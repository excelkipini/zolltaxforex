"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Receipt,
  TrendingUp,
  FileText,
  AlertTriangle,
  User,
  Building2,
  Calendar,
  Eye,
  Settings,
  CreditCard,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import type { SessionUser } from "@/lib/auth-client"
import { PageLoader } from "@/components/ui/page-loader"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { formatDateFR } from "@/lib/utils"
import { PDFReceipt } from "@/components/pdf-receipt"
import { useExchangeRates } from "@/hooks/use-exchange-rates"

interface AccountingDashboardProps {
  user: SessionUser
}

export function AccountingDashboard({ user }: AccountingDashboardProps) {
  // Utiliser les taux de change dynamiques
  const { rates: exchangeRates, loading: ratesLoading } = useExchangeRates()
  const { toast } = useToast()
  
  const [loading, setLoading] = React.useState(true)
  const [stats, setStats] = React.useState({
    pendingExpenses: 0,
    approvedExpenses: 0,
    rejectedExpenses: 0,
    totalPendingAmount: 0,
    totalApprovedAmount: 0
  })
  const [pendingExpensesList, setPendingExpensesList] = React.useState<any[]>([])
  const [pendingDeleteReceipts, setPendingDeleteReceipts] = React.useState<any[]>([])
  const [pendingDeleteCount, setPendingDeleteCount] = React.useState(0)
  
  // États pour les dialogues d'approbation/rejet
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [expenseToReject, setExpenseToReject] = React.useState<any>(null)

  // États pour modifier / supprimer une dépense
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [expenseToEdit, setExpenseToEdit] = React.useState<any>(null)
  const [editDesc, setEditDesc] = React.useState("")
  const [editAmount, setEditAmount] = React.useState("")
  const [editCategory, setEditCategory] = React.useState("")
  const [editAgency, setEditAgency] = React.useState("")
  const [editComment, setEditComment] = React.useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [expenseToDelete, setExpenseToDelete] = React.useState<any>(null)

  const expenseCategories = ["Bureau", "Transport", "Communication", "Formation", "Équipement", "Maintenance", "Marketing", "Autre", "Autres"]

  // Mettre à jour le titre de la page selon le rôle
  const isDirectorDelegate = user.role === "director" || user.role === "delegate"

  useDocumentTitle({ title: isDirectorDelegate ? "Tableau de bord Directeur" : "Tableau de bord Comptable" })

  // Charger les statistiques des dépenses (endpoint dashboard = stats + liste limitée, plus rapide)
  const loadStats = async () => {
    try {
      const response = await fetch('/api/expenses?type=dashboard')
      const data = await response.json()

      if (response.ok && data?.ok && data?.type === 'dashboard' && data?.data) {
        const { stats: s, pendingList } = data.data
        setStats({
          pendingExpenses: s.pendingCount ?? 0,
          approvedExpenses: s.approvedCount ?? 0,
          rejectedExpenses: s.rejectedCount ?? 0,
          totalPendingAmount: s.totalPendingAmount ?? 0,
          totalApprovedAmount: s.totalApprovedAmount ?? 0
        })
        setPendingExpensesList(Array.isArray(pendingList) ? pendingList : [])
      } else {
        toast({
          title: "Erreur de chargement",
          description: data?.error ?? "Impossible de charger les données des dépenses.",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les données des dépenses. Vérifiez votre connexion.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Charger les transactions en attente de suppression
  const loadPendingDeleteTransactions = async () => {
    try {
      const response = await fetch('/api/transactions')
      const data = await response.json()
      
      if (data.ok && Array.isArray(data.data)) {
        const pendingTransactions = data.data.filter(transaction => 
          transaction.status === 'pending_delete' &&
          !transaction.delete_validated_by
        )
        
        setPendingDeleteReceipts(pendingTransactions)
        setPendingDeleteCount(pendingTransactions.length)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des transactions:', error)
    }
  }

  React.useEffect(() => {
    loadStats()
    // Charger les transactions en attente de suppression pour les comptables et directeurs
    if (user.role === "accounting" || isDirectorDelegate) {
      loadPendingDeleteTransactions()
    }
  }, [user.role])

  // Valider la suppression d'un reçu
  const handleValidateDelete = async (transaction: any) => {
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/validate-delete`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la validation')
      }

      const result = await response.json()
      
      // Recharger les transactions en attente
      await loadPendingDeleteTransactions()
      
      // Afficher un message de succès (vous pouvez ajouter un toast ici)
    } catch (error: any) {
      console.error('Erreur lors de la validation:', error.message)
    }
  }

  // Nouvelles fonctions pour le workflow en 2 étapes
  const validateExpense = async (expenseId: string, approved: boolean, validationType: "accounting" | "director") => {
    try {
      const response = await fetch("/api/expenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          expenseId, 
          approved, 
          validationType,
          rejectionReason: approved ? undefined : rejectionReason
        }),
      })
      
      const data = await response.json()
      
      if (response.ok && data?.ok) {
        const action = approved ? "approuvée" : "rejetée"
        const validator = validationType === "accounting" ? "comptabilité" : "directeur"
        
        toast({
          title: `Dépense ${action}`,
          description: `Dépense ${action} par la ${validator} avec succès.`,
        })
        
        // Recharger les données
        await loadStats()
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

  // Approuver une dépense (ancienne fonction pour compatibilité)
  const approveExpense = async (expense: any) => {
    try {
      const response = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expense.id, status: "approved" }),
      })
      
      const data = await response.json()
      
      if (response.ok && data?.ok) {
        toast({
          title: "Dépense approuvée",
          description: `"${expense.description}" approuvée avec succès.`,
        })
        
        // Recharger les données
        await loadStats()
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

  // Ouvrir le dialogue de rejet
  const openRejectDialog = (expenseId: string, validationType?: "accounting" | "director") => {
    setExpenseToReject({ id: expenseId })
    setRejectionReason("")
    setRejectDialogOpen(true)
    // Stocker le type de validation pour l'utiliser dans confirmReject
    ;(window as any).currentValidationType = validationType
  }

  // Confirmer le rejet d'une dépense
  const confirmReject = async () => {
    if (!expenseToReject || !rejectionReason.trim()) return

    const validationType = (window as any).currentValidationType

    if (validationType) {
      // Utiliser la nouvelle API de validation
      await validateExpense(expenseToReject.id, false, validationType)
    } else {
      // Utiliser l'ancienne logique pour compatibilité
      try {
        const response = await fetch("/api/expenses", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: expenseToReject.id,
            status: "rejected",
            rejection_reason: rejectionReason.trim()
          }),
        })
        
        const data = await response.json()
        
        if (response.ok && data?.ok) {
          toast({
            title: "Dépense rejetée",
            description: `"${expenseToReject.description}" rejetée avec succès.`,
          })
          
          // Fermer le dialogue et recharger les données
          setRejectDialogOpen(false)
          setExpenseToReject(null)
          setRejectionReason("")
          await loadStats()
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

    // Fermer le dialogue et nettoyer
    setRejectDialogOpen(false)
    setExpenseToReject(null)
    setRejectionReason("")
    ;(window as any).currentValidationType = undefined
  }

  const openEditDialog = (expense: any) => {
    setExpenseToEdit(expense)
    setEditDesc(expense.description ?? "")
    setEditAmount(String(expense.amount ?? ""))
    setEditCategory(expense.category ?? "Autre")
    setEditAgency(expense.agency ?? "")
    setEditComment(expense.comment ?? "")
    setEditDialogOpen(true)
  }

  const submitEdit = async () => {
    if (!expenseToEdit) return
    const amount = Number(editAmount)
    if (!editDesc.trim() || Number.isNaN(amount) || amount < 0) {
      toast({ title: "Champs invalides", description: "Libellé et montant (positif) sont requis.", variant: "destructive" })
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
      if (res.ok && data?.ok) {
        toast({ title: "Dépense modifiée", description: "Les modifications ont été enregistrées." })
        setEditDialogOpen(false)
        setExpenseToEdit(null)
        await loadStats()
      } else {
        toast({ title: "Erreur", description: data?.error ?? "Erreur lors de la modification", variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la dépense", variant: "destructive" })
    }
  }

  const handleDeleteExpense = (expense: any) => {
    if (expense.status === "director_approved" || expense.status === "approved") {
      toast({ title: "Suppression impossible", description: "Impossible de supprimer une dépense validée par le directeur.", variant: "destructive" })
      return
    }
    setExpenseToDelete(expense)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return
    try {
      const res = await fetch(`/api/expenses?id=${expenseToDelete.id}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok && data?.ok) {
        toast({ title: "Dépense supprimée", description: `"${expenseToDelete.description}" a été supprimée.` })
        setDeleteDialogOpen(false)
        setExpenseToDelete(null)
        await loadStats()
      } else {
        toast({ title: "Erreur", description: data?.error ?? "Erreur lors de la suppression", variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer la dépense", variant: "destructive" })
    }
  }

  // Formater le montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const statsCards = [
    { 
      label: isDirectorDelegate ? "En attente de validation" : "En attente de validation comptable", 
      value: stats.pendingExpenses.toString(), 
      icon: Clock, 
      color: "text-yellow-600",
      description: isDirectorDelegate ? "Comptable ou directeur" : "En attente de validation"
    },
    { 
      label: "Approuvées par directeur", 
      value: stats.approvedExpenses.toString(), 
      icon: CheckCircle, 
      color: "text-green-600",
      description: "Validées par le directeur"
    },
    { 
      label: "Rejetées", 
      value: stats.rejectedExpenses.toString(), 
      icon: XCircle, 
      color: "text-red-600",
      description: isDirectorDelegate ? "Comptable ou directeur" : "Comptable ou directeur"
    },
    { 
      label: "Montant total approuvé", 
      value: formatAmount(stats.totalApprovedAmount), 
      icon: DollarSign, 
      color: "text-purple-600",
      description: "Somme des dépenses validées"
    }
  ]


  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <PageLoader message="Chargement du tableau de bord..." overlay={false} />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bonjour, {user.name} 👋</h1>
          <p className="text-muted-foreground">
            {isDirectorDelegate 
              ? "Tableau de bord directeur - Supervision et validation des dépenses" 
              : "Tableau de bord comptable - Gestion des dépenses et validation"
            }
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/expenses">
              <Receipt className="h-4 w-4 mr-2" />
              {isDirectorDelegate ? "Valider les dépenses" : "Gérer les dépenses"}
            </a>
          </Button>
        </div>
      </div>

      {/* Section 1: Notifications des dépenses en attente */}
      {stats.pendingExpenses > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Bell className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            Dépenses en attente de validation
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            <strong>{stats.pendingExpenses}</strong> dépense{stats.pendingExpenses > 1 ? 's' : ''} en attente 
            pour un montant total de <strong>{formatAmount(stats.totalPendingAmount)}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Section 2: Notification des transactions en attente de suppression - Pour les comptables et directeurs */}
      {(user.role === "accounting" || isDirectorDelegate) && pendingDeleteCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800">
            Transactions en attente de validation de suppression
          </AlertTitle>
          <AlertDescription className="text-orange-700">
            <strong>{pendingDeleteCount}</strong> transaction{pendingDeleteCount > 1 ? 's' : ''} en attente 
            de validation pour suppression. Les caissiers attendent votre validation.
          </AlertDescription>
        </Alert>
      )}

      {/* Section 2: Statistiques détaillées */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Section 3: Taux de change actuels (Achat / Vente) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taux de change actuels
          </CardTitle>
          <CardDescription>
            Cours des devises en temps réel — mise à jour automatique
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ratesLoading ? (
            <div className="text-center text-muted-foreground py-4">Chargement des taux…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* USD */}
              <div className="rounded-lg border p-4 bg-blue-50/60">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-sm font-semibold">USD/XAF</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Achat</p>
                    <p className="text-lg font-bold text-green-600">{exchangeRates.USD_buy.toLocaleString("fr-FR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Vente</p>
                    <p className="text-lg font-bold text-red-500">{exchangeRates.USD_sell.toLocaleString("fr-FR")}</p>
                  </div>
                </div>
              </div>

              {/* EUR */}
              <div className="rounded-lg border p-4 bg-green-50/60">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-sm font-semibold">EUR/XAF</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Achat</p>
                    <p className="text-lg font-bold text-green-600">{exchangeRates.EUR_buy.toLocaleString("fr-FR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Vente</p>
                    <p className="text-lg font-bold text-red-500">{exchangeRates.EUR_sell.toLocaleString("fr-FR")}</p>
                  </div>
                </div>
              </div>

              {/* GBP */}
              <div className="rounded-lg border p-4 bg-purple-50/60">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-sm font-semibold">GBP/XAF</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Achat</p>
                    <p className="text-lg font-bold text-green-600">{exchangeRates.GBP_buy.toLocaleString("fr-FR")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Vente</p>
                    <p className="text-lg font-bold text-red-500">{exchangeRates.GBP_sell.toLocaleString("fr-FR")}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions rapides */}
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>
            Accès direct aux fonctionnalités principales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/expenses">
                <Receipt className="h-6 w-6" />
                <span className="text-sm">{isDirectorDelegate ? "Valider les dépenses" : "Gérer les dépenses"}</span>
              </a>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/reports">
                <FileText className="h-6 w-6" />
                <span className="text-sm">Générer rapport</span>
              </a>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/transactions">
                <TrendingUp className="h-6 w-6" />
                <span className="text-sm">Voir opérations</span>
              </a>
            </Button>
          </div>
          
          {/* Raccourcis spécifiques au Directeur */}
          {isDirectorDelegate && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Raccourcis Directeur</h4>
              <div className="grid gap-4 md:grid-cols-4">
                <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
                  <a href="/rates">
                    <Settings className="h-6 w-6" />
                    <span className="text-sm">Mettre à jour les taux</span>
                  </a>
                </Button>
                
                <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
                  <a href="/cards">
                    <CreditCard className="h-6 w-6" />
                    <span className="text-sm">Ajouter une carte</span>
                  </a>
                </Button>
                
                <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
                  <a href="/agencies">
                    <Building2 className="h-6 w-6" />
                    <span className="text-sm">Ajouter une agence</span>
                  </a>
                </Button>
                
                <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
                  <a href="/users">
                    <User className="h-6 w-6" />
                    <span className="text-sm">Ajouter un utilisateur</span>
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Liste des dépenses en attente d'approbation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Dépenses en attente d'approbation
          </CardTitle>
          <CardDescription>
            {isDirectorDelegate 
              ? "Liste des dépenses validées par la comptabilité et en attente de votre validation" 
              : "Liste des dépenses en attente de validation par la comptabilité"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingExpensesList.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">Aucune dépense en attente</p>
              <p className="text-sm">Toutes les dépenses ont été traitées</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingExpensesList.map((expense) => (
                <div key={expense.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                          En attente
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {expense.category}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-lg mb-2">{expense.description}</h3>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-600">
                            {formatAmount(Number(expense.amount))}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          <span className="text-gray-600">{expense.requested_by}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-purple-600" />
                          <span className="text-gray-600">{expense.agency}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-600" />
                          <span className="whitespace-nowrap text-gray-600">
                            {formatDateFR(expense.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="ml-4 flex flex-col gap-2">
                      {/* Boutons pour comptables - validation comptable */}
                      {user.role === "accounting" && expense.status === "pending" && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3 font-medium text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                              onClick={() => validateExpense(expense.id, true, "accounting")}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approuver
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 gap-1.5 rounded-lg border-2 border-red-500/70 bg-red-500/5 font-medium text-red-600 hover:bg-red-500/15 dark:border-red-400/70 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                              onClick={() => openRejectDialog(expense.id, "accounting")}
                            >
                              <XCircle className="h-4 w-4" />
                              Rejeter
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 gap-1.5 rounded-lg border-2 border-blue-500/70 bg-blue-500/5 font-medium text-blue-700 hover:bg-blue-500/15 dark:border-blue-400/70 dark:text-blue-300 dark:hover:bg-blue-500/20"
                              onClick={() => openEditDialog(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 gap-1.5 rounded-lg border-2 border-amber-500/70 bg-amber-500/5 font-medium text-amber-800 hover:bg-amber-500/15 dark:border-amber-400/70 dark:text-amber-300 dark:hover:bg-amber-500/20"
                              onClick={() => handleDeleteExpense(expense)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Supprimer
                            </Button>
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg border-2 border-slate-300/80 bg-slate-500/5 font-medium hover:bg-slate-500/10 dark:border-slate-500/60 dark:bg-slate-500/10 dark:hover:bg-slate-500/20"
                              >
                                <Eye className="h-4 w-4" />
                                Voir le commentaire
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="max-w-sm p-4 bg-popover" align="end">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Commentaire</p>
                              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                                {expense.comment?.trim() || "Aucun commentaire"}
                              </p>
                            </PopoverContent>
                          </Popover>
                        </>
                      )}

                      {/* Boutons pour directeurs - même modèle que le comptable */}
                      {isDirectorDelegate && (expense.status === "accounting_approved" || expense.status === "pending") && (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {expense.status === "accounting_approved" && (
                              <>
                                <Button
                                  size="sm"
                                  className="h-9 gap-1.5 rounded-lg bg-emerald-600 px-3 font-medium text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                  onClick={() => validateExpense(expense.id, true, "director")}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                  Valider
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1.5 rounded-lg border-2 border-red-500/70 bg-red-500/5 font-medium text-red-600 hover:bg-red-500/15 dark:border-red-400/70 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                                  onClick={() => openRejectDialog(expense.id, "director")}
                                >
                                  <XCircle className="h-4 w-4" />
                                  Rejeter
                                </Button>
                              </>
                            )}
                            {expense.status !== "director_approved" && expense.status !== "approved" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1.5 rounded-lg border-2 border-blue-500/70 bg-blue-500/5 font-medium text-blue-700 hover:bg-blue-500/15 dark:border-blue-400/70 dark:text-blue-300 dark:hover:bg-blue-500/20"
                                  onClick={() => openEditDialog(expense)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Modifier
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 gap-1.5 rounded-lg border-2 border-amber-500/70 bg-amber-500/5 font-medium text-amber-800 hover:bg-amber-500/15 dark:border-amber-400/70 dark:text-amber-300 dark:hover:bg-amber-500/20"
                                  onClick={() => handleDeleteExpense(expense)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Supprimer
                                </Button>
                              </>
                            )}
                          </div>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg border-2 border-slate-300/80 bg-slate-500/5 font-medium hover:bg-slate-500/10 dark:border-slate-500/60 dark:bg-slate-500/10 dark:hover:bg-slate-500/20"
                              >
                                <Eye className="h-4 w-4" />
                                Voir le commentaire
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="max-w-sm p-4 bg-popover" align="end">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Commentaire</p>
                              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                                {expense.comment?.trim() || "Aucun commentaire"}
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
                                requested_by: expense.requested_by,
                                agency: expense.agency,
                                comment: expense.comment,
                                rejection_reason: expense.rejection_reason
                              }}
                              user={user}
                            />
                          )}
                        </>
                      )}

                      {/* Comptable (déjà traité) ou autres rôles : seulement Voir le commentaire + PDF si approuvée */}
                      {user.role === "accounting" && expense.status !== "pending" && (
                        <div className="flex flex-col gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 gap-1.5 rounded-lg border-2 border-slate-300/80 bg-slate-500/5 font-medium hover:bg-slate-500/10 dark:border-slate-500/60 dark:bg-slate-500/10 dark:hover:bg-slate-500/20"
                              >
                                <Eye className="h-4 w-4" />
                                Voir le commentaire
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="max-w-sm p-4 bg-popover" align="end">
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Commentaire</p>
                              <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                                {expense.comment?.trim() || "Aucun commentaire"}
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
                                requested_by: expense.requested_by,
                                agency: expense.agency,
                                comment: expense.comment,
                                rejection_reason: expense.rejection_reason
                              }}
                              user={user}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section des transactions en attente de suppression - Pour les comptables et directeurs */}
      {(user.role === "accounting" || isDirectorDelegate) && pendingDeleteReceipts.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Transactions en attente de validation de suppression
            </CardTitle>
            <CardDescription>
              {pendingDeleteReceipts.length} transaction{pendingDeleteReceipts.length > 1 ? 's' : ''} en attente de validation pour suppression
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDeleteReceipts.map((receipt) => (
                <div key={receipt.id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          {receipt.type === "transfer" ? "Transfert d'argent" :
                           receipt.type === "exchange" ? "Échange de devise" :
                           receipt.type === "card" ? "Gestion des cartes" :
                           receipt.type === "receipt" ? (receipt.details?.operation_type === "transfer" ? "Reçu - Transfert" : 
                                                      receipt.details?.operation_type === "exchange" ? "Reçu - Échange" :
                                                      receipt.details?.operation_type === "card_recharge" ? "Reçu - Recharge" : 
                                                      "Reçu d'opération") :
                           receipt.type === "reception" ? "Réception/Envoi" :
                           receipt.type}
                        </Badge>
                        <Badge className="bg-orange-100 text-orange-800">
                          Suppression demandée
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-600">ID:</span>
                          <p className="text-gray-900">{receipt.id}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Créé par:</span>
                          <p className="text-gray-900">{receipt.created_by}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Description:</span>
                          <p className="text-gray-900">{receipt.description}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Montant:</span>
                          <p className="text-gray-900 font-semibold">
                            {formatAmount(Number(receipt.amount))} {receipt.currency}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Date:</span>
                          <p className="text-gray-900">{new Date(receipt.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Agence:</span>
                          <p className="text-gray-900">{receipt.agency}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Date:</span>
                          <p className="text-gray-900">
                            {new Date(receipt.created_at).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      
                      {receipt.details?.beneficiary_name && (
                        <div className="mt-3 p-3 bg-white rounded-md border">
                          <p className="text-sm">
                            <span className="font-medium text-gray-600">Bénéficiaire:</span> {receipt.details.beneficiary_name}
                            {receipt.details.beneficiary_country && ` (${receipt.details.beneficiary_country})`}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-600 hover:bg-red-50"
                        onClick={() => handleValidateDelete(receipt)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Valider et supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section: Toutes les dépenses avec leurs états */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-600" />
            Toutes les Dépenses
          </CardTitle>
          <CardDescription>
            Vue d'ensemble de toutes les dépenses avec leurs états actuels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Statistiques globales */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {stats.pendingExpenses + stats.approvedExpenses + stats.rejectedExpenses}
                </div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.pendingExpenses}
                </div>
                <div className="text-sm text-gray-500">En attente</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {stats.approvedExpenses}
                </div>
                <div className="text-sm text-gray-500">Approuvées</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {stats.rejectedExpenses}
                </div>
                <div className="text-sm text-gray-500">Rejetées</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">
                  {formatAmount(stats.totalApprovedAmount)}
                </div>
                <div className="text-sm text-gray-500">Montant total</div>
              </div>
            </div>

            {/* Lien vers la page complète des dépenses */}
            <div className="text-center">
              <Button variant="outline" asChild>
                <a href="/expenses">
                  <Eye className="h-4 w-4 mr-2" />
                  Voir toutes les dépenses en détail
                </a>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialogue pour modifier une dépense */}
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
                <Input id="edit-amount" type="number" min={0} className="mt-1" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-category">Catégorie</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-agency">Agence</Label>
              <Input id="edit-agency" className="mt-1" value={editAgency} onChange={(e) => setEditAgency(e.target.value)} placeholder="Agence" />
            </div>
            <div>
              <Label htmlFor="edit-comment">Commentaire</Label>
              <Textarea id="edit-comment" className="mt-1" value={editComment} onChange={(e) => setEditComment(e.target.value)} placeholder="Optionnel" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setExpenseToEdit(null) }}>Annuler</Button>
            <Button onClick={submitEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setExpenseToDelete(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la dépense &quot;{expenseToDelete?.description}&quot; ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setDeleteDialogOpen(false); setExpenseToDelete(null) }}>Annuler</Button>
            <Button variant="destructive" onClick={confirmDeleteExpense}>
              <Trash2 className="h-4 w-4 mr-1" />
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue pour rejeter une dépense avec motif */}
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
