"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Send,
  Eye,
  X,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  Wallet,
  Building2,
  Banknote,
  FileDown,
  TrendingUp,
  Hash,
  Filter,
  RotateCcw,
  Ban,
  Archive,
  Loader2,
} from "lucide-react"
import { PageLoader } from "@/components/ui/page-loader"
import { useToast } from "@/hooks/use-toast"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

type TransferTransaction = {
  id: string
  type: string
  status: string
  description: string
  amount: number
  currency: string
  created_by: string
  agency: string
  created_at: string
  details?: {
    transfer_method?: string
    beneficiary_name?: string
    destination_country?: string
    destination_city?: string
    amount_received?: number
    amount_sent?: number
    received_currency?: string
    sent_currency?: string
    withdrawal_mode?: string
    iban_file_data?: { name: string; data: string; type: string }
    [key: string]: unknown
  }
  real_amount_eur?: number
  commission_amount?: number
  rejection_reason?: string
  receipt_url?: string
}

const TRANSFER_MODES = [
  { id: "Western Union", label: "Western Union", icon: Building2, color: "bg-amber-500", logo: "/logos/western-union.svg" },
  { id: "Ria Money Transfer", label: "RIA", icon: Send, color: "bg-blue-500", logo: "/logos/ria.svg" },
  { id: "MoneyGram", label: "MoneyGram", icon: Wallet, color: "bg-red-500", logo: "/logos/moneygram.svg" },
  { id: "Autre", label: "Autre", icon: Banknote, color: "bg-slate-500" },
]

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  validated: "Validé",
  completed: "Terminé",
  executed: "Exécuté",
  rejected: "Rejeté",
  cancelled: "Annulé",
  pending_delete: "Suppression",
}

const STATUS_DISPLAY: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgClass: string }[] = [
  { id: "pending", label: "En attente", icon: Clock, color: "text-amber-700", bgClass: "bg-amber-50 border-amber-200" },
  { id: "validated", label: "Validé", icon: Loader2, color: "text-blue-700", bgClass: "bg-blue-50 border-blue-200" },
  { id: "executed", label: "Exécuté", icon: Send, color: "text-violet-700", bgClass: "bg-violet-50 border-violet-200" },
  { id: "completed", label: "Terminé", icon: CheckCircle, color: "text-emerald-700", bgClass: "bg-emerald-50 border-emerald-200" },
  { id: "rejected", label: "Rejeté", icon: AlertTriangle, color: "text-red-700", bgClass: "bg-red-50 border-red-200" },
  { id: "cancelled", label: "Annulé", icon: Ban, color: "text-slate-600", bgClass: "bg-slate-50 border-slate-200" },
  { id: "pending_delete", label: "Suppression", icon: Archive, color: "text-orange-700", bgClass: "bg-orange-50 border-orange-200" },
]

interface TransferOperationsViewProps {
  user: { name: string; role: string }
}

