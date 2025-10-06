import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { logCardsAction } from "@/lib/cards-history"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, super admins et comptables peuvent supprimer des cartes en masse
  const canDelete = user.role === "director" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canDelete) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cardIds } = body

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ ok: false, error: "IDs de cartes requis" }, { status: 400 })
    }

    // Récupérer les informations des cartes avant suppression
    const cardsToDelete = await sql`
      SELECT 
        id::text,
        cid,
        country,
        status,
        monthly_limit,
        monthly_used,
        recharge_limit,
        expiration_date,
        created_at::text as created_at
      FROM cards
      WHERE id = ANY(${cardIds}::uuid[])
    `

    if (cardsToDelete.length === 0) {
      return NextResponse.json({ ok: false, error: "Aucune carte trouvée" }, { status: 404 })
    }

    // Supprimer les cartes
    await sql`
      DELETE FROM cards
      WHERE id = ANY(${cardIds}::uuid[])
    `

    // Enregistrer l'action de suppression en masse
    await logCardsAction({
      user_id: user.id,
      user_name: user.name,
      user_role: user.role,
      action_type: 'bulk_delete',
      action_description: `Suppression en masse de ${cardsToDelete.length} cartes`,
      metadata: {
        deleted_count: cardsToDelete.length,
        deleted_cards: cardsToDelete.map(card => ({
          cid: card.cid,
          country: card.country,
          status: card.status,
          monthly_limit: card.monthly_limit,
          monthly_used: card.monthly_used
        })),
        deleted_at: new Date().toISOString()
      }
    })

    return NextResponse.json({ 
      ok: true, 
      data: {
        deleted_count: cardsToDelete.length,
        deleted_cards: cardsToDelete.map(card => ({
          id: card.id,
          cid: card.cid,
          country: card.country
        }))
      }
    })
  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression en masse:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
