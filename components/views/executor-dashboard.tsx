"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Upload,
  Play,
  FileText,
  User,
  FileUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  RotateCcw,
  Calendar as CalendarIcon,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Label } from "@/components/ui/label"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

const TRANSFER_MODES = [
  { id: "Western Union", label: "Western Union", logo: "/logos/western-union.svg" },
  { id: "Ria Money Transfer", label: "RIA", logo: "/logos/ria.svg" },
  { id: "MoneyGram", label: "MoneyGram", logo: "/logos/moneygram.svg" },
  { id: "Autre", label: "Autre" },
] as const

interface Transaction {
  id: string
  type: string
  status: string
  description: string
  amount: number
  currency: string
  created_by: string
  agency: string
  details?: any
  real_amount_eur?: number
  commission_amount?: number
  executor_id?: string
  executed_at?: string
  receipt_url?: string
  executor_comment?: string
  rejection_reason?: string
  created_at: string
  updated_at: string
}

interface ExecutorDashboardProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    agency: string
  }
}

const parseTransaction = (t: any): Transaction => ({
  ...t,
  details: typeof t.details === "string" ? (t.details ? JSON.parse(t.details) : undefined) : t.details,
  amount: typeof t.amount === "string" ? Number(t.amount) : Number(t.amount || 0),
  commission_amount: t.commission_amount != null ? (typeof t.commission_amount === "string" ? Number(t.commission_amount) : Number(t.commission_amount)) : undefined,
})

