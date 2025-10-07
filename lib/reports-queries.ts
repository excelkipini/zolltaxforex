import "server-only"
import { sql } from "./db"

// Types pour les données de rapports
export interface ExpenseReportData {
  date: string
  amount: number
  category: string
  status: string
}

export interface TransactionReportData {
  date: string
  transactions: number
  total_amount: number
  type: string
}

export interface ReportsStats {
  totalExpenses: number
  totalOperations: number
  totalTransactions: number
  expensesVariation: number
  operationsVariation: number
}
export interface StatusIndicator {
  status: string
  count: number
  total_amount: number
}

export interface MonthlyStatusAmount {
  date: string
  status: string
  amount: number
}

export interface MonthlyStatusOperation {
  date: string
  status: string
  transactions: number
  total_amount: number
}

// Fonction pour récupérer les données de dépenses agrégées par mois
export async function getExpensesReportData(period: string = "year"): Promise<ExpenseReportData[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<ExpenseReportData[]>`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as date,
        SUM(amount)::bigint as amount,
        category,
        status
      FROM expenses 
      WHERE status IN ('director_approved', 'accounting_approved')
      ${sql.unsafe(dateCondition)}
      GROUP BY TO_CHAR(date, 'YYYY-MM'), category, status
      ORDER BY date ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors de la récupération des données de dépenses:", error)
    return []
  }
}
// Indicateurs par statut pour les dépenses
export async function getExpenseStatusIndicators(period: string = "year"): Promise<StatusIndicator[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<StatusIndicator[]>`
      SELECT 
        status,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0)::bigint as total_amount
      FROM expenses
      WHERE TRUE
      ${sql.unsafe(dateCondition)}
      GROUP BY status
      ORDER BY status ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors de la récupération des indicateurs de dépenses:", error)
    return []
  }
}

// Fonction pour récupérer les données de transactions agrégées par mois
export async function getTransactionsReportData(period: string = "year"): Promise<TransactionReportData[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<TransactionReportData[]>`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as date,
        COUNT(*) as transactions,
        SUM(amount)::bigint as total_amount,
        type
      FROM transactions 
      WHERE status IN ('executed', 'completed')
      ${sql.unsafe(dateCondition)}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), type
      ORDER BY date ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors de la récupération des données de transactions:", error)
    return []
  }
}
// Indicateurs par statut pour les opérations (transactions)
export async function getOperationStatusIndicators(period: string = "year"): Promise<StatusIndicator[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<StatusIndicator[]>`
      SELECT 
        status,
        COUNT(*)::int as count,
        COALESCE(SUM(amount), 0)::bigint as total_amount
      FROM transactions
      WHERE TRUE
      ${sql.unsafe(dateCondition)}
      GROUP BY status
      ORDER BY status ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors de la récupération des indicateurs d'opérations:", error)
    return []
  }
}

