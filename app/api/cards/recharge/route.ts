import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { recordRecharge, getCardById, validateRechargeLimits } from "@/lib/cards-queries"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, admins, comptables et caissiers peuvent recharger
  const canRecharge = user.role === "director" || user.role === "delegate" || user.role === "super_admin" || user.role === "accounting" || user.role === "cashier"
  
  if (!canRecharge) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cardId, amount, notes } = body

    if (!cardId || !amount) {
      return NextResponse.json({ 
        ok: false, 
        error: "ID de carte et montant requis" 
      }, { status: 400 })
    }

    const rechargeAmount = Number(amount)
    if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "Le montant doit être un nombre positif" 
      }, { status: 400 })
    }

    // Récupérer la carte pour validation
    const card = await getCardById(cardId)
    if (!card) {
      return NextResponse.json({ 
        ok: false, 
        error: "Carte non trouvée" 
      }, { status: 404 })
    }

    // Valider les limites de recharge
    const validation = await validateRechargeLimits(cardId, rechargeAmount)
    if (!validation.valid) {
      return NextResponse.json({ 
        ok: false, 
        error: validation.reason || "Limite de recharge dépassée" 
      }, { status: 400 })
    }

    // Enregistrer la recharge
    const recharge = await recordRecharge(
      cardId,
      rechargeAmount,
      user.name,
      notes,
      {
        id: user.id,
        name: user.name,
        role: user.role
      }
    )

    return NextResponse.json({ 
      ok: true, 
      message: "Recharge effectuée avec succès",
      recharge: recharge
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la recharge:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
