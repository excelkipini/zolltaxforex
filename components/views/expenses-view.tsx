"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn, formatDateFR } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Search,
  Filter,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Receipt,
  Pencil,
  Building2,
  CalendarDays,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react"
import { ActionGuard } from "@/components/permission-guard"
import { PDFReceipt } from "@/components/pdf-receipt"
import { PageLoader } from "@/components/ui/page-loader"
import type { SessionUser } from "@/lib/auth"

interface ExpensesViewProps {
  user: SessionUser
}

export function ExpensesView({ user }: ExpensesViewProps) {
  const { toast } = useToast()
  const [filter, setFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [requesterFilter, setRequesterFilter] = useState("all")
  const [agencyFilter, setAgencyFilter] = useState("all")
  const [periodFilter, setPeriodFilter] = useState("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  
  // Catégories de dépenses disponibles
  const expenseCategories = [
    "Bureau",
    "Transport",
    "Communication",
    "Formation",
    "Équipement",
    "Maintenance",
    "Marketing",
    "Autre",
    "Autres"
  ]

  const [items, setItems] = useState<Array<{
    id: string | number
      description: string
      amount: number
      category: string
      status: "pending" | "accounting_approved" | "accounting_rejected" | "director_approved" | "director_rejected"
      date: string
      requestedBy: string
      agency: string
    comment?: string
    rejection_reason?: string
    accounting_validated_by?: string
    accounting_validated_at?: string
    director_validated_by?: string
    director_validated_at?: string
  }>>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newDesc, setNewDesc] = useState("")
  const [newAmount, setNewAmount] = useState<string>("")
  const [newCategory, setNewCategory] = useState("")
  const [newAgency, setNewAgency] = useState(user.agency ?? "Agence Centre")
  const [newComment, setNewComment] = useState("")
  const [deductFromExcedents, setDeductFromExcedents] = useState(false)
  const [eligibleCashiers, setEligibleCashiers] = useState<Array<{ id: string; name: string; available_excedents: number }>>([])
  const [selectedCashierId, setSelectedCashierId] = useState<string>("")
  const isCashier = user.role === "cashier"
  const hasOwnExcedents = eligibleCashiers.find((c) => c.name === user.name)

  // Rafraîchir la liste des caissiers avec excédents (utilisée après validations)
  async function refreshEligibleCashiers() {
    try {
      const r = await fetch('/api/ria-cash-declarations?type=cashiers-with-excedents')
      const d = await r.json()
      const list = Array.isArray(d?.data) ? d.data : []
      if (isCashier) {
        const mine = list.filter((c: any) => c?.name === user.name)
        setEligibleCashiers(mine)
        if (mine.length > 0) {
          setSelectedCashierId((prev) => prev || mine[0].id)
        }
      } else {
        setEligibleCashiers(list)
      }
    } catch {}
  }
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [expenseToReject, setExpenseToReject] = useState<string | number | null>(null)
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<{ id: string | number; description: string } | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<typeof items[0] | null>(null)
  const [editDesc, setEditDesc] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editCategory, setEditCategory] = useState("")
  const [editAgency, setEditAgency] = useState("")
  const [editComment, setEditComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [ubaBalance, setUbaBalance] = useState<number | null>(null)

  const expenses = items

  // Charger le solde du Compte UBA
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/cash?action=accounts")
        const data = await res.json()
        if (data.success && Array.isArray(data.accounts)) {
          const uba = data.accounts.find((a: any) => a.account_type === "uba")
          if (uba) setUbaBalance(Number(uba.current_balance))
        }
      } catch {}
    })()
  }, [])

  // Load from API when DB is configured
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/expenses?limit=1000")
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data?.ok && Array.isArray(data.data)) {
          const apiData = data.data.map((item: any) => ({
            ...item,
            amount: Number(item.amount),
            requestedBy: item.requested_by || item.requestedBy,
            id: item.id
          }))
          setItems(apiData)
        } else if (res.status === 401 || res.status === 403) {
        } else {
        }
      } catch (error) {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Determine visibility scope: director/delegate and accounting see all, others only their own
  const isDirectorDelegate = user.role === "director" || user.role === "delegate"
  const canModerateAll = isDirectorDelegate
  const canViewAll = isDirectorDelegate || user.role === "accounting"

  const visibleExpenses = useMemo(() => {
    let filtered = expenses
    
    // Filtre par permissions utilisateur
    if (!canViewAll) {
      filtered = filtered.filter((e) => (e.requestedBy || e.requested_by) === user.name)
    }
    
    // Filtre par statut
    if (filter !== "all") {
      filtered = filtered.filter((e) => e.status === filter)
    }
    
    // Filtre par catégorie
    if (categoryFilter !== "all") {
      filtered = filtered.filter((e) => e.category === categoryFilter)
    }
    
    // Filtre par demandeur
    if (requesterFilter !== "all") {
      filtered = filtered.filter((e) => e.requestedBy === requesterFilter)
    }
    
    // Filtre par agence
    if (agencyFilter !== "all") {
      filtered = filtered.filter((e) => e.agency === agencyFilter)
    }
    
    // Filtre par période prédéfinie
    if (periodFilter !== "all") {
      const now = new Date()
      filtered = filtered.filter((e) => {
        const expenseDate = new Date(e.date)
        
        switch (periodFilter) {
          case "today":
            return expenseDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return expenseDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
            return expenseDate >= monthAgo
          case "year":
            const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
            return expenseDate >= yearAgo
          case "last_year":
            const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
            const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
            return expenseDate >= lastYearStart && expenseDate <= lastYearEnd
          default:
            return true
        }
      })
    }

    // Filtre par plage de dates personnalisée
    if (dateFrom || dateTo) {
      filtered = filtered.filter((e) => {
        const expenseDate = new Date(e.date)
        if (dateFrom) {
          const from = new Date(dateFrom + "T00:00:00")
          if (expenseDate < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo + "T23:59:59")
          if (expenseDate > to) return false
        }
        return true
      })
    }
    
    // Filtre par recherche textuelle
    if (searchTerm) {
      filtered = filtered.filter((e) =>
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.agency.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    return filtered
  }, [expenses, canViewAll, user.name, filter, categoryFilter, requesterFilter, agencyFilter, periodFilter, dateFrom, dateTo, searchTerm])

  const stats = useMemo(() => {
    const total = visibleExpenses.length
    const pending = visibleExpenses.filter((e) => e.status === "pending").length
    const accountingApproved = visibleExpenses.filter((e) => e.status === "accounting_approved").length
    const accountingRejected = visibleExpenses.filter((e) => e.status === "accounting_rejected").length
    const directorApproved = visibleExpenses.filter((e) => e.status === "director_approved").length
    const directorRejected = visibleExpenses.filter((e) => e.status === "director_rejected").length
    
    // Compatibilité avec l'ancien système
    const approved = visibleExpenses.filter((e) => e.status === "approved").length
    const rejected = visibleExpenses.filter((e) => e.status === "rejected").length
    
    const totalCost = visibleExpenses
      .filter((e) => e.status === "director_approved" || e.status === "approved")
      .reduce((sum, e) => sum + e.amount, 0)
    
    const pendingTotalCost = visibleExpenses
      .filter((e) => e.status === "pending" || e.status === "accounting_approved")
      .reduce((sum, e) => sum + e.amount, 0)
    
    return { 
      total, 
      pending, 
      accountingApproved, 
      accountingRejected, 
      directorApproved, 
      directorRejected,
      approved, // Pour compatibilité
      rejected, // Pour compatibilité
      pendingTotalCost,
      totalCost 
    }
  }, [visibleExpenses])

  // Logique de pagination
  const totalPages = Math.ceil(visibleExpenses.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedExpenses = visibleExpenses.slice(startIndex, endIndex)

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1)
  }, [filter, categoryFilter, requesterFilter, agencyFilter, periodFilter, dateFrom, dateTo, searchTerm])

  // Réinitialiser la page quand le nombre d'éléments par page change
  useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800"
      case "accounting_approved":
        return "bg-blue-100 text-blue-800"
      case "accounting_rejected":
        return "bg-red-100 text-red-800"
      case "director_approved":
        return "bg-green-100 text-green-800"
      case "director_rejected":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />
      case "accounting_approved":
        return <CheckCircle className="h-4 w-4" />
      case "accounting_rejected":
        return <XCircle className="h-4 w-4" />
      case "director_approved":
        return <CheckCircle className="h-4 w-4" />
      case "director_rejected":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  // Fonction pour traduire les statuts
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "accounting_approved":
        return "Approuvée par comptabilité"
      case "accounting_rejected":
        return "Rejetée par comptabilité"
      case "director_approved":
        return "Approuvée par directeur"
      case "director_rejected":
        return "Rejetée par directeur"
      default:
        return status
    }
  }

  const filteredExpenses = visibleExpenses.filter((expense) => {
    const matchesFilter = filter === "all" || expense.status === filter
    const matchesSearch =
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
  }

  function buildExportFilename(ext: string) {
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0]
    let filename = `depenses_${dateStr}`
    if (dateFrom || dateTo) {
      filename += `_${dateFrom || "debut"}_${dateTo || "fin"}`
    } else if (periodFilter !== "all") {
      filename += `_${periodFilter}`
    }
    if (filter !== "all") filename += `_${filter}`
    if (categoryFilter !== "all") filename += `_${categoryFilter}`
    if (searchTerm) filename += `_recherche`
    return filename + ext
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportCsv() {
    if (visibleExpenses.length === 0) {
      toast({ title: "Aucune donnée à exporter", description: "Aucune dépense ne correspond aux filtres appliqués.", variant: "destructive" })
      return
    }
    try {
      const headers = ["ID", "Libellé", "Montant", "Catégorie", "Statut", "Demandeur", "Agence", "Date", "Commentaire"]
      const csvRows = [
        headers.join(","),
        ...visibleExpenses.map(expense => [
          expense.id,
          `"${expense.description.replace(/"/g, '""')}"`,
          expense.amount,
          `"${expense.category}"`,
          `"${getStatusLabel(expense.status)}"`,
          `"${expense.requestedBy}"`,
          `"${expense.agency}"`,
          `"${expense.date}"`,
          `"${((expense as any).comment || "").replace(/"/g, '""')}"`
        ].join(","))
      ]
      const filename = buildExportFilename(".csv")
      downloadBlob(new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" }), filename)
      toast({ title: "Export CSV réussi", description: `${visibleExpenses.length} dépenses exportées vers ${filename}` })
    } catch {
      toast({ title: "Erreur d'export", description: "Une erreur est survenue lors de l'exportation.", variant: "destructive" })
    }
  }

  function exportPdf() {
    if (visibleExpenses.length === 0) {
      toast({ title: "Aucune donnée à exporter", description: "Aucune dépense ne correspond aux filtres appliqués.", variant: "destructive" })
      return
    }
    try {
      const filename = buildExportFilename(".pdf")
      const totalAmount = visibleExpenses.reduce((s, e) => s + e.amount, 0)

      // Construire le résumé des filtres actifs
      const activeFilters: string[] = []
      if (dateFrom || dateTo) activeFilters.push(`Période : ${dateFrom || "..."} au ${dateTo || "..."}`)
      else if (periodFilter !== "all") {
        const labels: Record<string, string> = { today: "Aujourd'hui", week: "Cette semaine", month: "Ce mois", year: "Cette année", last_year: "L'année dernière" }
        activeFilters.push(`Période : ${labels[periodFilter] || periodFilter}`)
      }
      if (filter !== "all") activeFilters.push(`Statut : ${getStatusLabel(filter)}`)
      if (categoryFilter !== "all") activeFilters.push(`Catégorie : ${categoryFilter}`)
      if (requesterFilter !== "all") activeFilters.push(`Demandeur : ${requesterFilter}`)
      if (agencyFilter !== "all") activeFilters.push(`Agence : ${agencyFilter}`)
      if (searchTerm) activeFilters.push(`Recherche : "${searchTerm}"`)

      const statusColors: Record<string, string> = {
        pending: "#f59e0b",
        accounting_approved: "#3b82f6",
        accounting_rejected: "#ef4444",
        director_approved: "#10b981",
        director_rejected: "#ef4444",
        approved: "#10b981",
        rejected: "#ef4444",
      }

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${filename}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; color: #1e293b; background: #fff; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 2px solid #2563eb; margin-bottom: 10px; }
  .header h1 { font-size: 18px; color: #1e3a5f; font-weight: 700; }
  .header .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
  .header .meta { text-align: right; font-size: 10px; color: #64748b; }
  .summary { display: flex; gap: 16px; margin-bottom: 10px; flex-wrap: wrap; }
  .summary-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; min-width: 140px; }
  .summary-card .label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 16px; font-weight: 700; color: #1e293b; margin-top: 2px; }
  .filters { font-size: 9px; color: #64748b; margin-bottom: 10px; }
  .filters span { background: #eff6ff; color: #2563eb; padding: 2px 6px; border-radius: 3px; margin-right: 4px; display: inline-block; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; }
  thead th { background: #1e3a5f; color: #fff; padding: 7px 8px; text-align: left; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
  thead th:first-child { border-radius: 4px 0 0 0; }
  thead th:last-child { border-radius: 0 4px 0 0; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 6px 8px; font-size: 10px; vertical-align: middle; }
  .amount { font-weight: 600; text-align: right; white-space: nowrap; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 9px; font-weight: 600; color: #fff; }
  .footer { margin-top: 12px; padding-top: 8px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="header">
  <div>
    <h1>ZOLL TAX FOREX</h1>
    <div class="subtitle">Rapport des Dépenses</div>
  </div>
  <div class="meta">
    Généré le ${new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}<br/>
    Par : ${user.name}
  </div>
</div>
<div class="summary">
  <div class="summary-card"><div class="label">Total dépenses</div><div class="value">${visibleExpenses.length}</div></div>
  <div class="summary-card"><div class="label">Montant total</div><div class="value">${totalAmount.toLocaleString("fr-FR")} XAF</div></div>
  <div class="summary-card"><div class="label">Approuvées</div><div class="value" style="color:#10b981">${visibleExpenses.filter(e => e.status === "director_approved" || e.status === "approved").length}</div></div>
  <div class="summary-card"><div class="label">En attente</div><div class="value" style="color:#f59e0b">${visibleExpenses.filter(e => e.status === "pending" || e.status === "accounting_approved").length}</div></div>
  <div class="summary-card"><div class="label">Rejetées</div><div class="value" style="color:#ef4444">${visibleExpenses.filter(e => e.status === "director_rejected" || e.status === "accounting_rejected" || e.status === "rejected").length}</div></div>
</div>
${activeFilters.length > 0 ? `<div class="filters">Filtres : ${activeFilters.map(f => `<span>${f}</span>`).join("")}</div>` : ""}
<table>
<thead><tr><th>#</th><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Montant</th><th>Statut</th><th>Demandeur</th><th>Agence</th></tr></thead>
<tbody>
${visibleExpenses.map((e, i) => `<tr>
  <td>${i + 1}</td>
  <td>${new Date(e.date).toLocaleDateString("fr-FR")}</td>
  <td>${e.description}</td>
  <td>${e.category}</td>
  <td class="amount">${e.amount.toLocaleString("fr-FR")} XAF</td>
  <td><span class="status" style="background:${statusColors[e.status] || "#64748b"}">${getStatusLabel(e.status)}</span></td>
  <td>${e.requestedBy}</td>
  <td>${e.agency}</td>
</tr>`).join("")}
</tbody>
</table>
<div class="footer">
  <span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span>
  <span>${visibleExpenses.length} enregistrements • Total : ${totalAmount.toLocaleString("fr-FR")} XAF</span>
</div>
</body></html>`

      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => { printWindow.print() }, 400)
      }
      toast({ title: "Export PDF prêt", description: `${visibleExpenses.length} dépenses prêtes à imprimer en PDF` })
    } catch {
      toast({ title: "Erreur d'export", description: "Une erreur est survenue lors de la génération du PDF.", variant: "destructive" })
    }
  }

  async function approve(id: string | number) {
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "approved" }),
      })
      const data = await res.json()
      if (res.ok && data?.ok) {
        const updatedExpense = {
          ...data.data,
          amount: Number(data.data.amount), // Convertir le montant en nombre
          requestedBy: data.data.requested_by || data.data.requestedBy,
          id: Number(data.data.id) || data.data.id
        }
        setItems((prev) => prev.map((e) => (String(e.id) === String(id) ? updatedExpense : e)))
      }
      const exp = (data?.data as any) || items.find((e) => String(e.id) === String(id))
      if (exp) {
        // Notifier l'utilisateur qui a soumis la dépense
        queueNotification({
          type: "expense_status",
          target: { userName: exp.requestedBy || exp.requested_by },
          message: `Votre dépense "${exp.description}" a été approuvée`,
        })
        // Notifier le comptable
        queueNotification({
          type: "expense_status",
          target: { role: "accounting" },
          message: `Dépense "${exp.description}" approuvée par le directeur`,
        })
        toast({ title: "Dépense approuvée", description: `"${exp.description}" approuvée.` })
      } else {
        toast({ 
          title: "Erreur", 
          description: `Erreur lors de l'approbation: ${data?.error || "Erreur inconnue"}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({ 
        title: "Erreur réseau", 
        description: "Impossible d'approuver la dépense. Vérifiez votre connexion.",
        variant: "destructive"
      })
    }
  }

  // Workflow d'approbation en 2 étapes (comptable puis directeur)
  async function validateExpense(
    id: string | number,
    approved: boolean,
    validationType: "accounting" | "director"
  ) {
    try {
      const res = await fetch("/api/expenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          expenseId: id, 
          approved, 
          validationType,
          rejectionReason: approved ? undefined : rejectionReason,
        }),
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        const updatedExpense = {
          ...data.data,
          amount: Number(data.data.amount),
          requestedBy: data.data.requested_by || data.data.requestedBy,
          id: Number(data.data.id) || data.data.id
        }
        setItems((prev) => prev.map((e) => (String(e.id) === String(id) ? updatedExpense : e)))
        
        const exp = updatedExpense
        const action = approved ? "approuvée" : "rejetée"
        const validator = validationType === "accounting" ? "comptabilité" : "directeur"
        
        // Notifier l'utilisateur qui a soumis la dépense
        queueNotification({
          type: "expense_status",
          target: { userName: exp.requestedBy || exp.requested_by },
          message: `Votre dépense "${exp.description}" a été ${action} par la ${validator}`,
        })
        
        toast({ 
          title: `Dépense ${action}`, 
          description: `"${exp.description}" ${action} par la ${validator}.` 
        })

        // Mise à jour temps réel des excédents après validation directeur/comptable
        await refreshEligibleCashiers()

        // Signaler aux autres écrans (ex: Clôture de caisse) de rafraîchir les excédents
        try {
          const notif = {
            id: `ex_${Date.now()}`,
            type: 'excedents_changed',
            createdAt: Date.now(),
          }
          const raw = localStorage.getItem('maf_notifications')
          const list = raw ? JSON.parse(raw) : []
          list.push(notif)
          localStorage.setItem('maf_notifications', JSON.stringify(list))
          window.dispatchEvent(new StorageEvent('storage', { key: 'maf_notifications', newValue: JSON.stringify(list) }))
        } catch {}
      } else {
        toast({ 
          title: "Erreur", 
          description: `Erreur lors de la validation: ${data?.error || "Erreur inconnue"}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({ 
        title: "Erreur réseau", 
        description: "Impossible de valider la dépense. Vérifiez votre connexion.",
        variant: "destructive"
      })
    }
  }

  function handleDeleteExpense(id: string | number) {
    // Vérifier que la dépense n'est pas validée par le directeur
    const expense = items.find((e) => String(e.id) === String(id))
    if (!expense) {
      toast({
        title: "Erreur",
        description: "Dépense non trouvée",
        variant: "destructive",
      })
      return
    }

    // Vérifier que la dépense n'est pas validée par le directeur (nouveau ou ancien format)
    if (expense.status === "director_approved" || expense.status === "approved") {
      toast({
        title: "Suppression impossible",
        description: "Impossible de supprimer une dépense déjà validée par le directeur",
        variant: "destructive",
      })
      return
    }

    // Ouvrir le dialogue de confirmation
    setExpenseToDelete({ id, description: expense.description })
    setDeleteConfirmDialogOpen(true)
  }

  async function confirmDeleteExpense() {
    if (!expenseToDelete) return

    try {
      const res = await fetch(`/api/expenses?id=${expenseToDelete.id}`, {
        method: "DELETE",
      })
      const data = await res.json()

      if (res.ok && data?.ok) {
        // Retirer la dépense de la liste
        setItems((prev) => prev.filter((e) => String(e.id) !== String(expenseToDelete.id)))
        toast({
          title: "Dépense supprimée",
          description: `La dépense "${expenseToDelete.description}" a été supprimée avec succès`,
        })
        setDeleteConfirmDialogOpen(false)
        setExpenseToDelete(null)
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la suppression de la dépense",
          variant: "destructive",
        })
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la dépense",
        variant: "destructive",
      })
    }
  }

  function openEditDialog(expense: typeof items[0]) {
    setExpenseToEdit(expense)
    setEditDesc(expense.description)
    setEditAmount(String(expense.amount))
    setEditCategory(expense.category)
    setEditAgency(expense.agency)
    setEditComment((expense as any).comment ?? "")
    setEditDialogOpen(true)
  }

  async function submitEdit() {
    if (!expenseToEdit) return
    const amount = Number(editAmount)
    if (!editDesc.trim() || Number.isNaN(amount) || amount < 0) {
      toast({
        title: "Champs invalides",
        description: "Libellé et montant (positif) sont requis.",
        variant: "destructive",
      })
      return
    }
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: expenseToEdit.id,
          description: editDesc.trim(),
          amount,
          category: editCategory || "Autre",
          agency: editAgency.trim() || expenseToEdit.agency,
          comment: editComment.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (res.ok && data?.ok && data?.data) {
        const updated = {
          ...data.data,
          amount: Number(data.data.amount),
          requestedBy: data.data.requested_by ?? data.data.requestedBy,
        }
        setItems((prev) => prev.map((e) => (String(e.id) === String(expenseToEdit.id) ? updated : e)))
        toast({ title: "Dépense modifiée", description: "Les modifications ont été enregistrées." })
        setEditDialogOpen(false)
        setExpenseToEdit(null)
      } else {
        toast({
          title: "Erreur",
          description: data?.error ?? "Erreur lors de la modification",
          variant: "destructive",
        })
      }
    } catch (e) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier la dépense",
        variant: "destructive",
      })
    }
  }

  function openRejectDialog(id: string | number, validationType?: "accounting" | "director") {
    setExpenseToReject(id)
    setRejectionReason("")
    setRejectDialogOpen(true)
    // Stocker le type de validation pour l'utiliser dans confirmReject
    ;(window as any).currentValidationType = validationType
  }

  async function confirmReject() {
    if (!expenseToReject || !rejectionReason.trim()) {
      toast({ 
        title: "Erreur", 
        description: "Veuillez saisir un motif de rejet",
        variant: "destructive"
      })
      return
    }

    const validationType = (window as any).currentValidationType

    if (validationType) {
      // Utiliser la nouvelle API de validation
      await validateExpense(expenseToReject, false, validationType)
    } else {
      // Utiliser l'ancienne logique pour compatibilité
      try {
        const res = await fetch("/api/expenses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            id: expenseToReject, 
            status: "rejected",
            rejection_reason: rejectionReason.trim()
          }),
        })
        const data = await res.json()
        
        if (res.ok && data?.ok) {
          const updatedExpense = {
            ...data.data,
            amount: Number(data.data.amount),
            requestedBy: data.data.requested_by || data.data.requestedBy,
            id: Number(data.data.id) || data.data.id
          }
          setItems((prev) => prev.map((e) => (String(e.id) === String(expenseToReject) ? updatedExpense : e)))
          
          const exp = updatedExpense
          queueNotification({
            type: "expense_status",
            target: { userName: exp.requestedBy || exp.requested_by },
            message: `Votre dépense "${exp.description}" a été rejetée. Motif: ${rejectionReason}`,
          })
          queueNotification({
            type: "expense_status",
            target: { role: "accounting" },
            message: `Dépense "${exp.description}" rejetée par le directeur. Motif: ${rejectionReason}`,
          })
          toast({ title: "Dépense rejetée", description: `"${exp.description}" rejetée avec motif.` })
        } else {
          toast({ 
            title: "Erreur", 
            description: `Erreur lors du rejet: ${data?.error || "Erreur inconnue"}`,
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({ 
          title: "Erreur réseau", 
          description: "Impossible de rejeter la dépense. Vérifiez votre connexion.",
          variant: "destructive"
        })
      }
    }

    setRejectDialogOpen(false)
    setExpenseToReject(null)
    setRejectionReason("")
    ;(window as any).currentValidationType = undefined
  }

  function openCreate() {
    setNewDesc("")
    setNewAmount("")
    setNewCategory("")
    setNewAgency(user.agency ?? "Agence Centre")
    setDeductFromExcedents(false)
    setSelectedCashierId("")
    setIsDialogOpen(true)
    // Charger les caissiers éligibles si nécessaire (pré-chargement)
    fetch('/api/ria-cash-declarations?type=cashiers-with-excedents')
      .then(r => r.json())
      .then(d => {
        console.log('🧮 Caissiers excédents (préchargement):', d)
        const list = Array.isArray(d?.data) ? d.data : []
        if (isCashier) {
          const mine = list.filter((c: any) => c?.name === user.name)
          setEligibleCashiers(mine)
          if (mine.length > 0) {
            setSelectedCashierId(mine[0].id)
            setDeductFromExcedents(true)
          } else {
            // Pas d'excédents: désactiver l'option
            setDeductFromExcedents(false)
          }
        } else {
          // Directeur / Comptable: voir toute la liste
          setEligibleCashiers(list)
        }
      })
      .catch(() => {})
  }

  async function submitCreate() {
    const amountNum = Number(newAmount)
    if (!newDesc.trim() || !Number.isFinite(amountNum) || amountNum <= 0) {
      alert("Veuillez saisir une description et un montant valide.")
      return
    }
    if (deductFromExcedents) {
      if (!selectedCashierId) {
        alert("Veuillez sélectionner un caissier pour la déduction dans les excédents.")
        return
      }
      const cashier = eligibleCashiers.find(c => c.id === selectedCashierId)
      if (cashier && amountNum > cashier.available_excedents) {
        alert(`Montant supérieur aux excédents disponibles de ${cashier.name} (${cashier.available_excedents} FCFA).`)
        return
      }
    }
    const payload = {
      description: newDesc.trim(),
      amount: amountNum,
      category: newCategory || "Autre",
      agency: newAgency || user.agency || "Agence Centre",
      comment: newComment.trim() || undefined,
      deduct_from_excedents: deductFromExcedents,
      deducted_cashier_id: deductFromExcedents ? selectedCashierId : null,
    }
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        const newExpense = {
          ...data.data,
          amount: Number(data.data.amount), // Convertir le montant en nombre
          requestedBy: data.data.requested_by || data.data.requestedBy,
          id: data.data.id // Garder l'ID original de l'API
        }
        setItems((prev) => [newExpense, ...prev])
        toast({ title: "Succès", description: `Dépense "${newDesc.trim()}" créée avec succès.` })
        
        // Recharger les données depuis l'API pour s'assurer de la synchronisation
        setTimeout(async () => {
          try {
            const res = await fetch("/api/expenses?limit=1000")
            const data = await res.json()
            if (res.ok && data?.ok && Array.isArray(data.data)) {
              const apiData = data.data.map((item: any) => ({
                ...item,
                requestedBy: item.requested_by || item.requestedBy,
                id: item.id
              }))
              setItems(apiData)
            }
          } catch (error) {
          }
        }, 1000)
      } else {
        toast({ 
          title: "Erreur", 
          description: `Erreur lors de la création: ${data?.error || "Erreur inconnue"}`,
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({ 
        title: "Erreur réseau", 
        description: "Impossible de créer la dépense. Vérifiez votre connexion.",
        variant: "destructive"
      })
    }
    setIsDialogOpen(false)
    // Réinitialiser le formulaire
    setNewDesc("")
    setNewAmount("")
    setNewCategory("")
    setNewComment("")
    toast({ title: "Dépense soumise", description: `"${newDesc.trim()}" créée et en attente.` })
    // Notifier seulement le Directeur
    queueNotification({ type: "expense_new", target: { role: "director" }, message: `Nouvelle dépense: ${newDesc.trim()}` })
  }

  // Notification system (localStorage + toasts)
  type NotificationItem = {
    id: string
    type: "expense_new" | "expense_status"
    target: { role?: "accounting" | "director"; userName?: string }
    message: string
    createdAt: number
  }

  function loadNotifications(): NotificationItem[] {
    try {
      const raw = localStorage.getItem("maf_notifications")
      return raw ? (JSON.parse(raw) as NotificationItem[]) : []
    } catch {
      return []
    }
  }

  function saveNotifications(list: NotificationItem[]) {
    try {
      localStorage.setItem("maf_notifications", JSON.stringify(list))
    } catch {
      // ignore
    }
  }

  function queueNotification(n: Omit<NotificationItem, "id" | "createdAt">) {
    const item: NotificationItem = {
      id: `n_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      createdAt: Date.now(),
      ...n,
    }
    const current = loadNotifications()
    current.push(item)
    saveNotifications(current)
  }

  // Consume notifications targeted to current user (role or name)
  useMemo(() => {
    // Run on each render to catch updates after actions
    try {
      const all = loadNotifications()
      const [mine, others]: [NotificationItem[], NotificationItem[]] = all.reduce(
        (acc, it) => {
          const matchRole = it.target.role && (user.role === it.target.role)
          const matchUser = it.target.userName && (user.name === it.target.userName)
          if (matchRole || matchUser) acc[0].push(it)
          else acc[1].push(it)
          return acc
        },
        [[], []] as any,
      )
      if (mine.length > 0) {
        mine.slice(0, 3).forEach((n) => toast({ title: "Notification", description: n.message }))
        // drop consumed
        saveNotifications(others)
      }
    } catch {
      // ignore
    }
  }, [items, user.name, user.role, toast])

  if (loading) {
    return <PageLoader message="Chargement des dépenses..." overlay={false} className="min-h-[320px]" />
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Receipt className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Gestion des Dépenses</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isDirectorDelegate ? "Validation et suivi des dépenses" : 
                    user.role === "accounting" ? "Suivi et consultation des dépenses" : 
                    "Consultation des dépenses"}
                </p>
              </div>
            </div>
          </div>
          <Button onClick={openCreate} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Button>
        </div>

        {/* Filters and Search */}
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                <Filter className="h-4 w-4 text-muted-foreground" />
              </div>
              Filtres et recherche
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Barre de recherche + Export */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par description, demandeur ou agence..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 pl-9 rounded-lg bg-muted/50 text-sm"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="shrink-0 rounded-lg h-9 gap-2">
                    <Download className="h-4 w-4" />
                    Exporter
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={exportCsv} className="gap-2 cursor-pointer">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Exporter en CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportPdf} className="gap-2 cursor-pointer">
                    <FileText className="h-4 w-4 text-red-500" />
                    Exporter en PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tous les filtres sur une seule ligne */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Plage de dates en premier */}
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); if (e.target.value) setPeriodFilter("all") }}
                  className="input-date-centered h-8 w-[130px] min-w-0 text-xs rounded-md"
                />
                <span className="text-xs text-muted-foreground shrink-0">au</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); if (e.target.value) setPeriodFilter("all") }}
                  className="input-date-centered h-8 w-[130px] min-w-0 text-xs rounded-md"
                />
              </div>

              <div className="h-5 w-px bg-border shrink-0 hidden sm:block" />

              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-md text-xs px-2.5 gap-1 [&>span]:truncate [&>span]:max-w-[100px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="accounting_approved">Approuvées comptabilité</SelectItem>
                  <SelectItem value="accounting_rejected">Rejetées comptabilité</SelectItem>
                  <SelectItem value="director_approved">Approuvées directeur</SelectItem>
                  <SelectItem value="director_rejected">Rejetées directeur</SelectItem>
                  <SelectItem value="approved">Approuvées (ancien)</SelectItem>
                  <SelectItem value="rejected">Rejetées (ancien)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-md text-xs px-2.5 gap-1 [&>span]:truncate [&>span]:max-w-[100px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {expenseCategories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={requesterFilter} onValueChange={setRequesterFilter}>
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-md text-xs px-2.5 gap-1 [&>span]:truncate [&>span]:max-w-[100px]">
                  <SelectValue placeholder="Demandeur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les demandeurs</SelectItem>
                  {Array.from(new Set(expenses.map(e => e.requestedBy))).map(requester => (
                    <SelectItem key={requester} value={requester}>{requester}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={agencyFilter} onValueChange={setAgencyFilter}>
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-md text-xs px-2.5 gap-1 [&>span]:truncate [&>span]:max-w-[100px]">
                  <SelectValue placeholder="Agence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les agences</SelectItem>
                  {Array.from(new Set(expenses.map(e => e.agency))).map(agency => (
                    <SelectItem key={agency} value={agency}>{agency}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={periodFilter} onValueChange={(v) => {
                setPeriodFilter(v)
                if (v !== "all") { setDateFrom(""); setDateTo("") }
              }}>
                <SelectTrigger className="h-8 w-auto min-w-0 rounded-md text-xs px-2.5 gap-1 [&>span]:truncate [&>span]:max-w-[100px]">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les périodes</SelectItem>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="year">Cette année</SelectItem>
                  <SelectItem value="last_year">L&apos;année dernière</SelectItem>
                </SelectContent>
              </Select>

              {(dateFrom || dateTo || filter !== "all" || categoryFilter !== "all" || requesterFilter !== "all" || agencyFilter !== "all" || periodFilter !== "all" || searchTerm) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom(""); setDateTo(""); setPeriodFilter("all")
                    setFilter("all"); setCategoryFilter("all"); setRequesterFilter("all")
                    setAgencyFilter("all"); setSearchTerm("")
                  }}
                  className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-md"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts for director role */}
        {isDirectorDelegate && stats.pending > 0 && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{stats.pending} dépenses</strong> nécessitent votre validation pour un montant total de{" "}
              <strong>
                {expenses
                  .filter((e) => e.status === "pending")
                  .reduce((sum, e) => sum + e.amount, 0)
                  .toLocaleString()}{" "}
                XAF
              </strong>
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {/* Total */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shadow-sm">
                <DollarSign className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground mt-3">Total</p>
            <p className="text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-400 mt-0.5">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">dépenses</p>
          </div>

          {/* En attente */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center shadow-sm">
                <Clock className="h-5 w-5 text-amber-700 dark:text-amber-400" />
              </div>
              {(isDirectorDelegate ? stats.pending + stats.accountingApproved : stats.pending) > 0 && (
                <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
              )}
            </div>
            <p className="text-sm font-semibold text-foreground mt-3">
              {isDirectorDelegate ? "En attente" : "En attente comptable"}
            </p>
            <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-400 mt-0.5">
              {isDirectorDelegate ? stats.pending + stats.accountingApproved : stats.pending}
            </p>
            <p className="text-xs mt-1">
              {isDirectorDelegate
                ? <span className="font-bold text-amber-800 dark:text-amber-300">Montant Total : {stats.pendingTotalCost.toLocaleString("fr-FR")} XAF</span>
                : <span className="text-muted-foreground">À valider</span>}
            </p>
          </div>

          {/* Approuvées */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shadow-sm">
                <CheckCircle className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground mt-3">Approuvées</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400 mt-0.5">{stats.directorApproved}</p>
            <p className="text-xs text-muted-foreground mt-1">par directeur</p>
          </div>

          {/* Rejetées */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent p-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-500/20 flex items-center justify-center shadow-sm">
                <XCircle className="h-5 w-5 text-red-700 dark:text-red-400" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground mt-3">Rejetées</p>
            <p className="text-2xl font-bold tabular-nums text-red-700 dark:text-red-400 mt-0.5">{stats.accountingRejected + stats.directorRejected}</p>
            <p className="text-xs text-muted-foreground mt-1">comptable ou directeur</p>
          </div>

          {/* Coût total */}
          <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent p-4 shadow-sm hover:shadow-md transition-all col-span-2 lg:col-span-1">
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-500/20 flex items-center justify-center shadow-sm">
                <TrendingUp className="h-5 w-5 text-violet-700 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-sm font-semibold text-foreground mt-3">Coût total</p>
            <p className="text-xl font-bold tabular-nums text-violet-700 dark:text-violet-400 mt-0.5">{stats.totalCost.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">XAF</span></p>
            <p className="text-xs text-muted-foreground mt-1">dépenses validées</p>
          </div>
        </div>

        {/* Disponibilité Compte UBA */}
        {ubaBalance !== null && (
          <div className="flex items-center gap-3 rounded-lg border bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 px-4 py-3">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
              <Building2 className="h-4 w-4 text-blue-700 dark:text-blue-400" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">Caisse de débit — Compte UBA :</span>
              <span className="text-sm font-bold text-blue-900 dark:text-blue-200 tabular-nums">
                {Number(ubaBalance).toLocaleString("fr-FR")} XAF
              </span>
              <span className="text-xs text-blue-600/70 dark:text-blue-400/60">disponible</span>
            </div>
          </div>
        )}

        {/* Expenses List - Table */}
        <Card className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <CardHeader className="border-b bg-muted/30 px-6 py-4">
            <CardTitle className="text-base font-semibold">
              Liste des dépenses
              <span className="ml-2 font-normal text-muted-foreground">({visibleExpenses.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Libellé</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Montant</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Catégorie</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statut</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demandeur</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agence</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                        <p className="font-medium">Aucune dépense</p>
                        <p className="text-sm mt-1">Aucun résultat ne correspond aux filtres ou la liste est vide.</p>
                      </td>
                    </tr>
                  ) : paginatedExpenses.map((expense, index) => (
                    <tr
                      key={expense.id}
                      className={cn(
                        "border-b border-border/80 transition-colors duration-150 ease-out",
                        "hover:bg-primary/10 hover:border-l-4 hover:border-l-primary border-l-4 border-l-transparent",
                        index % 2 === 1 && "bg-muted/10"
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-foreground">{expense.description}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-semibold tabular-nums text-foreground">{expense.amount.toLocaleString()}</span>
                        <span className="ml-1 text-xs text-muted-foreground">XAF</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{expense.category}</td>
                      <td className="px-5 py-3.5">
                        <Badge className={cn("gap-1.5 font-medium", getStatusColor(expense.status))}>
                          {getStatusIcon(expense.status)}
                          <span>{getStatusLabel(expense.status)}</span>
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{expense.requestedBy}</td>
                      <td className="px-5 py-3.5 text-sm text-muted-foreground">{expense.agency}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm tabular-nums text-muted-foreground">{formatDateFR(expense.date)}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {expense.status === "pending" && user.role === "accounting" && (
                            <>
                              <Button
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3 font-medium text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                onClick={() => validateExpense(expense.id, true, "accounting")}
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Approuver</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 rounded-lg border-2 border-red-500/70 bg-red-500/5 font-medium text-red-600 shadow-sm transition-all hover:bg-red-500/15 hover:border-red-500 dark:border-red-400/70 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                onClick={() => openRejectDialog(expense.id, "accounting")}
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Rejeter</span>
                              </Button>
                            </>
                          )}
                          {/* Directeur : Valider/Rejeter uniquement si déjà approuvé par la compta (même modèle que le tableau de bord) */}
                          {isDirectorDelegate && expense.status === "accounting_approved" && (
                            <>
                              <Button
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3 font-medium text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                onClick={() => validateExpense(expense.id, true, "director")}
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Valider</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 rounded-lg border-2 border-red-500/70 bg-red-500/5 font-medium text-red-600 shadow-sm transition-all hover:bg-red-500/15 hover:border-red-500 dark:border-red-400/70 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                onClick={() => openRejectDialog(expense.id, "director")}
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Rejeter</span>
                              </Button>
                            </>
                          )}
                          {/* Délégué/directeur en mode "moderate all" sur dépense pending (autre workflow) : Approuver/Rejeter */}
                          {expense.status === "pending" && canModerateAll && user.role !== "accounting" && !isDirectorDelegate && (
                            <>
                              <Button
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3 font-medium text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                onClick={() => approve(expense.id)}
                              >
                                <CheckCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Approuver</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 rounded-lg border-2 border-red-500/70 bg-red-500/5 font-medium text-red-600 shadow-sm transition-all hover:bg-red-500/15 hover:border-red-500 dark:border-red-400/70 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                onClick={() => openRejectDialog(expense.id)}
                              >
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Rejeter</span>
                              </Button>
                            </>
                          )}
                          {expense.status !== "director_approved" && expense.status !== "approved" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 rounded-lg border-2 border-blue-500/70 bg-blue-500/5 font-medium text-blue-700 shadow-sm transition-all hover:bg-blue-500/15 hover:border-blue-500 dark:border-blue-400/70 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                onClick={() => openEditDialog(expense)}
                              >
                                <Pencil className="h-4 w-4" />
                                <span className="hidden sm:inline">Modifier</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 rounded-lg border-2 border-amber-500/70 bg-amber-500/5 font-medium text-amber-800 shadow-sm transition-all hover:bg-amber-500/15 hover:border-amber-500 dark:border-amber-400/70 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20"
                                onClick={() => handleDeleteExpense(expense.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Supprimer</span>
                              </Button>
                            </>
                          )}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-9 gap-1.5 rounded-lg border-2 border-slate-300/80 bg-slate-500/5 font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-500/10 hover:border-slate-400 dark:border-slate-500/60 dark:bg-slate-500/10 dark:text-slate-300 dark:hover:bg-slate-500/20 dark:hover:text-slate-100"
                              >
                                <Eye className="h-4 w-4" />
                                <span className="hidden sm:inline">Voir le commentaire</span>
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="max-w-sm p-4 bg-popover" align="end">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Commentaire</p>
                              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                                {(expense as any).comment?.trim() || "Aucun commentaire"}
                              </p>
                            </PopoverContent>
                          </Popover>
                          {(expense.status === "director_approved" || expense.status === "approved") && (
                            <PDFReceipt
                              expense={{
                                id: String(expense.id),
                                description: expense.description,
                                amount: expense.amount,
                                category: expense.category,
                                status: expense.status,
                                date: expense.date,
                                requested_by: expense.requestedBy,
                                agency: expense.agency,
                                comment: (expense as any).comment,
                                rejection_reason: (expense as any).rejection_reason
                              }}
                              user={user}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Motifs de rejet (dépenses de la page concernées) */}
            {paginatedExpenses.some((e) => (e.status === "rejected" || e.status === "accounting_rejected" || e.status === "director_rejected") && (e as any).rejection_reason) && (
              <div className="space-y-2 border-t border-border bg-muted/10 px-6 py-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Motifs de rejet</p>
                {paginatedExpenses
                  .filter((e) => (e.status === "rejected" || e.status === "accounting_rejected" || e.status === "director_rejected") && (e as any).rejection_reason)
                  .map((expense) => (
                    <div key={expense.id} className="rounded-lg border border-red-200/80 bg-red-50/80 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-red-800 dark:text-red-200">{expense.description}</span>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap">{(expense as any).rejection_reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
          
          {/* Pagination */}
          <div className="flex flex-col gap-4 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="items-per-page" className="text-sm text-muted-foreground whitespace-nowrap">
                  Par page
                </Label>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger id="items-per-page" className="h-9 w-20 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {startIndex + 1} – {Math.min(endIndex, visibleExpenses.length)} sur {visibleExpenses.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:ml-1">Précédent</span>
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber: number
                  if (totalPages <= 5) {
                    pageNumber = i + 1
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i
                  } else {
                    pageNumber = currentPage - 2 + i
                  }
                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      className="h-9 w-9 rounded-lg p-0"
                      onClick={() => handlePageChange(pageNumber)}
                    >
                      {pageNumber}
                    </Button>
                  )
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only sm:not-sr-only sm:mr-1">Suivant</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Create expense dialog: accessible à tous */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle dépense</DialogTitle>
              <DialogDescription>
                Remplissez les informations ci-dessous pour créer une nouvelle dépense.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="exp-desc">Libellé</Label>
                <Input id="exp-desc" className="mt-1" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="exp-amount">Montant</Label>
                  <Input
                    id="exp-amount"
                    type="number"
                    className="mt-1"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="exp-category">Catégorie</Label>
                  <Select value={newCategory} onValueChange={setNewCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(category => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            {/* Déduction dans les excédents */}
            <div className="rounded-lg border p-3 bg-gray-50">
              <div className="flex items-center gap-3">
                <input
                  id="deduct-excedents"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={deductFromExcedents}
                  disabled={isCashier && (!eligibleCashiers || eligibleCashiers.length === 0)}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setDeductFromExcedents(checked)
                    if (checked && eligibleCashiers.length === 0) {
                      fetch('/api/ria-cash-declarations?type=cashiers-with-excedents')
                        .then(r => r.json())
                        .then(d => {
                          if (Array.isArray(d?.data)) setEligibleCashiers(d.data)
                        })
                        .catch(() => {})
                    }
                  }}
                />
                <Label htmlFor="deduct-excedents" className="cursor-pointer">Déduire dans les excédents (optionnel)</Label>
              </div>

              {deductFromExcedents && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Caissier à débiter</Label>
                    <Select value={selectedCashierId} onValueChange={setSelectedCashierId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner un caissier" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleCashiers.map(c => (
                          <SelectItem key={c.id} value={c.id} disabled={isCashier && c.name !== user.name}>
                            {c.name} — {(c.available_excedents || 0).toLocaleString()} FCFA
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Excédents disponibles</Label>
                    <Input
                      value={(eligibleCashiers.find(c => c.id === selectedCashierId)?.available_excedents || 0).toLocaleString() + ' FCFA'}
                      disabled
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

              <div>
                <Label htmlFor="exp-comment">Commentaire</Label>
                <Textarea 
                  id="exp-comment" 
                  className="mt-1" 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Ajouter un commentaire (optionnel)"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="exp-agency">Agence</Label>
                <Input 
                  id="exp-agency" 
                  className="mt-1" 
                  value={user.agency} 
                  disabled 
                  placeholder="Agence assignée à l'utilisateur"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
              <Button onClick={submitCreate}>Créer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pour modifier une dépense (avant validation directeur) */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) setExpenseToEdit(null) }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Modifier la dépense</DialogTitle>
              <DialogDescription>
                Modifiez les champs ci-dessous. Les dépenses validées par le directeur ne sont plus modifiables.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-desc">Libellé</Label>
                <Input id="edit-desc" className="mt-1" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="edit-amount">Montant (XAF)</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    min={0}
                    className="mt-1"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-category">Catégorie</Label>
                  <Select value={editCategory} onValueChange={setEditCategory}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-agency">Agence</Label>
                <Input
                  id="edit-agency"
                  className="mt-1"
                  value={editAgency}
                  onChange={(e) => setEditAgency(e.target.value)}
                  placeholder="Agence"
                />
              </div>
              <div>
                <Label htmlFor="edit-comment">Commentaire</Label>
                <Textarea
                  id="edit-comment"
                  className="mt-1"
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setEditDialogOpen(false); setExpenseToEdit(null) }}>
                Annuler
              </Button>
              <Button onClick={submitEdit}>
                <Pencil className="h-4 w-4 mr-1" />
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog pour rejeter une dépense avec motif */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Rejeter la dépense</DialogTitle>
              <DialogDescription>
                Veuillez indiquer le motif du rejet de cette dépense.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rejection-reason">Motif du rejet *</Label>
                <Textarea
                  id="rejection-reason"
                  className="mt-1"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette dépense est rejetée..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmReject}
                disabled={!rejectionReason.trim()}
              >
                Rejeter la dépense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialogue de confirmation de suppression */}
        <AlertDialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Confirmer la suppression
              </AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer la dépense "{expenseToDelete?.description}" ?
                <br />
                <span className="font-medium text-red-600 mt-2 block">
                  Cette action est irréversible.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setDeleteConfirmDialogOpen(false)
                setExpenseToDelete(null)
              }}>
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteExpense}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  )
}
