import { NextRequest, NextResponse } from "next/server"
import { requireAuth, hasPermission } from "@/lib/auth"
import { sql } from "@/lib/db"
import {
  createCashDeclaration,
  submitCashDeclaration,
  validateCashDeclaration,
  rejectCashDeclaration,
  getCashDeclarationById,
  getCashDeclarationsByUser,
  getPendingCashDeclarations,
  getAllCashDeclarations,
  getCashDeclarationsStats,
} from "@/lib/ria-cash-declarations-queries"
import {
  sendCashDeclarationSubmittedEmail,
  sendCashDeclarationValidatedEmail,
  sendCashDeclarationActionEmail,
} from "@/lib/email-service"
import { ROLE_PERMISSIONS } from "@/lib/rbac"

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic'

/**
 * GET /api/ria-cash-declarations
 * Récupérer les arrêtés de caisse selon le rôle de l'utilisateur
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 API GET /api/ria-cash-declarations appelée')
    
    // Authentification requise
    let user
    try {
      const session = await requireAuth()
      user = session.user
      console.log('✅ Utilisateur authentifié:', user)
    } catch (authError) {
      console.log('❌ Erreur d\'authentification:', authError)
      return NextResponse.json(
        { error: "Authentification requise" },
        { status: 401 }
      )
    }
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') // 'all', 'pending', 'user', 'stats', 'cashiers-with-excedents'
    
    // Vérifier les permissions - étendre l'accès pour certains types
    const baseAllowed = ['cashier', 'cash_manager']
    const extendedAllowed = ['cashier', 'cash_manager', 'director', 'delegate', 'accounting']
    // Pour les types 'all', 'pending', 'stats', permettre aussi director et accounting
    const managerAllowed = ['cash_manager', 'director', 'delegate', 'accounting']
    const allowedRoles = (type === 'cashiers-with-excedents' || type === 'all' || type === 'pending' || type === 'stats') 
      ? extendedAllowed 
      : baseAllowed
    if (!allowedRoles.includes(user.role)) {
      console.log('❌ Accès refusé pour le rôle:', user.role, 'type:', type)
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }
    const id = searchParams.get('id')
    const userId = searchParams.get('userId')

    // Récupérer un arrêté spécifique
    if (id) {
      const declaration = await getCashDeclarationById(id)
      if (!declaration) {
        return NextResponse.json({ error: "Arrêté non trouvé" }, { status: 404 })
      }
      return NextResponse.json({ data: declaration })
    }

    // Statistiques (pour le Responsable caisses ou caissier)
    if (type === 'stats') {
      try {
        console.log('📊 Récupération des statistiques pour user:', user.id, 'role:', user.role)
        // Si le rôle est cashier, on filtre par user_id, sinon on récupère toutes les stats
        const userId = user.role === 'cashier' ? user.id : undefined
        console.log('📊 userId pour stats:', userId)
        const stats = await getCashDeclarationsStats(userId)
        console.log('📊 Stats récupérées:', stats)
        return NextResponse.json({ data: stats })
      } catch (error) {
        console.error('❌ Erreur lors de la récupération des stats:', error)
        return NextResponse.json({ error: "Erreur lors de la récupération des statistiques" }, { status: 500 })
      }
    }

    // Liste des caissiers avec excédents disponibles (> 0) après déductions approuvées
    if (type === 'cashiers-with-excedents') {
      try {
        console.log('📥 API cashiers-with-excedents appelée')
        // S'assurer que les colonnes nécessaires existent (idempotent)
        await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deduct_from_excedents BOOLEAN NOT NULL DEFAULT false`
        await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS deducted_cashier_id UUID`

        // Comptabiliser excédents déclarés par caissier - dépenses approuvées déduites des excédents
        const rows = await sql`
          WITH declared AS (
            SELECT user_id, COALESCE(SUM(COALESCE(excedents,0)),0) AS total_declared
            FROM ria_cash_declarations
            GROUP BY user_id
          ),
          deducted AS (
            SELECT deducted_cashier_id AS user_id,
                   COALESCE(SUM(amount),0) AS total_deducted
            FROM expenses
            WHERE deduct_from_excedents = true
              AND deducted_cashier_id IS NOT NULL
              AND status IN ('accounting_approved','director_approved')
            GROUP BY deducted_cashier_id
          )
          SELECT u.id::text AS id,
                 u.name AS name,
                 (COALESCE(d.total_declared,0) - COALESCE(x.total_deducted,0))::bigint AS available_excedents
          FROM declared d
          JOIN users u ON u.id = d.user_id AND u.role = 'cashier'
          LEFT JOIN deducted x ON x.user_id = d.user_id
          WHERE (COALESCE(d.total_declared,0) - COALESCE(x.total_deducted,0)) > 0
          ORDER BY u.name
        `
        console.log('📊 Caissiers avec excédents:', rows)
        return NextResponse.json({ data: rows })
      } catch (err) {
        console.error('❌ Erreur cashiers-with-excedents:', err)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
      }
    }

    // Tous les arrêtés en attente (pour le Responsable caisses)
    if (type === 'pending') {
      const declarations = await getPendingCashDeclarations()
      return NextResponse.json({ data: declarations })
    }

    // Tous les arrêtés (pour le Responsable caisses)
    if (type === 'all') {
      const declarations = await getAllCashDeclarations()
      return NextResponse.json({ data: declarations })
    }

    // Arrêtés d'un utilisateur spécifique
    if (userId) {
      const declarations = await getCashDeclarationsByUser(userId)
      return NextResponse.json({ data: declarations })
    }

    // Par défaut, arrêtés de l'utilisateur connecté
    const declarations = await getCashDeclarationsByUser(user.id)
    return NextResponse.json({ data: declarations })

  } catch (error) {
    console.error("Erreur GET /api/ria-cash-declarations:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/ria-cash-declarations
 * Créer un nouvel arrêté de caisse
 */
