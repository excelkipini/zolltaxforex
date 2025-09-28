import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { distributeAmount } from "@/lib/cards-queries"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, admins et comptables peuvent distribuer des montants
  const canDistribute = user.role === "director" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canDistribute) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { amount, maxCards = 10 } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ ok: false, error: "Montant requis et doit être positif" }, { status: 400 })
    }

    if (maxCards < 1 || maxCards > 50) {
      return NextResponse.json({ ok: false, error: "Nombre de cartes doit être entre 1 et 50" }, { status: 400 })
    }

    const result = await distributeAmount(Number(amount), Number(maxCards))
    
    return NextResponse.json({ 
      ok: true, 
      data: {
        ...result,
        distributed_by: user.name,
        distributed_at: new Date().toISOString()
      }
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
