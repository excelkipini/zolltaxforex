import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { 
  getMonthlyExpensesData, 
  getMonthlyTransactionsData, 
  getReportsStats 
} from "@/lib/reports-queries"

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    // Vérifier les permissions
    if (!["accounting", "director", "delegate"].includes(user.role)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "year"
    const type = searchParams.get("type") || "all"

    let responseData: any = {}

    if (type === "all" || type === "expenses") {
      const expensesData = await getMonthlyExpensesData(period)
      responseData.expenses = expensesData
    }

    if (type === "all" || type === "transactions") {
      const transactionsData = await getMonthlyTransactionsData(period)
      responseData.transactions = transactionsData
    }

    if (type === "all" || type === "stats") {
      const stats = await getReportsStats(period)
      responseData.stats = stats
    }

    return NextResponse.json({
      ok: true,
      data: responseData,
      period,
      user: {
        name: user.name,
        role: user.role
      }
    })

  } catch (error: any) {
    console.error("Erreur dans l'API reports:", error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
