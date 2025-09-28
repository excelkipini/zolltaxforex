"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle, Eye, X, AlertTriangle, Info, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type Transaction = {
  id: string
  type: "reception" | "exchange" | "card" | "transfer"
  description: string
  amount: number
  currency: string
  status: "completed" | "pending" | "validated" | "rejected" | "cancelled"
  created_by: string
  agency: string
  created_at: string
  details?: any
  rejection_reason?: string
}

// Transactions mock pour les tests - SUPPRIMÉES

interface AuditorPendingTransactionsProps {
  user: { name: string; role: string }
}

export function AuditorPendingTransactions({ user }: AuditorPendingTransactionsProps) {
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [transactionToReject, setTransactionToReject] = React.useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = React.useState(false)
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null)
  const [bulkValidateDialogOpen, setBulkValidateDialogOpen] = React.useState(false)
  const [isBulkValidating, setIsBulkValidating] = React.useState(false)
  const { toast } = useToast()

  // Charger les transactions depuis localStorage
  React.useEffect(() => {
    const loadTransactions = async () => {
      try {
        const res = await fetch("/api/transactions")
        const data = await res.json()
        if (res.ok && data?.ok && Array.isArray(data.data)) {
          const apiTransactions = data.data.map((item: any) => ({
            ...item,
            details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details
          }))
          
          // Filtrer les transactions en attente
          const pendingTransactions = apiTransactions.filter(t => t.status === "pending")
          setTransactions(pendingTransactions)
        } else {
          setTransactions([])
        }
      } catch (error) {
        setTransactions([])
      }
    }

    loadTransactions()

    // Écouter les événements personnalisés pour recharger depuis l'API
    const handleTransferCreated = () => loadTransactions()
    const handleReceptionCreated = () => loadTransactions()
    const handleExchangeCreated = () => loadTransactions()
    const handleTransactionStatusChanged = () => loadTransactions()

    window.addEventListener('transferCreated', handleTransferCreated as EventListener)
    window.addEventListener('receptionCreated', handleReceptionCreated as EventListener)
    window.addEventListener('exchangeCreated', handleExchangeCreated as EventListener)
    window.addEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    
    return () => {
      window.removeEventListener('transferCreated', handleTransferCreated as EventListener)
      window.removeEventListener('receptionCreated', handleReceptionCreated as EventListener)
      window.removeEventListener('exchangeCreated', handleExchangeCreated as EventListener)
      window.removeEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    }
  }, [])

  const handleValidateTransaction = async (transactionId: string) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: transactionId,
          status: 'validated'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la validation')
      }

      const result = await response.json()
      const updatedTransaction = result.data
      
      // Mettre à jour l'état local
      setTransactions(prev => prev.filter(t => t.id !== transactionId))
      
      toast({
        title: "Transaction validée",
        description: `La transaction ${transactionId} a été validée et peut maintenant être clôturée par le caissier`,
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionId, status: 'validated' } 
      }))
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la validation: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const handleRejectTransaction = (transactionId: string) => {
    setTransactionToReject(transactionId)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setDetailsDialogOpen(true)
  }

  const handleBulkValidate = () => {
    setBulkValidateDialogOpen(true)
  }

  const confirmBulkValidate = async () => {
    if (transactions.length === 0) {
      toast({
        title: "Erreur",
        description: "Aucune transaction à valider",
        variant: "destructive"
      })
      return
    }

    setIsBulkValidating(true)
    
    try {
      const validationPromises = transactions.map(transaction => 
        fetch('/api/transactions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: transaction.id,
            status: 'validated'
          })
        })
      )

      const responses = await Promise.all(validationPromises)
      
      // Vérifier que toutes les réponses sont OK
      const failedValidations = responses.filter(response => !response.ok)
      
      if (failedValidations.length > 0) {
        throw new Error(`${failedValidations.length} transaction(s) n'ont pas pu être validées`)
      }

      // Vider la liste des transactions en attente
      setTransactions([])
      
      toast({
        title: "Validation en masse réussie",
        description: `${transactions.length} transaction(s) ont été validées avec succès`,
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionIds: transactions.map(t => t.id), status: 'validated' } 
      }))
      
    } catch (error) {
      toast({
        title: "Erreur lors de la validation en masse",
        description: `Erreur: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setIsBulkValidating(false)
      setBulkValidateDialogOpen(false)
    }
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

    const updatedTransactions = transactions.map(t => 
      t.id === transactionToReject 
        ? { ...t, status: "rejected" as const, rejection_reason: rejectionReason.trim() }
        : t
    )
    
    setTransactions(updatedTransactions)
    
    // Trouver la transaction pour déterminer son type
    const transaction = transactions.find(t => t.id === transactionToReject)
    if (!transaction) return

    // Sauvegarde via l'API (voir ci-dessous)
    
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

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toLocaleString("fr-FR")} ${currency}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR")
  }

  const renderTransactionDetails = (details: any, type: string) => {
    if (!details || typeof details !== 'object') {
      return <p className="text-sm text-gray-500 italic">Aucun détail supplémentaire</p>
    }

    switch (type) {
      case "transfer":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Bénéficiaire</span>
                <p className="text-sm text-gray-900 font-medium">{details.beneficiary_name || details.beneficiaryName || 'Non spécifié'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Pays de destination</span>
                <p className="text-sm text-gray-900">{details.destination_country || details.destinationCountry || 'Non spécifié'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Ville de destination</span>
                <p className="text-sm text-gray-900">{details.destination_city || details.destinationCity || 'Non spécifié'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Moyen de transfert</span>
                <p className="text-sm text-gray-900">{details.transfer_method || 'Non spécifié'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Mode de retrait</span>
                <p className="text-sm text-gray-900">
                  {details.withdrawal_mode === 'cash' ? 'Espèces' : 
                   details.withdrawal_mode === 'bank_transfer' ? 'Virement bancaire' : 
                   details.withdrawalMode === 'cash' ? 'Espèces' : 
                   details.withdrawalMode === 'bank_transfer' ? 'Virement bancaire' : 
                   details.withdrawal_mode || details.withdrawalMode || 'Non spécifié'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Montant reçu</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {(details.amount_received || details.amountReceived) ? 
                    `${Number(details.amount_received || details.amountReceived).toLocaleString('fr-FR')} ${details.received_currency || details.receivedCurrency || 'XAF'}` : 
                    'Non spécifié'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Montant à envoyer</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {(details.amount_sent || details.amountToSend) ? 
                    `${Number(details.amount_sent || details.amountToSend).toLocaleString('fr-FR')} ${details.sent_currency || details.sendCurrency || 'XAF'}` : 
                    'Non spécifié'}
                </p>
              </div>
            </div>
            {(details.iban_file || details.ibanFile) && (
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Fichier IBAN</span>
                <p className="text-sm text-blue-600 font-medium">📎 Fichier IBAN joint</p>
              </div>
            )}
          </div>
        )

      case "reception":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Type d'opération</span>
                <p className="text-sm text-gray-900 font-medium">
                  {details.transaction_type === 'receive' ? 'Réception' : 
                   details.transaction_type === 'send' ? 'Envoi' : 
                   details.transaction_type || 'Non spécifié'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Client</span>
                <p className="text-sm text-gray-900">{details.client_name || 'Non spécifié'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Téléphone</span>
                <p className="text-sm text-gray-900">{details.client_phone || 'Non spécifié'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Montant net</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {details.net_amount ? `${Number(details.net_amount).toLocaleString('fr-FR')} ${details.currency || 'XAF'}` : 'Non spécifié'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Commission</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {details.commission ? `${Number(details.commission).toLocaleString('fr-FR')} ${details.currency || 'XAF'}` : 'Non spécifié'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Numéro de reçu</span>
                <p className="text-sm text-gray-900 font-mono">{details.receipt_number || 'Non spécifié'}</p>
              </div>
            </div>
          </div>
        )

      case "exchange":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Type d'opération</span>
                <p className="text-sm text-gray-900 font-medium">
                  {details.exchange_type === 'buy' ? 'Achat de devises' : 
                   details.exchange_type === 'sell' ? 'Vente de devises' : 
                   details.exchange_type || 'Non spécifié'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Client</span>
                <p className="text-sm text-gray-900">{details.client_name || 'Non spécifié'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Devise source</span>
                <p className="text-sm text-gray-900 font-semibold">{details.from_currency || 'Non spécifié'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Devise cible</span>
                <p className="text-sm text-gray-900 font-semibold">{details.to_currency || 'Non spécifié'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Montant XAF</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {details.amount_xaf ? `${Number(details.amount_xaf).toLocaleString('fr-FR')} XAF` : 'Non spécifié'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Montant devise étrangère</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {details.amount_foreign ? `${Number(details.amount_foreign).toLocaleString('fr-FR')} ${details.from_currency || details.to_currency}` : 'Non spécifié'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Taux de change</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {details.exchange_rate ? `1 ${details.from_currency} = ${details.exchange_rate} ${details.to_currency}` : 'Non spécifié'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Commission</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {details.commission ? `${Number(details.commission).toLocaleString('fr-FR')} XAF` : 'Non spécifié'}
                </p>
              </div>
            </div>
          </div>
        )

      case "card":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Type de carte</span>
                <p className="text-sm text-gray-900">{details.cardType || 'Non spécifié'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Numéro de carte</span>
                <p className="text-sm text-gray-900 font-mono">{details.cardNumber || 'Non spécifié'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Titulaire</span>
                <p className="text-sm text-gray-900 font-medium">{details.holderName || 'Non spécifié'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Date d'expiration</span>
                <p className="text-sm text-gray-900">{details.expiryDate || 'Non spécifié'}</p>
              </div>
            </div>
            {details.amount && (
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Montant</span>
                <p className="text-sm text-gray-900 font-semibold">
                  {Number(details.amount).toLocaleString('fr-FR')} {details.currency || 'XAF'}
                </p>
              </div>
            )}
          </div>
        )

      default:
        return (
          <div className="space-y-2">
            <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Détails bruts</span>
            <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-x-auto">
              {JSON.stringify(details, null, 2)}
            </pre>
          </div>
        )
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
      default:
        return type
    }
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-gray-800">
            Transactions en Attente de Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-500">Aucune transaction en attente de validation</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-800">
            Transactions en Attente de Validation ({transactions.length})
          </CardTitle>
          {transactions.length > 0 && (
            <Button
              onClick={handleBulkValidate}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isBulkValidating}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isBulkValidating ? "Validation..." : "Valider toutes"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {getTypeLabel(transaction.type)}
                  </Badge>
                  <span className="font-medium text-sm">{transaction.id}</span>
                  <span className="text-sm text-gray-600">{transaction.description}</span>
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {formatAmount(transaction.amount, transaction.currency)} • {formatDate(transaction.created_at)}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Créé par: {transaction.created_by} • Agence: {transaction.agency}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-gray-600 border-gray-600 hover:bg-gray-50"
                  onClick={() => handleViewDetails(transaction)}
                >
                  <Info className="h-4 w-4 mr-1" />
                  Détails
                </Button>
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
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Note :</strong> Validez les transactions pour permettre aux caissiers de les clôturer. 
            Une fois validées, elles apparaîtront comme "Validé" dans l'onglet "Opérations".
          </p>
        </div>
      </CardContent>

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

      {/* Dialogue des détails de transaction */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Détails de la transaction
            </DialogTitle>
            <DialogDescription>
              Informations complètes sur cette transaction en attente de validation.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">ID Transaction</Label>
                  <p className="text-sm text-gray-900">{selectedTransaction.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Type</Label>
                  <p className="text-sm text-gray-900">{getTypeLabel(selectedTransaction.type)}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Description</Label>
                <p className="text-sm text-gray-900">{selectedTransaction.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Montant</Label>
                  <p className="text-sm text-gray-900 font-semibold">
                    {formatAmount(selectedTransaction.amount, selectedTransaction.currency)}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Statut</Label>
                  <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Créé par</Label>
                  <p className="text-sm text-gray-900">{selectedTransaction.created_by}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700">Agence</Label>
                  <p className="text-sm text-gray-900">{selectedTransaction.agency}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-700">Date de création</Label>
                <p className="text-sm text-gray-900">{formatDate(selectedTransaction.created_at)}</p>
              </div>
              
              {selectedTransaction.details && (
                <div>
                  <Label className="text-sm font-medium text-gray-700">Détails supplémentaires</Label>
                  <div className="mt-1 p-4 bg-gray-50 rounded-lg border">
                    {renderTransactionDetails(selectedTransaction.details, selectedTransaction.type)}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de validation en masse */}
      <Dialog open={bulkValidateDialogOpen} onOpenChange={setBulkValidateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Valider toutes les transactions
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir valider toutes les {transactions.length} transaction(s) en attente ? 
              Cette action permettra aux caissiers de clôturer ces transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Transactions qui seront validées :</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="text-sm text-yellow-700">
                    <span className="font-medium">{transaction.id}</span> - {getTypeLabel(transaction.type)} - {formatAmount(transaction.amount, transaction.currency)}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkValidateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmBulkValidate}
              disabled={isBulkValidating}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isBulkValidating ? "Validation..." : `Valider ${transactions.length} transaction(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
