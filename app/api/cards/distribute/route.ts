import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { distributeAmountToSpecificCards } from "@/lib/cards-queries"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, admins, comptables et caissiers peuvent distribuer
  const canDistribute = user.role === "director" || user.role === "super_admin" || user.role === "accounting" || user.role === "cashier"
  
  if (!canDistribute) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { amount, country, cardIds } = body

    if (!amount || !country || !cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "Montant, pays et cartes sélectionnées requis" 
      }, { status: 400 })
    }

    const result = await distributeAmountToSpecificCards({
      amount: Number(amount),
      country: country,
      cardIds: cardIds,
      distributedBy: user.name,
      distributedByUser: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    })

    return NextResponse.json({ 
      ok: true, 
      message: "Distribution réussie",
      data: result
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la distribution:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}