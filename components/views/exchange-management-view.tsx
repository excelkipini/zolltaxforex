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
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageLoader } from "@/components/ui/page-loader"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface ExchangeManagementViewProps {
  user: { id: string; name: string; email: string; role: string; agency?: string }
}

type OpRow = {
  id: string
  operation_type: "appro" | "vente" | "cession" | "maj_manuelle"
  payload: Record<string, unknown>
  created_by: string
  created_at: string
}

export function ExchangeManagementView({ user }: ExchangeManagementViewProps) {
  useDocumentTitle("Gestion de change")

  const [xaf, setXaf] = React.useState(0)
  const [usd, setUsd] = React.useState(0)
  const [eur, setEur] = React.useState(0)
  const [coffreBalance, setCoffreBalance] = React.useState(0)
  const [lastApproRateUsd, setLastApproRateUsd] = React.useState<number | null>(null)
  const [lastApproRateEur, setLastApproRateEur] = React.useState<number | null>(null)
  const [operations, setOperations] = React.useState<OpRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const { toast } = useToast()

  // Détails opération
  const [detailsOp, setDetailsOp] = React.useState<OpRow | null>(null)

  // Mise à jour manuelle caisse
  const [updateCaisseOpen, setUpdateCaisseOpen] = React.useState(false)
  const [updateCaisseCurrency, setUpdateCaisseCurrency] = React.useState<"XAF" | "USD" | "EUR">("XAF")
  const [updateCaisseCurrentBalance, setUpdateCaisseCurrentBalance] = React.useState(0)
  const [updateCaisseNewBalance, setUpdateCaisseNewBalance] = React.useState("")
  const [updateCaisseMotif, setUpdateCaisseMotif] = React.useState("")
  const [updateCaisseSubmitting, setUpdateCaisseSubmitting] = React.useState(false)
  const [lastManualMotifXaf, setLastManualMotifXaf] = React.useState<string | null>(null)
  const [lastManualMotifUsd, setLastManualMotifUsd] = React.useState<string | null>(null)
  const [lastManualMotifEur, setLastManualMotifEur] = React.useState<string | null>(null)

  // Filtres et tri du reporting
  const getReportDateRange = () => {
    const today = new Date()
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    return { from: format(first, "yyyy-MM-dd"), to: format(today, "yyyy-MM-dd") }
  }
  const [reportDateFrom, setReportDateFrom] = React.useState(() => getReportDateRange().from)
  const [reportDateTo, setReportDateTo] = React.useState(() => getReportDateRange().to)
  const [reportTypeFilter, setReportTypeFilter] = React.useState<string>("all")
  const [reportSortBy, setReportSortBy] = React.useState<"date" | "type" | "details" | "par">("date")
  const [reportSortDir, setReportSortDir] = React.useState<"asc" | "desc">("desc")
  const [reportPage, setReportPage] = React.useState(1)
  const [reportPerPage, setReportPerPage] = React.useState(10)

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
      return true
    })
  }, [operations, reportDateFrom, reportDateTo, reportTypeFilter])

  const filteredAndSortedOperations = React.useMemo(() => {
    const list = [...filteredOperations].sort((a, b) => {
      let cmp = 0
      if (reportSortBy === "date") {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (reportSortBy === "type") {
        const order = { appro: 0, vente: 1, cession: 2, maj_manuelle: 3 }
        cmp = (order[a.operation_type] ?? 0) - (order[b.operation_type] ?? 0)
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
  }, [reportDateFrom, reportDateTo, reportTypeFilter, reportPerPage])

  React.useEffect(() => {
    if (reportPage > reportTotalPages) setReportPage(Math.max(1, reportTotalPages))
  }, [reportPage, reportTotalPages])

  /** Variation des caisses sur la période filtrée (à partir des opérations filtrées). */
  const movementFromFilter = React.useMemo(() => {
    let movXaf = 0
    let movUsd = 0
    let movEur = 0
    let movCoffre = 0
    for (const op of filteredOperations) {
      const p = op.payload as Record<string, unknown>
      if (op.operation_type === "appro") {
        const montant = Number(p.montant ?? 0)
        const deviseAchat = String(p.devise_achat ?? "")
        const totalDispo = Number(p.total_devise_disponible ?? 0)
        const deviseAchetee = String(p.devise_achetee ?? "")
        if (deviseAchat === "XAF") {
          if (p.deduct_from_coffre) movCoffre -= montant
          else movXaf -= montant
        } else if (deviseAchat === "USD") movUsd -= montant
        else if (deviseAchat === "EUR") movEur -= montant
        if (deviseAchetee === "USD") movUsd += totalDispo
        else if (deviseAchetee === "EUR") movEur += totalDispo
      } else if (op.operation_type === "vente") {
        const montant = Number(p.montant_vendu ?? 0)
        const dev = String(p.devise_vendu ?? "")
        if (dev === "USD") movUsd -= montant
        else if (dev === "EUR") movEur -= montant
      } else if (op.operation_type === "cession") {
        const montant = Number(p.montant ?? 0)
        const dev = String(p.devise ?? "")
        if (dev === "XAF") movXaf -= montant
        else if (dev === "USD") movUsd -= montant
        else if (dev === "EUR") movEur -= montant
      }
      // maj_manuelle : pas de mouvement calculé (simple correction de solde)
    }
    return { xaf: movXaf, usd: movUsd, eur: movEur, coffre: movCoffre }
  }, [filteredOperations])

  /** Commissions générées (ventes) par devise, sur la période filtrée (en XAF). */
  const commissionsByDevise = React.useMemo(() => {
    let usd = 0
    let eur = 0
    for (const op of filteredOperations) {
      if (op.operation_type !== "vente") continue
      const p = op.payload as Record<string, unknown>
      const commission = Number(p.commission ?? 0)
      const dev = String(p.devise_vendu ?? "")
      if (dev === "USD") usd += commission
      else if (dev === "EUR") eur += commission
    }
    return { usd, eur }
  }, [filteredOperations])

  const defaultRange = React.useMemo(() => getReportDateRange(), [])
  const hasActiveFilter =
    reportTypeFilter !== "all" ||
    reportDateFrom !== defaultRange.from ||
    reportDateTo !== defaultRange.to

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true)
      const [resBal, resOps] = await Promise.all([
        fetch("/api/exchange-caisse"),
        fetch("/api/exchange-caisse?action=operations&limit=50"),
      ])
      const bal = await resBal.json()
      const ops = await resOps.json()
      if (bal.success) {
        setXaf(bal.xaf ?? 0)
        setUsd(bal.usd ?? 0)
        setEur(bal.eur ?? 0)
        setCoffreBalance(bal.coffreBalance ?? 0)
        setLastApproRateUsd(
          bal.lastApproRateUsd != null ? Math.round(Number(bal.lastApproRateUsd) * 100) / 100 : null
        )
        setLastApproRateEur(
          bal.lastApproRateEur != null ? Math.round(Number(bal.lastApproRateEur) * 100) / 100 : null
        )
        setLastManualMotifXaf(bal.lastManualMotifXaf ?? null)
        setLastManualMotifUsd(bal.lastManualMotifUsd ?? null)
        setLastManualMotifEur(bal.lastManualMotifEur ?? null)
      }
      if (ops.success && Array.isArray(ops.operations)) {
        setOperations(ops.operations)
      }
    } catch (e) {
      toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    loadData()
  }, [loadData])

  const formatAmount = (amount: number, currency: string) =>
    `${Number(amount).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`

  const openUpdateCaisse = (currency: "XAF" | "USD" | "EUR") => {
    const balance = currency === "XAF" ? xaf : currency === "USD" ? usd : eur
    const lastMotif =
      currency === "XAF" ? lastManualMotifXaf : currency === "USD" ? lastManualMotifUsd : lastManualMotifEur
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
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: `Caisse ${updateCaisseCurrency} mise à jour.` })
        setUpdateCaisseOpen(false)
        loadData()
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setUpdateCaisseSubmitting(false)
    }
  }

  const buildReceiptHTML = (op: OpRow): string => {
    const p = op.payload as Record<string, unknown>
    const dateStr = format(new Date(op.created_at), "dd/MM/yyyy HH:mm", { locale: fr })
    const typeLabel =
      op.operation_type === "appro"
        ? "Appro devise"
        : op.operation_type === "vente"
          ? "Vente de devise"
          : op.operation_type === "maj_manuelle"
            ? "Mise à jour manuelle caisse"
            : "Cession de devise"
    let rows = ""
    if (op.operation_type === "appro") {
      rows = `
        <div class="row"><span>Devise d'achat</span><span>${String(p.devise_achat ?? "")}</span></div>
        <div class="row"><span>Montant</span><span>${Number(p.montant ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Devise à acheter</span><span>${String(p.devise_achetee ?? "")}</span></div>
        <div class="row"><span>Taux achat</span><span>${Number(p.taux_achat ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Montant devise achetée</span><span>${Number(p.montant_devise_achetee ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</span></div>
        <div class="row"><span>Dépenses (Transport, Beach, Échange billets)</span><span>${Number((Number(p.depenses_transport ?? 0) + Number(p.depenses_beach ?? 0) + Number(p.depenses_echange_billets ?? 0))).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Total devise disponible</span><span>${Number(p.total_devise_disponible ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}</span></div>
        <div class="row"><span>Taux réel</span><span>${Number(p.taux_reel ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} XAF</span></div>
      `
    } else if (op.operation_type === "vente") {
      rows = `
        <div class="row"><span>Bénéficiaire</span><span>${String(p.beneficiaire ?? "")}</span></div>
        <div class="row"><span>Devise vendu</span><span>${String(p.devise_vendu ?? "")}</span></div>
        <div class="row"><span>Montant vendu</span><span>${Number(p.montant_vendu ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Devise reçu</span><span>${String(p.devise_recu ?? "")}</span></div>
        <div class="row"><span>Taux du jour</span><span>${Number(p.taux_du_jour ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Montant reçu</span><span>${Number(p.montant_recu ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Commission</span><span>${Number(p.commission ?? 0).toLocaleString("fr-FR")} XAF</span></div>
      `
    } else if (op.operation_type === "maj_manuelle") {
      rows = `
        <div class="row"><span>Caisse</span><span>${String(p.currency ?? "")}</span></div>
        <div class="row"><span>Ancien solde</span><span>${Number(p.previous_balance ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Nouveau solde</span><span>${Number(p.new_balance ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Motif</span><span>${String(p.motif ?? "—")}</span></div>
      `
    } else {
      rows = `
        <div class="row"><span>Devise</span><span>${String(p.devise ?? "")}</span></div>
        <div class="row"><span>Montant</span><span>${Number(p.montant ?? 0).toLocaleString("fr-FR")}</span></div>
        <div class="row"><span>Bénéficiaire</span><span>${String(p.beneficiaire ?? "")}</span></div>
      `
    }
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"/><title>Reçu - ${typeLabel}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:'Courier New',monospace;margin:0;padding:20px;background:#fff;color:#000;line-height:1.5}
      .receipt{max-width:400px;margin:0 auto;border:2px solid #000;padding:20px}
      .header{text-align:center;margin-bottom:20px;border-bottom:1px dashed #000;padding-bottom:15px}
      .logo{font-size:18px;font-weight:bold;margin-bottom:8px}
      .receipt-number{font-size:14px;font-weight:bold;background:#f0f0f0;padding:5px;border:1px solid #000}
      .row{display:flex;justify-content:space-between;margin:8px 0;padding:2px 0}
      .footer{text-align:center;font-size:11px;color:#666;margin-top:20px;border-top:1px dashed #000;padding-top:15px}
    </style></head><body>
    <div class="receipt">
      <div class="header">
        <div class="logo">ZOLL TAX FOREX</div>
        <div style="font-size:14px;margin-bottom:5px">Bureau de change - ${typeLabel}</div>
        <div class="receipt-number">${op.id}</div>
      </div>
      <div class="row"><span>Date</span><span>${dateStr}</span></div>
      <div class="row"><span>Par</span><span>${op.created_by}</span></div>
      ${rows}
      <div class="footer">Reçu généré le ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr })}</div>
    </div></body></html>`
  }

  const printReceipt = (op: OpRow) => {
    const html = buildReceiptHTML(op)
    const w = window.open("", "_blank")
    if (!w) {
      toast({ title: "Erreur", description: "Autorisez les pop-ups pour imprimer le reçu.", variant: "destructive" })
      return
    }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
      w.close()
    }, 300)
  }

  /** Détails d'une opération en français, ordonnés et groupés. */
  const getDetailsRows = (op: OpRow): { label: string; value: string }[] => {
    const p = op.payload as Record<string, unknown>
    const num = (v: unknown) => {
      const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN
      if (Number.isNaN(n)) return String(v ?? "")
      return Number.isInteger(n)
        ? n.toLocaleString("fr-FR")
        : Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    }
    if (op.operation_type === "appro") {
      return [
        { label: "Devise d'achat", value: String(p.devise_achat ?? "") },
        { label: "Montant", value: num(p.montant) + " " + (p.devise_achat ?? "") },
        { label: "Devise à acheter", value: String(p.devise_achetee ?? "") },
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
    // cession
    return [
      { label: "Devise", value: String(p.devise ?? "") },
      { label: "Montant", value: num(p.montant) + " " + (p.devise ?? "") },
      { label: "Bénéficiaire", value: String(p.beneficiaire ?? "") },
    ]
  }

  // --- Appro dialog
  const [approOpen, setApproOpen] = React.useState(false)
  const [approDeviseAchat, setApproDeviseAchat] = React.useState<"XAF" | "USD" | "EUR">("XAF")
  const [approMontant, setApproMontant] = React.useState<string>("")
  const [approDeviseAchetee, setApproDeviseAchetee] = React.useState<"USD" | "EUR">("USD")
  const [approTauxAchat, setApproTauxAchat] = React.useState<string>("")
  const [approDepTransport, setApproDepTransport] = React.useState<string>("0")
  const [approDepBeach, setApproDepBeach] = React.useState<string>("0")
  const [approDepEchangeBillets, setApproDepEchangeBillets] = React.useState<string>("0")
  const [approDeductXaf, setApproDeductXaf] = React.useState(false)
  const [approDeductUsd, setApproDeductUsd] = React.useState(false)
  const [approDeductEur, setApproDeductEur] = React.useState(false)
  const [approDeductCoffre, setApproDeductCoffre] = React.useState(false)
  const [approSubmitting, setApproSubmitting] = React.useState(false)

  const montantNum = Number(approMontant) || 0
  const tauxNum = Number(approTauxAchat) || 0
  const depTransport = Number(approDepTransport) || 0
  const depBeach = Number(approDepBeach) || 0
  const depEchangeBillets = Number(approDepEchangeBillets) || 0
  const depenses = depTransport + depBeach + depEchangeBillets
  const montantDeviseAchetee = tauxNum > 0 ? montantNum / tauxNum : 0
  const totalDeviseDisponible = Math.max(0, montantDeviseAchetee - depenses)
  const tauxReel = totalDeviseDisponible > 0 ? tauxNum + depenses / totalDeviseDisponible : tauxNum

  const handleApproSubmit = async () => {
    if (!montantNum || montantNum <= 0 || !tauxNum || tauxNum <= 0) {
      toast({ title: "Erreur", description: "Montant et Taux achat requis et > 0.", variant: "destructive" })
      return
    }
    if (approDeviseAchat === "XAF" && !approDeductXaf && !approDeductCoffre) {
      toast({ title: "Erreur", description: "Sélectionnez Caisse XAF ou Coffre pour déduire.", variant: "destructive" })
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
    setApproSubmitting(true)
    try {
      const res = await fetch("/api/exchange-caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "appro",
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
          deductFromCoffre: approDeductCoffre,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: "Appro enregistrée. Caisses mises à jour." })
        setApproOpen(false)
        resetApproForm()
        loadData()
        const tempOp: OpRow = {
          id: `EXC-${Date.now()}`,
          operation_type: "appro",
          payload: {
            devise_achat: approDeviseAchat,
            montant: montantNum,
            devise_achetee: approDeviseAchetee,
            taux_achat: tauxNum,
            montant_devise_achetee: montantDeviseAchetee,
            depenses_transport: depTransport,
            depenses_beach: depBeach,
            depenses_echange_billets: depEchangeBillets,
            total_devise_disponible: totalDeviseDisponible,
            taux_reel: tauxReel,
          },
          created_by: user.name,
          created_at: new Date().toISOString(),
        }
        printReceipt(tempOp)
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur appro", variant: "destructive" })
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
    setApproDeductCoffre(false)
  }

  // --- Vente dialog
  const [venteOpen, setVenteOpen] = React.useState(false)
  const [venteBeneficiaire, setVenteBeneficiaire] = React.useState("")
  const [venteDeviseVendu, setVenteDeviseVendu] = React.useState<"USD" | "EUR">("USD")
  const [venteMontantVendu, setVenteMontantVendu] = React.useState("")
  const [venteDeviseRecu, setVenteDeviseRecu] = React.useState("XAF")
  const [venteTauxDuJour, setVenteTauxDuJour] = React.useState("")
  const [venteMontantRecu, setVenteMontantRecu] = React.useState("")
  const [venteSubmitting, setVenteSubmitting] = React.useState(false)

  const lastApproRate = venteDeviseVendu === "EUR" ? lastApproRateEur : lastApproRateUsd
  const tauxJourNum = Number(venteTauxDuJour) || 0
  const montantVenduNum = Number(venteMontantVendu) || 0
  const prixVente = montantVenduNum * tauxJourNum
  const prixAchat = montantVenduNum * (lastApproRate ?? tauxJourNum)
  const commissionVente = Math.max(0, prixVente - prixAchat)

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
          deviseVendu: venteDeviseVendu,
          montantVendu: montantVenduNum,
          deviseRecu: venteDeviseRecu,
          tauxDuJour: tauxJourNum,
          montantRecu: montantRecuNum,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: `Vente enregistrée. Commission: ${commissionVente.toLocaleString("fr-FR")} XAF` })
        setVenteOpen(false)
        setVenteBeneficiaire("")
        setVenteMontantVendu("")
        setVenteTauxDuJour("")
        setVenteMontantRecu("")
        loadData()
        const tempOp: OpRow = {
          id: `EXC-${Date.now()}`,
          operation_type: "vente",
          payload: {
            beneficiaire: venteBeneficiaire.trim(),
            devise_vendu: venteDeviseVendu,
            montant_vendu: montantVenduNum,
            devise_recu: venteDeviseRecu,
            taux_du_jour: tauxJourNum,
            montant_recu: Number(venteMontantRecu) || 0,
            commission: commissionVente,
          },
          created_by: user.name,
          created_at: new Date().toISOString(),
        }
        printReceipt(tempOp)
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur vente", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setVenteSubmitting(false)
    }
  }

  // --- Cession dialog
  const [cessionOpen, setCessionOpen] = React.useState(false)
  const [cessionDevise, setCessionDevise] = React.useState<"XAF" | "USD" | "EUR">("XAF")
  const [cessionMontant, setCessionMontant] = React.useState("")
  const [cessionBeneficiaire, setCessionBeneficiaire] = React.useState("")
  const [cessionSubmitting, setCessionSubmitting] = React.useState(false)

  const handleCessionSubmit = async () => {
    if (!cessionBeneficiaire.trim()) {
      toast({ title: "Erreur", description: "Bénéficiaire requis.", variant: "destructive" })
      return
    }
    const montant = Number(cessionMontant) || 0
    if (!montant || montant <= 0) {
      toast({ title: "Erreur", description: "Montant requis et > 0.", variant: "destructive" })
      return
    }
    setCessionSubmitting(true)
    try {
      const res = await fetch("/api/exchange-caisse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cession",
          devise: cessionDevise,
          montant,
          beneficiaire: cessionBeneficiaire.trim(),
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Succès", description: "Cession enregistrée." })
        setCessionOpen(false)
        setCessionMontant("")
        setCessionBeneficiaire("")
        loadData()
        const tempOp: OpRow = {
          id: `EXC-${Date.now()}`,
          operation_type: "cession",
          payload: {
            devise: cessionDevise,
            montant: Number(cessionMontant) || 0,
            beneficiaire: cessionBeneficiaire.trim(),
          },
          created_by: user.name,
          created_at: new Date().toISOString(),
        }
        printReceipt(tempOp)
      } else {
        toast({ title: "Erreur", description: data.error ?? "Erreur cession", variant: "destructive" })
      }
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Erreur", variant: "destructive" })
    } finally {
      setCessionSubmitting(false)
    }
  }

  if (loading) {
    return <PageLoader message="Chargement des caisses..." overlay={false} className="min-h-[320px]" />
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gestion de change</h1>
            <p className="text-muted-foreground">Caisses et opérations de change</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2 h-9 w-full sm:w-auto shrink-0">
            <RefreshCw className="h-4 w-4" />
            Actualiser
          </Button>
        </div>
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
                  <SelectTrigger className="h-9 w-[130px] text-sm">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="appro">Appro</SelectItem>
                    <SelectItem value="vente">Vente</SelectItem>
                    <SelectItem value="cession">Cession</SelectItem>
                    <SelectItem value="maj_manuelle">Mise à jour manuelle</SelectItem>
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
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Caisses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 p-5 bg-gradient-to-br from-emerald-50 to-green-50/80 border-b border-emerald-100">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-800">Caisse XAF</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-900">{formatAmount(xaf, "XAF")}</p>
                  {hasActiveFilter && movementFromFilter.xaf !== 0 && (
                    <p className="text-xs text-emerald-700 mt-0.5">
                      Sur la période: {movementFromFilter.xaf > 0 ? "+" : ""}{formatAmount(movementFromFilter.xaf, "XAF")}
                    </p>
                  )}
                  {(!hasActiveFilter || movementFromFilter.xaf === 0) && <p className="text-xs text-emerald-700">Disponible</p>}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openUpdateCaisse("XAF")} title="Mettre à jour">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 p-5 bg-gradient-to-br from-blue-50 to-indigo-50/80 border-b border-blue-100">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-blue-800">Caisse USD</p>
                  <p className="text-2xl font-bold tabular-nums text-blue-900">{formatAmount(usd, "USD")}</p>
                  {hasActiveFilter && movementFromFilter.usd !== 0 && (
                    <p className="text-xs text-blue-700 mt-0.5">
                      Sur la période: {movementFromFilter.usd > 0 ? "+" : ""}{movementFromFilter.usd.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} USD
                    </p>
                  )}
                  {(!hasActiveFilter || movementFromFilter.usd === 0) && (
                    <p className="text-xs text-blue-700">
                      {lastApproRateUsd != null ? `Taux réel appro: ${lastApproRateUsd.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF` : "—"}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openUpdateCaisse("USD")} title="Mettre à jour">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 p-5 bg-gradient-to-br from-violet-50 to-purple-50/80 border-b border-violet-100">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                  <Euro className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-violet-800">Caisse Euro</p>
                  <p className="text-2xl font-bold tabular-nums text-violet-900">{formatAmount(eur, "EUR")}</p>
                  {hasActiveFilter && movementFromFilter.eur !== 0 && (
                    <p className="text-xs text-violet-700 mt-0.5">
                      Sur la période: {movementFromFilter.eur > 0 ? "+" : ""}{movementFromFilter.eur.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} EUR
                    </p>
                  )}
                  {(!hasActiveFilter || movementFromFilter.eur === 0) && (
                    <p className="text-xs text-violet-700">
                      {lastApproRateEur != null ? `Taux réel appro: ${lastApproRateEur.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} XAF` : "—"}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" onClick={() => openUpdateCaisse("EUR")} title="Mettre à jour">
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-amber-50 to-orange-50/80 border-b border-amber-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">Coffre</p>
                <p className="text-2xl font-bold tabular-nums text-amber-900">{formatAmount(coffreBalance, "XAF")}</p>
                {hasActiveFilter && movementFromFilter.coffre !== 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">
                    Sur la période: {movementFromFilter.coffre > 0 ? "+" : ""}{formatAmount(movementFromFilter.coffre, "XAF")}
                  </p>
                )}
                <p className="text-xs text-amber-700">
                  <Link href="/cash" className="inline-flex items-center gap-1 text-amber-800 hover:underline">
                    Gestion de la Caisse <ExternalLink className="h-3 w-3" />
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commissions générées Change USD / EUR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-sky-50 to-blue-50/80 border-b border-sky-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <DollarSign className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-sky-800">Commissions générées Change USD</p>
                <p className="text-2xl font-bold tabular-nums text-sky-900">{formatAmount(commissionsByDevise.usd, "XAF")}</p>
                <p className="text-xs text-sky-700">Sur la période filtrée</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-50 to-violet-50/80 border-b border-indigo-100">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Euro className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-800">Commissions générées Change EUR</p>
                <p className="text-2xl font-bold tabular-nums text-indigo-900">{formatAmount(commissionsByDevise.eur, "XAF")}</p>
                <p className="text-xs text-indigo-700">Sur la période filtrée</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Opérations</CardTitle>
          <p className="text-sm text-muted-foreground font-normal">Choisir une action à effectuer</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => setApproOpen(true)}
              className="group flex flex-col items-start gap-3 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/60 dark:text-emerald-400">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Appro devise</p>
                <p className="text-xs text-muted-foreground mt-0.5">Achat de devises (USD/EUR)</p>
              </div>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 group-hover:underline">Ouvrir →</span>
            </button>
            <button
              type="button"
              onClick={() => setVenteOpen(true)}
              className="group flex flex-col items-start gap-3 rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 dark:hover:border-blue-700 dark:hover:bg-blue-950/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-400">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Vente de devise</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vendre USD ou EUR au client</p>
              </div>
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 group-hover:underline">Ouvrir →</span>
            </button>
            <button
              type="button"
              onClick={() => setCessionOpen(true)}
              className="group flex flex-col items-start gap-3 rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4 text-left transition hover:border-violet-400 hover:bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/30 dark:hover:border-violet-700 dark:hover:bg-violet-950/50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-400">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Cession de devise</p>
                <p className="text-xs text-muted-foreground mt-0.5">Transfert vers un bénéficiaire</p>
              </div>
              <span className="text-xs font-medium text-violet-600 dark:text-violet-400 group-hover:underline">Ouvrir →</span>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Appro */}
      <Dialog open={approOpen} onOpenChange={setApproOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appro devise</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise d&apos;achat</Label>
                <Select value={approDeviseAchat} onValueChange={(v: "XAF" | "USD" | "EUR") => setApproDeviseAchat(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
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
                <Select value={approDeviseAchetee} onValueChange={(v: "USD" | "EUR") => setApproDeviseAchetee(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
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
                  <>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={approDeductXaf} onCheckedChange={(c) => { setApproDeductXaf(!!c); if (c) setApproDeductCoffre(false) }} />
                      Caisse XAF
                    </label>
                    <label className="flex items-center gap-2">
                      <Checkbox checked={approDeductCoffre} onCheckedChange={(c) => { setApproDeductCoffre(!!c); if (c) setApproDeductXaf(false) }} />
                      Coffre
                    </label>
                  </>
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
                    Caisse Euro
                  </label>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproOpen(false)}>Annuler</Button>
            <Button onClick={handleApproSubmit} disabled={approSubmitting}>Enregistrer</Button>
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
                <Label>Devise vendu</Label>
                <Select value={venteDeviseVendu} onValueChange={(v: "USD" | "EUR") => setVenteDeviseVendu(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant</Label>
                <Input type="number" min={0} step="any" value={venteMontantVendu} onChange={(e) => setVenteMontantVendu(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Devise reçu</Label>
                <Select value={venteDeviseRecu} onValueChange={setVenteDeviseRecu}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Taux du jour</Label>
                <Input type="number" min={0} step="any" value={venteTauxDuJour} onChange={(e) => setVenteTauxDuJour(e.target.value)} placeholder="0" />
              </div>
            </div>
            <div>
              <Label>Montant reçu (XAF)</Label>
              <Input type="number" min={0} step="any" value={venteMontantRecu} onChange={(e) => setVenteMontantRecu(e.target.value)} placeholder="0" />
            </div>
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <p><strong>Commission:</strong> {commissionVente.toLocaleString("fr-FR", { minimumFractionDigits: 0 })} XAF</p>
              <p className="text-muted-foreground text-xs">Prix de vente × Taux du jour − Prix d&apos;achat × Taux réel dernière appro</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVenteOpen(false)}>Annuler</Button>
            <Button onClick={handleVenteSubmit} disabled={venteSubmitting}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mise à jour caisse */}
      <Dialog open={updateCaisseOpen} onOpenChange={setUpdateCaisseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mettre à jour la caisse {updateCaisseCurrency}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Solde actuel</Label>
              <p className="text-lg font-semibold mt-1">{formatAmount(updateCaisseCurrentBalance, updateCaisseCurrency)}</p>
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
                placeholder="Ex: correction inventaire, clôture..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateCaisseOpen(false)}>Annuler</Button>
            <Button onClick={confirmUpdateCaisse} disabled={updateCaisseSubmitting}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Détails opération */}
      <Dialog open={!!detailsOp} onOpenChange={(open) => !open && setDetailsOp(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
          {detailsOp && (
            <>
              <div className="px-6 pt-6 pb-4 border-b bg-muted/20">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg font-semibold">Détails de l&apos;opération</DialogTitle>
                  <Badge
                    variant="outline"
                    className={
                      detailsOp.operation_type === "appro"
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-normal"
                        : detailsOp.operation_type === "vente"
                          ? "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 font-normal"
                          : detailsOp.operation_type === "maj_manuelle"
                            ? "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 font-normal"
                            : "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800 font-normal"
                    }
                  >
                    {detailsOp.operation_type === "appro"
                      ? "Appro devise"
                      : detailsOp.operation_type === "vente"
                        ? "Vente de devise"
                        : detailsOp.operation_type === "maj_manuelle"
                          ? "Mise à jour manuelle caisse"
                          : "Cession de devise"}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-col gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">N° opération</span>
                    <span className="font-mono text-xs text-right break-all max-w-[220px]">{detailsOp.id}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Date</span>
                    <span>{format(new Date(detailsOp.created_at), "dd/MM/yyyy à HH:mm:ss", { locale: fr })}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Effectué par</span>
                    <span className="font-medium">{detailsOp.created_by}</span>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className="rounded-xl bg-slate-50/80 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                  {getDetailsRows(detailsOp).map((row, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center gap-6 px-4 py-3 text-sm border-b border-slate-200/60 dark:border-slate-800 last:border-0"
                    >
                      <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 text-right tabular-nums shrink-0">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Cession */}
      <Dialog open={cessionOpen} onOpenChange={setCessionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cession de devise</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Devise</Label>
              <Select value={cessionDevise} onValueChange={(v: "XAF" | "USD" | "EUR") => setCessionDevise(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant</Label>
              <Input type="number" min={0} step="any" value={cessionMontant} onChange={(e) => setCessionMontant(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Bénéficiaire</Label>
              <Input value={cessionBeneficiaire} onChange={(e) => setCessionBeneficiaire(e.target.value)} placeholder="Nom du bénéficiaire" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCessionOpen(false)}>Annuler</Button>
            <Button onClick={handleCessionSubmit} disabled={cessionSubmitting}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reporting */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Reporting des transactions et des actions
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadData}>Actualiser</Button>
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={300}>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100/80 dark:bg-slate-800/50 hover:bg-slate-100/80 dark:hover:bg-slate-800/50">
                  <TableHead className="font-semibold w-[140px]">
                    <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/50" onClick={() => toggleReportSort("date")}>
                      Date
                      {reportSortBy === "date" ? (
                        reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold w-[100px]">
                    <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/50" onClick={() => toggleReportSort("type")}>
                      Type
                      {reportSortBy === "type" ? (
                        reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold min-w-[200px]">
                    <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/50" onClick={() => toggleReportSort("details")}>
                      Détails
                      {reportSortBy === "details" ? (
                        reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="font-semibold w-[140px]">
                    <Button variant="ghost" size="sm" className="h-8 -ml-2 gap-1 font-semibold hover:bg-slate-200/60 dark:hover:bg-slate-700/50" onClick={() => toggleReportSort("par")}>
                      Par
                      {reportSortBy === "par" ? (
                        reportSortDir === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ArrowUpDown className="h-4 w-4 opacity-50" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="text-right w-[200px] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportTotal === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {operations.length === 0 ? "Aucune opération" : "Aucun résultat pour ces filtres"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedOperations.map((op) => (
                    <TableRow key={op.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(op.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            op.operation_type === "appro"
                              ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                              : op.operation_type === "vente"
                                ? "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800"
                                : op.operation_type === "maj_manuelle"
                                  ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-violet-100 text-violet-800 border-violet-200 hover:bg-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800"
                          }
                          variant="outline"
                        >
                          {op.operation_type === "appro"
                            ? "Appro"
                            : op.operation_type === "vente"
                              ? "Vente"
                              : op.operation_type === "maj_manuelle"
                                ? "Mise à jour manuelle"
                                : "Cession"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {op.operation_type === "appro" && (
                          <>{(op.payload as any).montant} {(op.payload as any).devise_achat} → {(op.payload as any).total_devise_disponible?.toLocaleString?.("fr-FR")} {(op.payload as any).devise_achetee} (taux réel: {(op.payload as any).taux_reel?.toLocaleString?.("fr-FR")})</>
                        )}
                        {op.operation_type === "vente" && (
                          <>{(op.payload as any).beneficiaire} – {(op.payload as any).montant_vendu} {(op.payload as any).devise_vendu} (commission: {(op.payload as any).commission?.toLocaleString?.("fr-FR")} XAF)</>
                        )}
                        {op.operation_type === "cession" && (
                          <>{(op.payload as any).montant} {(op.payload as any).devise} → {(op.payload as any).beneficiaire}</>
                        )}
                        {op.operation_type === "maj_manuelle" && (
                          <>Caisse {(op.payload as any).currency}: {(op.payload as any).previous_balance?.toLocaleString?.("fr-FR")} → {(op.payload as any).new_balance?.toLocaleString?.("fr-FR")}{(op.payload as any).motif ? ` — ${(op.payload as any).motif}` : ""}</>
                        )}
                      </TableCell>
                      <TableCell>{op.created_by}</TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50/50 dark:bg-slate-900/30 dark:border-slate-800 px-1 py-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50" onClick={() => setDetailsOp(op)}>
                                <Eye className="h-3.5 w-3.5" />
                                Détails
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voir les détails de l&apos;opération</TooltipContent>
                          </Tooltip>
                          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50" onClick={() => printReceipt(op)}>
                                <Receipt className="h-3.5 w-3.5" />
                                Reçu
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Imprimer le reçu</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {reportTotal > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t mt-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Éléments par page:</Label>
                  <Select
                    value={String(reportPerPage)}
                    onValueChange={(v) => {
                      setReportPerPage(Number(v))
                      setReportPage(1)
                    }}
                  >
                    <SelectTrigger className="w-[70px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-muted-foreground">
                  Affichage de {reportStart + 1} à {reportEnd} sur {reportTotal} opération{reportTotal !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1"
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  disabled={reportPage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1"
                  onClick={() => setReportPage((p) => Math.min(reportTotalPages, p + 1))}
                  disabled={reportPage >= reportTotalPages}
                >
                  Suivant
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          </TooltipProvider>
        </CardContent>
      </Card>
    </div>
  )
}
