"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
} from "lucide-react"
import { ActionGuard } from "@/components/permission-guard"
import { PDFReceipt } from "@/components/pdf-receipt"
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
  const [selectedExpenseComment, setSelectedExpenseComment] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [expenseToReject, setExpenseToReject] = useState<string | number | null>(null)

  const expenses = items

  // Load from API when DB is configured
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch("/api/expenses")
        const data = await res.json()
        if (res.ok && data?.ok && Array.isArray(data.data)) {
          // Transformer les données de l'API pour correspondre au format du composant
          const apiData = data.data.map((item: any) => ({
            ...item,
            amount: Number(item.amount), // Convertir le montant en nombre
            requestedBy: item.requested_by || item.requestedBy,
            id: item.id // Garder l'ID original de l'API
          }))
          
          // Utiliser toujours les données de l'API (même si vides)
          setItems(apiData)
        } else if (res.status === 401 || res.status === 403) {
        } else {
        }
      } catch (error) {
      }
    })()
  }, [])

  // Determine visibility scope: director and accounting see all, others only their own
  const canModerateAll = user.role === "director"
  const canViewAll = user.role === "director" || user.role === "accounting"

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
    
    // Filtre par période
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
    
    // Filtre par recherche textuelle
    if (searchTerm) {
      filtered = filtered.filter((e) =>
        e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.requestedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.agency.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    return filtered
  }, [expenses, canViewAll, user.name, filter, categoryFilter, requesterFilter, agencyFilter, periodFilter, searchTerm])

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
    
    return { 
      total, 
      pending, 
      accountingApproved, 
      accountingRejected, 
      directorApproved, 
      directorRejected,
      approved, // Pour compatibilité
      rejected, // Pour compatibilité
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
  }, [filter, categoryFilter, requesterFilter, agencyFilter, periodFilter, searchTerm])

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

  function exportCsv() {
    if (visibleExpenses.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Aucune dépense ne correspond aux filtres appliqués.",
        variant: "destructive"
      })
      return
    }

    try {
      // Créer les en-têtes CSV
      const headers = [
        "ID",
        "Libellé",
        "Montant",
        "Catégorie",
        "Statut",
        "Demandeur",
        "Agence",
        "Date",
        "Commentaire"
      ]

      // Créer les lignes de données
      const csvRows = [
        headers.join(","),
        ...visibleExpenses.map(expense => [
          expense.id,
          `"${expense.description.replace(/"/g, '""')}"`,
          expense.amount,
          `"${expense.category}"`,
          `"${expense.status}"`,
          `"${expense.requestedBy}"`,
          `"${expense.agency}"`,
          `"${expense.date}"`,
          `"${((expense as any).comment || "").replace(/"/g, '""')}"`
        ].join(","))
      ]

      // Créer le contenu CSV
      const csvContent = csvRows.join("\n")

      // Créer le nom de fichier avec la date et les filtres
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      let filename = `depenses_${dateStr}`
      
      // Ajouter des suffixes selon les filtres
      if (periodFilter !== "all") {
        filename += `_${periodFilter}`
      }
      if (filter !== "all") {
        filename += `_${filter}`
      }
      if (categoryFilter !== "all") {
        filename += `_${categoryFilter}`
      }
      if (searchTerm) {
        filename += `_recherche`
      }
      
      filename += ".csv"

      // Créer et télécharger le fichier
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const link = document.createElement("a")
      
      if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
        link.setAttribute("href", url)
        link.setAttribute("download", filename)
        link.style.visibility = "hidden"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    URL.revokeObjectURL(url)
      }

      toast({
        title: "Export réussi",
        description: `${visibleExpenses.length} dépenses exportées vers ${filename}`,
      })
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Une erreur est survenue lors de l'exportation des données.",
        variant: "destructive"
      })
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

  // Nouvelles fonctions pour le workflow en 2 étapes
  async function validateExpense(id: string | number, approved: boolean, validationType: "accounting" | "director") {
    try {
      const res = await fetch("/api/expenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          expenseId: id, 
          approved, 
          validationType,
          rejectionReason: approved ? undefined : rejectionReason
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
            const res = await fetch("/api/expenses")
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

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Gestion des Dépenses</h1>
            <p className="text-gray-600 mt-1">
              {user.role === "director" ? "Validation et suivi des dépenses" : 
               user.role === "accounting" ? "Suivi et consultation des dépenses" : 
               "Consultation des dépenses"}
            </p>
          </div>
          {/* Tous les utilisateurs peuvent créer une dépense */}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle dépense
          </Button>
        </div>

        {/* Alerts for director role */}
        {user.role === "director" && stats.pending > 0 && (
          <Alert className="border-orange-200 bg-orange-50">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Dépenses</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                {user.role === "director" ? "En attente de validation" : "En attente de validation comptable"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {user.role === "director" ? stats.pending + stats.accountingApproved : stats.pending}
              </div>
              <p className="text-xs text-muted-foreground">
                {user.role === "director" ? "Comptable ou directeur" : "Nécessitent validation comptable"}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Approuvées par directeur
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.directorApproved}</div>
              <p className="text-xs text-muted-foreground">Validées par le directeur</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Rejetées
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.accountingRejected + stats.directorRejected}</div>
              <p className="text-xs text-muted-foreground">Comptable ou directeur</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                Coût total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{stats.totalCost.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">XAF (validées)</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtres et Recherche
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                      placeholder="Rechercher par description, demandeur ou agence..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="h-4 w-4 mr-2" />
                  Exporter
                </Button>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="accounting_approved">Approuvées par comptabilité</SelectItem>
                  <SelectItem value="accounting_rejected">Rejetées par comptabilité</SelectItem>
                  <SelectItem value="director_approved">Approuvées par directeur</SelectItem>
                  <SelectItem value="director_rejected">Rejetées par directeur</SelectItem>
                  {/* Anciens statuts pour compatibilité */}
                  <SelectItem value="approved">Approuvées (ancien)</SelectItem>
                  <SelectItem value="rejected">Rejetées (ancien)</SelectItem>
                </SelectContent>
              </Select>
                
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
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
                  <SelectTrigger className="w-full sm:w-48">
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
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Agence" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les agences</SelectItem>
                    {Array.from(new Set(expenses.map(e => e.agency))).map(agency => (
                      <SelectItem key={agency} value={agency}>{agency}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Période" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les périodes</SelectItem>
                    <SelectItem value="today">Aujourd'hui</SelectItem>
                    <SelectItem value="week">Cette semaine</SelectItem>
                    <SelectItem value="month">Ce mois</SelectItem>
                    <SelectItem value="year">Cette année</SelectItem>
                    <SelectItem value="last_year">L'année dernière</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expenses List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Dépenses ({visibleExpenses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {paginatedExpenses.map((expense) => (
                <div key={expense.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{expense.description}</h3>
                        <Badge className={getStatusColor(expense.status)}>
                          {getStatusIcon(expense.status)}
                          <span className="ml-1">{getStatusLabel(expense.status)}</span>
                        </Badge>
                        {((expense as any).comment && (expense as any).comment.trim()) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedExpenseComment((expense as any).comment)}
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Voir commentaire
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Montant:</span>
                          <div className="text-lg font-bold text-gray-900">{expense.amount.toLocaleString()} XAF</div>
                        </div>
                        <div>
                          <span className="font-medium">Catégorie:</span>
                          <div>{expense.category}</div>
                        </div>
                        <div>
                          <span className="font-medium">Demandeur:</span>
                          <div>{expense.requestedBy}</div>
                        </div>
                        <div>
                          <span className="font-medium">Agence:</span>
                          <div>{expense.agency}</div>
                        </div>
                      </div>
                      {/* Affichage du motif de rejet si la dépense est rejetée */}
                      {expense.status === "rejected" && (expense as any).rejection_reason && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium text-red-800">Motif du rejet:</span>
                              <p className="text-sm text-red-700 mt-1 whitespace-pre-wrap">
                                {(expense as any).rejection_reason}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <div className="text-sm text-gray-500">{expense.date}</div>
                      
                      {/* Boutons pour comptables - validation comptable */}
                      {expense.status === "pending" && user.role === "accounting" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                            onClick={() => validateExpense(expense.id, true, "accounting")}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                            onClick={() => openRejectDialog(expense.id, "accounting")}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                      
                      {/* Boutons pour directeurs - validation directeur */}
                      {expense.status === "accounting_approved" && user.role === "director" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                            onClick={() => validateExpense(expense.id, true, "director")}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                            onClick={() => openRejectDialog(expense.id, "director")}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                      
                      {/* Ancienne logique pour compatibilité (à supprimer plus tard) */}
                      {expense.status === "pending" && canModerateAll && user.role !== "accounting" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                            onClick={() => approve(expense.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                            onClick={() => openRejectDialog(expense.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                      
                      {/* Affichage du PDF pour les dépenses finalement approuvées */}
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
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          
          {/* Contrôles de pagination */}
          <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="items-per-page" className="text-sm text-gray-600">
                  Éléments par page:
                </Label>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-20">
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
              <div className="text-sm text-gray-600">
                Affichage de {startIndex + 1} à {Math.min(endIndex, visibleExpenses.length)} sur {visibleExpenses.length} dépenses
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
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
                      onClick={() => handlePageChange(pageNumber)}
                      className="w-8 h-8 p-0"
                    >
                      {pageNumber}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Suivant
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

        {/* Dialog pour afficher le commentaire */}
        <Dialog open={selectedExpenseComment !== null} onOpenChange={() => setSelectedExpenseComment(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Commentaire de la dépense</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedExpenseComment || "Aucun commentaire disponible"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedExpenseComment(null)}>
                Fermer
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
      </div>
  )
}
