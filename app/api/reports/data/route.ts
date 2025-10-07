import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { 
  getMonthlyExpensesData, 
  getMonthlyTransactionsData, 
  getReportsStats,
  getOperationStatusIndicators,
  getExpenseStatusIndicators,
  getMonthlyExpenseStatusSeries,
  getMonthlyOperationStatusSeries
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
      const expenseIndicators = await getExpenseStatusIndicators(period)
      responseData.expenseIndicators = expenseIndicators
      const expenseSeriesByStatus = await getMonthlyExpenseStatusSeries(period)
      responseData.expenseSeriesByStatus = expenseSeriesByStatus
    }

    if (type === "all" || type === "transactions") {
      const transactionsData = await getMonthlyTransactionsData(period)
      responseData.transactions = transactionsData
      const operationIndicators = await getOperationStatusIndicators(period)
      responseData.operationIndicators = operationIndicators
      const operationSeriesByStatus = await getMonthlyOperationStatusSeries(period)
      responseData.operationSeriesByStatus = operationSeriesByStatus
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
