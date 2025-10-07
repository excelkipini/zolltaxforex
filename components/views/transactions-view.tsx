"use client"

import * as React from "react"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, Filter, Eye, Download, FileDown, CheckCircle, Check, X, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Printer, Trash2, Clock, Play, FileUp, Upload } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Types pour les transactions
type Transaction = {
  id: string
  type: "reception" | "exchange" | "card" | "transfer" | "receipt"
  description: string
  amount: number
  currency: string
  status: "completed" | "pending" | "validated" | "rejected" | "cancelled"
  created_by: string
  agency: string
  created_at: string
  details?: any
  rejection_reason?: string // Motif de rejet
}

// Données de démonstration (fallback) - SUPPRIMÉES
const mockTransactions: Transaction[] = []

interface TransactionsViewProps {
  user?: { role: string }
}

// Fonctions utilitaires supprimées - utilisation de l'API uniquement

export function TransactionsView({ user }: TransactionsViewProps = {}) {
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [filteredTransactions, setFilteredTransactions] = React.useState<Transaction[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [periodFilter, setPeriodFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [typeFilter, setTypeFilter] = React.useState<string>("all")
  const [cashierFilter, setCashierFilter] = React.useState<string>("all")
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [transactionToReject, setTransactionToReject] = React.useState<string | null>(null)
  const [sortField, setSortField] = React.useState<string | null>("created_at")
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = React.useState(1)
  const [itemsPerPage, setItemsPerPage] = React.useState(10)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [transactionToDelete, setTransactionToDelete] = React.useState<string | null>(null)
  const [validateDeleteDialogOpen, setValidateDeleteDialogOpen] = React.useState(false)
  const [transactionToValidateDelete, setTransactionToValidateDelete] = React.useState<string | null>(null)
  const [validateDialogOpen, setValidateDialogOpen] = React.useState(false)
  const [transactionToValidate, setTransactionToValidate] = React.useState<string | null>(null)
  const [realAmountEUR, setRealAmountEUR] = React.useState("")
  const [executeDialogOpen, setExecuteDialogOpen] = React.useState(false)
  const [transactionToExecute, setTransactionToExecute] = React.useState<string | null>(null)
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null)
  const [executorComment, setExecutorComment] = React.useState("")
  const { toast } = useToast()

  // Fonction helper pour recharger et filtrer les transactions
  const reloadAndFilterTransactions = async () => {
    try {
      const res = await fetch("/api/transactions")
      const data = await res.json()
      if (res.ok && data?.ok && Array.isArray(data.data)) {
        const apiTransactions = data.data.map((item: any) => ({
          ...item,
          amount: Number(item.amount),
          details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details
        }))
        setTransactions(apiTransactions)
        // Les filtres seront réappliqués automatiquement par le useEffect
      }
    } catch (error) {
      console.error("Erreur lors du rechargement:", error)
    }
  }

  // Charger toutes les transactions depuis l'API uniquement
  React.useEffect(() => {
    const loadTransactionsFromAPI = async () => {
      try {
        const res = await fetch("/api/transactions")
        const data = await res.json()
        if (res.ok && data?.ok && Array.isArray(data.data)) {
          const apiTransactions = data.data.map((item: any) => ({
            ...item,
            amount: Number(item.amount), // Convertir en nombre
            details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details
          }))
          setTransactions(apiTransactions)
          setFilteredTransactions(apiTransactions)
        } else {
          setTransactions([])
          setFilteredTransactions([])
        }
      } catch (error) {
        console.error("Erreur lors du chargement:", error)
        setTransactions([])
        setFilteredTransactions([])
      }
    }

    loadTransactionsFromAPI()

    // Écouter les événements personnalisés pour recharger depuis l'API
    const handleTransferCreated = () => loadTransactionsFromAPI()
    const handleReceptionCreated = () => loadTransactionsFromAPI()
    const handleExchangeCreated = () => loadTransactionsFromAPI()
    const handleTransactionStatusChanged = () => loadTransactionsFromAPI()

    window.addEventListener('transferCreated', handleTransferCreated as EventListener)
    window.addEventListener('receptionCreated', handleReceptionCreated as EventListener)
    window.addEventListener('exchangeCreated', handleExchangeCreated as EventListener)
    window.addEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    
    // Nettoyer les écouteurs
    return () => {
      window.removeEventListener('transferCreated', handleTransferCreated as EventListener)
      window.removeEventListener('receptionCreated', handleReceptionCreated as EventListener)
      window.removeEventListener('exchangeCreated', handleExchangeCreated as EventListener)
      window.removeEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    }
  }, [])

  // Filtrage et tri des transactions
  React.useEffect(() => {
    let filtered = transactions

    // Filtre par utilisateur pour les caissiers
    if (user?.role === "cashier") {
      filtered = filtered.filter(t => t.created_by === user.name)
    }

    // Filtre par terme de recherche
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.created_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtre par statut
    if (statusFilter !== "all") {
      filtered = filtered.filter(t => t.status === statusFilter)
    }

    // Filtre par type
    if (typeFilter !== "all") {
      filtered = filtered.filter(t => t.type === typeFilter)
    }

    // Filtre par caissier
    if (cashierFilter !== "all") {
      filtered = filtered.filter(t => t.created_by === cashierFilter)
    }

    // Filtre par période
    if (periodFilter !== "all") {
      const now = new Date()
      const transactionDate = new Date()
      
      filtered = filtered.filter(t => {
        transactionDate.setTime(new Date(t.created_at).getTime())
        
        switch (periodFilter) {
          case "today":
            return transactionDate.toDateString() === now.toDateString()
          case "week":
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            return transactionDate >= weekAgo
          case "month":
            const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
            return transactionDate >= monthAgo
          case "year":
            const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
            return transactionDate >= yearAgo
          case "last_year":
            const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
            const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
            return transactionDate >= lastYearStart && transactionDate <= lastYearEnd
          default:
            return true
        }
      })
    }

    // Tri des transactions
    if (sortField) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortField) {
          case "id":
            aValue = a.id
            bValue = b.id
            break
          case "type":
            aValue = a.type
            bValue = b.type
            break
          case "description":
            aValue = a.description
            bValue = b.description
            break
          case "amount":
            aValue = a.amount
            bValue = b.amount
            break
          case "created_by":
            aValue = a.created_by
            bValue = b.created_by
            break
          case "status":
            aValue = a.status
            bValue = b.status
            break
          case "created_at":
            aValue = new Date(a.created_at).getTime()
            bValue = new Date(b.created_at).getTime()
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    }

    setFilteredTransactions(filtered)
    
    // Réinitialiser la page courante si elle dépasse le nombre total de pages
    const totalPages = Math.ceil(filtered.length / itemsPerPage)
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1)
    }
  }, [transactions, searchTerm, periodFilter, statusFilter, typeFilter, cashierFilter, sortField, sortDirection, itemsPerPage, currentPage])

  // Obtenir la liste des caissiers uniques
  const uniqueCashiers = React.useMemo(() => {
    const cashiers = [...new Set(transactions.map(t => t.created_by))].sort()
    return cashiers
  }, [transactions])

  // Calculer les transactions paginées
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex)

  // Réinitialiser la page quand le nombre d'éléments par page change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [itemsPerPage])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Terminé</Badge>
      case "executed":
        return <Badge className="bg-purple-100 text-purple-800">Exécuté</Badge>
      case "validated":
        return <Badge className="bg-blue-100 text-blue-800">Validé</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejeté</Badge>
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800">Annulé</Badge>
      case "pending_delete":
        return <Badge className="bg-orange-100 text-orange-800">Suppression</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "reception":
        return "Réception/Envoi"
      case "exchange":
        return "Bureau de change"
      case "card":
        return "Gestion cartes"
      case "transfer":
        return "Transfert d'argent"
      case "receipt":
        return "Reçu d'opération"
      default:
        return type
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toLocaleString("fr-FR")} ${currency}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR")
  }

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value))
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortDirection === "asc" ? 
      <ArrowUp className="h-4 w-4 text-blue-600" /> : 
      <ArrowDown className="h-4 w-4 text-blue-600" />
  }

  const handleExportTransactions = () => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "Aucune donnée à exporter",
        description: "Aucune transaction ne correspond aux filtres appliqués.",
        variant: "destructive"
      })
      return
    }

    try {
      // Créer les en-têtes CSV
      const headers = [
        "ID",
        "Type",
        "Description", 
        "Montant",
        "Devise",
        "Caissier",
        "Statut",
        "Agence",
        "Date de création"
      ]

      // Créer les lignes de données
      const csvRows = [
        headers.join(","),
        ...filteredTransactions.map(transaction => [
          transaction.id,
          `"${getTypeLabel(transaction.type)}"`,
          `"${transaction.description.replace(/"/g, '""')}"`,
          transaction.amount,
          transaction.currency,
          `"${transaction.created_by}"`,
          `"${transaction.status}"`,
          `"${transaction.agency}"`,
          `"${formatDate(transaction.created_at)}"`
        ].join(","))
      ]

      // Créer le contenu CSV
      const csvContent = csvRows.join("\n")

      // Créer le nom de fichier avec la date et les filtres
      const now = new Date()
      const dateStr = now.toISOString().split('T')[0]
      let filename = `operations_${dateStr}`
      
      // Ajouter des suffixes selon les filtres
      if (periodFilter !== "all") {
        filename += `_${periodFilter}`
      }
      if (statusFilter !== "all") {
        filename += `_${statusFilter}`
      }
      if (typeFilter !== "all") {
        filename += `_${typeFilter}`
      }
      if (cashierFilter !== "all") {
        filename += `_${cashierFilter}`
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
        description: `${filteredTransactions.length} opérations exportées vers ${filename}`,
      })
    } catch (error) {
      toast({
        title: "Erreur d'export",
        description: "Une erreur est survenue lors de l'exportation des données.",
        variant: "destructive"
      })
    }
  }

  const handleValidateTransaction = (transactionId: string) => {
    setTransactionToValidate(transactionId)
    setRealAmountEUR("")
    setValidateDialogOpen(true)
  }

  const confirmValidateTransaction = async () => {
    if (!transactionToValidate || !realAmountEUR) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir le montant réel en EUR",
        variant: "destructive"
      })
      return
    }

    const realAmount = parseFloat(realAmountEUR)
    if (isNaN(realAmount) || realAmount <= 0) {
      toast({
        title: "Erreur",
        description: "Le montant réel doit être un nombre positif",
        variant: "destructive"
      })
      return
    }

    try {
      const response = await fetch('/api/transactions/update-real-amount', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: transactionToValidate,
          realAmountEUR: realAmount,
          validatedBy: user.name
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de la validation')
      }

      // Mettre à jour l'état local
      const updatedTransaction = {
        ...result.transaction,
        details: typeof result.transaction.details === 'string' ? JSON.parse(result.transaction.details) : result.transaction.details
      }
      
      setTransactions(prev => prev.map(t => t.id === transactionToValidate ? updatedTransaction : t))
      setFilteredTransactions(prev => prev.map(t => t.id === transactionToValidate ? updatedTransaction : t))
      
      toast({
        title: result.message.includes('validée') ? "Transaction validée" : "Transaction rejetée",
        description: result.message,
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionId: transactionToValidate, status: result.transaction.status } 
      }))
      
      setValidateDialogOpen(false)
      setTransactionToValidate(null)
      setRealAmountEUR("")
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la validation: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handleExecuteTransaction = (transactionId: string) => {
    setTransactionToExecute(transactionId)
    setReceiptFile(null)
    setExecutorComment("")
    setExecuteDialogOpen(true)
  }

  const confirmExecuteTransaction = async () => {
    if (!transactionToExecute || !receiptFile) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier de reçu",
        variant: "destructive"
      })
      return
    }

    try {
      // Créer un FormData pour l'upload du fichier
      const formData = new FormData()
      formData.append('transactionId', transactionToExecute)
      formData.append('executorId', user?.id || '')
      formData.append('receiptFile', receiptFile)
      if (executorComment.trim()) {
        formData.append('executorComment', executorComment.trim())
      }
      
      const response = await fetch('/api/transactions/execute', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erreur lors de l\'exécution')
      }

      // Mettre à jour l'état local
      setTransactions(prev => prev.map(t =>
        t.id === transactionToExecute
          ? { ...t, status: "executed" as const }
          : t
      ))
      setFilteredTransactions(prev => prev.map(t =>
        t.id === transactionToExecute
          ? { ...t, status: "executed" as const }
          : t
      ))

      toast({
        title: "Transaction exécutée",
        description: "La transaction a été marquée comme exécutée avec succès",
      })

      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', {
        detail: { transactionId: transactionToExecute, status: "executed" }
      }))

      // Fermer le dialog et réinitialiser
      setExecuteDialogOpen(false)
      setTransactionToExecute(null)
      setReceiptFile(null)
      setExecutorComment("")

    } catch (error) {
      toast({
        title: "Erreur",
        description: `Erreur lors de l'exécution: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handleCompleteTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: transactionId,
          status: 'completed'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la clôture')
      }

      const result = await response.json()
      const updatedTransaction = result.data
      
      // Mettre à jour l'état local
      const updatedTransactions = transactions.map(t => 
        t.id === transactionId 
          ? { ...t, status: "completed" as const }
          : t
      )
      
      setTransactions(updatedTransactions)
      
      toast({
        title: "Transaction terminée",
        description: `La transaction ${transactionId} a été clôturée`,
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionId, status: 'completed' } 
      }))
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la clôture: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handleRejectTransaction = (transactionId: string) => {
    setTransactionToReject(transactionId)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const confirmRejectTransaction = async () => {
    if (!transactionToReject || !rejectionReason.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un motif de rejet",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          id: transactionToReject, 
          status: "rejected",
          rejection_reason: rejectionReason.trim()
        })
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        const updatedTransaction = {
          ...data.data,
          details: typeof data.data.details === 'string' ? JSON.parse(data.data.details) : data.data.details
        }
        
        setTransactions(prev => prev.map(t => t.id === transactionToReject ? updatedTransaction : t))
        setFilteredTransactions(prev => prev.map(t => t.id === transactionToReject ? updatedTransaction : t))
        
        toast({
          title: "Transaction rejetée",
          description: `La transaction ${transactionToReject} a été rejetée avec le motif: ${rejectionReason}`,
        })
        
        // Déclencher un événement personnalisé pour notifier les autres composants
        window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
          detail: { transactionId: transactionToReject, status: 'rejected' } 
        }))
        
        setRejectDialogOpen(false)
        setTransactionToReject(null)
        setRejectionReason("")
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors du rejet",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur réseau",
        description: "Impossible de rejeter la transaction",
        variant: "destructive"
      })
    }
  }

  const handleDownloadIBAN = (transaction: Transaction) => {
    
    const ibanFileData = transaction.details.iban_file_data
    
    if (!ibanFileData) {
      toast({
        title: "Erreur",
        description: "Aucun fichier IBAN disponible pour cette transaction",
        variant: "destructive"
      })
      return
    }

    toast({
      title: "Téléchargement en cours",
      description: `Téléchargement du fichier ${ibanFileData.name}...`,
    })
    
    try {
      // Convertir le base64 en fichier binaire
      const binaryString = atob(ibanFileData.data)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      
      // Créer le blob avec le type MIME correct
      const blob = new Blob([bytes], { type: ibanFileData.type })
      
      // Créer le lien de téléchargement
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = ibanFileData.name
      link.style.display = 'none'
      document.body.appendChild(link)
      
      link.click()
      
      // Nettoyer après un court délai
      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }, 100)
      
      toast({
        title: "Téléchargement terminé",
        description: `Le fichier ${ibanFileData.name} a été téléchargé`,
      })
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Une erreur est survenue lors du téléchargement du fichier: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handlePrintReceipt = (transaction: Transaction) => {
    if (transaction.type !== "receipt") {
      toast({
        title: "Erreur",
        description: "Cette fonctionnalité n'est disponible que pour les reçus d'opération",
        variant: "destructive"
      })
      return
    }

    try {
      // Créer les données du reçu à partir des détails de la transaction
      const details = transaction.details
      const qrData = JSON.stringify({
        id: transaction.id,
        type: "receipt",
        date: transaction.created_at,
        amount: transaction.amount,
        currency: transaction.currency,
        client: details.client_name,
        phone: details.client_phone,
        operation: details.operation_type,
        agent: transaction.created_by
      })

      // Générer le HTML du reçu
      const receiptHTML = `
        <!DOCTYPE html>
        <html lang="fr">
          <head>
            <meta charset="utf-8" />
            <title>Reçu de Transaction - ${transaction.id}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body { 
                font-family: 'Courier New', monospace;
                margin: 0;
                padding: 20px;
                background: white;
                color: #000;
                line-height: 1.4;
              }
              
              .receipt { 
                max-width: 400px; 
                margin: 0 auto; 
                border: 2px solid #000; 
                padding: 20px;
                background: white;
              }
              
              .header { 
                text-align: center; 
                margin-bottom: 20px;
                border-bottom: 1px dashed #000;
                padding-bottom: 15px;
              }
              
              .logo { 
                font-size: 18px; 
                font-weight: bold; 
                margin-bottom: 8px;
                text-transform: uppercase;
              }
              
              .receipt-title {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 5px;
              }
              
              .receipt-number {
                font-size: 14px;
                font-weight: bold;
                background: #f0f0f0;
                padding: 5px;
                border: 1px solid #000;
              }
              
              .row { 
                display: flex; 
                justify-content: space-between; 
                margin: 8px 0;
                padding: 2px 0;
              }
              
              .row.total {
                border-top: 1px solid #000;
                border-bottom: 1px solid #000;
                font-weight: bold;
                margin-top: 10px;
                padding: 8px 0;
              }
              
              .qrcode-section { 
                text-align: center; 
                margin: 20px 0;
                border-top: 1px dashed #000;
                padding-top: 15px;
              }
              
              .qrcode-container {
                display: inline-block;
                border: 1px solid #000;
                padding: 10px;
                background: white;
              }
              
              .footer { 
                text-align: center; 
                font-size: 11px; 
                color: #666; 
                margin-top: 20px;
                border-top: 1px dashed #000;
                padding-top: 15px;
              }
              
              .timestamp {
                font-size: 10px;
                color: #888;
                margin-top: 10px;
              }
              
              @media print {
                body {
                  margin: 0;
                  padding: 10px;
                }
                
                .receipt {
                  border: 2px solid #000;
                  box-shadow: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="receipt">
              <div class="header">
                <div class="logo">ZOLL TAX FOREX</div>
                <div class="receipt-title">Reçu de Transaction</div>
                <div class="receipt-number">${transaction.id}</div>
              </div>
              
              <div class="transaction-details">
                <div class="row">
                  <span>Date:</span>
                  <span>${new Date(transaction.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
                <div class="row">
                  <span>Agent:</span>
                  <span>${transaction.created_by}</span>
                </div>
                <div class="row">
                  <span>Client:</span>
                  <span>${details.client_name || "-"}</span>
                </div>
                <div class="row">
                  <span>Téléphone:</span>
                  <span>${details.client_phone || "-"}</span>
                </div>
                <div class="row">
                  <span>Opération:</span>
                  <span>${details.operation_type === "transfer" ? "Transfert d'argent" : 
                           details.operation_type === "exchange" ? "Échange de devise" :
                           details.operation_type === "card_recharge" ? "Recharge de carte" : 
                           details.operation_type}</span>
                </div>
                ${details.operation_type === "transfer" ? `
                  <div class="row">
                    <span>Bénéficiaire:</span>
                    <span>${details.beneficiary_name || "-"}</span>
                  </div>
                  <div class="row">
                    <span>Pays:</span>
                    <span>${details.beneficiary_country || "-"}</span>
                  </div>
                ` : details.operation_type === "exchange" ? `
                  <div class="row">
                    <span>Montant échangé:</span>
                    <span>${(details.from_amount || 0).toLocaleString("fr-FR")} ${details.from_currency || "XAF"}</span>
                  </div>
                  <div class="row">
                    <span>Montant reçu:</span>
                    <span>${(details.to_amount || 0).toLocaleString("fr-FR")} ${details.to_currency || "XAF"}</span>
                  </div>
                ` : details.operation_type === "card_recharge" ? `
                  <div class="row">
                    <span>Numéro de carte:</span>
                    <span>${details.card_number || "-"}</span>
                  </div>
                  <div class="row">
                    <span>Montant:</span>
                    <span>${(details.amount || 0).toLocaleString("fr-FR")} ${details.currency || "XAF"}</span>
                  </div>
                ` : ""}
                <div class="row total">
                  <span>Montant total:</span>
                  <span>${transaction.amount.toLocaleString("fr-FR")} ${transaction.currency}</span>
                </div>
              </div>
              
              <div class="qrcode-section">
                <div class="qrcode-container">
                  <div id="qrcode"></div>
                </div>
                <div style="font-size: 11px; margin-top: 8px; font-style: italic;">
                  Scannez ce QR code pour vérifier<br/>
                  l'authenticité de cette transaction
                </div>
              </div>
              
              <div class="footer">
                <div>Merci pour votre confiance</div>
                <div><strong>ZOLL TAX FOREX</strong></div>
                <div>© 2025 - Tous droits réservés</div>
                <div class="timestamp">
                  Généré le ${new Date().toLocaleString("fr-FR")}
                </div>
              </div>
            </div>
            
            <!-- QR Code Library -->
            <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            <script>
              document.addEventListener('DOMContentLoaded', function() {
                try {
                  if (typeof QRCode !== 'undefined') {
                    new QRCode(document.getElementById("qrcode"), {
                      text: '${qrData}',
                      width: 120,
                      height: 120,
                      colorDark: "#000000",
                      colorLight: "#ffffff",
                      correctLevel: QRCode.CorrectLevel.M
                    });
                  } else {
                    document.getElementById("qrcode").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                  }
                } catch (error) {
                  document.getElementById("qrcode").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                }
              });
            </script>
          </body>
        </html>
      `

      // Ouvrir une nouvelle fenêtre avec le reçu
      const printWindow = window.open('', '_blank', 'width=600,height=800')
      if (printWindow) {
        printWindow.document.write(receiptHTML)
        printWindow.document.close()
        
        // Attendre que le contenu soit chargé puis imprimer
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
          }, 1000)
        }
      } else {
        toast({
          title: "Erreur",
          description: "Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups sont autorisés.",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Une erreur est survenue lors de la génération du reçu: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  // Fonction pour demander la suppression d'une transaction
  const handleDeleteTransaction = (transactionId: string) => {
    setTransactionToDelete(transactionId)
    setDeleteDialogOpen(true)
  }

  // Fonction pour confirmer la suppression
  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return

    try {
      const response = await fetch(`/api/transactions/${transactionToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (response.ok && result.ok) {
        toast({
          title: "Succès",
          description: result.status === "pending_delete" ? "Demande de suppression envoyée" : "Transaction supprimée",
          variant: "default"
        })
        
        // Recharger les transactions
        await reloadAndFilterTransactions()
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Erreur lors de la suppression",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Erreur lors de la suppression:", error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression",
        variant: "destructive"
      })
    } finally {
      setDeleteDialogOpen(false)
      setTransactionToDelete(null)
    }
  }

  // Fonction pour valider la suppression d'une transaction
  const handleValidateDelete = (transactionId: string) => {
    setTransactionToValidateDelete(transactionId)
    setValidateDeleteDialogOpen(true)
  }

  // Fonction pour confirmer la validation de suppression
  const confirmValidateDelete = async () => {
    if (!transactionToValidateDelete) return

    try {
      const response = await fetch(`/api/transactions/${transactionToValidateDelete}/validate-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (response.ok && result.ok) {
        toast({
          title: "Succès",
          description: result.message || "Transaction supprimée avec succès",
          variant: "default"
        })
        
        // Recharger les transactions
        await reloadAndFilterTransactions()
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Erreur lors de la validation",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Erreur lors de la validation:", error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la validation",
        variant: "destructive"
      })
    } finally {
      setValidateDeleteDialogOpen(false)
      setTransactionToValidateDelete(null)
    }
  }

  // Fonction pour générer un reçu pour toutes les transactions
  const handlePrintTransactionReceipt = (transaction: Transaction) => {
    try {
      let qrData = ""
      let receiptHTML = ""

      // Générer les données QR et HTML selon le type de transaction
      switch (transaction.type) {
        case "receipt":
          // Utiliser la fonction existante pour les reçus
          handlePrintReceipt(transaction)
          return
          
        case "transfer":
          receiptHTML = `
            <!DOCTYPE html>
            <html lang="fr">
              <head>
                <meta charset="utf-8" />
                <title>Reçu de Transfert - ${transaction.id}</title>
                <style>
                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }
                  
                  body { 
                    font-family: 'Courier New', monospace;
                    margin: 0;
                    padding: 20px;
                    background: white;
                    color: #000;
                    line-height: 1.4;
                  }
                  
                  .receipt { 
                    max-width: 400px; 
                    margin: 0 auto; 
                    border: 2px solid #000; 
                    padding: 20px;
                    background: white;
                  }
                  
                  .header { 
                    text-align: center; 
                    margin-bottom: 20px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 15px;
                  }
                  
                  .logo { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin-bottom: 8px;
                    text-transform: uppercase;
                  }
                  
                  .receipt-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  
                  .receipt-number {
                    font-size: 14px;
                    font-weight: bold;
                    background: #f0f0f0;
                    padding: 5px;
                    border: 1px solid #000;
                  }
                  
                  .row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 8px 0;
                    padding: 2px 0;
                  }
                  
                  .row.total {
                    border-top: 1px solid #000;
                    border-bottom: 1px solid #000;
                    font-weight: bold;
                    margin-top: 10px;
                    padding: 8px 0;
                  }
                  
                  .qrcode-section { 
                    text-align: center; 
                    margin: 20px 0;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                  }
                  
                  .qrcode-container {
                    display: inline-block;
                    border: 1px solid #000;
                    padding: 10px;
                    background: white;
                  }
                  
                  .footer { 
                    text-align: center; 
                    font-size: 11px; 
                    color: #666; 
                    margin-top: 20px;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                  }
                  
                  .timestamp {
                    font-size: 10px;
                    color: #888;
                    margin-top: 10px;
                  }
                  
                  @media print {
                    body {
                      margin: 0;
                      padding: 10px;
                    }
                    
                    .receipt {
                      border: 2px solid #000;
                      box-shadow: none;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="receipt">
                  <div class="header">
                    <div class="logo">ZOLL TAX FOREX</div>
                    <div class="receipt-title">Reçu de Transfert d'Argent</div>
                    <div class="receipt-number">${transaction.id}</div>
                  </div>
                  
                  <div class="transaction-details">
                    <div class="row">
                      <span>Date:</span>
                      <span>${new Date(transaction.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div class="row">
                      <span>Agent:</span>
                      <span>${transaction.created_by}</span>
                    </div>
                    <div class="row">
                      <span>Bénéficiaire:</span>
                      <span>${transaction.details?.beneficiary_name || "N/A"}</span>
                    </div>
                    <div class="row">
                      <span>Destination:</span>
                      <span>${transaction.details?.destination_city || ""}, ${transaction.details?.destination_country || ""}</span>
                    </div>
                    <div class="row">
                      <span>Moyen:</span>
                      <span>${transaction.details?.transfer_method || "N/A"}</span>
                    </div>
                    <div class="row">
                      <span>Mode de retrait:</span>
                      <span>${transaction.details?.withdrawal_mode === "cash" ? "Espèces" : transaction.details?.withdrawal_mode === "bank_transfer" ? "Virement bancaire" : transaction.details?.withdrawalMode === "cash" ? "Espèces" : transaction.details?.withdrawalMode === "bank_transfer" ? "Virement bancaire" : "N/A"}</span>
                    </div>
                    <div class="row total">
                      <span>Montant:</span>
                      <span>${transaction.amount.toLocaleString("fr-FR")} ${transaction.currency}</span>
                    </div>
                  </div>
                  
                  <div class="qrcode-section">
                    <div class="qrcode-container">
                      <div id="qrcode-transfer"></div>
                    </div>
                    <div style="font-size: 11px; margin-top: 8px; font-style: italic;">
                      Scannez ce QR code pour vérifier<br/>
                      l'authenticité de cette transaction
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div>Merci pour votre confiance</div>
                    <div><strong>ZOLL TAX FOREX</strong></div>
                    <div>© 2025 - Tous droits réservés</div>
                    <div class="timestamp">
                      Généré le ${new Date().toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                
                <!-- QR Code Library -->
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <script>
                  document.addEventListener('DOMContentLoaded', function() {
                    try {
                      if (typeof QRCode !== 'undefined') {
                        const qrData = {
                          id: "${transaction.id}",
                          type: "transfer",
                          date: "${transaction.created_at}",
                          amount: ${transaction.amount},
                          currency: "${transaction.currency}",
                          beneficiary: "${transaction.details?.beneficiary_name || "N/A"}",
                          destination: "${transaction.details?.destination_city || ""}, ${transaction.details?.destination_country || ""}",
                          method: "${transaction.details?.transfer_method || "N/A"}",
                          withdrawal_mode: "${transaction.details?.withdrawal_mode || transaction.details?.withdrawalMode || "N/A"}",
                          agent: "${transaction.created_by}"
                        };
                        new QRCode(document.getElementById("qrcode-transfer"), {
                          text: JSON.stringify(qrData),
                          width: 120,
                          height: 120,
                          colorDark: "#000000",
                          colorLight: "#ffffff",
                          correctLevel: QRCode.CorrectLevel.M
                        });
                      } else {
                        document.getElementById("qrcode-transfer").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                      }
                    } catch (error) {
                      document.getElementById("qrcode-transfer").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                    }
                  });
                </script>
              </body>
            </html>
          `
          break
          
        case "exchange":
          receiptHTML = `
            <!DOCTYPE html>
            <html lang="fr">
              <head>
                <meta charset="utf-8" />
                <title>Reçu d'Échange - ${transaction.id}</title>
                <style>
                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }
                  
                  body { 
                    font-family: 'Courier New', monospace;
                    margin: 0;
                    padding: 20px;
                    background: white;
                    color: #000;
                    line-height: 1.4;
                  }
                  
                  .receipt { 
                    max-width: 400px; 
                    margin: 0 auto; 
                    border: 2px solid #000; 
                    padding: 20px;
                    background: white;
                  }
                  
                  .header { 
                    text-align: center; 
                    margin-bottom: 20px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 15px;
                  }
                  
                  .logo { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin-bottom: 8px;
                    text-transform: uppercase;
                  }
                  
                  .receipt-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  
                  .receipt-number {
                    font-size: 14px;
                    font-weight: bold;
                    background: #f0f0f0;
                    padding: 5px;
                    border: 1px solid #000;
                  }
                  
                  .row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 8px 0;
                    padding: 2px 0;
                  }
                  
                  .row.total {
                    border-top: 1px solid #000;
                    border-bottom: 1px solid #000;
                    font-weight: bold;
                    margin-top: 10px;
                    padding: 8px 0;
                  }
                  
                  .qrcode-section { 
                    text-align: center; 
                    margin: 20px 0;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                  }
                  
                  .qrcode-container {
                    display: inline-block;
                    border: 1px solid #000;
                    padding: 10px;
                    background: white;
                  }
                  
                  .footer { 
                    text-align: center; 
                    font-size: 11px; 
                    color: #666; 
                    margin-top: 20px;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                  }
                  
                  .timestamp {
                    font-size: 10px;
                    color: #888;
                    margin-top: 10px;
                  }
                  
                  @media print {
                    body {
                      margin: 0;
                      padding: 10px;
                    }
                    
                    .receipt {
                      border: 2px solid #000;
                      box-shadow: none;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="receipt">
                  <div class="header">
                    <div class="logo">ZOLL TAX FOREX</div>
                    <div class="receipt-title">Reçu d'Échange de Devise</div>
                    <div class="receipt-number">${transaction.id}</div>
                  </div>
                  
                  <div class="transaction-details">
                    <div class="row">
                      <span>Date:</span>
                      <span>${new Date(transaction.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div class="row">
                      <span>Agent:</span>
                      <span>${transaction.created_by}</span>
                    </div>
                    <div class="row">
                      <span>Client:</span>
                      <span>${transaction.details?.client_name || "N/A"}</span>
                    </div>
                    <div class="row">
                      <span>Opération:</span>
                      <span>${transaction.details?.exchange_type === "buy" ? "Achat devise" : "Vente devise"}</span>
                    </div>
                    <div class="row">
                      <span>Devise:</span>
                      <span>${transaction.details?.from_currency || transaction.currency}</span>
                    </div>
                    <div class="row">
                      <span>Taux:</span>
                      <span>1 ${transaction.details?.from_currency || transaction.currency} = ${transaction.details?.exchange_rate || "N/A"} XAF</span>
                    </div>
                    <div class="row total">
                      <span>Montant:</span>
                      <span>${transaction.amount.toLocaleString("fr-FR")} ${transaction.currency}</span>
                    </div>
                  </div>
                  
                  <div class="qrcode-section">
                    <div class="qrcode-container">
                      <div id="qrcode-exchange"></div>
                    </div>
                    <div style="font-size: 11px; margin-top: 8px; font-style: italic;">
                      Scannez ce QR code pour vérifier<br/>
                      l'authenticité de cette transaction
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div>Merci pour votre confiance</div>
                    <div><strong>ZOLL TAX FOREX</strong></div>
                    <div>© 2025 - Tous droits réservés</div>
                    <div class="timestamp">
                      Généré le ${new Date().toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                
                <!-- QR Code Library -->
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <script>
                  document.addEventListener('DOMContentLoaded', function() {
                    try {
                      if (typeof QRCode !== 'undefined') {
                        const qrData = {
                          id: "${transaction.id}",
                          type: "exchange",
                          date: "${transaction.created_at}",
                          amount: ${transaction.amount},
                          currency: "${transaction.currency}",
                          client: "${transaction.details?.client_name || "N/A"}",
                          operation: "${transaction.details?.exchange_type || "N/A"}",
                          rate: "${transaction.details?.exchange_rate || "N/A"}",
                          agent: "${transaction.created_by}"
                        };
                        new QRCode(document.getElementById("qrcode-exchange"), {
                          text: JSON.stringify(qrData),
                          width: 120,
                          height: 120,
                          colorDark: "#000000",
                          colorLight: "#ffffff",
                          correctLevel: QRCode.CorrectLevel.M
                        });
                      } else {
                        document.getElementById("qrcode-exchange").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                      }
                    } catch (error) {
                      document.getElementById("qrcode-exchange").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                    }
                  });
                </script>
              </body>
            </html>
          `
          break
          
        default:
          // Pour les autres types de transactions
          qrData = JSON.stringify({
            id: transaction.id,
            type: transaction.type,
            date: transaction.created_at,
            amount: transaction.amount,
            currency: transaction.currency,
            agent: transaction.created_by
          })
          
          receiptHTML = `
            <!DOCTYPE html>
            <html lang="fr">
              <head>
                <meta charset="utf-8" />
                <title>Reçu de Transaction - ${transaction.id}</title>
                <style>
                  * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                  }
                  
                  body { 
                    font-family: 'Courier New', monospace;
                    margin: 0;
                    padding: 20px;
                    background: white;
                    color: #000;
                    line-height: 1.4;
                  }
                  
                  .receipt { 
                    max-width: 400px; 
                    margin: 0 auto; 
                    border: 2px solid #000; 
                    padding: 20px;
                    background: white;
                  }
                  
                  .header { 
                    text-align: center; 
                    margin-bottom: 20px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 15px;
                  }
                  
                  .logo { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin-bottom: 8px;
                    text-transform: uppercase;
                  }
                  
                  .receipt-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 5px;
                  }
                  
                  .receipt-number {
                    font-size: 14px;
                    font-weight: bold;
                    background: #f0f0f0;
                    padding: 5px;
                    border: 1px solid #000;
                  }
                  
                  .row { 
                    display: flex; 
                    justify-content: space-between; 
                    margin: 8px 0;
                    padding: 2px 0;
                  }
                  
                  .row.total {
                    border-top: 1px solid #000;
                    border-bottom: 1px solid #000;
                    font-weight: bold;
                    margin-top: 10px;
                    padding: 8px 0;
                  }
                  
                  .qrcode-section { 
                    text-align: center; 
                    margin: 20px 0;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                  }
                  
                  .qrcode-container {
                    display: inline-block;
                    border: 1px solid #000;
                    padding: 10px;
                    background: white;
                  }
                  
                  .footer { 
                    text-align: center; 
                    font-size: 11px; 
                    color: #666; 
                    margin-top: 20px;
                    border-top: 1px dashed #000;
                    padding-top: 15px;
                  }
                  
                  .timestamp {
                    font-size: 10px;
                    color: #888;
                    margin-top: 10px;
                  }
                  
                  @media print {
                    body {
                      margin: 0;
                      padding: 10px;
                    }
                    
                    .receipt {
                      border: 2px solid #000;
                      box-shadow: none;
                    }
                  }
                </style>
              </head>
              <body>
                <div class="receipt">
                  <div class="header">
                    <div class="logo">ZOLL TAX FOREX</div>
                    <div class="receipt-title">Reçu de Transaction</div>
                    <div class="receipt-number">${transaction.id}</div>
                  </div>
                  
                  <div class="transaction-details">
                    <div class="row">
                      <span>Date:</span>
                      <span>${new Date(transaction.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div class="row">
                      <span>Agent:</span>
                      <span>${transaction.created_by}</span>
                    </div>
                    <div class="row">
                      <span>Type:</span>
                      <span>${transaction.type}</span>
                    </div>
                    <div class="row">
                      <span>Description:</span>
                      <span>${transaction.description}</span>
                    </div>
                    <div class="row">
                      <span>Statut:</span>
                      <span>${transaction.status}</span>
                    </div>
                    <div class="row total">
                      <span>Montant:</span>
                      <span>${transaction.amount.toLocaleString("fr-FR")} ${transaction.currency}</span>
                    </div>
                  </div>
                  
                  <div class="qrcode-section">
                    <div class="qrcode-container">
                      <div id="qrcode-default"></div>
                    </div>
                    <div style="font-size: 11px; margin-top: 8px; font-style: italic;">
                      Scannez ce QR code pour vérifier<br/>
                      l'authenticité de cette transaction
                    </div>
                  </div>
                  
                  <div class="footer">
                    <div>Merci pour votre confiance</div>
                    <div><strong>ZOLL TAX FOREX</strong></div>
                    <div>© 2025 - Tous droits réservés</div>
                    <div class="timestamp">
                      Généré le ${new Date().toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                
                <!-- QR Code Library -->
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <script>
                  document.addEventListener('DOMContentLoaded', function() {
                    try {
                      if (typeof QRCode !== 'undefined') {
                        const qrData = {
                          id: "${transaction.id}",
                          type: "transaction",
                          date: "${transaction.created_at}",
                          amount: ${transaction.amount},
                          currency: "${transaction.currency}",
                          agent: "${transaction.created_by}"
                        };
                        new QRCode(document.getElementById("qrcode-default"), {
                          text: JSON.stringify(qrData),
                          width: 120,
                          height: 120,
                          colorDark: "#000000",
                          colorLight: "#ffffff",
                          correctLevel: QRCode.CorrectLevel.M
                        });
                      } else {
                        document.getElementById("qrcode-default").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                      }
                    } catch (error) {
                      document.getElementById("qrcode-default").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                    }
                  });
                </script>
              </body>
            </html>
          `
          break
      }

      // Ouvrir une nouvelle fenêtre avec le reçu
      const printWindow = window.open('', '_blank', 'width=600,height=800')
      if (printWindow) {
        printWindow.document.write(receiptHTML)
        printWindow.document.close()
        
        // Attendre que le contenu soit chargé avant d'imprimer
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
            printWindow.close()
          }, 500)
        }
      }
    } catch (error) {
      console.error("Erreur lors de la génération du reçu:", error)
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la génération du reçu",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Opérations des Caissiers</h2>
          <p className="text-gray-600 mt-1">Suivi et consultation des opérations effectuées par les caissiers</p>
        </div>
        <Button onClick={handleExportTransactions} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exporter
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Rechercher par description, caissier ou ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="year">Cette année</SelectItem>
                <SelectItem value="last_year">L'année dernière</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="completed">Terminé</SelectItem>
                <SelectItem value="validated">Validé</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
                <SelectItem value="cancelled">Annulé</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="reception">Réception/Envoi</SelectItem>
                <SelectItem value="exchange">Bureau de change</SelectItem>
                <SelectItem value="card">Gestion cartes</SelectItem>
                <SelectItem value="transfer">Transfert d'argent</SelectItem>
              </SelectContent>
            </Select>
            <Select value={cashierFilter} onValueChange={setCashierFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Caissier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les caissiers</SelectItem>
                {uniqueCashiers.map(cashier => (
                  <SelectItem key={cashier} value={cashier}>
                    {cashier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{filteredTransactions.length}</div>
            <div className="text-sm text-gray-600">Opérations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {filteredTransactions.filter(t => t.status === "completed").length}
            </div>
            <div className="text-sm text-gray-600">Terminées</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {filteredTransactions.filter(t => t.status === "pending").length}
            </div>
            <div className="text-sm text-gray-600">En attente</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {filteredTransactions
                .filter(t => t.status === "validated" || t.status === "executed" || t.status === "completed")
                .reduce((sum, t) => sum + Number(t.commission_amount ?? 0), 0)
                .toLocaleString("fr-FR")} XAF
            </div>
            <div className="text-sm text-gray-600">Commissions cumulées</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {filteredTransactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString("fr-FR")} XAF
            </div>
            <div className="text-sm text-gray-600">Montant total</div>
          </CardContent>
        </Card>
      </div>

      {/* Liste des transactions */}
      <Card>
        <CardTitle className="p-4">Liste des Opérations</CardTitle>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("id")}
                          >
                            <div className="flex items-center gap-1">
                              ID
                              {getSortIcon("id")}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("type")}
                          >
                            <div className="flex items-center gap-1">
                              Type
                              {getSortIcon("type")}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("description")}
                          >
                            <div className="flex items-center gap-1">
                              Description
                              {getSortIcon("description")}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("amount")}
                          >
                            <div className="flex items-center gap-1">
                              Montant
                              {getSortIcon("amount")}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("created_by")}
                          >
                            <div className="flex items-center gap-1">
                              Caissier
                              {getSortIcon("created_by")}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("status")}
                          >
                            <div className="flex items-center gap-1">
                              Statut
                              {getSortIcon("status")}
                            </div>
                          </th>
                          <th 
                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100 select-none"
                            onClick={() => handleSort("created_at")}
                          >
                            <div className="flex items-center gap-1">
                              Date
                              {getSortIcon("created_at")}
                            </div>
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{transaction.id}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{getTypeLabel(transaction.type)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{transaction.description}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatAmount(transaction.amount, transaction.currency)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{transaction.created_by}</td>
                    <td className="px-6 py-4 text-sm">{getStatusBadge(transaction.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(transaction.created_at)}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewDetails(transaction)}
                          title="Voir les détails"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {/* Boutons de validation/rejet pour les auditeurs uniquement */}
                        {transaction.status === "pending" && user?.role === "auditor" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              onClick={() => handleValidateTransaction(transaction.id)}
                              title="Valider la transaction"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-600 hover:bg-red-50"
                              onClick={() => handleRejectTransaction(transaction.id)}
                              title="Rejeter la transaction"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        
                        {/* Bouton d'exécution pour les exécuteurs uniquement */}
                        {transaction.status === "validated" && user?.role === "executor" && transaction.executor_id === user.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => handleExecuteTransaction(transaction.id)}
                            title="Exécuter la transaction"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Bouton de clôture pour les caissiers uniquement */}
                        {transaction.status === "executed" && user?.role === "cashier" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => handleCompleteTransaction(transaction.id)}
                            title="Clôturer la transaction"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Bouton d'impression pour toutes les transactions */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                          onClick={() => handlePrintTransactionReceipt(transaction)}
                          title="Imprimer le reçu"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>

                        {/* Boutons de suppression pour toutes les transactions */}
                        {/* Bouton de demande de suppression pour les caissiers */}
                        {user?.role === "cashier" && transaction.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            title="Demander la suppression"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Indicateur d'attente pour les caissiers */}
                        {user?.role === "cashier" && transaction.status === "pending_delete" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-orange-600 border-orange-600 hover:bg-orange-50"
                            disabled
                            title="En attente de validation"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Bouton de validation/suppression pour les comptables et directeurs */}
                        {(user?.role === "accounting" || user?.role === "director") && transaction.status === "pending_delete" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleValidateDelete(transaction.id)}
                            title="Valider et supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
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
                Affichage de {startIndex + 1} à {Math.min(endIndex, filteredTransactions.length)} sur {filteredTransactions.length} opérations
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
        </CardContent>
      </Card>

      {/* Modal des détails */}
      {selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardTitle className="p-4 border-b flex items-center justify-between">
              <span>Détails de l'opération {selectedTransaction.id}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTransaction(null)}
                className="h-8 w-8 p-0 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type d'opération</label>
                  <p className="text-sm">{getTypeLabel(selectedTransaction.type)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Statut</label>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Montant</label>
                  <p className="text-sm font-medium">{formatAmount(selectedTransaction.amount, selectedTransaction.currency)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Caissier</label>
                  <p className="text-sm">{selectedTransaction.created_by}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Agence</label>
                  <p className="text-sm">{selectedTransaction.agency}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Date</label>
                  <p className="text-sm">{formatDate(selectedTransaction.created_at)}</p>
                </div>
              </div>
              
                      <div>
                        <label className="text-sm font-medium text-gray-600">Description</label>
                        <p className="text-sm mt-1">{selectedTransaction.description}</p>
                      </div>

                      {/* Affichage du motif de rejet si la transaction est rejetée */}
                      {selectedTransaction.status === "rejected" && selectedTransaction.rejection_reason && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                          <label className="text-sm font-medium text-red-800">Motif du rejet</label>
                          <p className="text-sm mt-1 text-red-700">{selectedTransaction.rejection_reason}</p>
                        </div>
                      )}

              {selectedTransaction.details && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Détails spécifiques</label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                    {selectedTransaction.type === "receipt" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Type d'opération:</span>
                            <p className="text-sm">{selectedTransaction.details.operation_type === "transfer" ? "Transfert d'argent" : 
                                                      selectedTransaction.details.operation_type === "exchange" ? "Échange de devise" :
                                                      selectedTransaction.details.operation_type === "card_recharge" ? "Recharge de carte" : 
                                                      selectedTransaction.details.operation_type}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Client:</span>
                            <p className="text-sm">{selectedTransaction.details.client_name || "N/A"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Téléphone:</span>
                            <p className="text-sm">{selectedTransaction.details.client_phone || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Numéro de reçu:</span>
                            <p className="text-sm">{selectedTransaction.details.receipt_number || "N/A"}</p>
                          </div>
                        </div>
                        {selectedTransaction.details.operation_type === "transfer" && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-600">Bénéficiaire:</span>
                                <p className="text-sm">{selectedTransaction.details.beneficiary_name || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-600">Pays du bénéficiaire:</span>
                                <p className="text-sm">{selectedTransaction.details.beneficiary_country || "N/A"}</p>
                              </div>
                            </div>
                          </>
                        )}
                        {selectedTransaction.details.operation_type === "exchange" && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-600">Montant échangé:</span>
                                <p className="text-sm">{(selectedTransaction.details.from_amount || 0).toLocaleString("fr-FR")} {selectedTransaction.details.from_currency || "XAF"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-600">Montant reçu:</span>
                                <p className="text-sm">{(selectedTransaction.details.to_amount || 0).toLocaleString("fr-FR")} {selectedTransaction.details.to_currency || "XAF"}</p>
                              </div>
                            </div>
                          </>
                        )}
                        {selectedTransaction.details.operation_type === "card_recharge" && (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-600">Numéro de carte:</span>
                                <p className="text-sm">{selectedTransaction.details.card_number || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-600">Montant de recharge:</span>
                                <p className="text-sm">{(selectedTransaction.details.amount || 0).toLocaleString("fr-FR")} {selectedTransaction.details.currency || "XAF"}</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    ) : selectedTransaction.type === "transfer" ? (
                      <div className="space-y-2">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-600">Bénéficiaire:</span>
                                    <p className="text-sm">{selectedTransaction.details.beneficiary_name || "N/A"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-600">Destination:</span>
                                    <p className="text-sm">{selectedTransaction.details.destination_city || "N/A"}, {selectedTransaction.details.destination_country || "N/A"}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-600">Moyen de transfert:</span>
                                    <p className="text-sm">{selectedTransaction.details.transfer_method || "N/A"}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-600">Montant reçu:</span>
                                    <p className="text-sm">{(selectedTransaction.details.amount_received || 0).toLocaleString("fr-FR")} {selectedTransaction.details.received_currency || "XAF"}</p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-medium text-gray-600">Montant à envoyer:</span>
                                    <p className="text-sm">{(selectedTransaction.details.amount_sent || 0).toLocaleString("fr-FR")} {selectedTransaction.details.sent_currency || "XAF"}</p>
                                  </div>
                                </div>
                                {/* Montant réel et commission pour les transferts validés */}
                                {(selectedTransaction.status === "validated" || selectedTransaction.status === "executed" || selectedTransaction.status === "completed") && selectedTransaction.real_amount_eur && (
                                  <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                                    <div>
                                      <span className="text-sm font-medium text-blue-700">Montant réel envoyé:</span>
                                      <p className="text-sm font-semibold text-blue-900">{selectedTransaction.real_amount_eur.toLocaleString("fr-FR")} EUR</p>
                                    </div>
                                    <div>
                                      <span className="text-sm font-medium text-green-700">Commission:</span>
                                      <p className="text-sm font-semibold text-green-900">{Number(selectedTransaction.commission_amount ?? 0).toLocaleString("fr-FR")} XAF</p>
                                    </div>
                                  </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <span className="text-sm font-medium text-gray-600">Mode de retrait:</span>
                                    <p className="text-sm">{selectedTransaction.details.withdrawal_mode === "cash" ? "Espèces" : "Virement bancaire"}</p>
                                  </div>
                                  {selectedTransaction.details.iban_file && (
                                    <div>
                                      <span className="text-sm font-medium text-gray-600">Fichier IBAN:</span>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm">{selectedTransaction.details.iban_file}</p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleDownloadIBAN(selectedTransaction)}
                                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                                        >
                                          <FileDown className="h-4 w-4 mr-1" />
                                          Télécharger
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {/* Fichier de reçu d'exécution */}
                                  {selectedTransaction.receipt_url && (
                                    <div>
                                      <span className="text-sm font-medium text-gray-600">Reçu d'exécution:</span>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm">{selectedTransaction.receipt_url.split('/').pop()}</p>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => window.open(selectedTransaction.receipt_url, '_blank')}
                                          className="text-green-600 border-green-600 hover:bg-green-50"
                                        >
                                          <FileDown className="h-4 w-4 mr-1" />
                                          Télécharger
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {/* Commentaire de l'exécuteur */}
                                  {selectedTransaction.executor_comment && (
                                    <div>
                                      <span className="text-sm font-medium text-gray-600">Commentaire exécuteur:</span>
                                      <p className="text-sm bg-green-50 p-2 rounded border border-green-200">{selectedTransaction.executor_comment}</p>
                                    </div>
                                  )}
                                </div>
                      </div>
                    ) : selectedTransaction.type === "reception" ? (
                      <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-600">Expéditeur:</span>
                                <p className="text-sm">{selectedTransaction.details.sender_name || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-600">Téléphone expéditeur:</span>
                                <p className="text-sm">{selectedTransaction.details.sender_phone || "N/A"}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="text-sm font-medium text-gray-600">Destinataire:</span>
                                <p className="text-sm">{selectedTransaction.details.receiver_name || "N/A"}</p>
                              </div>
                              <div>
                                <span className="text-sm font-medium text-gray-600">Téléphone destinataire:</span>
                                <p className="text-sm">{selectedTransaction.details.receiver_phone || "N/A"}</p>
                              </div>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-600">Commission:</span>
                              <p className="text-sm">{Number(selectedTransaction.details.commission ?? 0).toLocaleString("fr-FR")} XAF</p>
                            </div>
                      </div>
                    ) : selectedTransaction.type === "exchange" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Devise source:</span>
                            <p className="text-sm">{selectedTransaction.details.from_currency || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Devise cible:</span>
                            <p className="text-sm">{selectedTransaction.details.to_currency || "N/A"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Taux de change:</span>
                            <p className="text-sm">{(selectedTransaction.details.exchange_rate || 0).toLocaleString("fr-FR")}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Montant reçu:</span>
                            <p className="text-sm">{(selectedTransaction.details.amount_received || selectedTransaction.details.amount_xaf || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-600">Commission:</span>
                          <p className="text-sm">{Number(selectedTransaction.details.commission ?? 0).toLocaleString("fr-FR")} XAF</p>
                        </div>
                      </div>
                    ) : selectedTransaction.type === "card" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Numéro de carte:</span>
                            <p className="text-sm">{selectedTransaction.details.card_number || "N/A"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Type de carte:</span>
                            <p className="text-sm">{selectedTransaction.details.card_type || "N/A"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Solde précédent:</span>
                            <p className="text-sm">{(selectedTransaction.details.previous_balance || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Nouveau solde:</span>
                            <p className="text-sm">{(selectedTransaction.details.new_balance || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(selectedTransaction.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedTransaction(null)}>
                  Fermer
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogue de rejet avec motif */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Rejeter la transaction
            </DialogTitle>
            <DialogDescription>
              Veuillez indiquer le motif du rejet de cette transaction. Cette information sera visible par le caissier.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="rejection-reason">Motif du rejet *</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Ex: Documents manquants, montant incorrect, informations incomplètes..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmRejectTransaction}
              disabled={!rejectionReason.trim()}
            >
              <X className="h-4 w-4 mr-2" />
              Rejeter la transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Demander la suppression
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir demander la suppression de cette transaction ? 
              Cette demande devra être validée par un comptable ou un directeur avant suppression définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDeleteTransaction}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Demander la suppression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de validation de suppression */}
      <Dialog open={validateDeleteDialogOpen} onOpenChange={setValidateDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Valider et supprimer
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir valider et supprimer définitivement cette transaction ? 
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="default" 
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmValidateDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Valider et supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de validation avec montant réel */}
      <Dialog open={validateDialogOpen} onOpenChange={setValidateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Valider la transaction
            </DialogTitle>
            <DialogDescription>
              Veuillez saisir le montant réel envoyé en EUR pour calculer la commission et valider automatiquement la transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="real-amount" className="text-sm font-medium text-gray-700">
                  Montant réel envoyé (EUR) *
                </Label>
                <Input
                  id="real-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Ex: 100.50"
                  value={realAmountEUR}
                  onChange={(e) => setRealAmountEUR(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Le système calculera automatiquement la commission et validera/rejettera selon le seuil de 5000 XAF
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmValidateTransaction}
              disabled={!realAmountEUR || isNaN(parseFloat(realAmountEUR)) || parseFloat(realAmountEUR) <= 0}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Valider avec montant réel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue d'exécution avec upload de fichier */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-600" />
              Exécuter la transaction
            </DialogTitle>
            <DialogDescription>
              Veuillez uploader le fichier de reçu pour confirmer l'exécution de la transaction.
            </DialogDescription>
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
              <p className="text-xs text-gray-500 mt-1">
                Formats acceptés: PDF, JPG, PNG, DOC, DOCX (max 10MB)
              </p>
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
                onClick={confirmExecuteTransaction}
                disabled={!receiptFile}
                className="bg-green-600 hover:bg-green-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Confirmer l'exécution
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
