import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { 
  listCards, 
  createCard, 
  updateCard, 
  deleteCard, 
  distributeAmount,
  bulkCreateCardsFromExcel,
  getAvailableCardsForDistribution,
  getAvailableCardsForBulkDistribution,
  getDistributionStats,
  getRechargeHistory,
  recordRecharge,
  validateRechargeLimits,
  updateCountryLimits,
  getCountryStats,
  getAvailableCountries,
  Country
} from "@/lib/cards-queries"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, admins, comptables et caissiers peuvent voir les cartes
  const canView = user.role === "director" || user.role === "super_admin" || user.role === "accounting" || user.role === "cashier"
  
  if (!canView) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const country = searchParams.get('country') as Country | null

    switch (action) {
      case 'countries':
        const countries = getAvailableCountries()
        return NextResponse.json({ ok: true, countries })

      case 'stats':
        const stats = await getCountryStats(country || undefined)
        return NextResponse.json({ ok: true, stats })

      case 'recharge-history':
        const cardId = searchParams.get('cardId')
        const history = await getRechargeHistory(cardId || undefined, country || undefined)
        return NextResponse.json({ ok: true, history })

      case 'available':
        const availableCardsForDistribution = await getAvailableCardsForBulkDistribution(country as "Mali" | "RDC" | "France" | "Congo" | undefined)
        return NextResponse.json({ ok: true, cards: availableCardsForDistribution })

      default:
        // Par défaut, retourner les cartes avec filtrage par pays
        const cards = await listCards(country || undefined)
        const availableCardsForStats = await getAvailableCardsForDistribution()
        const distributionStats = await getDistributionStats()
        
        const activeCards = cards.filter(c => c.status === 'active')
        
        return NextResponse.json({ 
          ok: true, 
          data: { 
            cards, 
            availableCards,
            totalCards: cards.length,
            activeCards: activeCards.length,
            totalMonthlyLimit: activeCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0),
            totalMonthlyUsed: activeCards.reduce((sum, c) => sum + Number(c.monthly_used), 0),
            distributionStats
          } 
        })
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, admins, comptables et caissiers peuvent créer des cartes
  const canCreate = user.role === "director" || user.role === "super_admin" || user.role === "accounting" || user.role === "cashier"
  
  if (!canCreate) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { action, cid, country, last_recharge_date, expiration_date, status = "active", monthly_limit, recharge_limit, cardId, amount, notes } = body

    switch (action) {
      case 'recharge':
        if (!cardId || !amount) {
          return NextResponse.json({ ok: false, error: "ID de carte et montant requis" }, { status: 400 })
        }

        // Valider les limites de recharge
        const validation = await validateRechargeLimits(cardId, amount)
        if (!validation.valid) {
          return NextResponse.json({ ok: false, error: validation.reason }, { status: 400 })
        }

        // Enregistrer la recharge
        const recharge = await recordRecharge(cardId, amount, user.name, notes, {
          id: user.id,
          name: user.name,
          role: user.role
        })

        // Mettre à jour le montant utilisé de la carte
        await updateCard({
          id: cardId,
          monthly_used: undefined // Cette logique sera implémentée dans updateCard
        })

        return NextResponse.json({ ok: true, data: recharge })

      case 'update-limits':
        if (!country || !monthly_limit || !recharge_limit) {
          return NextResponse.json({ ok: false, error: "Pays et limites requis" }, { status: 400 })
        }

        await updateCountryLimits(country, monthly_limit, recharge_limit, {
          id: user.id,
          name: user.name,
          role: user.role
        })
        return NextResponse.json({ ok: true, message: "Limites mises à jour avec succès" })

      default:
        // Création de carte par défaut
        if (!cid || !country) {
          return NextResponse.json({ ok: false, error: "CID et pays requis" }, { status: 400 })
        }

        const card = await createCard({
          cid,
          country,
          last_recharge_date,
          expiration_date,
          status,
          monthly_limit,
          recharge_limit,
          created_by: {
            id: user.id,
            name: user.name,
            role: user.role
          }
        })

        return NextResponse.json({ ok: true, data: card })
    }
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, admins, comptables et caissiers peuvent modifier des cartes
  const canModify = user.role === "director" || user.role === "super_admin" || user.role === "accounting" || user.role === "cashier"
  
  if (!canModify) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, cid, country, last_recharge_date, expiration_date, status, monthly_limit, recharge_limit } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID carte requis" }, { status: 400 })
    }

    const updateData: any = {}
    if (cid !== undefined) updateData.cid = String(cid)
    if (country !== undefined) updateData.country = String(country)
    if (last_recharge_date !== undefined) updateData.last_recharge_date = String(last_recharge_date)
    if (expiration_date !== undefined) updateData.expiration_date = String(expiration_date)
    if (status !== undefined) updateData.status = String(status)
    if (monthly_limit !== undefined) updateData.monthly_limit = Number(monthly_limit)
    if (recharge_limit !== undefined) updateData.recharge_limit = Number(recharge_limit)

    const updatedCard = await updateCard({ 
      id: String(id), 
      ...updateData,
      updated_by: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    })
    return NextResponse.json({ ok: true, data: updatedCard })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  console.log('🔍 API DELETE appelée')
  try {
    const { user } = await requireAuth()
    console.log('👤 Utilisateur authentifié:', user.name, user.role)
    
    // Les directeurs, super admins et comptables peuvent supprimer des cartes
    const canDelete = user.role === "director" || user.role === "super_admin" || user.role === "accounting"
    
    if (!canDelete) {
      console.log('❌ Utilisateur non autorisé pour la suppression')
      return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    console.log('🆔 ID de carte à supprimer:', id)

    if (!id) {
      console.log('❌ ID carte manquant')
      return NextResponse.json({ ok: false, error: "ID carte requis" }, { status: 400 })
    }

    console.log('📝 Appel de deleteCard avec:', { id, user: { id: user.id, name: user.name, role: user.role } })
    await deleteCard(String(id), {
      id: user.id,
      name: user.name,
      role: user.role
    })
    console.log('✅ deleteCard terminée avec succès')
    return NextResponse.json({ ok: true, message: "Carte supprimée avec succès" })
  } catch (error: any) {
    console.error('❌ Erreur dans API DELETE:', error)
    console.error('❌ Stack trace:', error.stack)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}