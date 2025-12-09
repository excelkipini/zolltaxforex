"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, Eye, X, AlertTriangle, Clock, FileDown, Edit, Trash2, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type Transaction = {
  id: string
  type: "reception" | "exchange" | "card" | "transfer" | "receipt"
  description: string
  amount: number
  currency: string
  status: "completed" | "pending" | "validated" | "rejected" | "cancelled" | "pending_delete"
  created_by: string
  agency: string
  created_at: string
  details?: any
  rejection_reason?: string
}

interface DailyOperationsProps {
  operationType: "reception" | "exchange" | "transfer" | "receipt"
  user: { name: string; role: string }
  title?: string
}

export function DailyOperations({ operationType, user, title }: DailyOperationsProps) {
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [transactionToReject, setTransactionToReject] = React.useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmDialogOpen, setDeleteConfirmDialogOpen] = React.useState(false)
  const [receiptToDelete, setReceiptToDelete] = React.useState<Transaction | null>(null)
  const [validateDialogOpen, setValidateDialogOpen] = React.useState(false)
  const [transactionToValidate, setTransactionToValidate] = React.useState<string | null>(null)
  const [realAmountEUR, setRealAmountEUR] = React.useState("")
  const { toast } = useToast()

  // Charger les transactions du jour depuis l'API
  React.useEffect(() => {
    const loadDailyTransactions = async () => {
      try {
        const today = new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
        
        // Charger toutes les transactions depuis l'API
        const res = await fetch("/api/transactions")
        const data = await res.json()
        
        if (res.ok && data?.ok && Array.isArray(data.data)) {
          const apiTransactions = data.data.map((item: any) => ({
            ...item,
            details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details,
            // Inclure les informations de validation de suppression dans les détails
            details: {
              ...(typeof item.details === 'string' ? JSON.parse(item.details) : item.details),
              delete_validated_by: item.delete_validated_by,
              delete_validated_at: item.delete_validated_at
            }
          }))

          // Filtrer les transactions du jour et du type correspondant
          let todayTransactions = apiTransactions.filter(t => {
            const isToday = t.created_at.startsWith(today)
            const isCorrectType = operationType === "receipt" ? t.type === "receipt" : t.type === operationType
            
            // Pour les reçus, inclure tous les statuts (completed, pending_delete)
            if (operationType === "receipt" && t.type === "receipt") {
              return isToday && (t.status === "completed" || t.status === "pending_delete")
            }
            
            return isToday && isCorrectType
          })
          
          // Filtrer par utilisateur pour les caissiers
          if (user.role === "cashier") {
            todayTransactions = todayTransactions.filter(t => t.created_by === user.name)
          }
          
          setTransactions(todayTransactions)
        } else {
          setTransactions([])
        }
      } catch (error) {
        setTransactions([])
      }
    }

    loadDailyTransactions()

    // Écouter les événements personnalisés pour recharger depuis l'API
    const handleTransactionCreated = () => loadDailyTransactions()
    const handleTransactionStatusChanged = () => loadDailyTransactions()

    const eventName = `${operationType}Created`
    window.addEventListener(eventName, handleTransactionCreated as EventListener)
    window.addEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    
    return () => {
      window.removeEventListener(eventName, handleTransactionCreated as EventListener)
      window.removeEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    }
  }, [operationType])

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
        return <Badge className="bg-orange-100 text-orange-800">Suppression demandée</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getOperationTypeLabel = (type: string) => {
    switch (type) {
      case "reception":
        return "Réception/Envoi"
      case "exchange":
        return "Bureau de change"
      case "transfer":
        return "Transfert d'argent"
      case "receipt":
        return "Reçus"
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
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Une erreur est survenue lors du téléchargement du fichier: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handleDeleteTransaction = (transaction: Transaction) => {
    setReceiptToDelete(transaction)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteTransaction = async () => {
    if (!receiptToDelete) return

    try {
      const response = await fetch(`/api/transactions/${receiptToDelete.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la suppression')
      }

      const result = await response.json()

      toast({
        title: result.status === "pending_delete" ? "Demande envoyée" : "Transaction supprimée",
        description: result.message,
      })

      // Recharger les transactions
      const loadDailyTransactions = async () => {
        try {
          const today = new Date().toISOString().split('T')[0]
          const res = await fetch("/api/transactions")
          const data = await res.json()
          
          if (res.ok && data?.ok && Array.isArray(data.data)) {
            const apiTransactions = data.data.map((item: any) => ({
              ...item,
              details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details
            }))

            let todayTransactions = apiTransactions.filter(t => {
              const isToday = t.created_at.startsWith(today)
              const isCorrectType = operationType === "receipt" ? t.type === "receipt" : t.type === operationType
              return isToday && isCorrectType
            })
            
            if (user.role === "cashier") {
              todayTransactions = todayTransactions.filter(t => t.created_by === user.name)
            }
            
            setTransactions(todayTransactions)
          }
        } catch (error) {
          console.error('Erreur lors du rechargement:', error)
        }
      }

      await loadDailyTransactions()
      
      setDeleteConfirmDialogOpen(false)
      setReceiptToDelete(null)
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la suppression: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handleValidateDelete = async (transaction: Transaction) => {
    try {
      const response = await fetch(`/api/transactions/${transaction.id}/validate-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la validation')
      }

      const result = await response.json()

      toast({
        title: "Transaction supprimée",
        description: result.message,
      })

      // Recharger les transactions
      const loadDailyTransactions = async () => {
        try {
          const today = new Date().toISOString().split('T')[0]
          const res = await fetch("/api/transactions")
          const data = await res.json()
          
          if (res.ok && data?.ok && Array.isArray(data.data)) {
            const apiTransactions = data.data.map((item: any) => ({
              ...item,
              details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details
            }))

            let todayTransactions = apiTransactions.filter(t => {
              const isToday = t.created_at.startsWith(today)
              const isCorrectType = operationType === "receipt" ? t.type === "receipt" : t.type === operationType
              return isToday && isCorrectType
            })
            
            if (user.role === "cashier") {
              todayTransactions = todayTransactions.filter(t => t.created_by === user.name)
            }
            
            setTransactions(todayTransactions)
          }
        } catch (error) {
          console.error('Erreur lors du rechargement:', error)
        }
      }

      await loadDailyTransactions()
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la validation: ${error.message}`,
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
      setTransactions(prev => prev.map(t => 
        t.id === transactionToValidate 
          ? { ...t, status: result.transaction.status as const }
          : t
      ))
      
      toast({
        title: "Transaction validée",
        description: result.message || "La transaction a été validée avec succès",
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
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      
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
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: transactionToReject,
          status: 'rejected',
          rejection_reason: rejectionReason.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors du rejet')
      }

      const result = await response.json()
      const updatedTransaction = result.data
      
      // Mettre à jour l'état local
      setTransactions(prev => prev.filter(t => t.id !== transactionToReject))
      
      toast({
        title: "Transaction rejetée",
        description: `La transaction ${transactionToReject} a été rejetée avec le motif: ${rejectionReason}`,
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionId: transactionToReject, status: 'rejected' } 
      }))
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Erreur lors du rejet: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setRejectDialogOpen(false)
      setTransactionToReject(null)
      setRejectionReason("")
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {title || `Opérations du jour - ${getOperationTypeLabel(operationType)}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Aucune opération {getOperationTypeLabel(operationType).toLowerCase()} effectuée aujourd'hui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-sm">{transaction.id}</span>
                        {getStatusBadge(transaction.status)}
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{transaction.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{formatAmount(transaction.amount, transaction.currency)}</span>
                        <span>{formatDate(transaction.created_at)}</span>
                        <span>Par: {transaction.created_by}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(transaction)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Détails
                      </Button>
                      
                      {/* Boutons de suppression pour toutes les transactions */}
                      {user.role === "cashier" && transaction.status === "completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteTransaction(transaction)}
                        >
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Demander suppression
                        </Button>
                      )}
                      
                      {user.role === "cashier" && transaction.status === "pending_delete" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-orange-600 border-orange-600 hover:bg-orange-50"
                          disabled
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          En attente validation
                        </Button>
                      )}
                      
                      {/* Bouton de validation/suppression pour les comptables et direction */}
                      {(user.role === "accounting" || user.role === "director" || user.role === "delegate") && transaction.status === "pending_delete" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600 hover:bg-red-50"
                          onClick={() => handleValidateDelete(transaction)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Valider et supprimer
                        </Button>
                      )}
                      
                      {/* Boutons de validation/rejet pour les auditeurs uniquement */}
                      {transaction.status === "pending" && user.role === "auditor" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-600 hover:bg-blue-50"
                            onClick={() => handleValidateTransaction(transaction.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Valider
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleRejectTransaction(transaction.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </>
                      )}
                      
                      {/* Bouton de clôture pour les caissiers uniquement */}
                      {transaction.status === "validated" && user.role === "cashier" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600 hover:bg-green-50"
                          onClick={() => handleCompleteTransaction(transaction.id)}
                        >
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
        </CardContent>
      </Card>

      {/* Modal de détails */}
      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardTitle className="p-4 border-b">Détails de l'opération {selectedTransaction.id}</CardTitle>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Type</label>
                  <p className="text-sm">{getOperationTypeLabel(selectedTransaction.type)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Statut</label>
                  <div className="mt-1">{getStatusBadge(selectedTransaction.status)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Montant</label>
                  <p className="text-sm font-medium">{formatAmount(selectedTransaction.amount, selectedTransaction.currency)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Caissier</label>
                  <p className="text-sm">{selectedTransaction.created_by}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                    {selectedTransaction.type === "reception" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Type de transaction:</span>
                            <p className="text-sm">{selectedTransaction.details.transaction_type === "receive" ? "Réception" : "Envoi"}</p>
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
                            <span className="text-sm font-medium text-gray-600">Devise:</span>
                            <p className="text-sm">{selectedTransaction.details.currency || "N/A"}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Commission:</span>
                            <p className="text-sm">{(selectedTransaction.details.commission || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Montant net:</span>
                            <p className="text-sm">{(selectedTransaction.details.net_amount || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                        </div>
                        {selectedTransaction.details.receipt_number && (
                          <div>
                            <span className="text-sm font-medium text-gray-600">Numéro de reçu:</span>
                            <p className="text-sm font-mono">{selectedTransaction.details.receipt_number}</p>
                          </div>
                        )}
                      </div>
                    ) : selectedTransaction.type === "exchange" ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Type d'opération:</span>
                            <p className="text-sm">{selectedTransaction.details.exchange_type === "buy" ? "Achat devise" : "Vente devise"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Client:</span>
                            <p className="text-sm">{selectedTransaction.details.client_name || "N/A"}</p>
                          </div>
                        </div>
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
                            <span className="text-sm font-medium text-gray-600">Montant XAF:</span>
                            <p className="text-sm">{(selectedTransaction.details.amount_xaf || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Montant devise:</span>
                            <p className="text-sm">{(selectedTransaction.details.amount_foreign || 0).toLocaleString("fr-FR")} {selectedTransaction.details.to_currency || ""}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Commission:</span>
                            <p className="text-sm">{(selectedTransaction.details.commission || 0).toLocaleString("fr-FR")} XAF</p>
                          </div>
                        </div>
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
                          <div>
                            <span className="text-sm font-medium text-gray-600">Mode de frais:</span>
                            <p className="text-sm">
                              {selectedTransaction.details.fee_mode === "with_fees" ? "Avec frais" : 
                               selectedTransaction.details.fee_mode === "without_fees" ? "Sans frais" : 
                               "N/A"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-gray-600">Montant reçu:</span>
                            <p className="text-sm">{(selectedTransaction.details.amount_received || 0).toLocaleString("fr-FR")} {selectedTransaction.details.received_currency || "XAF"}</p>
                          </div>
                          <div>
                            <span className="text-sm font-medium text-gray-600">Montant envoyé:</span>
                            <p className="text-sm">{(selectedTransaction.details.amount_sent || 0).toLocaleString("fr-FR")} {selectedTransaction.details.sent_currency || "XAF"}</p>
                          </div>
                        </div>
                        {/* Détails de calcul si disponibles */}
                        {(selectedTransaction.details.fees !== undefined || selectedTransaction.details.tax !== undefined) && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Détails du calcul</h5>
                            <div className="space-y-1 text-xs">
                              {selectedTransaction.details.fees !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Frais:</span>
                                  <span className="font-medium">{(selectedTransaction.details.fees || 0).toLocaleString("fr-FR")} XAF</span>
                                </div>
                              )}
                              {selectedTransaction.details.tax !== undefined && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Taxe:</span>
                                  <span className="font-medium">{(selectedTransaction.details.tax || 0).toLocaleString("fr-FR")} XAF</span>
                                </div>
                              )}
                              {selectedTransaction.details.amount_to_collect !== undefined && (
                                <div className="flex justify-between pt-1 border-t border-gray-300">
                                  <span className="text-gray-700 font-semibold">Montant à collecter:</span>
                                  <span className="font-semibold">{(selectedTransaction.details.amount_to_collect || 0).toLocaleString("fr-FR")} {selectedTransaction.details.received_currency || "XAF"}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {/* Montant réel et commission pour les transferts validés */}
                        {(selectedTransaction.status === "validated" || selectedTransaction.status === "executed" || selectedTransaction.status === "completed") && selectedTransaction.real_amount_eur && (
                          <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <div>
                              <span className="text-sm font-medium text-blue-700">Montant réel envoyé:</span>
                              <p className="text-sm font-semibold text-blue-900">{selectedTransaction.real_amount_eur.toLocaleString("fr-FR")} EUR</p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-green-700">Commission:</span>
                              <p className="text-sm font-semibold text-green-900">{(selectedTransaction.commission_amount || 0).toLocaleString("fr-FR")} XAF</p>
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
                        </div>
                      </div>
                    ) : selectedTransaction.type === "receipt" ? (
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

      {/* Dialogue de demande de suppression */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              {receiptToDelete?.status === "completed" ? "Demander la suppression du reçu" : "Confirmer la suppression du reçu"}
            </DialogTitle>
            <DialogDescription>
              {receiptToDelete?.status === "completed" 
                ? "Vous êtes sur le point de demander la suppression de ce reçu. Cette demande devra être validée par le comptable."
                : "Cette action supprimera définitivement le reçu de la base de données. Cette action est irréversible."
              }
            </DialogDescription>
          </DialogHeader>
          {receiptToDelete && (
            <div className="grid gap-4 py-4">
              <div className="p-3 bg-gray-50 rounded-md">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-gray-600">ID du reçu:</span>
                    <p className="text-sm font-mono">{receiptToDelete.id}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Description:</span>
                    <p className="text-sm">{receiptToDelete.description}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Montant:</span>
                    <p className="text-sm">{receiptToDelete.amount.toLocaleString('fr-FR')} {receiptToDelete.currency}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">Client:</span>
                    <p className="text-sm">{receiptToDelete.details?.client_name || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (receiptToDelete?.status === "completed") {
                  setDeleteDialogOpen(false)
                  setDeleteConfirmDialogOpen(true)
                } else {
                  confirmDeleteTransaction()
                }
              }}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              {receiptToDelete?.status === "completed" ? "Demander la suppression" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de confirmation de suppression */}
      <Dialog open={deleteConfirmDialogOpen} onOpenChange={setDeleteConfirmDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-red-600" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              ⚠️ Cette action est irréversible. Le reçu sera définitivement supprimé de la base de données.
            </DialogDescription>
          </DialogHeader>
          {receiptToDelete && (
            <div className="grid gap-4 py-4">
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="space-y-2">
                  <div>
                    <span className="text-sm font-medium text-red-800">Reçu à supprimer:</span>
                    <p className="text-sm font-mono text-red-700">{receiptToDelete.id}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-red-800">Description:</span>
                    <p className="text-sm text-red-700">{receiptToDelete.description}</p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-red-800">Montant:</span>
                    <p className="text-sm text-red-700">{receiptToDelete.amount.toLocaleString('fr-FR')} {receiptToDelete.currency}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Attention:</strong> Cette suppression est définitive et ne peut pas être annulée.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteTransaction}
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="h-4 w-4 mr-2" />
              Supprimer définitivement
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
                  Le système calculera automatiquement la commission et validera la transaction
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
    </div>
  )
}

