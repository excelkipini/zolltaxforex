"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Download, TrendingUp, TrendingDown, DollarSign, Activity, Loader2, FileText, FileSpreadsheet, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { PageLoader } from "@/components/ui/page-loader"
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
  const { toast } = useToast()
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

  const translateStatus = (status: string) => {
    const translations: { [key: string]: string } = {
      'pending': 'En attente',
      'accounting_approved': 'Approuvée (Compta)',
      'accounting_rejected': 'Rejetée (Compta)',
      'director_approved': 'Approuvée par le directeur',
      'director_rejected': 'Rejetée par le directeur',
      'validated': 'Validée',
      'completed': 'Terminée',
      'executed': 'Exécutée',
      'pending_delete': 'Suppression en attente',
      'rejected': 'Rejetée',
    };
    return translations[status] || status;
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

  const handleExportPdf = () => {
    const periodLabels: Record<string, string> = { week: "Cette semaine", month: "Ce mois", quarter: "Ce trimestre", year: "Cette année" }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Rapports</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #2563eb;margin-bottom:10px}.header h1{font-size:18px;color:#1e3a5f;font-weight:700}.header .subtitle{font-size:11px;color:#64748b;margin-top:2px}.header .meta{text-align:right;font-size:10px;color:#64748b}
.summary{display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap}.summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;min-width:160px}.summary-card .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}.summary-card .value{font-size:16px;font-weight:700;color:#1e293b;margin-top:2px}
.section{margin-bottom:16px}.section h2{font-size:13px;font-weight:700;color:#1e3a5f;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0}
table{width:100%;border-collapse:collapse;margin-bottom:10px}thead th{background:#1e3a5f;color:#fff;padding:7px 8px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}thead th:first-child{border-radius:4px 0 0 0}thead th:last-child{border-radius:0 4px 0 0}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:6px 8px;font-size:10px;vertical-align:middle}.amount{font-weight:600;text-align:right;white-space:nowrap}
.footer{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>ZOLL TAX FOREX</h1><div class="subtitle">Rapport Financier — ${periodLabels[selectedPeriod] || selectedPeriod}</div></div><div class="meta">Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}<br/>Par : ${user.name}</div></div>
<div class="summary">
<div class="summary-card"><div class="label">Total Dépenses</div><div class="value">${formatCurrency(stats.totalExpenses)}</div></div>
<div class="summary-card"><div class="label">Total Opérations</div><div class="value">${formatCurrency(stats.totalOperations)}</div></div>
<div class="summary-card"><div class="label">Transactions</div><div class="value">${formatNumber(stats.totalTransactions)}</div></div>
</div>
${expensesData.length > 0 ? `<div class="section"><h2>Dépenses par période</h2><table><thead><tr><th>Date</th><th>Montant</th><th>Catégorie</th><th>Statut</th></tr></thead><tbody>${expensesData.map(d => `<tr><td>${d.date}</td><td class="amount">${Number(d.amount).toLocaleString("fr-FR")} XAF</td><td>${d.category||"-"}</td><td>${d.status||"-"}</td></tr>`).join("")}</tbody></table></div>` : ""}
${operationsData.length > 0 ? `<div class="section"><h2>Opérations par période</h2><table><thead><tr><th>Date</th><th>Transactions</th><th>Montant total</th></tr></thead><tbody>${operationsData.map(d => `<tr><td>${d.date}</td><td>${d.transactions}</td><td class="amount">${Number(d.total_amount).toLocaleString("fr-FR")} XAF</td></tr>`).join("")}</tbody></table></div>` : ""}
<div class="footer"><span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span><span>Période : ${periodLabels[selectedPeriod] || selectedPeriod}</span></div>
</body></html>`
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
    toast({ title: "Export PDF prêt", description: "Rapport prêt à imprimer en PDF" })
  }

  if (loading) {
    return <PageLoader message="Chargement des données..." overlay={false} className="min-h-[320px]" />
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
          <h1 className="text-3xl font-bold text-gray-900">Rapports</h1>
          <p className="text-gray-600 mt-1">
            Analyse des dépenses et opérations financières
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="quarter">Ce trimestre</SelectItem>
              <SelectItem value="year">Cette année</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exporter
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExport} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Exporter en CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                Exporter en PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Statistiques générales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dépenses</CardTitle>
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
              <span className="ml-1">vs période précédente</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Opérations</CardTitle>
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
              <span className="ml-1">vs période précédente</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nombre de Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(stats.totalTransactions)}</div>
            <p className="text-xs text-muted-foreground">
              Moyenne: {formatNumber(Math.round(stats.totalTransactions / Math.max(operationsData.length, 1)))} / mois
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
                    <div className="text-xs text-gray-500 uppercase">{translateStatus(ind.status)}</div>
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
                    <div className="text-xs text-gray-500 uppercase">{translateStatus(ind.status)}</div>
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
              Variation des Dépenses
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
                      formatter={(value: number, name: string) => [formatCurrency(value), translateStatus(name)]}
                      labelFormatter={(label) => `Mois: ${label}`}
                    />
                    <Legend formatter={(value) => translateStatus(value)} />
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
                  Aucune donnée de dépenses disponible
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
              Variation des Opérations
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
                      formatter={(value: number, name: string) => [formatCurrency(value), translateStatus(name)]}
                      labelFormatter={(label) => `Mois: ${label}`}
                    />
                    <Legend formatter={(value) => translateStatus(value)} />
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
                  Aucune donnée d'opérations disponible
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
            Nombre de Transactions par Mois
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
                Aucune donnée de transactions disponible
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}