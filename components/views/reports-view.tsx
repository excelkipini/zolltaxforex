"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Activity, Loader2 } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts"

interface SessionUser {
  id: string
  name: string
  role: string
  email: string
}

interface ReportsViewProps {
  user: SessionUser
}

// Types pour les données
interface ExpenseData {
  date: string
  amount: number
  category: string
  status: string
}

interface OperationData {
  date: string
  transactions: number
  total_amount: number
  type: string
}

interface ReportsStats {
  totalExpenses: number
  totalOperations: number
  totalTransactions: number
  expensesVariation: number
  operationsVariation: number
}

type StatusIndicator = {
  status: string
  count: number
  total_amount: number
}

type MonthlyStatusAmount = {
  date: string
  status: string
  amount: number
}

type MonthlyStatusOperation = {
  date: string
  status: string
  transactions: number
  total_amount: number
}

export function ReportsView({ user }: ReportsViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("year")
  const [expensesData, setExpensesData] = useState<ExpenseData[]>([])
  const [operationsData, setOperationsData] = useState<OperationData[]>([])
  const [expenseIndicators, setExpenseIndicators] = useState<StatusIndicator[]>([])
  const [operationIndicators, setOperationIndicators] = useState<StatusIndicator[]>([])
  const [expenseSeriesByStatus, setExpenseSeriesByStatus] = useState<MonthlyStatusAmount[]>([])
  const [operationSeriesByStatus, setOperationSeriesByStatus] = useState<MonthlyStatusOperation[]>([])

  // Préparer les données fusionnées par date pour les graphiques multi-séries
  const expenseStatuses = Array.from(new Set(expenseSeriesByStatus.map(s => s.status)))
  const operationStatuses = Array.from(new Set(operationSeriesByStatus.map(s => s.status)))

  const expenseChartData = (() => {
    const byDate: Record<string, any> = {}
    for (const row of expenseSeriesByStatus) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date }
      byDate[row.date][row.status] = row.amount
    }
    return Object.values(byDate).sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
  })()

  const operationChartData = (() => {
    const byDate: Record<string, any> = {}
    for (const row of operationSeriesByStatus) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date }
      byDate[row.date][row.status] = row.total_amount
    }
    return Object.values(byDate).sort((a: any, b: any) => (a.date < b.date ? -1 : 1))
  })()
  const [stats, setStats] = useState<ReportsStats>({
    totalExpenses: 0,
    totalOperations: 0,
    totalTransactions: 0,
    expensesVariation: 0,
    operationsVariation: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Charger les données
  const loadData = async (period: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/reports/data?period=${period}&type=all`)
      const result = await response.json()

      if (!result.ok) {
        throw new Error(result.error || "Erreur lors du chargement des données")
      }

      setExpensesData(result.data.expenses || [])
      setOperationsData(result.data.transactions || [])
      setExpenseIndicators(result.data.expenseIndicators || [])
      setOperationIndicators(result.data.operationIndicators || [])
      setExpenseSeriesByStatus(result.data.expenseSeriesByStatus || [])
      setOperationSeriesByStatus(result.data.operationSeriesByStatus || [])
      setStats(result.data.stats || {
        totalExpenses: 0,
        totalOperations: 0,
        totalTransactions: 0,
        expensesVariation: 0,
        operationsVariation: 0
      })
    } catch (err: any) {
      console.error("Erreur lors du chargement des données:", err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Charger les données au montage du composant
  useEffect(() => {
    loadData(selectedPeriod)
  }, [selectedPeriod])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR').format(num)
  }

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period)
  }

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/reports/data?period=${selectedPeriod}&type=all`)
      const result = await response.json()
      
      if (result.ok) {
        // Créer un fichier CSV avec les données
        const csvData = [
          ['Période', 'Type', 'Date', 'Montant', 'Transactions'],
          ...expensesData.map(item => [selectedPeriod, 'Dépenses', item.date, item.amount, '']),
          ...operationsData.map(item => [selectedPeriod, 'Opérations', item.date, item.total_amount, item.transactions])
        ]
        
        const csvContent = csvData.map(row => row.join(',')).join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rapports-${selectedPeriod}-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error("Erreur lors de l'export:", error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Chargement des données...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 mb-2">Erreur lors du chargement</div>
          <div className="text-sm text-gray-600">{error}</div>
          <Button onClick={() => loadData(selectedPeriod)} className="mt-4">
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            Financial analysis of expenses and operations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="quarter">This quarter</SelectItem>
              <SelectItem value="year">This year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Statistiques générales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalExpenses)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.expensesVariation >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.expensesVariation >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(stats.expensesVariation).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalOperations)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {stats.operationsVariation >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className={stats.operationsVariation >= 0 ? "text-green-500" : "text-red-500"}>
                {Math.abs(stats.operationsVariation).toFixed(1)}%
              </span>
              <span className="ml-1">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions Count</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalTransactions)}</div>
            <p className="text-xs text-muted-foreground">
              Average: {formatNumber(Math.round(stats.totalTransactions / Math.max(operationsData.length, 1)))} / month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Indicateurs par statut */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Indicateurs Opérations par statut</CardTitle>
          </CardHeader>
          <CardContent>
            {operationIndicators.length === 0 ? (
              <div className="text-sm text-gray-500">Aucune donnée</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {operationIndicators.map(ind => (
                  <div key={ind.status} className="p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 uppercase">{ind.status}</div>
                    <div className="text-lg font-semibold">{formatCurrency(ind.total_amount)}</div>
                    <div className="text-xs text-gray-600">{formatNumber(ind.count)} opérations</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicateurs Dépenses par statut</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseIndicators.length === 0 ? (
              <div className="text-sm text-gray-500">Aucune donnée</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {expenseIndicators.map(ind => (
                  <div key={ind.status} className="p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 uppercase">{ind.status}</div>
                    <div className="text-lg font-semibold">{formatCurrency(ind.total_amount)}</div>
                    <div className="text-xs text-gray-600">{formatNumber(ind.count)} dépenses</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique de variation des dépenses (multi-séries par statut) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-blue-600" />
              Expense Variation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {expenseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={expenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.split('-')[1]}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Montant']}
                      labelFormatter={(label) => `Mois: ${label}`}
                    />
                    <Legend />
                    {expenseStatuses.map((status, idx) => {
                      const colorPalette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4']
                      const color = colorPalette[idx % colorPalette.length]
                      return (
                        <Line
                          key={status}
                          type="monotone"
                          dataKey={status}
                          name={status}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                        />
                      )
                    })}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No expense data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Graphique de variation des opérations (empilé par statut) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-green-600" />
              Operation Variation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              {operationChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={operationChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => value.split('-')[1]}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Montant']}
                      labelFormatter={(label) => `Mois: ${label}`}
                    />
                    <Legend />
                    {operationStatuses.map((status, idx) => {
                      const colorPalette = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4']
                      const color = colorPalette[idx % colorPalette.length]
                      return (
                        <Bar
                          key={status}
                          stackId="byStatus"
                          dataKey={status}
                          name={status}
                          fill={color}
                          radius={[4,4,0,0]}
                        />
                      )
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No operation data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique combiné des transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2 text-purple-600" />
            Transactions per Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {operationsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={operationsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => value.split('-')[1]}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatNumber(value), 'Transactions']}
                    labelFormatter={(label) => `Mois: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="transactions" 
                    stroke="#8b5cf6" 
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No transaction data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}