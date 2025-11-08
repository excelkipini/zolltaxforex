import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { bulkCreateCardsFromExcel } from "@/lib/cards-queries"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, admins, comptables et caissiers peuvent importer des cartes
  const canImport = user.role === "director" || user.role === "delegate" || user.role === "super_admin" || user.role === "accounting" || user.role === "cashier"
  
  if (!canImport) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cards, country = 'Mali' } = body

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return NextResponse.json({ ok: false, error: "Données de cartes requises" }, { status: 400 })
    }

    // Valider le format des données
    const validatedCards = cards.map((card: any) => {
      if (!card.cid) {
        throw new Error("CID requis pour chaque carte")
      }
      return {
        cid: String(card.cid),
        country: card.country || country, // Utiliser le pays spécifié ou celui par défaut
        last_recharge_date: card.last_recharge_date ? String(card.last_recharge_date) : undefined,
        expiration_date: card.expiration_date ? String(card.expiration_date) : undefined,
      }
    })

    const result = await bulkCreateCardsFromExcel(validatedCards, {
      id: user.id,
      name: user.name,
      role: user.role
    })
    
    return NextResponse.json({ 
      ok: true, 
      data: {
        created: result.created.length,
        skipped: result.skipped.length,
        total: result.total,
        cards: result.created,
        skipped_cards: result.skipped,
        imported_by: user.name,
        imported_at: new Date().toISOString()
      }
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
