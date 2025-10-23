import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { getSettlementUnloadings } from "@/lib/cash-settlements-queries"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth()
    
    if (!hasPermission(user, "view_cash_settlements")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    const unloadings = await getSettlementUnloadings(params.id)
    
    return NextResponse.json({ unloadings })
  } catch (error: any) {
    console.error('Erreur GET cash-settlements/[id]/unloadings:', error)
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 })
  }
}