export function TransferOperationsView({ user }: TransferOperationsViewProps) {
  const { toast } = useToast()
  const { rates } = useExchangeRates()
  const [rawTransfers, setRawTransfers] = React.useState<TransferTransaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const getTodayRange = () => {
    const today = new Date()
    return { from: today, to: today }
  }
  const [dateRange, setDateRange] = React.useState<{ from?: Date; to?: Date }>(() => getTodayRange())
  const [cashierFilter, setCashierFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [modeFilter, setModeFilter] = React.useState<string>("all")
  const [searchTerm, setSearchTerm] = React.useState("")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(10)
  const [selectedTransaction, setSelectedTransaction] = React.useState<TransferTransaction | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [transactionToReject, setTransactionToReject] = React.useState<string | null>(null)
  const [validateDialogOpen, setValidateDialogOpen] = React.useState(false)
  const [transactionToValidate, setTransactionToValidate] = React.useState<string | null>(null)
  const [realAmountEUR, setRealAmountEUR] = React.useState("")
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [pendingDateRange, setPendingDateRange] = React.useState<{ from?: Date; to?: Date }>(() => getTodayRange())

  const loadTransfers = React.useCallback(async () => {
    setLoading(true)
    try {
      const fromStr = dateRange.from ? format(dateRange.from, "yyyy-MM-dd") : ""
      const toStr = dateRange.to ? format(dateRange.to, "yyyy-MM-dd") : ""
      const params = new URLSearchParams({ type: "transfer" })
      if (fromStr) params.set("from", fromStr)
      if (toStr) params.set("to", toStr)
      const res = await fetch(`/api/transactions?${params}`)
      const data = await res.json()
      if (res.ok && data?.ok && Array.isArray(data.data)) {
        const list = data.data.map((item: any) => ({
          ...item,
          real_amount_eur: item.real_amount_eur != null ? Number(item.real_amount_eur) : undefined,
          commission_amount: item.commission_amount != null ? Number(item.commission_amount) : undefined,
          details: typeof item.details === "string" ? JSON.parse(item.details) : item.details || {},
        }))
        setRawTransfers(list)
      } else {
        setRawTransfers([])
      }
    } catch {
      setRawTransfers([])
    } finally {
      setLoading(false)
    }
  }, [dateRange.from, dateRange.to])

  React.useEffect(() => {
    loadTransfers()
  }, [loadTransfers])

  React.useEffect(() => {
    const onCreated = () => loadTransfers()
    const onStatusChanged = () => loadTransfers()
    window.addEventListener("transferCreated", onCreated as EventListener)
    window.addEventListener("transactionStatusChanged", onStatusChanged as EventListener)
    return () => {
      window.removeEventListener("transferCreated", onCreated as EventListener)
      window.removeEventListener("transactionStatusChanged", onStatusChanged as EventListener)
    }
  }, [loadTransfers])

  const uniqueCashiers = React.useMemo(
    () => [...new Set(rawTransfers.map((t) => t.created_by))].sort(),
    [rawTransfers]
  )

  const filteredTransfers = React.useMemo(() => {
    let list = rawTransfers
    if (user.role === "cashier") list = list.filter((t) => t.created_by === user.name)
    if (cashierFilter !== "all") list = list.filter((t) => t.created_by === cashierFilter)
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter)
    if (modeFilter !== "all") list = list.filter((t) => (t.details?.transfer_method || "Autre") === modeFilter)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.created_by || "").toLowerCase().includes(q) ||
          (t.details?.beneficiary_name || "").toLowerCase().includes(q)
      )
    }
    return list
  }, [rawTransfers, user.role, user.name, cashierFilter, statusFilter, modeFilter, searchTerm])

  // Uniquement les transferts exécutés pour les totaux (montant reçu, montant envoyé, commission)
  const executedTransfers = React.useMemo(
    () => filteredTransfers.filter((t) => t.status === "executed"),
    [filteredTransfers]
  )

  const totalReceivedXAF = React.useMemo(() => {
    const toXAF = (amount: number, currency: string) => {
      if (currency === "XAF") return amount
      if (currency === "EUR") return amount * (rates.EUR || 650)
      if (currency === "USD") return amount * (rates.USD || 580)
      if (currency === "GBP") return amount * (rates.GBP || 750)
      return amount
    }
    return executedTransfers.reduce((sum, t) => sum + toXAF(Number(t.amount), t.currency || "XAF"), 0)
  }, [executedTransfers, rates.EUR, rates.USD, rates.GBP])
  const totalRealSentEUR = React.useMemo(
    () => executedTransfers.reduce((sum, t) => sum + (Number(t.real_amount_eur) || 0), 0),
    [executedTransfers]
  )
  const totalCommissionXAF = React.useMemo(
    () => executedTransfers.reduce((sum, t) => sum + (Number(t.commission_amount) || 0), 0),
    [executedTransfers]
  )

  const totalCount = filteredTransfers.length
  const byStatus = React.useMemo(() => {
    const map: Record<string, number> = {}
    filteredTransfers.forEach((t) => {
      map[t.status] = (map[t.status] || 0) + 1
    })
    return map
  }, [filteredTransfers])

  const byMode = React.useMemo(() => {
    const map: Record<string, number> = {}
    filteredTransfers.forEach((t) => {
      const mode = t.details?.transfer_method || "Autre"
      map[mode] = (map[mode] || 0) + 1
    })
    return map
  }, [filteredTransfers])

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTransfers = filteredTransfers.slice(startIndex, startIndex + itemsPerPage)

  React.useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1)
  }, [currentPage, totalPages])

  const formatAmount = (amount: number, currency: string) =>
    `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${currency}`
  const formatDate = (dateString: string) => format(new Date(dateString), "dd/MM/yyyy HH:mm:ss", { locale: fr })

  const getStatusBadge = (status: string) => {
    const label = STATUS_LABELS[status] || status
    const classes: Record<string, string> = {
      completed: "bg-green-100 text-green-800",
      executed: "bg-purple-100 text-purple-800",
      validated: "bg-blue-100 text-blue-800",
      pending: "bg-yellow-100 text-yellow-800",
      rejected: "bg-red-100 text-red-800",
      cancelled: "bg-red-100 text-red-800",
      pending_delete: "bg-orange-100 text-orange-800",
    }
    return <Badge className={classes[status] || "bg-gray-100 text-gray-800"}>{label}</Badge>
  }

  const handleViewDetails = (t: TransferTransaction) => setSelectedTransaction(t)
  const handleReject = (id: string) => {
    setTransactionToReject(id)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }
  const handleValidate = (id: string) => {
    setTransactionToValidate(id)
    setRealAmountEUR("")
    setValidateDialogOpen(true)
  }

  const confirmReject = async () => {
    if (!transactionToReject || !rejectionReason.trim()) return
    try {
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transactionToReject, status: "rejected", rejection_reason: rejectionReason.trim() }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: "Transaction rejetée", description: `Motif: ${rejectionReason}` })
      window.dispatchEvent(new CustomEvent("transactionStatusChanged", { detail: { transactionId: transactionToReject, status: "rejected" } }))
      await loadTransfers()
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Rejet impossible", variant: "destructive" })
    } finally {
      setRejectDialogOpen(false)
      setTransactionToReject(null)
      setRejectionReason("")
    }
  }

  const confirmValidate = async () => {
    if (!transactionToValidate || !realAmountEUR) return
    const real = parseFloat(realAmountEUR.replace(",", "."))
    if (Number.isNaN(real) || real <= 0) {
      toast({ title: "Erreur", description: "Montant réel (EUR) invalide", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/transactions/update-real-amount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: transactionToValidate, realAmountEUR: real }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: "Transaction validée", description: "Montant réel enregistré." })
      window.dispatchEvent(new CustomEvent("transactionStatusChanged", { detail: { transactionId: transactionToValidate } }))
      await loadTransfers()
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Validation impossible", variant: "destructive" })
    } finally {
      setValidateDialogOpen(false)
      setTransactionToValidate(null)
      setRealAmountEUR("")
    }
  }

  const handleCompleteTransaction = async (id: string) => {
    try {
      const res = await fetch("/api/transactions", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: "completed" }) })
      if (!res.ok) throw new Error((await res.json()).error)
      toast({ title: "Transaction terminée", description: `Transaction ${id} clôturée.` })
      window.dispatchEvent(new CustomEvent("transactionStatusChanged", { detail: { transactionId: id, status: "completed" } }))
      await loadTransfers()
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Clôture impossible", variant: "destructive" })
    }
  }

  const resetFilters = () => {
    setDateRange(getTodayRange())
    setCashierFilter("all")
    setStatusFilter("all")
    setModeFilter("all")
    setSearchTerm("")
    setCurrentPage(1)
    toast({ title: "Filtres réinitialisés", description: "Tous les filtres ont été remis par défaut." })
  }

  const handleDownloadIBAN = (t: TransferTransaction) => {
    const iban = t.details?.iban_file_data
    if (!iban?.data) {
      toast({ title: "Erreur", description: "Aucun fichier IBAN disponible", variant: "destructive" })
      return
    }
    try {
      const bytes = Uint8Array.from(atob(iban.data), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: iban.type })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = iban.name || "iban"
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Téléchargement", description: "Fichier IBAN téléchargé." })
    } catch {
      toast({ title: "Erreur", description: "Échec du téléchargement", variant: "destructive" })
    }
  }

  const applyCalendarRange = () => {
    if (pendingDateRange.from) {
      setDateRange({ from: pendingDateRange.from, to: pendingDateRange.to ?? pendingDateRange.from })
    }
    setCalendarOpen(false)
  }

  const openCalendar = (open: boolean) => {
    setCalendarOpen(open)
    if (open) setPendingDateRange(dateRange.from && dateRange.to ? { from: dateRange.from, to: dateRange.to } : getTodayRange())
  }

  return (
    <div className="relative min-h-[200px]">
      {loading && <PageLoader message="Chargement..." overlay />}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Opérations - Transfert d&apos;argent</h2>
          <p className="text-gray-600 mt-1">Statistiques et liste des transferts avec filtres dynamiques</p>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 justify-center gap-2"
                      onClick={() => {
                        const today = getTodayRange()
                        setPendingDateRange(today)
                      }}
                    >
                      <Clock className="h-4 w-4" />
                      Aujourd&apos;hui
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 justify-center gap-2"
                      onClick={applyCalendarRange}
                      disabled={!pendingDateRange.from}
                    >
                      Appliquer
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-gray-500">Caissier</Label>
              <Select value={cashierFilter} onValueChange={setCashierFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les caissiers</SelectItem>
                  {uniqueCashiers.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[160px]">
              <Label className="text-xs text-gray-500">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {Object.keys(STATUS_LABELS).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-gray-500">Mode de transfert</Label>
              <Select value={modeFilter} onValueChange={setModeFilter}>
                <SelectTrigger className="mt-1">
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
              <Label className="text-xs text-gray-500">Recherche (ID, description, caissier, bénéficiaire)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
          <CardContent className="p-0">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-white/20 shrink-0">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-100 uppercase tracking-wide">Total Montant reçu</p>
                  <p className="text-emerald-100/90 text-xs mt-0.5">(transferts exécutés)</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
                    {totalReceivedXAF.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-emerald-100 text-sm font-medium mt-0.5">XAF</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-0">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-white/20 shrink-0">
                  <Send className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-100 uppercase tracking-wide">Total montant (réel) envoyé</p>
                  <p className="text-blue-100/90 text-xs mt-0.5">(transferts exécutés)</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
                    {totalRealSentEUR.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-blue-100 text-sm font-medium mt-0.5">EUR</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-0">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-4 rounded-2xl bg-white/20 shrink-0">
                  <Wallet className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-100 uppercase tracking-wide">Total Commission reçu</p>
                  <p className="text-amber-100/90 text-xs mt-0.5">(transferts exécutés)</p>
                  <p className="text-2xl sm:text-3xl font-bold mt-1 tracking-tight">
                    {totalCommissionXAF.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-amber-100 text-sm font-medium mt-0.5">XAF</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transferts par mode */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Transferts par mode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TRANSFER_MODES.map((mode) => {
              const Icon = mode.icon
              const count = byMode[mode.id] ?? 0
              const hasLogo = "logo" in mode && mode.logo
              return (
                <div key={mode.id} className="flex items-center gap-3 p-4 rounded-xl border bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${hasLogo ? "bg-white border border-slate-200 p-1.5" : mode.color + " text-white p-2.5"}`}>
                    {hasLogo ? (
                      <img src={mode.logo} alt={mode.label} className="h-full w-full object-contain" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{mode.label}</p>
                    <p className="text-lg font-bold text-slate-900">{count}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Nombre de transferts */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-800">
            <div className="p-1.5 rounded-lg bg-slate-100">
              <Hash className="h-4 w-4 text-slate-600" />
            </div>
            Nombre de transferts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border-2 border-slate-200 bg-slate-50/80 px-5 py-4">
            <span className="text-sm font-medium text-slate-600">Total (période filtrée)</span>
            <span className="text-3xl font-bold tabular-nums text-slate-900">{totalCount}</span>
            <span className="text-sm text-slate-500">transfert{totalCount !== 1 ? "s" : ""}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Répartition par statut</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {STATUS_DISPLAY.map(({ id, label, icon: Icon, color, bgClass }) => {
                const count = byStatus[id] ?? 0
                return (
                  <div
                    key={id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${bgClass} ${count === 0 ? "opacity-60" : "hover:shadow-sm"}`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-600 truncate">{label}</p>
                      <p className="text-lg font-bold tabular-nums text-slate-900">{count}</p>
                    </div>
                  </div>
                )
              })}
              {Object.entries(byStatus)
                .filter(([status]) => !STATUS_DISPLAY.some((s) => s.id === status))
                .map(([status, count]) => (
                  <div
                    key={status}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 hover:shadow-sm"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-600 truncate">{STATUS_LABELS[status] || status}</p>
                      <p className="text-lg font-bold tabular-nums text-slate-900">{count}</p>
                    </div>
                  </div>
                ))}
            </div>
            {totalCount === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Aucun transfert sur la période</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste paginée */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Liste des transferts</CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedTransfers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Send className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Aucun transfert trouvé pour les critères sélectionnés.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedTransfers.map((t) => (
                <div key={t.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="font-medium text-sm">{t.id}</span>
                        {getStatusBadge(t.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{t.description}</p>
                      <div className="flex items-center gap-0 text-xs text-gray-500 flex-wrap [&>*+*]:before:content-['|'] [&>*+*]:before:px-2 [&>*+*]:before:text-gray-400">
                        <span>{formatAmount(t.amount, t.currency)}</span>
                        <span>{formatDate(t.created_at)}</span>
                        <span>Par: {t.created_by}</span>
                        {(() => {
                          const modeId = t.details?.transfer_method || "Autre"
                          const modeConfig = TRANSFER_MODES.find((m) => m.id === modeId)
                          const hasLogo = modeConfig && "logo" in modeConfig && modeConfig.logo
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              <span>{modeConfig?.label ?? modeId}</span>
                              {hasLogo && (
                                <img src={modeConfig.logo} alt={modeConfig.label} className="h-5 w-5 object-contain" />
                              )}
                            </span>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleViewDetails(t)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Détails
                      </Button>
                      {t.status === "pending" && user.role === "auditor" && (
                        <>
                          <Button size="sm" variant="outline" className="text-blue-600 border-blue-600 hover:bg-blue-50" onClick={() => handleValidate(t.id)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Valider
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-600 hover:bg-red-50" onClick={() => handleReject(t.id)}>
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </>
                      )}
                      {t.status === "validated" && user.role === "cashier" && (
                        <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50" onClick={() => handleCompleteTransaction(t.id)}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Clôturer
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 pt-4 border-t flex flex-nowrap items-center gap-x-4 gap-y-0 overflow-x-auto min-w-0">
            <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">Éléments par page:</span>
            <Select value={String(itemsPerPage)} onValueChange={(v) => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="w-[80px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-gray-600 whitespace-nowrap shrink-0">
              Affichage de {totalCount === 0 ? 1 : startIndex + 1} à {totalCount === 0 ? 0 : Math.min(startIndex + itemsPerPage, totalCount)} sur {totalCount} opérations
            </span>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                Suivant
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Détails – même structure que l'onglet Opérations des Caissiers */}
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
                  <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Montant</label>
                  <p className="text-sm font-medium mt-1">{formatAmount(selectedTransaction.amount, selectedTransaction.currency)}</p>
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(selectedTransaction.receipt_url!, "_blank")}
                            className="text-green-600 border-green-600 hover:bg-green-50"
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            Télécharger
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedTransaction.details.iban_file_data && (
                      <div>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadIBAN(selectedTransaction)}>
                          <FileDown className="h-4 w-4 mr-2" />
                          Télécharger fichier IBAN
                        </Button>
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

      {/* Dialog Rejet */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Motif du rejet *</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Saisir le motif..." rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={!rejectionReason.trim()}>Rejeter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Validation (montant réel EUR) */}
      <Dialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider – Montant réel envoyé (EUR)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Label>Montant réel envoyé (EUR) *</Label>
            <Input type="text" inputMode="decimal" value={realAmountEUR} onChange={(e) => setRealAmountEUR(e.target.value)} placeholder="Ex: 150.50" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateDialogOpen(false)}>Annuler</Button>
            <Button onClick={confirmValidate} disabled={!realAmountEUR.trim()}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}