export default function ExecutorDashboard({ user }: ExecutorDashboardProps) {
  useDocumentTitle("Tableau de Bord - Exécuteur")

  const [stats, setStats] = useState({ validated: 0, executed: 0, totalExecutedAmount: 0 })
  const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([])
  const [executedTransactions, setExecutedTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingPage, setPendingPage] = useState(1)
  const [pendingLimit, setPendingLimit] = useState(10)
  const [pendingTotal, setPendingTotal] = useState(0)
  const [executedPage, setExecutedPage] = useState(1)
  const [executedLimit, setExecutedLimit] = useState(10)
  const [executedTotal, setExecutedTotal] = useState(0)
  const [executingTransaction, setExecutingTransaction] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [executorComment, setExecutorComment] = useState("")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const getTodayRange = () => {
    const today = new Date()
    return { from: today, to: today }
  }
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() => getTodayRange())
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [pendingDateRange, setPendingDateRange] = useState<{ from?: Date; to?: Date }>(() => getTodayRange())
  const [cashierFilter, setCashierFilter] = useState<string>("all")
  const [modeFilter, setModeFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [cashiers, setCashiers] = useState<string[]>([])

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams()
    if (dateRange.from) params.set("from", format(dateRange.from, "yyyy-MM-dd"))
    if (dateRange.to) params.set("to", format(dateRange.to, "yyyy-MM-dd"))
    if (cashierFilter && cashierFilter !== "all") params.set("cashier", cashierFilter)
    if (modeFilter && modeFilter !== "all") params.set("transferMethod", modeFilter)
    if (searchTerm.trim()) params.set("search", searchTerm.trim())
    return params.toString()
  }, [dateRange.from, dateRange.to, cashierFilter, modeFilter, searchTerm])

  const loadStats = useCallback(async () => {
    try {
      const q = buildFilterParams()
      const url = `/api/transactions/stats${q ? `?${q}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data?.ok) {
        setStats({
          validated: data.validated ?? 0,
          executed: data.executed ?? 0,
          totalExecutedAmount: data.totalExecutedAmount ?? 0,
        })
      }
    } catch {
      // ignore
    }
  }, [buildFilterParams])

  const loadPending = useCallback(async (page: number, limit: number) => {
    try {
      const q = buildFilterParams()
      const url = `/api/transactions?status=validated&page=${page}&limit=${limit}${q ? `&${q}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data?.ok && Array.isArray(data.data)) {
        setPendingTransactions(data.data.map(parseTransaction))
        setPendingTotal(typeof data.total === "number" ? data.total : data.data.length)
      } else {
        setPendingTransactions([])
        setPendingTotal(0)
      }
    } catch {
      setPendingTransactions([])
      setPendingTotal(0)
    }
  }, [buildFilterParams])

  const loadExecuted = useCallback(async (page: number, limit: number) => {
    try {
      const q = buildFilterParams()
      const url = `/api/transactions?status=executed&page=${page}&limit=${limit}${q ? `&${q}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok && data?.ok && Array.isArray(data.data)) {
        setExecutedTransactions(data.data.map(parseTransaction))
        setExecutedTotal(typeof data.total === "number" ? data.total : data.data.length)
      } else {
        setExecutedTransactions([])
        setExecutedTotal(0)
      }
    } catch {
      setExecutedTransactions([])
      setExecutedTotal(0)
    }
  }, [buildFilterParams])

  const refreshAll = useCallback(() => {
    loadStats()
    loadPending(pendingPage, pendingLimit)
    loadExecuted(executedPage, executedLimit)
  }, [loadStats, loadPending, loadExecuted, pendingPage, pendingLimit, executedPage, executedLimit])

  const loadFilterOptions = useCallback(async () => {
    try {
      const [rValidated, rExecuted] = await Promise.all([
        fetch("/api/transactions?filterOptions=validated"),
        fetch("/api/transactions?filterOptions=executed"),
      ])
      const dValidated = await rValidated.json()
      const dExecuted = await rExecuted.json()
      const listValidated = (dValidated?.cashiers ?? []) as string[]
      const listExecuted = (dExecuted?.cashiers ?? []) as string[]
      const merged = Array.from(new Set([...listValidated, ...listExecuted])).sort()
      setCashiers(merged)
    } catch {
      setCashiers([])
    }
  }, [])

  const resetFilters = useCallback(() => {
    const today = getTodayRange()
    setDateRange(today)
    setPendingDateRange(today)
    setCashierFilter("all")
    setModeFilter("all")
    setSearchTerm("")
    setPendingPage(1)
    setExecutedPage(1)
  }, [])

  const applyCalendarRange = useCallback(() => {
    if (pendingDateRange.from) {
      setDateRange({ from: pendingDateRange.from, to: pendingDateRange.to ?? pendingDateRange.from })
      setPendingPage(1)
      setExecutedPage(1)
    }
    setCalendarOpen(false)
  }, [pendingDateRange])

  const openCalendar = useCallback((open: boolean) => {
    setCalendarOpen(open)
    if (open) setPendingDateRange(dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : getTodayRange())
  }, [dateRange.from, dateRange.to])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await loadFilterOptions()
      setLoading(false)
    }
    init()
  }, [loadFilterOptions])

  // Recharger les stats dès que les filtres changent (dates, caissier, mode, recherche)
  useEffect(() => {
    loadStats()
  }, [
    dateRange.from?.getTime(),
    dateRange.to?.getTime(),
    cashierFilter,
    modeFilter,
    searchTerm,
    loadStats,
  ])

  useEffect(() => {
    loadPending(pendingPage, pendingLimit)
  }, [loadPending, pendingPage, pendingLimit])

  useEffect(() => {
    loadExecuted(executedPage, executedLimit)
  }, [loadExecuted, executedPage, executedLimit])

  const handleExecuteTransaction = async (transactionId: string) => {
    if (!receiptFile) {
      alert('Veuillez sélectionner un fichier de reçu')
      return
    }

    try {
      setExecutingTransaction(transactionId)
      
      // Créer un FormData pour l'upload du fichier
      // Note: executorId n'est plus nécessaire car l'API utilise l'utilisateur authentifié
      const formData = new FormData()
      formData.append('transactionId', transactionId)
      formData.append('receiptFile', receiptFile)
      if (executorComment.trim()) {
        formData.append('executorComment', executorComment.trim())
      }
      
      const response = await fetch('/api/transactions/execute', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        alert('Transaction exécutée avec succès !')
        setReceiptFile(null)
        setExecutorComment("")
        refreshAll()
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur lors de l\'exécution:', error)
      alert('Erreur lors de l\'exécution de la transaction')
    } finally {
      setExecutingTransaction(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800"
      case "validated":
        return "bg-blue-100 text-blue-800"
      case "executed":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "validated":
        return "Validée"
      case "executed":
        return "Exécutée"
      case "rejected":
        return "Rejetée"
      case "completed":
        return "Terminée"
      default:
        return status
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: fr })

  const formatAmountWithCurrency = (amount: number, currency: string) =>
    `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Chargement des transactions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tableau de Bord - Exécuteur</h1>
          <p className="text-muted-foreground">
            Bienvenue, {user.name} - {user.agency}
          </p>
        </div>
      </div>

      {/* Statistiques – style aligné Opérations transfert */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-slate-50 to-slate-100/80 border-b border-slate-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total</p>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{stats.validated + stats.executed}</p>
                <p className="text-xs text-slate-500">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-amber-50 to-orange-50/80 border-b border-amber-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">En attente</p>
                <p className="text-2xl font-bold tabular-nums text-amber-900">{stats.validated}</p>
                <p className="text-xs text-amber-700">À exécuter</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-emerald-50 to-green-50/80 border-b border-emerald-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-emerald-800">Exécutées</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-900">{stats.executed}</p>
                <p className="text-xs text-emerald-700">Terminées</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50/80 border-b border-violet-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-violet-800">Montant total</p>
                <p className="text-2xl font-bold tabular-nums text-violet-900">{formatAmount(stats.totalExecutedAmount)}</p>
                <p className="text-xs text-violet-700">Exécuté</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtres
          </CardTitle>
          <Button variant="outline" size="sm" onClick={resetFilters} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Réinitialiser les filtres
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 block mb-1">Dates</Label>
              <Popover open={calendarOpen} onOpenChange={openCalendar}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full sm:w-[260px] justify-start gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    {dateRange.from && dateRange.to
                      ? `${format(dateRange.from, "dd/MM/yyyy", { locale: fr })} – ${format(dateRange.to, "dd/MM/yyyy", { locale: fr })}`
                      : "Sélectionner une plage"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={pendingDateRange.from ? { from: pendingDateRange.from, to: pendingDateRange.to ?? pendingDateRange.from } : undefined}
                    onSelect={(range) => setPendingDateRange({ from: range?.from, to: range?.to })}
                    locale={fr}
                    disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                    captionLayout="dropdown"
                  />
                  <div className="p-2 border-t flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 justify-center gap-2" onClick={() => setPendingDateRange(getTodayRange())}>
                      <Clock className="h-4 w-4" />
                      Aujourd&apos;hui
                    </Button>
                    <Button size="sm" className="flex-1 justify-center gap-2" onClick={applyCalendarRange} disabled={!pendingDateRange.from}>
                      Appliquer
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-gray-500 block mb-1">Caissier</Label>
              <Select value={cashierFilter} onValueChange={(v) => { setCashierFilter(v); setPendingPage(1); setExecutedPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les caissiers</SelectItem>
                  {cashiers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-gray-500 block mb-1">Mode de transfert</Label>
              <Select value={modeFilter} onValueChange={(v) => { setModeFilter(v); setPendingPage(1); setExecutedPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les modes</SelectItem>
                  {TRANSFER_MODES.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 block mb-1">Recherche (ID, description, caissier, bénéficiaire)</Label>
              <Input
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setPendingPage(1)
                  setExecutedPage(1)
                }}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions en attente d'exécution – style Opérations du jour */}
      {stats.validated > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Clock className="h-5 w-5 text-amber-600" />
              Transactions en attente d&apos;exécution ({pendingTotal})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingTransactions.map((transaction) => {
                const modeId = transaction.details?.transfer_method || "Autre"
                const modeConfig = TRANSFER_MODES.find((m) => m.id === modeId)
                const hasLogo = modeConfig && "logo" in modeConfig && modeConfig.logo
                return (
                  <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-medium text-sm">{transaction.id}</span>
                          <Badge className={getStatusColor(transaction.status)}>{getStatusLabel(transaction.status)}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{transaction.description}</p>
                        <div className="flex items-center gap-0 text-xs text-gray-500 flex-wrap [&>*+*]:before:content-['|'] [&>*+*]:before:px-2 [&>*+*]:before:text-gray-400">
                          <span>{formatAmountWithCurrency(transaction.amount, transaction.currency || "XAF")}</span>
                          <span>{formatDate(transaction.created_at)}</span>
                          <span>Par: {transaction.created_by}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span>{modeConfig?.label ?? modeId}</span>
                            {hasLogo && <img src={modeConfig!.logo} alt={modeConfig!.label} className="h-5 w-5 object-contain" />}
                        </span>
                      </div>
                        <div className="mt-2 text-xs text-gray-500">
                          {transaction.commission_amount != null && (
                            <span className="text-green-600">Commission: {formatAmount(transaction.commission_amount)}</span>
                          )}
                          {transaction.real_amount_eur != null && (
                            <span className="ml-2">Montant réel: {Number(transaction.real_amount_eur).toLocaleString("fr-FR")} EUR</span>
                        )}
                      </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600 border-gray-600 hover:bg-gray-50"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Détails
                        </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="bg-green-600 hover:bg-green-700"
                            disabled={executingTransaction === transaction.id}
                          >
                            <Play className="h-4 w-4 mr-2" />
                              {executingTransaction === transaction.id ? "Exécution..." : "Exécuter"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Exécuter la transaction</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Fichier du reçu *</label>
                              <div className="mt-1">
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                {receiptFile && (
                                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                                    <FileUp className="h-4 w-4" />
                                    <span>{receiptFile.name}</span>
                                    <span className="text-gray-500">({(receiptFile.size / 1024).toFixed(1)} KB)</span>
                                  </div>
                                )}
                              </div>
                                <p className="text-xs text-gray-500 mt-1">Formats acceptés: PDF, JPG, PNG, DOC, DOCX (max 10MB)</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Commentaire (optionnel)</label>
                              <Textarea
                                placeholder="Commentaire sur l'exécution..."
                                value={executorComment}
                                onChange={(e) => setExecutorComment(e.target.value)}
                                rows={3}
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button
                                onClick={() => handleExecuteTransaction(transaction.id)}
                                disabled={!receiptFile || executingTransaction === transaction.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Upload className="h-4 w-4 mr-2" />
                                  Confirmer l&apos;exécution
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                  </div>
                )
              })}
            </div>
            {pendingTotal > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-nowrap items-center gap-x-4 gap-y-0 overflow-x-auto min-w-0">
                <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Éléments par page:</span>
                <Select value={String(pendingLimit)} onValueChange={(v) => { setPendingLimit(Number(v)); setPendingPage(1); }}>
                  <SelectTrigger className="w-[80px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">
                  Affichage de {pendingTotal === 0 ? 1 : (pendingPage - 1) * pendingLimit + 1} à {Math.min(pendingPage * pendingLimit, pendingTotal)} sur {pendingTotal} transaction(s)
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => setPendingPage((p) => Math.max(1, p - 1))} disabled={pendingPage <= 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPendingPage((p) => p + 1)} disabled={pendingPage >= Math.ceil(pendingTotal / pendingLimit) || pendingTotal === 0}>
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transactions exécutées – style Opérations du jour */}
      {stats.executed > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Transactions exécutées ({executedTotal})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {executedTransactions.map((transaction) => {
                const modeId = transaction.details?.transfer_method || "Autre"
                const modeConfig = TRANSFER_MODES.find((m) => m.id === modeId)
                const hasLogo = modeConfig && "logo" in modeConfig && modeConfig.logo
                return (
                  <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="font-medium text-sm">{transaction.id}</span>
                          <Badge className={getStatusColor(transaction.status)}>{getStatusLabel(transaction.status)}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{transaction.description}</p>
                        <div className="flex items-center gap-0 text-xs text-gray-500 flex-wrap [&>*+*]:before:content-['|'] [&>*+*]:before:px-2 [&>*+*]:before:text-gray-400">
                          <span>{formatAmountWithCurrency(transaction.amount, transaction.currency || "XAF")}</span>
                          {transaction.executed_at && (
                            <span>Exécuté le: {formatDate(transaction.executed_at)}</span>
                          )}
                          <span>Par: {transaction.created_by}</span>
                          <span className="inline-flex items-center gap-1.5">
                            <span>{modeConfig?.label ?? modeId}</span>
                            {hasLogo && <img src={modeConfig!.logo} alt={modeConfig!.label} className="h-5 w-5 object-contain" />}
                        </span>
                      </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                          {transaction.commission_amount != null && (
                            <span className="text-green-600">Commission: {formatAmount(transaction.commission_amount)}</span>
                          )}
                          {transaction.receipt_url ? (
                            <a href={transaction.receipt_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              Reçu: Voir
                            </a>
                          ) : (
                            <span className="text-red-600">Reçu: Non disponible</span>
                          )}
                        </div>
                        {transaction.executor_comment && (
                          <div className="mt-2 bg-gray-50 p-3 rounded text-sm">
                            <strong className="text-gray-700">Commentaire:</strong>
                            <p className="text-gray-600 mt-1">{transaction.executor_comment}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600 border-gray-600 hover:bg-gray-50"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Détails
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {executedTotal > 0 && (
              <div className="mt-4 pt-4 border-t flex flex-nowrap items-center gap-x-4 gap-y-0 overflow-x-auto min-w-0">
                <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Éléments par page:</span>
                <Select value={String(executedLimit)} onValueChange={(v) => { setExecutedLimit(Number(v)); setExecutedPage(1); }}>
                  <SelectTrigger className="w-[80px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[10, 20, 50].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">
                  Affichage de {(executedPage - 1) * executedLimit + 1} à {Math.min(executedPage * executedLimit, executedTotal)} sur {executedTotal} transaction(s)
                </span>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <Button variant="outline" size="sm" onClick={() => setExecutedPage((p) => Math.max(1, p - 1))} disabled={executedPage <= 1}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setExecutedPage((p) => p + 1)} disabled={executedPage >= Math.ceil(executedTotal / executedLimit) || executedTotal === 0}>
                    Suivant
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Message si aucune transaction */}
      {!loading && stats.validated === 0 && stats.executed === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune transaction assignée</h3>
            <p className="text-muted-foreground">
              Vous n&apos;avez actuellement aucune transaction assignée à exécuter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal Détails – même structure que Opérations des Caissiers */}
      {selectedTransaction && (
        <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Détails de l&apos;opération {selectedTransaction.id}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type d&apos;opération</label>
                  <p className="text-sm mt-1">Transfert d&apos;argent</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Statut</label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedTransaction.status)}>{getStatusLabel(selectedTransaction.status)}</Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Montant</label>
                  <p className="text-sm font-medium mt-1">{formatAmountWithCurrency(selectedTransaction.amount, selectedTransaction.currency || "XAF")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Caissier</label>
                  <p className="text-sm mt-1">{selectedTransaction.created_by}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Agence</label>
                  <p className="text-sm mt-1">{selectedTransaction.agency}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Date</label>
                  <p className="text-sm mt-1">{formatDate(selectedTransaction.created_at)}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <p className="text-sm mt-1">{selectedTransaction.description}</p>
              </div>
              {selectedTransaction.details && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Détails spécifiques</label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Bénéficiaire:</span>
                        <p className="text-sm">{selectedTransaction.details.beneficiary_name || "–"}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Destination:</span>
                        <p className="text-sm">{[selectedTransaction.details.destination_city, selectedTransaction.details.destination_country].filter(Boolean).join(", ") || "–"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Moyen de transfert:</span>
                        <p className="text-sm">{selectedTransaction.details.transfer_method || "–"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Montant reçu:</span>
                        <p className="text-sm">{(selectedTransaction.details.amount_received ?? selectedTransaction.amount).toLocaleString("fr-FR")} {selectedTransaction.details.received_currency || "XAF"}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">Montant à envoyer:</span>
                        <p className="text-sm">{(selectedTransaction.details.amount_sent ?? 0).toLocaleString("fr-FR")} {selectedTransaction.details.sent_currency || "EUR"}</p>
                      </div>
                    </div>
                    {(selectedTransaction.status === "validated" || selectedTransaction.status === "executed" || selectedTransaction.status === "completed") && (
                      <div className="grid grid-cols-2 gap-4">
                        {selectedTransaction.real_amount_eur != null && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Montant réel envoyé:</span>
                            <p className="text-sm font-semibold text-blue-700">{Number(selectedTransaction.real_amount_eur).toLocaleString("fr-FR")} EUR</p>
                          </div>
                        )}
                        {selectedTransaction.commission_amount != null && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Commission:</span>
                            <p className="text-sm font-semibold text-green-700">{Number(selectedTransaction.commission_amount).toLocaleString("fr-FR")} XAF</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm font-medium text-gray-600">Mode de retrait:</span>
                        <p className="text-sm">{selectedTransaction.details.withdrawal_mode === "cash" ? "Espèces" : selectedTransaction.details.withdrawal_mode === "bank_transfer" ? "Virement bancaire" : selectedTransaction.details.withdrawal_mode || "–"}</p>
                      </div>
                    </div>
                    {selectedTransaction.receipt_url && (
                      <div>
                        <span className="text-sm font-medium text-gray-600">Reçu d&apos;exécution:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm font-mono">{selectedTransaction.receipt_url.split("/").pop() || selectedTransaction.receipt_url}</p>
                          <Button size="sm" variant="outline" onClick={() => window.open(selectedTransaction.receipt_url!, "_blank")} className="text-green-600 border-green-600 hover:bg-green-50">
                            Télécharger
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {selectedTransaction.status === "rejected" && selectedTransaction.rejection_reason && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <label className="text-sm font-medium text-red-800">Motif du rejet</label>
                  <p className="text-sm text-red-700 mt-1">{selectedTransaction.rejection_reason}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Fermer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