// Fonction pour récupérer les statistiques générales
export async function getReportsStats(period: string = "year"): Promise<ReportsStats> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    // Récupérer les données de dépenses
    const expensesResult = await sql<{total: number}>`
      SELECT SUM(amount)::bigint as total
      FROM expenses 
      WHERE status IN ('director_approved', 'accounting_approved')
      ${sql.unsafe(dateCondition)}
    `

    // Récupérer les données de transactions
    const transactionsResult = await sql<{total_amount: number, total_count: number}>`
      SELECT 
        SUM(amount)::bigint as total_amount,
        COUNT(*) as total_count
      FROM transactions 
      WHERE status IN ('executed', 'completed')
      ${sql.unsafe(dateCondition.replace('date', 'created_at'))}
    `

    // Récupérer les données du mois précédent pour calculer les variations
    const previousPeriodCondition = dateCondition.replace('CURRENT_DATE', 'CURRENT_DATE - INTERVAL \'1 month\'')
    
    const previousExpensesResult = await sql<{total: number}>`
      SELECT SUM(amount)::bigint as total
      FROM expenses 
      WHERE status IN ('director_approved', 'accounting_approved')
      ${sql.unsafe(previousPeriodCondition)}
    `

    const previousTransactionsResult = await sql<{total_amount: number}>`
      SELECT SUM(amount)::bigint as total_amount
      FROM transactions 
      WHERE status IN ('executed', 'completed')
      ${sql.unsafe(previousPeriodCondition.replace('date', 'created_at'))}
    `

    const totalExpenses = expensesResult[0]?.total || 0
    const totalOperations = transactionsResult[0]?.total_amount || 0
    const totalTransactions = transactionsResult[0]?.total_count || 0

    const previousExpenses = previousExpensesResult[0]?.total || 0
    const previousOperations = previousTransactionsResult[0]?.total_amount || 0

    const expensesVariation = previousExpenses > 0 
      ? ((totalExpenses - previousExpenses) / previousExpenses) * 100 
      : 0

    const operationsVariation = previousOperations > 0 
      ? ((totalOperations - previousOperations) / previousOperations) * 100 
      : 0

    return {
      totalExpenses,
      totalOperations,
      totalTransactions,
      expensesVariation,
      operationsVariation
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error)
    return {
      totalExpenses: 0,
      totalOperations: 0,
      totalTransactions: 0,
      expensesVariation: 0,
      operationsVariation: 0
    }
  }
}

// Fonction pour récupérer les données agrégées par mois (pour les graphiques)
export async function getMonthlyExpensesData(period: string = "year"): Promise<ExpenseReportData[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<ExpenseReportData[]>`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as date,
        SUM(amount)::bigint as amount,
        'Toutes' as category,
        'approved' as status
      FROM expenses 
      WHERE status IN ('director_approved', 'accounting_approved')
      ${sql.unsafe(dateCondition)}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY date ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors de la récupération des données mensuelles de dépenses:", error)
    return []
  }
}

export async function getMonthlyTransactionsData(period: string = "year"): Promise<TransactionReportData[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<TransactionReportData[]>`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as date,
        COUNT(*) as transactions,
        SUM(amount)::bigint as total_amount,
        'transfer' as type
      FROM transactions 
      WHERE status IN ('executed', 'completed')
      ${sql.unsafe(dateCondition)}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY date ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors de la récupération des données mensuelles de transactions:", error)
    return []
  }
}

// Séries mensuelles par statut – Dépenses
export async function getMonthlyExpenseStatusSeries(period: string = "year"): Promise<MonthlyStatusAmount[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND date >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<MonthlyStatusAmount[]>`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as date,
        status,
        SUM(amount)::bigint as amount
      FROM expenses 
      WHERE TRUE
      ${sql.unsafe(dateCondition)}
      GROUP BY TO_CHAR(date, 'YYYY-MM'), status
      ORDER BY date ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors des séries mensuelles par statut (dépenses):", error)
    return []
  }
}

// Séries mensuelles par statut – Opérations
export async function getMonthlyOperationStatusSeries(period: string = "year"): Promise<MonthlyStatusOperation[]> {
  try {
    let dateCondition = ""
    switch (period) {
      case "week":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '7 days'"
        break
      case "month":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 month'"
        break
      case "quarter":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '3 months'"
        break
      case "year":
        dateCondition = "AND created_at >= CURRENT_DATE - INTERVAL '1 year'"
        break
    }

    const rows = await sql<MonthlyStatusOperation[]>`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as date,
        status,
        COUNT(*) as transactions,
        SUM(amount)::bigint as total_amount
      FROM transactions 
      WHERE TRUE
      ${sql.unsafe(dateCondition)}
      GROUP BY TO_CHAR(created_at, 'YYYY-MM'), status
      ORDER BY date ASC
    `

    return rows
  } catch (error) {
    console.error("Erreur lors des séries mensuelles par statut (opérations):", error)
    return []
  }
}
