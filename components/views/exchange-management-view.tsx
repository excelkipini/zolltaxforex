"use client"

import * as React from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Wallet,
  RefreshCw,
  Package,
  ShoppingCart,
  ArrowRightLeft,
  FileText,
  ExternalLink,
  TrendingUp,
  Pencil,
  Eye,
  Receipt,
  Filter,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Euro,
  Building2,
  Users,
  Send,
  Printer,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageLoader } from "@/components/ui/page-loader"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import { printExchangeReceipt, generateReceiptId, type ExchangeReceiptData } from "@/lib/exchange-receipts"

interface ExchangeManagementViewProps {
  user: { id: string; name: string; email: string; role: string; agency?: string }
}

type OpRow = {
  id: string
  operation_type: "appro" | "vente" | "cession" | "maj_manuelle" | "appro_agence" | "change_achat" | "change_vente"
  payload: Record<string, unknown>
  created_by: string
  created_at: string
  agency_id?: string | null
  agency_name?: string | null
}

type AgencyCaisse = {
  agency_id: string
  agency_name: string
  balances: { XAF: number; USD: number; EUR: number; GBP: number }
  last_appro_rates: { USD: number | null; EUR: number | null; GBP: number | null }
}

// Rôles ayant accès à toutes les caisses
const ADMIN_ROLES = ["director", "auditor", "accounting", "super_admin", "delegate"]