export async function POST(request: NextRequest) {
  try {
    let session
    try {
      session = await requireAuth()
      const user = session.user
    } catch (authError) {
      console.error('Erreur d\'authentification:', authError)
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      )
    }

    // Seuls les caissiers et cash_manager peuvent créer des arrêtés
    const user = session.user
    if (!['cashier', 'cash_manager'].includes(user.role)) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { guichetier, declaration_date, montant_brut, total_delestage, excedents, delestage_comment, justificatif_files } = body

    // Validation
    if (!guichetier || !declaration_date || !montant_brut) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      )
    }

    const declaration = await createCashDeclaration({
      user_id: user.id,
      guichetier,
      declaration_date,
      montant_brut,
      total_delestage: total_delestage || 0,
      excedents: excedents || 0,
      delestage_comment: delestage_comment || undefined,
      justificatif_files: justificatif_files || [],
      autoSubmit: true, // Soumettre automatiquement
    })
    
    console.log('📦 Arrêté créé avec auto-submit:', declaration.id, 'status:', declaration.status)
    
    // Si l'arrêté a été créé en statut 'submitted', envoyer immédiatement l'email
    if (declaration.status === 'submitted') {
      try {
        // Récupérer tous les responsables caisses, directeurs et comptables
        const managers = await sql`
          SELECT email, name, role FROM users 
          WHERE role IN ('cash_manager', 'director', 'delegate', 'accounting')
        `
        console.log(`📧 Envoi email à ${managers.length} destinataires`)
        
        for (const manager of managers) {
          if (manager.email) {
            const emailResult = await sendCashDeclarationSubmittedEmail(
              manager.email,
              user.name || user.email,
              {
                guichetier: declaration.guichetier,
                declaration_date: declaration.declaration_date,
                montant_brut: declaration.montant_brut,
                total_delestage: declaration.total_delestage,
                delestage_comment: declaration.delestage_comment,
              }
            )
            if (emailResult.success) {
              console.log(`✅ Email envoyé à ${manager.email} (${manager.role})`)
            } else {
              console.error(`❌ Échec envoi email à ${manager.email}:`, emailResult.error)
            }
          }
        }
      } catch (emailError) {
        console.error("❌ Erreur lors de l'envoi de l'email (création):", emailError)
      }
    }

    return NextResponse.json({ data: declaration })

  } catch (error) {
    console.error("Erreur POST /api/ria-cash-declarations:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/ria-cash-declarations
 * Mettre à jour un arrêté de caisse
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await requireAuth()
    const user = session.user

    const body = await request.json()
    const { id, action, data } = body

    if (!id || !action) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      )
    }

    // Récupérer l'arrêté existant
    const declaration = await getCashDeclarationById(id)
    if (!declaration) {
      return NextResponse.json(
        { error: "Arrêté non trouvé" },
        { status: 404 }
      )
    }

    let result

    switch (action) {
      case 'submit':
        // Seul le créateur peut soumettre
        console.log('🔍 Vérification des permissions de soumission...')
        console.log('🔍 Declaration user_id:', declaration.user_id)
        console.log('🔍 Current user id:', user.id)
        console.log('🔍 Match:', declaration.user_id === user.id)
        
        if (declaration.user_id !== user.id) {
          console.error('❌ Accès non autorisé: user_id ne correspond pas')
          return NextResponse.json(
            { error: "Accès non autorisé" },
            { status: 403 }
          )
        }
        
        console.log('✅ Permissions validées, soumission de l\'arrêté...')
        result = await submitCashDeclaration(id)
        console.log('✅ Arrêté soumis avec succès:', result.id)
        console.log('📧 Résultat soumission:', JSON.stringify(result, null, 2))
        
        // Envoyer notification email aux responsables, directeurs et comptables
        try {
          const managers = await sql`
            SELECT email, name, role FROM users 
            WHERE role IN ('cash_manager', 'director', 'delegate', 'accounting')
          `
          console.log(`📧 Envoi email à ${managers.length} destinataires`)
          
          for (const manager of managers) {
            if (manager.email) {
              const emailResult = await sendCashDeclarationSubmittedEmail(
                manager.email,
                user.name || user.email,
                {
                  guichetier: result.guichetier,
                  declaration_date: result.declaration_date,
                  montant_brut: result.montant_brut,
                  total_delestage: result.total_delestage,
                  delestage_comment: result.delestage_comment,
                }
              )
              if (emailResult.success) {
                console.log(`✅ Email envoyé à ${manager.email} (${manager.role})`)
              } else {
                console.error(`❌ Échec envoi email à ${manager.email}:`, emailResult.error)
              }
            }
          }
        } catch (emailError) {
          console.error("❌ Erreur lors de l'envoi de l'email:", emailError)
        }
        break

      case 'validate':
        // Le Responsable caisses, le Directeur et le Comptable peuvent valider
        if (!['cash_manager', 'director', 'delegate', 'accounting'].includes(user.role)) {
          return NextResponse.json(
            { error: "Accès non autorisé" },
            { status: 403 }
          )
        }
        result = await validateCashDeclaration(id, user.id, data?.comment)
        
        // Envoyer notification email au caissier
        try {
          const caissier = await sql`
            SELECT email, name FROM users WHERE id = ${result.user_id}
          `
          if (caissier[0]?.email) {
            await sendCashDeclarationValidatedEmail(
              caissier[0].email,
              user.name || user.email,
              {
                guichetier: result.guichetier,
                declaration_date: result.declaration_date,
                montant_brut: result.montant_brut,
                total_delestage: result.total_delestage,
                validation_comment: result.validation_comment,
              }
            )
          }
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email:", emailError)
        }
        break

      case 'reject':
        // Le Responsable caisses, le Directeur et le Comptable peuvent rejeter
        if (!['cash_manager', 'director', 'delegate', 'accounting'].includes(user.role)) {
          return NextResponse.json(
            { error: "Accès non autorisé" },
            { status: 403 }
          )
        }
        if (!data?.comment) {
          return NextResponse.json(
            { error: "Commentaire de rejet requis" },
            { status: 400 }
          )
        }
        result = await rejectCashDeclaration(id, user.id, data.comment)
        
        // Envoyer notification email au caissier
        try {
          const caissier = await sql`
            SELECT email, name FROM users WHERE id = ${result.user_id}
          `
          if (caissier[0]?.email) {
            await sendCashDeclarationActionEmail(
              caissier[0].email,
              user.name || user.email,
              'rejected',
              {
                guichetier: result.guichetier,
                declaration_date: result.declaration_date,
                montant_brut: result.montant_brut,
                total_delestage: result.total_delestage,
                comment: data.comment,
              }
            )
          }
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email:", emailError)
        }
        break


      default:
        return NextResponse.json(
          { error: "Action non valide" },
          { status: 400 }
        )
    }

    return NextResponse.json({ data: result })

  } catch (error) {
    console.error("Erreur PUT /api/ria-cash-declarations:", error)
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    )
  }
}

