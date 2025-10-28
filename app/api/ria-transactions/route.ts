import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { getRiaTransactions } from "@/lib/ria-transactions-queries"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  
  if (!hasPermission(user, "view_ria_transactions")) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const filters = {
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      guichetier: searchParams.get('guichetier') || undefined,
      agence: searchParams.get('agence') || undefined,
      action: searchParams.get('action') || undefined,
      paysDestination: searchParams.get('paysDestination') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined
    }

    const transactions = await getRiaTransactions(filters)

    return NextResponse.json({
      ok: true,
      data: {
        transactions,
        count: transactions.length,
        filters
      }
    })

  } catch (error: any) {
    console.error("Erreur lors de la récupération des transactions RIA:", error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