export function ExchangeManagementView({ user }: ExchangeManagementViewProps) {
  useDocumentTitle("Caisse - Bureau de change")

  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  
  // Caisse sélectionnée (null = principale)
  const [selectedAgencyId, setSelectedAgencyId] = React.useState<string | null>(null)
  const [agencies, setAgencies] = React.useState<AgencyCaisse[]>([])
  
  // Soldes de la caisse actuelle
  const [xaf, setXaf] = React.useState(0)
  const [usd, setUsd] = React.useState(0)
  const [eur, setEur] = React.useState(0)
  const [gbp, setGbp] = React.useState(0)
  const [lastApproRateUsd, setLastApproRateUsd] = React.useState<number | null>(null)
  const [lastApproRateEur, setLastApproRateEur] = React.useState<number | null>(null)
  const [lastApproRateGbp, setLastApproRateGbp] = React.useState<number | null>(null)
  const [commissionUsd, setCommissionUsd] = React.useState(0)
  const [commissionEur, setCommissionEur] = React.useState(0)
  const [commissionGbp, setCommissionGbp] = React.useState(0)
  const [operations, setOperations] = React.useState<OpRow[]>([])
  
  // Motifs mise à jour manuelle
  const [lastManualMotifXaf, setLastManualMotifXaf] = React.useState<string | null>(null)
  const [lastManualMotifUsd, setLastManualMotifUsd] = React.useState<string | null>(null)
  const [lastManualMotifEur, setLastManualMotifEur] = React.useState<string | null>(null)
  const [lastManualMotifGbp, setLastManualMotifGbp] = React.useState<string | null>(null)

  // Détails opération
  const [detailsOp, setDetailsOp] = React.useState<OpRow | null>(null)

  // Mise à jour manuelle caisse
  const [updateCaisseOpen, setUpdateCaisseOpen] = React.useState(false)
  const [updateCaisseCurrency, setUpdateCaisseCurrency] = React.useState<"XAF" | "USD" | "EUR" | "GBP">("XAF")
  const [updateCaisseCurrentBalance, setUpdateCaisseCurrentBalance] = React.useState(0)
  const [updateCaisseNewBalance, setUpdateCaisseNewBalance] = React.useState("")
  const [updateCaisseMotif, setUpdateCaisseMotif] = React.useState("")
  const [updateCaisseSubmitting, setUpdateCaisseSubmitting] = React.useState(false)

  // Vérifier si l'utilisateur est admin (accès à toutes les caisses)
  const isAdmin = ADMIN_ROLES.includes(user.role)
  
  // Trouver l'agence de l'utilisateur
  const userAgencyId = React.useMemo(() => {
    if (isAdmin) return null // Les admins voient d'abord la caisse principale
    const userAgency = agencies.find(a => a.agency_name === user.agency)
    return userAgency?.agency_id || null
  }, [isAdmin, agencies, user.agency])

  // Filtres et tri du reporting
  const getReportDateRange = () => {
    const today = new Date()
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: format(first, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") }
  }
  const [reportDateFrom, setReportDateFrom] = React.useState(() => getReportDateRange().from)
  const [reportDateTo, setReportDateTo] = React.useState(() => getReportDateRange().to)
  const [reportTypeFilter, setReportTypeFilter] = React.useState<string>("all")
  const [reportAgencyFilter, setReportAgencyFilter] = React.useState<string>("all")
  const [reportCashierFilter, setReportCashierFilter] = React.useState<string>("all")
  const [reportSortBy, setReportSortBy] = React.useState<"date" | "type" | "details" | "par">("date")
  const [reportSortDir, setReportSortDir] = React.useState<"asc" | "desc">("desc")
  const [reportPage, setReportPage] = React.useState(1)
  const [reportPerPage, setReportPerPage] = React.useState(10)

  // Liste des caissiers uniques pour le filtre
  const uniqueCashiers = React.useMemo(() => {
    const cashiers = new Set<string>()
    operations.forEach(op => {
      if (op.created_by) cashiers.add(op.created_by)
    })
    return Array.from(cashiers).sort()
  }, [operations])

  // Liste des agences uniques pour le filtre (à partir des opérations)
  const uniqueOperationAgencies = React.useMemo(() => {
    const agencyMap = new Map<string, string>()
    operations.forEach(op => {
      if (op.agency_id && op.agency_name) {
        agencyMap.set(op.agency_id, op.agency_name)
      }
    })
    // Ajouter "Principale" pour les opérations sans agence
    const hasMainCaisse = operations.some(op => !op.agency_id)
    const result: { id: string | null; name: string }[] = []
    if (hasMainCaisse) {
      result.push({ id: null, name: "Principale" })
    }
    agencyMap.forEach((name, id) => {
      result.push({ id, name })
    })
    return result.sort((a, b) => {
      if (a.id === null) return -1
      if (b.id === null) return 1
      return a.name.localeCompare(b.name)
    })
  }, [operations])

  const toggleReportSort = (col: "date" | "type" | "details" | "par") => {
    if (reportSortBy === col) setReportSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else {
      setReportSortBy(col)
      setReportSortDir(col === "date" ? "desc" : "asc")
    }
  }

  const filteredOperations = React.useMemo(() => {
    return operations.filter((op) => {
      const opDate = op.created_at.slice(0, 10)
      if (opDate < reportDateFrom || opDate > reportDateTo) return false
      if (reportTypeFilter !== "all" && op.operation_type !== reportTypeFilter) return false
      // Filtre par agence
      if (reportAgencyFilter !== "all") {
        if (reportAgencyFilter === "principale") {
          if (op.agency_id) return false
        } else {
          if (op.agency_id !== reportAgencyFilter) return false
        }
      }
      // Filtre par caissier
      if (reportCashierFilter !== "all" && op.created_by !== reportCashierFilter) return false
      return true
    })
  }, [operations, reportDateFrom, reportDateTo, reportTypeFilter, reportAgencyFilter, reportCashierFilter])

  const filteredAndSortedOperations = React.useMemo(() => {
    const list = [...filteredOperations].sort((a, b) => {
      let cmp = 0
      if (reportSortBy === "date") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (reportSortBy === "type") {
        const order: Record<string, number> = { change_achat: 0, change_vente: 1, appro: 2, vente: 3, cession: 4, maj_manuelle: 5, appro_agence: 6 }
        cmp = (order[a.operation_type] ?? 99) - (order[b.operation_type] ?? 99)
      } else if (reportSortBy === "details") {
        const sa = String((a.payload as any).montant ?? (a.payload as any).beneficiaire ?? (a.payload as any).currency ?? "")
        const sb = String((b.payload as any).montant ?? (b.payload as any).beneficiaire ?? (b.payload as any).currency ?? "")
        cmp = sa.localeCompare(sb)
      } else {
        cmp = (a.created_by ?? "").localeCompare(b.created_by ?? "")
      }
      return reportSortDir === "asc" ? cmp : -cmp
    })
    return list
  }, [filteredOperations, reportSortBy, reportSortDir])

  const reportTotal = filteredAndSortedOperations.length
  const reportTotalPages = Math.max(1, Math.ceil(reportTotal / reportPerPage))
  const reportStart = (reportPage - 1) * reportPerPage
  const reportEnd = Math.min(reportStart + reportPerPage, reportTotal)
  const paginatedOperations = filteredAndSortedOperations.slice(reportStart, reportEnd)

  React.useEffect(() => {
    setReportPage(1)
  }, [reportDateFrom, reportDateTo, reportTypeFilter, reportAgencyFilter, reportCashierFilter, reportPerPage])

  React.useEffect(() => {
    if (reportPage > reportTotalPages) setReportPage(Math.max(1, reportTotalPages))
  }, [reportPage, reportTotalPages])

  /** Variation des caisses sur la période filtrée */
  const movementFromFilter = React.useMemo(() => {
    let movXaf = 0
    let movUsd = 0
    let movEur = 0
    let movGbp = 0
    for (const op of filteredOperations) {
      const p = op.payload as Record<string, unknown>
      if (op.operation_type === "appro") {
        const montant = Number(p.montant ?? 0)
        const deviseAchat = String(p.devise_achat ?? "")
        const totalDispo = Number(p.total_devise_disponible ?? 0)
        const deviseAchetee = String(p.devise_achetee ?? "")
        if (deviseAchat === "XAF") movXaf -= montant
        else if (deviseAchat === "USD") movUsd -= montant
        else if (deviseAchat === "EUR") movEur -= montant
        else if (deviseAchat === "GBP") movGbp -= montant
        if (deviseAchetee === "USD") movUsd += totalDispo
        else if (deviseAchetee === "EUR") movEur += totalDispo
        else if (deviseAchetee === "GBP") movGbp += totalDispo
      } else if (op.operation_type === "vente") {
        const montant = Number(p.montant_vendu ?? 0)
        const dev = String(p.devise_vendu ?? "")
        if (dev === "USD") movUsd -= montant
        else if (dev === "EUR") movEur -= montant
        else if (dev === "GBP") movGbp -= montant
      } else if (op.operation_type === "cession") {
        const montant = Number(p.montant ?? 0)
        const dev = String(p.devise ?? "")
        if (dev === "XAF") movXaf -= montant
        else if (dev === "USD") movUsd -= montant
        else if (dev === "EUR") movEur -= montant
        else if (dev === "GBP") movGbp -= montant
      } else if (op.operation_type === "appro_agence") {
        // Pour la caisse principale, c'est une sortie
        movXaf -= Number(p.total_xaf ?? 0)
        movUsd -= Number(p.total_usd ?? 0)
        movEur -= Number(p.total_eur ?? 0)
        movGbp -= Number(p.total_gbp ?? 0)
      } else if (op.operation_type === "change_achat") {
        // Client vend des devises -> on reçoit des devises, on donne du XAF
        const montantDevise = Number(p.montant_devise ?? 0)
        const montantXaf = Number(p.montant_xaf ?? 0)
        const dev = String(p.devise ?? "")
        movXaf -= montantXaf
        if (dev === "USD") movUsd += montantDevise
        else if (dev === "EUR") movEur += montantDevise
        else if (dev === "GBP") movGbp += montantDevise
      } else if (op.operation_type === "change_vente") {
        // Client achète des devises -> on donne des devises, on reçoit du XAF
        const montantDevise = Number(p.montant_devise ?? 0)
        const montantXaf = Number(p.montant_xaf ?? 0)
        const dev = String(p.devise ?? "")
        movXaf += montantXaf
        if (dev === "USD") movUsd -= montantDevise
        else if (dev === "EUR") movEur -= montantDevise
        else if (dev === "GBP") movGbp -= montantDevise
      }
    }
    return { xaf: movXaf, usd: movUsd, eur: movEur, gbp: movGbp }
  }, [filteredOperations])

  /** Commissions générées (ventes) par devise, sur la période filtrée (en XAF). */
  const commissionsByDevise = React.useMemo(() => {
    let usd = 0
    let eur = 0
    let gbp = 0
    for (const op of filteredOperations) {
      const p = op.payload as Record<string, unknown>
      const commission = Number(p.commission ?? 0)
      
      if (op.operation_type === "vente") {
        const dev = String(p.devise_vendu ?? "")
        if (dev === "USD") usd += commission
        else if (dev === "EUR") eur += commission
        else if (dev === "GBP") gbp += commission
      } else if (op.operation_type === "change_vente") {
        // Commissions des opérations de change (vente au client)
        const dev = String(p.devise ?? "")
        if (dev === "USD") usd += commission
        else if (dev === "EUR") eur += commission
        else if (dev === "GBP") gbp += commission
      }
    }
    return { usd, eur, gbp }
  }, [filteredOperations])

  const defaultRange = React.useMemo(() => getReportDateRange(), [])
  const hasActiveFilter =
    reportTypeFilter !== "all" ||
    reportAgencyFilter !== "all" ||
    reportCashierFilter !== "all" ||
    reportDateFrom !== defaultRange.from ||
    reportDateTo !== defaultRange.to

  // Charger les agences
  const loadAgencies = React.useCallback(async () => {
    try {
      const res = await fetch("/api/exchange-caisse?action=agencies")
      const data = await res.json()
      if (data.success && Array.isArray(data.agencies)) {
        setAgencies(data.agencies)
      }
    } catch (e) {
      console.error("Erreur chargement agences:", e)
    }
  }, [])

  // Charger les données de la caisse sélectionnée
  const loadCaisseData = React.useCallback(async (agencyId: string | null) => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (agencyId) params.set("agencyId", agencyId)
      
      const [resBal, resOps] = await Promise.all([
        fetch(`/api/exchange-caisse?${params}`),
        // Pour la caisse principale, inclure toutes les opérations si admin
        fetch(`/api/exchange-caisse?action=operations&limit=1000${agencyId ? `&agencyId=${agencyId}` : (isAdmin && selectedAgencyId === null ? '&includeAll=true' : '')}`),
      ])
      const bal = await resBal.json()
      const ops = await resOps.json()
      
      if (bal.success) {
        setXaf(bal.xaf ?? 0)
        setUsd(bal.usd ?? 0)
        setEur(bal.eur ?? 0)
        setGbp(bal.gbp ?? 0)
        setLastApproRateUsd(bal.lastApproRateUsd != null ? Math.round(Number(bal.lastApproRateUsd) * 100) / 100 : null)
        setLastApproRateEur(bal.lastApproRateEur != null ? Math.round(Number(bal.lastApproRateEur) * 100) / 100 : null)
        setLastApproRateGbp(bal.lastApproRateGbp != null ? Math.round(Number(bal.lastApproRateGbp) * 100) / 100 : null)
        setLastManualMotifXaf(bal.lastManualMotifXaf ?? null)
        setLastManualMotifUsd(bal.lastManualMotifUsd ?? null)
        setLastManualMotifEur(bal.lastManualMotifEur ?? null)
        setLastManualMotifGbp(bal.lastManualMotifGbp ?? null)
        setCommissionUsd(bal.commissionUsd ?? 0)
        setCommissionEur(bal.commissionEur ?? 0)
        setCommissionGbp(bal.commissionGbp ?? 0)
      }
      if (ops.success && Array.isArray(ops.operations)) {
        setOperations(ops.operations)
      }
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast, isAdmin, selectedAgencyId])

  // Charger les données initiales (agences)
  React.useEffect(() => {
    loadAgencies()
  }, [loadAgencies])

  // État pour savoir si l'agence par défaut a été définie
  const [agencyInitialized, setAgencyInitialized] = React.useState(false)

  // Définir l'agence par défaut pour les non-admins
  React.useEffect(() => {
    if (agencies.length === 0) return // Attendre le chargement des agences
    
    if (!isAdmin) {
      // Pour les non-admins, forcer leur agence
      const userAgency = agencies.find(a => a.agency_name === user.agency)
      if (userAgency && selectedAgencyId !== userAgency.agency_id) {
        setSelectedAgencyId(userAgency.agency_id)
      }
      setAgencyInitialized(true)
    } else {
      // Les admins peuvent voir la caisse principale
      setAgencyInitialized(true)
    }
  }, [isAdmin, agencies, user.agency, selectedAgencyId])

  // Charger les données de la caisse quand la sélection change (seulement après initialisation)
  React.useEffect(() => {
    if (!agencyInitialized) return // Attendre que l'agence soit initialisée
    
    // Pour les non-admins, ne jamais charger la caisse principale
    if (!isAdmin && selectedAgencyId === null) return
    
    loadCaisseData(selectedAgencyId)
  }, [selectedAgencyId, loadCaisseData, agencyInitialized, isAdmin])

  const formatAmount = (amount: number, currency: string) =>
    `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`

  const openUpdateCaisse = (currency: "XAF" | "USD" | "EUR" | "GBP") => {
    const balance = currency === "XAF" ? xaf : currency === "USD" ? usd : currency === "EUR" ? eur : gbp
    const lastMotif = currency === "XAF" ? lastManualMotifXaf : currency === "USD" ? lastManualMotifUsd : currency === "EUR" ? lastManualMotifEur : lastManualMotifGbp
    setUpdateCaisseCurrency(currency)
    setUpdateCaisseCurrentBalance(balance)
    setUpdateCaisseNewBalance(String(balance))
    setUpdateCaisseMotif(lastMotif ?? "")
    setUpdateCaisseOpen(true)
  }

  const confirmUpdateCaisse = async () => {
    const val = Number(updateCaisseNewBalance)
    if (isNaN(val) || val < 0) {
      toast({ title: "Erreur", description: "Solde invalide (nombre ≥ 0).", variant: "destructive" })
      return
    }
    setUpdateCaisseSubmitting(true)
    try {
      const res = await fetch("/api/exchange-caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-balance",
          currency: updateCaisseCurrency,
          newBalance: val,
          motif: updateCaisseMotif.trim() || undefined,
          agencyId: selectedAgencyId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: `Caisse ${updateCaisseCurrency} mise à jour.` })
        setUpdateCaisseOpen(false)
        loadCaisseData(selectedAgencyId)
        loadAgencies()
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setUpdateCaisseSubmitting(false)
    }
  }

  // --- Achat devise dialog (anciennement Appro)
  const [approOpen, setApproOpen] = React.useState(false)
  const [approDeviseAchat, setApproDeviseAchat] = React.useState<"XAF" | "USD" | "EUR" | "GBP">("XAF")
  const [approMontant, setApproMontant] = React.useState<string>("")
  const [approDeviseAchetee, setApproDeviseAchetee] = React.useState<"USD" | "EUR" | "GBP">("USD")
  const [approTauxAchat, setApproTauxAchat] = React.useState<string>("")
  const [approDepTransport, setApproDepTransport] = React.useState<string>("0")
  const [approDepBeach, setApproDepBeach] = React.useState<string>("0")
  const [approDepEchangeBillets, setApproDepEchangeBillets] = React.useState<string>("0")
  const [approDeductXaf, setApproDeductXaf] = React.useState(false)
  const [approDeductUsd, setApproDeductUsd] = React.useState(false)
  const [approDeductEur, setApproDeductEur] = React.useState(false)
  const [approDeductGbp, setApproDeductGbp] = React.useState(false)
  const [approSubmitting, setApproSubmitting] = React.useState(false)

  const montantNum = Number(approMontant) || 0
  const tauxNum = Number(approTauxAchat) || 0
  const depTransport = Number(approDepTransport) || 0
  const depBeach = Number(approDepBeach) || 0
  const depEchangeBillets = Number(approDepEchangeBillets) || 0
  const depenses = depTransport + depBeach + depEchangeBillets
  const montantDeviseAchetee = tauxNum > 0 ? montantNum / tauxNum : 0
  // Les dépenses sont en devise (pas en XAF), donc on les soustrait directement
  const totalDeviseDisponible = Math.max(0, montantDeviseAchetee - depenses)
  const tauxReel = totalDeviseDisponible > 0 ? montantNum / totalDeviseDisponible : tauxNum

  const handleApproSubmit = async () => {
    if (!montantNum || montantNum <= 0 || !tauxNum || tauxNum <= 0) {
      toast({ title: "Erreur", description: "Montant et Taux achat requis et > 0.", variant: "destructive" })
      return
    }
    if (approDeviseAchat === "XAF" && !approDeductXaf) {
      toast({ title: "Erreur", description: "Sélectionnez Caisse XAF pour déduire.", variant: "destructive" })
      return
    }
    if (approDeviseAchat === "USD" && !approDeductUsd) {
      toast({ title: "Erreur", description: "Sélectionnez Caisse USD pour déduire.", variant: "destructive" })
      return
    }
    if (approDeviseAchat === "EUR" && !approDeductEur) {
      toast({ title: "Erreur", description: "Sélectionnez Caisse EUR pour déduire.", variant: "destructive" })
      return
    }
    if (approDeviseAchat === "GBP" && !approDeductGbp) {
      toast({ title: "Erreur", description: "Sélectionnez Caisse GBP pour déduire.", variant: "destructive" })
      return
    }
    setApproSubmitting(true)
    try {
      const res = await fetch("/api/exchange-caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "achat-devise",
          deviseAchat: approDeviseAchat,
          montant: montantNum,
          deviseAchetee: approDeviseAchetee,
          tauxAchat: tauxNum,
          depensesTransport: depTransport,
          depensesBeach: depBeach,
          depensesEchangeBillets: depEchangeBillets,
          deductFromXaf: approDeductXaf,
          deductFromUsd: approDeductUsd,
          deductFromEur: approDeductEur,
          deductFromGbp: approDeductGbp,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: "Achat devise enregistré. Caisses mises à jour." })
        // Imprimer le reçu
        const receiptData: ExchangeReceiptData = {
          type: "achat_devise",
          receiptId: generateReceiptId("ACH"),
          date: new Date().toLocaleString("fr-FR"),
          agent: user.name,
          deviseAchat: approDeviseAchat,
          montant: montantNum,
          deviseAchetee: approDeviseAchetee,
          tauxAchat: tauxNum,
          montantDeviseAchetee,
          totalDeviseDisponible,
          tauxReel,
          depTransport,
          depBeach,
          depEchangeBillets,
        }
        printExchangeReceipt(receiptData)
        setApproOpen(false)
        resetApproForm()
        loadCaisseData(selectedAgencyId)
        loadAgencies()
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setApproSubmitting(false)
    }
  }

  const resetApproForm = () => {
    setApproMontant("")
    setApproTauxAchat("")
    setApproDepTransport("0")
    setApproDepBeach("0")
    setApproDepEchangeBillets("0")
    setApproDeductXaf(false)
    setApproDeductUsd(false)
    setApproDeductEur(false)
    setApproDeductGbp(false)
  }

  // --- Appro agence dialog (anciennement Cession)
  const [approAgenceOpen, setApproAgenceOpen] = React.useState(false)
  const [approAgenceDistributions, setApproAgenceDistributions] = React.useState<Map<string, { xaf: string; usd: string; eur: string; gbp: string }>>(new Map())
  const [approAgenceSubmitting, setApproAgenceSubmitting] = React.useState(false)

  const toggleAgencySelection = (agencyId: string) => {
    const newDist = new Map(approAgenceDistributions)
    if (newDist.has(agencyId)) {
      newDist.delete(agencyId)
    } else {
      newDist.set(agencyId, { xaf: "0", usd: "0", eur: "0", gbp: "0" })
    }
    setApproAgenceDistributions(newDist)
  }

  const updateAgencyAmount = (agencyId: string, currency: "xaf" | "usd" | "eur" | "gbp", value: string) => {
    const newDist = new Map(approAgenceDistributions)
    const current = newDist.get(agencyId) || { xaf: "0", usd: "0", eur: "0", gbp: "0" }
    current[currency] = value
    newDist.set(agencyId, current)
    setApproAgenceDistributions(newDist)
  }

  // Calculer les totaux pour l'appro agence
  const approAgenceTotals = React.useMemo(() => {
    let totalXaf = 0
    let totalUsd = 0
    let totalEur = 0
    let totalGbp = 0
    approAgenceDistributions.forEach((amounts) => {
      totalXaf += Number(amounts.xaf) || 0
      totalUsd += Number(amounts.usd) || 0
      totalEur += Number(amounts.eur) || 0
      totalGbp += Number(amounts.gbp) || 0
    })
    return {
      count: approAgenceDistributions.size,
      totalXaf,
      totalUsd,
      totalEur,
      totalGbp,
      resteXaf: xaf - totalXaf,
      resteUsd: usd - totalUsd,
      resteEur: eur - totalEur,
      resteGbp: gbp - totalGbp,
    }
  }, [approAgenceDistributions, xaf, usd, eur, gbp])

  const handleApproAgenceSubmit = async () => {
    if (approAgenceDistributions.size === 0) {
      toast({ title: "Erreur", description: "Sélectionnez au moins une agence.", variant: "destructive" })
      return
    }

    // Vérifier qu'il y a au moins un montant > 0
    let hasAmount = false
    approAgenceDistributions.forEach((amounts) => {
      if ((Number(amounts.xaf) || 0) > 0 || (Number(amounts.usd) || 0) > 0 || (Number(amounts.eur) || 0) > 0 || (Number(amounts.gbp) || 0) > 0) {
        hasAmount = true
      }
    })
    if (!hasAmount) {
      toast({ title: "Erreur", description: "Entrez au moins un montant > 0.", variant: "destructive" })
      return
    }

    // Vérifier les soldes
    if (approAgenceTotals.resteXaf < 0 || approAgenceTotals.resteUsd < 0 || approAgenceTotals.resteEur < 0 || approAgenceTotals.resteGbp < 0) {
      toast({ title: "Erreur", description: "Solde insuffisant dans la caisse principale.", variant: "destructive" })
      return
    }

    setApproAgenceSubmitting(true)
    try {
      const distributions: any[] = []
      approAgenceDistributions.forEach((amounts, agencyId) => {
        const agency = agencies.find(a => a.agency_id === agencyId)
        if (agency) {
          distributions.push({
            agencyId,
            agencyName: agency.agency_name,
            montantXaf: Number(amounts.xaf) || 0,
            montantUsd: Number(amounts.usd) || 0,
            montantEur: Number(amounts.eur) || 0,
            montantGbp: Number(amounts.gbp) || 0,
          })
        }
      })

      const res = await fetch("/api/exchange-caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appro-agence",
          distributions,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: `Appro agence enregistré. ${distributions.length} agence(s) approvisionnée(s).` })
        // Imprimer le reçu
        const receiptDists = distributions.map((d: any) => ({
          agencyName: d.agencyName,
          xaf: d.montantXaf,
          usd: d.montantUsd,
          eur: d.montantEur,
          gbp: d.montantGbp,
        }))
        const receiptData: ExchangeReceiptData = {
          type: "appro_agence",
          receiptId: generateReceiptId("APR"),
          date: new Date().toLocaleString("fr-FR"),
          agent: user.name,
          distributions: receiptDists,
          totalXaf: approAgenceTotals.totalXaf,
          totalUsd: approAgenceTotals.totalUsd,
          totalEur: approAgenceTotals.totalEur,
          totalGbp: approAgenceTotals.totalGbp,
          resteXaf: approAgenceTotals.resteXaf,
          resteUsd: approAgenceTotals.resteUsd,
          resteEur: approAgenceTotals.resteEur,
          resteGbp: approAgenceTotals.resteGbp,
        }
        printExchangeReceipt(receiptData)
        setApproAgenceOpen(false)
        setApproAgenceDistributions(new Map())
        loadCaisseData(selectedAgencyId)
        loadAgencies()
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setApproAgenceSubmitting(false)
    }
  }

  // --- Vente dialog
  const [venteOpen, setVenteOpen] = React.useState(false)
  const [venteBeneficiaire, setVenteBeneficiaire] = React.useState("")
  const [venteIdType, setVenteIdType] = React.useState("")
  const [venteIdNumber, setVenteIdNumber] = React.useState("")
  const [venteDeviseVendu, setVenteDeviseVendu] = React.useState<"USD" | "EUR" | "GBP">("USD")
  const [venteMontantVendu, setVenteMontantVendu] = React.useState("")
  const [venteDeviseRecu, setVenteDeviseRecu] = React.useState("XAF")
  const [venteTauxDuJour, setVenteTauxDuJour] = React.useState("")
  const [venteMontantRecu, setVenteMontantRecu] = React.useState("")
  const [venteSubmitting, setVenteSubmitting] = React.useState(false)

  const VENTE_ID_TYPES = [
    { value: "passport", label: "Passeport" },
    { value: "cni", label: "Carte d'identité nationale" },
    { value: "niu", label: "NIU" },
    { value: "permis", label: "Permis de conduire" },
  ]

  const lastApproRate = venteDeviseVendu === "EUR" ? lastApproRateEur : venteDeviseVendu === "GBP" ? lastApproRateGbp : lastApproRateUsd
  const tauxJourNum = Number(venteTauxDuJour) || 0
  const montantVenduNum = Number(venteMontantVendu) || 0
  const venteMontantRecuCalcule = montantVenduNum * tauxJourNum
  const prixVente = venteMontantRecuCalcule
  const prixAchat = montantVenduNum * (lastApproRate ?? tauxJourNum)
  const commissionVente = Math.max(0, prixVente - prixAchat)

  // Mettre à jour automatiquement le montant reçu quand le montant vendu ou le taux change
  React.useEffect(() => {
    setVenteMontantRecu(venteMontantRecuCalcule > 0 ? String(venteMontantRecuCalcule) : "")
  }, [venteMontantRecuCalcule])

  const handleVenteSubmit = async () => {
    if (!venteBeneficiaire.trim()) {
      toast({ title: "Erreur", description: "Bénéficiaire requis.", variant: "destructive" })
      return
    }
    if (!montantVenduNum || montantVenduNum <= 0) {
      toast({ title: "Erreur", description: "Montant vendu requis et > 0.", variant: "destructive" })
      return
    }
    if (!tauxJourNum || tauxJourNum <= 0) {
      toast({ title: "Erreur", description: "Taux du jour requis et > 0.", variant: "destructive" })
      return
    }
    const montantRecuNum = Number(venteMontantRecu) || 0
    if (montantRecuNum <= 0) {
      toast({ title: "Erreur", description: "Montant reçu requis et > 0.", variant: "destructive" })
      return
    }
    setVenteSubmitting(true)
    try {
      const res = await fetch("/api/exchange-caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vente",
          beneficiaire: venteBeneficiaire.trim(),
          idType: venteIdType || null,
          idTypeLabel: VENTE_ID_TYPES.find(t => t.value === venteIdType)?.label || null,
          idNumber: venteIdNumber.trim() || null,
          deviseVendu: venteDeviseVendu,
          montantVendu: montantVenduNum,
          deviseRecu: venteDeviseRecu,
          tauxDuJour: tauxJourNum,
          montantRecu: montantRecuNum,
          agencyId: selectedAgencyId,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: `Vente enregistrée. Commission: ${commissionVente.toLocaleString("fr-FR")} XAF` })
        // Imprimer le reçu
        const receiptData: ExchangeReceiptData = {
          type: "vente_devise",
          receiptId: generateReceiptId("VNT"),
          date: new Date().toLocaleString("fr-FR"),
          agent: user.name,
          beneficiaire: venteBeneficiaire.trim(),
          clientIdType: VENTE_ID_TYPES.find(t => t.value === venteIdType)?.label,
          clientIdNumber: venteIdNumber.trim() || undefined,
          deviseVendu: venteDeviseVendu,
          montantVendu: montantVenduNum,
          deviseRecu: venteDeviseRecu,
          tauxDuJour: tauxJourNum,
          montantRecu: montantRecuNum,
          lastApproRate,
          commissionVente,
        }
        printExchangeReceipt(receiptData)
        setVenteOpen(false)
        setVenteBeneficiaire("")
        setVenteIdType("")
        setVenteIdNumber("")
        setVenteMontantVendu("")
        setVenteTauxDuJour("")
        setVenteMontantRecu("")
        loadCaisseData(selectedAgencyId)
        loadAgencies()
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setVenteSubmitting(false)
    }
  }

  // Obtenir le libellé du type d'opération
  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case "appro": return "Achat devise (caisse)"
      case "vente": return "Vente devise (caisse)"
      case "cession": return "Cession de devise"
      case "maj_manuelle": return "Mise à jour manuelle"
      case "appro_agence": return "Appro agence"
      case "change_achat": return "Change - Achat"
      case "change_vente": return "Change - Vente"
      default: return type
    }
  }

  // Détails d'une opération
  const getOpDetails = (op: OpRow) => {
    const p = op.payload as Record<string, unknown>
    const num = (v: unknown) => Number(v ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    
    if (op.operation_type === "appro") {
      return [
        { label: "Devise d'achat", value: String(p.devise_achat ?? "") },
        { label: "Montant", value: num(p.montant) + " " + (p.devise_achat ?? "") },
        { label: "Devise achetée", value: String(p.devise_achetee ?? "") },
        { label: "Taux achat", value: num(p.taux_achat) + " XAF" },
        { label: "Montant devise achetée", value: num(p.montant_devise_achetee) + " " + (p.devise_achetee ?? "") },
        { label: "Dépenses transport", value: num(p.depenses_transport) },
        { label: "Dépenses beach", value: num(p.depenses_beach) },
        { label: "Dépenses échange billets", value: num(p.depenses_echange_billets) },
        { label: "Total devise disponible", value: num(p.total_devise_disponible) + " " + (p.devise_achetee ?? "") },
        { label: "Taux réel", value: num(p.taux_reel) + " XAF" },
      ]
    }
    if (op.operation_type === "vente") {
      return [
        { label: "Bénéficiaire", value: String(p.beneficiaire ?? "") },
        { label: "Devise vendu", value: String(p.devise_vendu ?? "") },
        { label: "Montant vendu", value: num(p.montant_vendu) + " " + (p.devise_vendu ?? "") },
        { label: "Devise reçu", value: String(p.devise_recu ?? "") },
        { label: "Taux du jour", value: num(p.taux_du_jour) + " XAF" },
        { label: "Montant reçu", value: num(p.montant_recu) + " " + (p.devise_recu ?? "") },
        { label: "Taux réel dernière appro", value: num(p.last_appro_rate) + " XAF" },
        { label: "Commission", value: num(p.commission) + " XAF" },
      ]
    }
    if (op.operation_type === "maj_manuelle") {
      return [
        { label: "Caisse", value: String(p.currency ?? "") },
        { label: "Ancien solde", value: num(p.previous_balance) + " " + (p.currency ?? "") },
        { label: "Nouveau solde", value: num(p.new_balance) + " " + (p.currency ?? "") },
        { label: "Motif", value: String(p.motif ?? "—") },
      ]
    }
    if (op.operation_type === "appro_agence") {
      const distributions = (p.distributions as any[]) || []
      return [
        { label: "Nombre d'agences", value: String(distributions.length) },
        { label: "Total XAF", value: num(p.total_xaf) + " XAF" },
        { label: "Total USD", value: num(p.total_usd) + " USD" },
        { label: "Total EUR", value: num(p.total_eur) + " EUR" },
        { label: "Total GBP", value: num(p.total_gbp) + " GBP" },
        { label: "Agences", value: distributions.map((d: any) => d.agencyName).join(", ") || "—" },
      ]
    }
    if (op.operation_type === "change_achat") {
      return [
        { label: "Type", value: "Achat devise (client vend)" },
        { label: "Devise", value: String(p.devise ?? "") },
        { label: "Montant devise", value: num(p.montant_devise) + " " + (p.devise ?? "") },
        { label: "Montant XAF", value: num(p.montant_xaf) + " XAF" },
        { label: "Taux appliqué", value: num(p.taux_applique) + " XAF" },
        { label: "Taux réel appro", value: p.taux_reel_appro ? num(p.taux_reel_appro) + " XAF" : "—" },
        { label: "Commission", value: num(p.commission) + " XAF" },
        { label: "Agence", value: String(p.agence ?? "") },
      ]
    }
    if (op.operation_type === "change_vente") {
      return [
        { label: "Type", value: "Vente devise (client achète)" },
        { label: "Devise", value: String(p.devise ?? "") },
        { label: "Montant devise", value: num(p.montant_devise) + " " + (p.devise ?? "") },
        { label: "Montant XAF", value: num(p.montant_xaf) + " XAF" },
        { label: "Taux appliqué", value: num(p.taux_applique) + " XAF" },
        { label: "Taux réel appro", value: p.taux_reel_appro ? num(p.taux_reel_appro) + " XAF" : "—" },
        { label: "Commission", value: num(p.commission) + " XAF" },
        { label: "Agence", value: String(p.agence ?? "") },
      ]
    }
    // cession
    return [
      { label: "Devise", value: String(p.devise ?? "") },
      { label: "Montant", value: num(p.montant) + " " + (p.devise ?? "") },
      { label: "Bénéficiaire", value: String(p.beneficiaire ?? "") },
    ]
  }

  // Export des opérations du reporting
  const handleExportReportCsv = () => {
    if (filteredAndSortedOperations.length === 0) return
    const headers = ["Date", "Type", "Caisse", "Détails", "Par"]
    const rows = filteredAndSortedOperations.map(op => {
      const p = op.payload as Record<string, unknown>
      return [
        `"${new Date(op.created_at).toLocaleString("fr-FR")}"`,
        `"${op.type}"`,
        `"${op.agency_name || "Principale"}"`,
        `"${String(p?.summary || p?.details || op.type).replace(/"/g, '""')}"`,
        `"${op.created_by}"`
      ].join(",")
    })
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `reporting-change-${new Date().toISOString().split("T")[0]}.csv`
    a.style.visibility = "hidden"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const handleExportReportPdf = () => {
    if (filteredAndSortedOperations.length === 0) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporting Change</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #2563eb;margin-bottom:10px}.header h1{font-size:18px;color:#1e3a5f;font-weight:700}.header .subtitle{font-size:11px;color:#64748b;margin-top:2px}.header .meta{text-align:right;font-size:10px;color:#64748b}
.summary{display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap}.summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;min-width:140px}.summary-card .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}.summary-card .value{font-size:16px;font-weight:700;color:#1e293b;margin-top:2px}
table{width:100%;border-collapse:collapse}thead th{background:#1e3a5f;color:#fff;padding:7px 8px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}thead th:first-child{border-radius:4px 0 0 0}thead th:last-child{border-radius:0 4px 0 0}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:6px 8px;font-size:10px;vertical-align:middle}
.footer{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>ZOLL TAX FOREX</h1><div class="subtitle">Reporting des Opérations de Change${selectedAgencyId === null && isAdmin ? " — Toutes les caisses" : ` — ${selectedAgencyName}`}</div></div><div class="meta">Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div></div>
<div class="summary"><div class="summary-card"><div class="label">Total opérations</div><div class="value">${filteredAndSortedOperations.length}</div></div></div>
<table><thead><tr><th>#</th><th>Date</th><th>Type</th><th>Caisse</th><th>Détails</th><th>Par</th></tr></thead>
<tbody>${filteredAndSortedOperations.map((op, i) => {
      const p = op.payload as Record<string, unknown>
      return `<tr><td>${i+1}</td><td>${new Date(op.created_at).toLocaleString("fr-FR")}</td><td>${op.type}</td><td>${op.agency_name||"Principale"}</td><td>${String(p?.summary||p?.details||op.type)}</td><td>${op.created_by}</td></tr>`
    }).join("")}</tbody></table>
<div class="footer"><span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span><span>${filteredAndSortedOperations.length} enregistrements</span></div>
</body></html>`
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
  }

  // Générer un reçu à partir d'une opération du reporting
  const handlePrintOpReceipt = (op: OpRow) => {
    const p = op.payload as Record<string, unknown>
    const opDate = new Date(op.created_at).toLocaleString("fr-FR")
    
    let receiptData: ExchangeReceiptData | null = null
    
    if (op.operation_type === "appro") {
      receiptData = {
        type: "achat_devise",
        receiptId: generateReceiptId("ACH"),
        date: opDate,
        agent: op.created_by,
        deviseAchat: String(p.devise_achat ?? "XAF"),
        montant: Number(p.montant ?? 0),
        deviseAchetee: String(p.devise_achetee ?? ""),
        tauxAchat: Number(p.taux_achat ?? 0),
        montantDeviseAchetee: Number(p.montant_devise_achetee ?? 0),
        totalDeviseDisponible: Number(p.total_devise_disponible ?? 0),
        tauxReel: Number(p.taux_reel ?? 0),
        depTransport: Number(p.depenses_transport ?? 0),
        depBeach: Number(p.depenses_beach ?? 0),
        depEchangeBillets: Number(p.depenses_echange_billets ?? 0),
      }
    } else if (op.operation_type === "vente") {
      receiptData = {
        type: "vente_devise",
        receiptId: generateReceiptId("VNT"),
        date: opDate,
        agent: op.created_by,
        beneficiaire: String(p.beneficiaire ?? ""),
        clientIdType: p.id_type_label ? String(p.id_type_label) : undefined,
        clientIdNumber: p.id_number ? String(p.id_number) : undefined,
        deviseVendu: String(p.devise_vendu ?? ""),
        montantVendu: Number(p.montant_vendu ?? 0),
        deviseRecu: String(p.devise_recu ?? ""),
        tauxDuJour: Number(p.taux_du_jour ?? 0),
        montantRecu: Number(p.montant_recu ?? 0),
        lastApproRate: p.last_appro_rate ? Number(p.last_appro_rate) : null,
        commissionVente: Number(p.commission ?? 0),
      }
    } else if (op.operation_type === "appro_agence") {
      const dists = (p.distributions as any[]) || []
      receiptData = {
        type: "appro_agence",
        receiptId: generateReceiptId("APR"),
        date: opDate,
        agent: op.created_by,
        distributions: dists.map((d: any) => ({
          agencyName: d.agencyName || d.agency_name || "—",
          xaf: Number(d.montantXaf ?? d.montant_xaf ?? 0),
          usd: Number(d.montantUsd ?? d.montant_usd ?? 0),
          eur: Number(d.montantEur ?? d.montant_eur ?? 0),
          gbp: Number(d.montantGbp ?? d.montant_gbp ?? 0),
        })),
        totalXaf: Number(p.total_xaf ?? 0),
        totalUsd: Number(p.total_usd ?? 0),
        totalEur: Number(p.total_eur ?? 0),
        totalGbp: Number(p.total_gbp ?? 0),
        resteXaf: Number(p.solde_restant_xaf ?? 0),
        resteUsd: Number(p.solde_restant_usd ?? 0),
        resteEur: Number(p.solde_restant_eur ?? 0),
        resteGbp: Number(p.solde_restant_gbp ?? 0),
      }
    } else if (op.operation_type === "change_achat") {
      receiptData = {
        type: "change_achat",
        receiptId: generateReceiptId("EXC"),
        date: opDate,
        agent: op.created_by,
        clientName: p.client_name ? String(p.client_name) : undefined,
        clientPhone: p.client_phone ? String(p.client_phone) : undefined,
        clientIdType: p.client_id_type_label ? String(p.client_id_type_label) : undefined,
        clientIdNumber: p.client_id_number ? String(p.client_id_number) : undefined,
        operationType: "Achat devise",
        currency: String(p.devise ?? ""),
        amountForeign: Number(p.montant_devise ?? 0),
        amountXaf: Number(p.montant_xaf ?? 0),
        exchangeRate: Number(p.taux_applique ?? 0),
        commission: Number(p.commission ?? 0),
      }
    } else if (op.operation_type === "change_vente") {
      receiptData = {
        type: "change_vente",
        receiptId: generateReceiptId("EXC"),
        date: opDate,
        agent: op.created_by,
        clientName: p.client_name ? String(p.client_name) : undefined,
        clientPhone: p.client_phone ? String(p.client_phone) : undefined,
        clientIdType: p.client_id_type_label ? String(p.client_id_type_label) : undefined,
        clientIdNumber: p.client_id_number ? String(p.client_id_number) : undefined,
        operationType: "Vente devise",
        currency: String(p.devise ?? ""),
        amountForeign: Number(p.montant_devise ?? 0),
        amountXaf: Number(p.montant_xaf ?? 0),
        exchangeRate: Number(p.taux_applique ?? 0),
        commission: Number(p.commission ?? 0),
      }
    }
    
    if (receiptData) {
      printExchangeReceipt(receiptData)
    }
  }
  
  // Types d'opérations qui supportent les reçus
  const hasReceipt = (type: string) => ["appro", "vente", "appro_agence", "change_achat", "change_vente"].includes(type)

  // Calculer l'agence sélectionnée pour affichage
  const selectedAgencyName = selectedAgencyId 
    ? agencies.find(a => a.agency_id === selectedAgencyId)?.agency_name || "Agence"
    : "Caisse principale"

  // Déterminer les onglets accessibles
  const accessibleTabs = React.useMemo(() => {
    if (isAdmin) {
      // Les admins ont accès à tout
      return [{ id: null, name: "Caisse principale" }, ...agencies.map(a => ({ id: a.agency_id, name: a.agency_name }))]
    } else {
      // Les caissiers n'ont accès qu'à leur agence
      const userAgency = agencies.find(a => a.agency_name === user.agency)
      if (userAgency) {
        return [{ id: userAgency.agency_id, name: userAgency.agency_name }]
      }
      return []
    }
  }, [isAdmin, agencies, user.agency])

  if (loading && operations.length === 0) {
    return <PageLoader message="Chargement des données de caisse..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Caisse - Bureau de change</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestion des caisses de devises et des opérations de change</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadCaisseData(selectedAgencyId); loadAgencies() }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* Tabs pour les différentes caisses */}
      {accessibleTabs.length > 0 && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Sélection de caisse */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Sélectionner une caisse</h3>
                    <p className="text-xs text-muted-foreground">Choisissez la caisse à consulter</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {accessibleTabs.map((tab) => {
                    const isActive = (tab.id || "main") === (selectedAgencyId || "main")
                    const isMain = tab.id === null
                    
                    return (
                      <button
                        key={tab.id || "main"}
                        onClick={() => setSelectedAgencyId(tab.id)}
                        className={`
                          flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-200
                          ${isActive 
                            ? isMain
                              ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20'
                              : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25 ring-2 ring-blue-500/20'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 border border-slate-200'
                          }
                        `}
                      >
                        {isMain ? (
                          <Building2 className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        ) : (
                          <Users className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                        )}
                        <span>{tab.name}</span>
                        {isMain && isActive && (
                          <Badge className="ml-1 h-5 px-1.5 text-[10px] font-semibold bg-white/20 text-white border-0 hover:bg-white/20">
                            Principal
                          </Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Actions rapides - seulement pour la caisse principale et les admins */}
              {selectedAgencyId === null && isAdmin && (
                <div className="flex flex-col gap-2 lg:border-l lg:border-slate-200 lg:pl-4">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Actions rapides</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setApproOpen(true)}
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-md shadow-emerald-500/20"
                      size="sm"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Achat devise
                    </Button>
                    <Button
                      onClick={() => setVenteOpen(true)}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md shadow-blue-500/20"
                      size="sm"
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Vente devise
                    </Button>
                    <Button
                      onClick={() => setApproAgenceOpen(true)}
                      className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-md shadow-violet-500/20"
                      size="sm"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Appro agence
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtres */}
      <div className="space-y-2">
        <div className="rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground shrink-0 flex items-center gap-1.5">
              <Filter className="h-4 w-4" />
              Filtres
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Dates</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                    className="input-date-centered h-9 w-[140px] min-w-0 text-sm"
                  />
                  <span className="text-muted-foreground text-sm shrink-0">au</span>
                  <Input
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                    className="input-date-centered h-9 w-[140px] min-w-0 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Type</Label>
                <Select value={reportTypeFilter} onValueChange={setReportTypeFilter}>
                  <SelectTrigger className="h-9 w-[140px] text-sm">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="change_achat">Change - Achat</SelectItem>
                    <SelectItem value="change_vente">Change - Vente</SelectItem>
                    <SelectItem value="appro">Achat devise (caisse)</SelectItem>
                    <SelectItem value="vente">Vente devise (caisse)</SelectItem>
                    <SelectItem value="appro_agence">Appro agence</SelectItem>
                    <SelectItem value="cession">Cession</SelectItem>
                    <SelectItem value="maj_manuelle">Mise à jour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Filtre par agence */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Agence</Label>
                <Select value={reportAgencyFilter} onValueChange={setReportAgencyFilter}>
                  <SelectTrigger className="h-9 w-[140px] text-sm">
                    <SelectValue placeholder="Agence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="principale">Principale</SelectItem>
                    {agencies.map((agency) => (
                      <SelectItem key={agency.agency_id} value={agency.agency_id}>
                        {agency.agency_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Filtre par caissier */}
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Caissier</Label>
                <Select value={reportCashierFilter} onValueChange={setReportCashierFilter}>
                  <SelectTrigger className="h-9 w-[140px] text-sm">
                    <SelectValue placeholder="Caissier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {uniqueCashiers.map((cashier) => (
                      <SelectItem key={cashier} value={cashier}>
                        {cashier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-sm shrink-0"
                onClick={() => {
                  const r = getReportDateRange()
                  setReportDateFrom(r.from)
                  setReportDateTo(r.to)
                  setReportTypeFilter("all")
                  setReportAgencyFilter("all")
                  setReportCashierFilter("all")
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Section Soldes des caisses */}
      <Card className="border-slate-200 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg shadow-emerald-500/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">Soldes des Caisses</CardTitle>
              <p className="text-sm text-muted-foreground">Aperçu des disponibilités par devise</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Caisse XAF */}
            <div className="relative group rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-green-50 to-emerald-100/50 p-4 transition-all hover:shadow-lg hover:border-emerald-300">
              <div className="absolute top-2 right-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openUpdateCaisse("XAF")} title="Mettre à jour">
                  <Pencil className="h-3.5 w-3.5 text-emerald-600" />
                </Button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-md">
                  <span className="text-sm font-bold">XAF</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Franc CFA</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-900">{formatAmount(xaf, "")}</p>
                </div>
              </div>
              {hasActiveFilter && movementFromFilter.xaf !== 0 && (
                <div className={`text-xs font-medium px-2 py-1 rounded-full inline-flex items-center gap-1 ${movementFromFilter.xaf > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {movementFromFilter.xaf > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                  {movementFromFilter.xaf > 0 ? "+" : ""}{formatAmount(movementFromFilter.xaf, "")}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-emerald-200">
                <p className="text-xs text-emerald-600">Devise locale (pas de taux)</p>
              </div>
            </div>

            {/* Caisse USD */}
            <div className="relative group rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100/50 p-4 transition-all hover:shadow-lg hover:border-blue-300">
              <div className="absolute top-2 right-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openUpdateCaisse("USD")} title="Mettre à jour">
                  <Pencil className="h-3.5 w-3.5 text-blue-600" />
                </Button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">Dollar US</p>
                  <p className="text-2xl font-bold tabular-nums text-blue-900">{formatAmount(usd, "")}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-600">Taux réel dernière appro</p>
                  <p className="text-sm font-bold text-blue-800">
                    {lastApproRateUsd != null ? `${lastApproRateUsd.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Caisse EUR */}
            <div className="relative group rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 via-purple-50 to-violet-100/50 p-4 transition-all hover:shadow-lg hover:border-violet-300">
              <div className="absolute top-2 right-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openUpdateCaisse("EUR")} title="Mettre à jour">
                  <Pencil className="h-3.5 w-3.5 text-violet-600" />
                </Button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
                  <Euro className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">Euro</p>
                  <p className="text-2xl font-bold tabular-nums text-violet-900">{formatAmount(eur, "")}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-violet-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-violet-600">Taux réel dernière appro</p>
                  <p className="text-sm font-bold text-violet-800">
                    {lastApproRateEur != null ? `${lastApproRateEur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Caisse GBP */}
            <div className="relative group rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100/50 p-4 transition-all hover:shadow-lg hover:border-amber-300">
              <div className="absolute top-2 right-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openUpdateCaisse("GBP")} title="Mettre à jour">
                  <Pencil className="h-3.5 w-3.5 text-amber-600" />
                </Button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md">
                  <span className="text-lg font-bold">£</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">Livre Sterling</p>
                  <p className="text-2xl font-bold tabular-nums text-amber-900">{formatAmount(gbp, "")}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-amber-200">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-amber-600">Taux réel dernière appro</p>
                  <p className="text-sm font-bold text-amber-800">
                    {lastApproRateGbp != null ? `${lastApproRateGbp.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF` : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section Commissions générées */}
      <Card className="border-slate-200 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-lg shadow-cyan-500/20">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">Commissions Générées</CardTitle>
              <p className="text-sm text-muted-foreground">Revenus sur la période filtrée</p>
            </div>
            {hasActiveFilter && (
              <Badge variant="secondary" className="ml-auto bg-cyan-100 text-cyan-700 border-0">
                Période filtrée
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Commission USD */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <DollarSign className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-slate-500 uppercase">USD</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{formatAmount(commissionsByDevise.usd, "XAF")}</p>
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${Math.min(100, (commissionsByDevise.usd / (commissionsByDevise.usd + commissionsByDevise.eur + commissionsByDevise.gbp || 1)) * 100)}%` }} />
              </div>
            </div>

            {/* Commission EUR */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Euro className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium text-slate-500 uppercase">EUR</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{formatAmount(commissionsByDevise.eur, "XAF")}</p>
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full" style={{ width: `${Math.min(100, (commissionsByDevise.eur / (commissionsByDevise.usd + commissionsByDevise.eur + commissionsByDevise.gbp || 1)) * 100)}%` }} />
              </div>
            </div>

            {/* Commission GBP */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                  <span className="text-lg font-bold">£</span>
                </div>
                <span className="text-xs font-medium text-slate-500 uppercase">GBP</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-900">{formatAmount(commissionsByDevise.gbp, "XAF")}</p>
              <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" style={{ width: `${Math.min(100, (commissionsByDevise.gbp / (commissionsByDevise.usd + commissionsByDevise.eur + commissionsByDevise.gbp || 1)) * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Total des commissions */}
          <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-teal-50 border border-cyan-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-teal-600 text-white">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-cyan-700">Total des commissions</p>
                  <p className="text-xs text-cyan-600">Toutes devises confondues</p>
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums text-cyan-900">
                {formatAmount(commissionsByDevise.usd + commissionsByDevise.eur + commissionsByDevise.gbp, "XAF")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reporting des transactions */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Reporting des transactions et des actions</CardTitle>
              <p className="text-sm text-muted-foreground font-normal">
                {selectedAgencyId === null && isAdmin 
                  ? "Historique de toutes les caisses" 
                  : `Historique de ${selectedAgencyName}`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs px-2.5">
                    <Download className="h-3.5 w-3.5" />
                    Exporter
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={handleExportReportCsv} className="gap-2 cursor-pointer text-xs">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Exporter en CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportReportPdf} className="gap-2 cursor-pointer text-xs">
                    <FileText className="h-4 w-4 text-red-500" />
                    Exporter en PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="outline" className="text-xs">
                {reportTotal} opération{reportTotal > 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-[150px] cursor-pointer" onClick={() => toggleReportSort("date")}>
                    <div className="flex items-center gap-1">
                      Date
                      {reportSortBy === "date" ? (reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleReportSort("type")}>
                    <div className="flex items-center gap-1">
                      Type
                      {reportSortBy === "type" ? (reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  {selectedAgencyId === null && isAdmin && (
                    <TableHead>Caisse</TableHead>
                  )}
                  <TableHead className="cursor-pointer" onClick={() => toggleReportSort("details")}>
                    <div className="flex items-center gap-1">
                      Détails
                      {reportSortBy === "details" ? (reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead className="cursor-pointer" onClick={() => toggleReportSort("par")}>
                    <div className="flex items-center gap-1">
                      Par
                      {reportSortBy === "par" ? (reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ArrowUpDown className="h-4 w-4 opacity-30" />}
                    </div>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOperations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectedAgencyId === null && isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      Aucune opération trouvée pour la période sélectionnée
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOperations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="text-sm">
                        {format(new Date(op.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          op.operation_type === "change_achat" ? "default" :
                          op.operation_type === "change_vente" ? "secondary" :
                          op.operation_type === "appro" ? "default" :
                          op.operation_type === "vente" ? "secondary" :
                          op.operation_type === "appro_agence" ? "outline" :
                          "outline"
                        } className={`text-xs ${
                          op.operation_type === "change_achat" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" :
                          op.operation_type === "change_vente" ? "bg-blue-100 text-blue-800 hover:bg-blue-100" :
                          ""
                        }`}>
                          {getOperationTypeLabel(op.operation_type)}
                        </Badge>
                      </TableCell>
                      {selectedAgencyId === null && isAdmin && (
                        <TableCell className="text-sm">
                          {op.agency_name || "Principale"}
                        </TableCell>
                      )}
                      <TableCell className="text-sm max-w-xs truncate">
                        {op.operation_type === "appro" && (
                          <>{(op.payload as any).montant?.toLocaleString?.("fr-FR")} {(op.payload as any).devise_achat} → {(op.payload as any).total_devise_disponible?.toLocaleString?.("fr-FR")} {(op.payload as any).devise_achetee}</>
                        )}
                        {op.operation_type === "vente" && (
                          <>{(op.payload as any).beneficiaire} – {(op.payload as any).montant_vendu?.toLocaleString?.("fr-FR")} {(op.payload as any).devise_vendu}</>
                        )}
                        {op.operation_type === "appro_agence" && (
                          <>{((op.payload as any).distributions as any[])?.length || 0} agence(s) – {(op.payload as any).total_xaf?.toLocaleString?.("fr-FR")} XAF, {(op.payload as any).total_usd?.toLocaleString?.("fr-FR")} USD, {(op.payload as any).total_eur?.toLocaleString?.("fr-FR")} EUR</>
                        )}
                        {op.operation_type === "cession" && (
                          <>{(op.payload as any).beneficiaire} – {(op.payload as any).montant?.toLocaleString?.("fr-FR")} {(op.payload as any).devise}</>
                        )}
                        {op.operation_type === "maj_manuelle" && (
                          <>{(op.payload as any).currency}: {(op.payload as any).previous_balance?.toLocaleString?.("fr-FR")} → {(op.payload as any).new_balance?.toLocaleString?.("fr-FR")}</>
                        )}
                        {op.operation_type === "change_achat" && (
                          <>+{(op.payload as any).montant_devise?.toLocaleString?.("fr-FR")} {(op.payload as any).devise} (client vend)</>
                        )}
                        {op.operation_type === "change_vente" && (
                          <>-{(op.payload as any).montant_devise?.toLocaleString?.("fr-FR")} {(op.payload as any).devise} (client achète)</>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{op.created_by}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetailsOp(op)} title="Voir les détails">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {hasReceipt(op.operation_type) && (
                            <Button variant="ghost" size="sm" onClick={() => handlePrintOpReceipt(op)} title="Imprimer le reçu">
                              <Printer className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {reportTotalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Affichage {reportStart + 1}-{reportEnd} sur {reportTotal}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reportPage <= 1}
                  onClick={() => setReportPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {reportPage} / {reportTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reportPage >= reportTotalPages}
                  onClick={() => setReportPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Achat devise (anciennement Appro) */}
      <Dialog open={approOpen} onOpenChange={setApproOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Achat devise</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise d&apos;achat</Label>
                <Select value={approDeviseAchat} onValueChange={(v: "XAF" | "USD" | "EUR" | "GBP") => setApproDeviseAchat(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant</Label>
                <Input type="number" min={0} step="any" value={approMontant} onChange={(e) => setApproMontant(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise à acheter</Label>
                <Select value={approDeviseAchetee} onValueChange={(v: "USD" | "EUR" | "GBP") => setApproDeviseAchetee(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Taux achat</Label>
                <Input type="number" min={0} step="any" value={approTauxAchat} onChange={(e) => setApproTauxAchat(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p><strong>Montant devise achetée:</strong> {montantDeviseAchetee.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {approDeviseAchetee}</p>
              <p><strong>Total devise disponible:</strong> {totalDeviseDisponible.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {approDeviseAchetee}</p>
              <p><strong>Taux réel:</strong> {tauxReel.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Dépenses Transport</Label>
                <Input type="number" min={0} step="any" value={approDepTransport} onChange={(e) => setApproDepTransport(e.target.value)} />
              </div>
              <div>
                <Label>Beach</Label>
                <Input type="number" min={0} step="any" value={approDepBeach} onChange={(e) => setApproDepBeach(e.target.value)} />
              </div>
              <div>
                <Label>Échange billets</Label>
                <Input type="number" min={0} step="any" value={approDepEchangeBillets} onChange={(e) => setApproDepEchangeBillets(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Déduire de</Label>
              <div className="flex flex-wrap gap-4">
                {approDeviseAchat === "XAF" && (
                  <label className="flex items-center gap-2">
                    <Checkbox checked={approDeductXaf} onCheckedChange={(c) => setApproDeductXaf(!!c)} />
                    Caisse XAF
                  </label>
                )}
                {approDeviseAchat === "USD" && (
                  <label className="flex items-center gap-2">
                    <Checkbox checked={approDeductUsd} onCheckedChange={(c) => setApproDeductUsd(!!c)} />
                    Caisse USD
                  </label>
                )}
                {approDeviseAchat === "EUR" && (
                  <label className="flex items-center gap-2">
                    <Checkbox checked={approDeductEur} onCheckedChange={(c) => setApproDeductEur(!!c)} />
                    Caisse EUR
                  </label>
                )}
                {approDeviseAchat === "GBP" && (
                  <label className="flex items-center gap-2">
                    <Checkbox checked={approDeductGbp} onCheckedChange={(c) => setApproDeductGbp(!!c)} />
                    Caisse GBP
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproOpen(false)}>Annuler</Button>
            <Button onClick={handleApproSubmit} disabled={approSubmitting}>
              {approSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Appro agence */}
      <Dialog open={approAgenceOpen} onOpenChange={setApproAgenceOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appro agence</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Transférer des devises de la caisse principale vers les caisses des agences
            </p>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Soldes caisse principale */}
            <div className="rounded-md bg-muted/50 p-3">
              <p className="text-sm font-medium mb-2">Soldes caisse principale</p>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">XAF:</span>{" "}
                  <span className="font-medium">{xaf.toLocaleString("fr-FR")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">USD:</span>{" "}
                  <span className="font-medium">{usd.toLocaleString("fr-FR")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">EUR:</span>{" "}
                  <span className="font-medium">{eur.toLocaleString("fr-FR")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">GBP:</span>{" "}
                  <span className="font-medium">{gbp.toLocaleString("fr-FR")}</span>
                </div>
              </div>
            </div>

            {/* Liste des agences */}
            <div className="space-y-3">
              <Label>Sélectionner les agences à approvisionner</Label>
              {agencies.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune agence disponible</p>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {agencies.map((agency) => {
                    const isSelected = approAgenceDistributions.has(agency.agency_id)
                    const amounts = approAgenceDistributions.get(agency.agency_id) || { xaf: "0", usd: "0", eur: "0", gbp: "0" }
                    
                    return (
                      <div 
                        key={agency.agency_id} 
                        className={`rounded-lg border p-3 transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'border-muted'}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Checkbox 
                            checked={isSelected} 
                            onCheckedChange={() => toggleAgencySelection(agency.agency_id)} 
                          />
                          <div className="flex-1">
                            <p className="font-medium">{agency.agency_name}</p>
                            <p className="text-xs text-muted-foreground">
                              Solde: {agency.balances.XAF.toLocaleString("fr-FR")} XAF, {agency.balances.USD.toLocaleString("fr-FR")} USD, {agency.balances.EUR.toLocaleString("fr-FR")} EUR, {agency.balances.GBP.toLocaleString("fr-FR")} GBP
                            </p>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="grid grid-cols-4 gap-3 pl-7">
                            <div>
                              <Label className="text-xs">XAF</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                step="any" 
                                value={amounts.xaf}
                                onChange={(e) => updateAgencyAmount(agency.agency_id, "xaf", e.target.value)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">USD</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                step="any" 
                                value={amounts.usd}
                                onChange={(e) => updateAgencyAmount(agency.agency_id, "usd", e.target.value)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">EUR</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                step="any" 
                                value={amounts.eur}
                                onChange={(e) => updateAgencyAmount(agency.agency_id, "eur", e.target.value)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">GBP</Label>
                              <Input 
                                type="number" 
                                min={0} 
                                step="any" 
                                value={amounts.gbp}
                                onChange={(e) => updateAgencyAmount(agency.agency_id, "gbp", e.target.value)}
                                placeholder="0"
                                className="h-8"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Résumé */}
            {approAgenceDistributions.size > 0 && (
              <div className="rounded-md bg-primary/10 p-3 space-y-2">
                <p className="text-sm font-medium">Résumé de l&apos;opération</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><span className="text-muted-foreground">Agences sélectionnées:</span> <strong>{approAgenceTotals.count}</strong></p>
                    <p><span className="text-muted-foreground">Total XAF:</span> <strong>{approAgenceTotals.totalXaf.toLocaleString("fr-FR")}</strong></p>
                    <p><span className="text-muted-foreground">Total USD:</span> <strong>{approAgenceTotals.totalUsd.toLocaleString("fr-FR")}</strong></p>
                    <p><span className="text-muted-foreground">Total EUR:</span> <strong>{approAgenceTotals.totalEur.toLocaleString("fr-FR")}</strong></p>
                    <p><span className="text-muted-foreground">Total GBP:</span> <strong>{approAgenceTotals.totalGbp.toLocaleString("fr-FR")}</strong></p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Reste dans la caisse principale:</p>
                    <p className={approAgenceTotals.resteXaf < 0 ? "text-red-600" : ""}>
                      XAF: <strong>{approAgenceTotals.resteXaf.toLocaleString("fr-FR")}</strong>
                    </p>
                    <p className={approAgenceTotals.resteUsd < 0 ? "text-red-600" : ""}>
                      USD: <strong>{approAgenceTotals.resteUsd.toLocaleString("fr-FR")}</strong>
                    </p>
                    <p className={approAgenceTotals.resteEur < 0 ? "text-red-600" : ""}>
                      EUR: <strong>{approAgenceTotals.resteEur.toLocaleString("fr-FR")}</strong>
                    </p>
                    <p className={approAgenceTotals.resteGbp < 0 ? "text-red-600" : ""}>
                      GBP: <strong>{approAgenceTotals.resteGbp.toLocaleString("fr-FR")}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproAgenceOpen(false); setApproAgenceDistributions(new Map()) }}>
              Annuler
            </Button>
            <Button 
              onClick={handleApproAgenceSubmit} 
              disabled={approAgenceSubmitting || approAgenceDistributions.size === 0}
            >
              {approAgenceSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Vente */}
      <Dialog open={venteOpen} onOpenChange={setVenteOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vente de devise</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Bénéficiaire</Label>
              <Input value={venteBeneficiaire} onChange={(e) => setVenteBeneficiaire(e.target.value)} placeholder="Nom du bénéficiaire" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de pièce d&apos;identité</Label>
                <Select value={venteIdType} onValueChange={setVenteIdType}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {VENTE_ID_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Numéro de la pièce</Label>
                <Input value={venteIdNumber} onChange={(e) => setVenteIdNumber(e.target.value)} placeholder="Numéro du document" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise à vendre</Label>
                <Select value={venteDeviseVendu} onValueChange={(v: "USD" | "EUR" | "GBP") => setVenteDeviseVendu(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant vendu</Label>
                <Input type="number" min={0} step="any" value={venteMontantVendu} onChange={(e) => setVenteMontantVendu(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise reçue</Label>
                <Select value={venteDeviseRecu} onValueChange={setVenteDeviseRecu}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Taux du jour</Label>
                <Input type="number" min={0} step="any" value={venteTauxDuJour} onChange={(e) => setVenteTauxDuJour(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Montant reçu (Net à percevoir)</Label>
              <Input type="number" min={0} step="any" value={venteMontantRecu} readOnly className="bg-muted/30 font-mono font-semibold" placeholder="0" />
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p><strong>Taux réel dernière appro:</strong> {lastApproRate?.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"} XAF</p>
              <p><strong>Commission estimée:</strong> {commissionVente.toLocaleString("fr-FR")} XAF</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVenteOpen(false)}>Annuler</Button>
            <Button onClick={handleVenteSubmit} disabled={venteSubmitting}>
              {venteSubmitting ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mise à jour caisse */}
      <Dialog open={updateCaisseOpen} onOpenChange={setUpdateCaisseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mise à jour Caisse {updateCaisseCurrency}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Solde actuel</Label>
              <Input value={updateCaisseCurrentBalance.toLocaleString("fr-FR")} disabled />
            </div>
            <div>
              <Label>Nouveau solde</Label>
              <Input 
                type="number" 
                min={0} 
                step="any" 
                value={updateCaisseNewBalance} 
                onChange={(e) => setUpdateCaisseNewBalance(e.target.value)} 
                placeholder="0" 
              />
            </div>
            <div>
              <Label>Motif (optionnel)</Label>
              <Input 
                value={updateCaisseMotif} 
                onChange={(e) => setUpdateCaisseMotif(e.target.value)} 
                placeholder="Raison de la mise à jour" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateCaisseOpen(false)}>Annuler</Button>
            <Button onClick={confirmUpdateCaisse} disabled={updateCaisseSubmitting}>
              {updateCaisseSubmitting ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Détails opération */}
      <Dialog open={!!detailsOp} onOpenChange={() => setDetailsOp(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Détails de l&apos;opération
              {detailsOp && (
                <Badge variant="outline" className="ml-2">
                  {getOperationTypeLabel(detailsOp.operation_type)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailsOp && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="text-muted-foreground">Date:</span>{" "}
                {format(new Date(detailsOp.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Par:</span> {detailsOp.created_by}
              </div>
              {detailsOp.agency_name && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Caisse:</span> {detailsOp.agency_name}
                </div>
              )}
              <div className="border-t pt-3 space-y-2">
                {getOpDetails(detailsOp).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}:</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsOp(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
