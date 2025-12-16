"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { CheckCircle, Eye, X, AlertTriangle, Info, Upload, Play, FileUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Transaction = {
  id: string
  type: "reception" | "exchange" | "card" | "transfer"
  description: string
  amount: number
  currency: string
  status: "completed" | "pending" | "validated" | "rejected" | "cancelled" | "executed"
  created_by: string
  agency: string
  created_at: string
  details?: any
  rejection_reason?: string
  real_amount_eur?: number
  commission_amount?: number
  executor_id?: string
  executed_at?: string
  receipt_url?: string
  executor_comment?: string
}

// Transactions mock pour les tests - SUPPRIMÉES

interface AuditorPendingTransactionsProps {
  user: { name: string; role: string }
}

export function AuditorPendingTransactions({ user }: AuditorPendingTransactionsProps) {
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [pendingExecutionTransactions, setPendingExecutionTransactions] = React.useState<Transaction[]>([])
  const [rejectDialogOpen, setRejectDialogOpen] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [transactionToReject, setTransactionToReject] = React.useState<string | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = React.useState(false)
  const [selectedTransaction, setSelectedTransaction] = React.useState<Transaction | null>(null)
  const [validateDialogOpen, setValidateDialogOpen] = React.useState(false)
  const [transactionToValidate, setTransactionToValidate] = React.useState<string | null>(null)
  const [realAmountEUR, setRealAmountEUR] = React.useState("")
  const [executeDialogOpen, setExecuteDialogOpen] = React.useState(false)
  const [transactionToExecute, setTransactionToExecute] = React.useState<string | null>(null)
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null)
  const [executorComment, setExecutorComment] = React.useState("")
  const [executingTransaction, setExecutingTransaction] = React.useState<string | null>(null)
  const { toast } = useToast()
  const { rates } = useExchangeRates()

  // Charger les transactions depuis l'API
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
          
          // Filtrer les transactions en attente de validation
          const pendingTransactions = apiTransactions.filter(t => t.status === "pending")
          setTransactions(pendingTransactions)
          
          // Filtrer les transactions en attente d'exécution
          const pendingExecution = apiTransactions.filter(t => t.status === "validated")
          setPendingExecutionTransactions(pendingExecution)
        } else {
          setTransactions([])
          setPendingExecutionTransactions([])
        }
      } catch (error) {
        setTransactions([])
        setPendingExecutionTransactions([])
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
      setTransactions(prev => prev.filter(t => t.id !== transactionToValidate))
      
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

  const handleRejectTransaction = (transactionId: string) => {
    setTransactionToReject(transactionId)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setDetailsDialogOpen(true)
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
      setExecutingTransaction(transactionToExecute)
      
      // Créer un FormData pour l'upload du fichier
      // Note: executorId n'est plus nécessaire car l'API utilise l'utilisateur authentifié
      const formData = new FormData()
      formData.append('transactionId', transactionToExecute)
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
      setPendingExecutionTransactions(prev => prev.filter(t => t.id !== transactionToExecute))
      
      toast({
        title: "Transaction exécutée",
        description: result.message || "La transaction a été exécutée avec succès",
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionId: transactionToExecute, status: 'executed' } 
      }))
      
      setExecuteDialogOpen(false)
      setTransactionToExecute(null)
      setReceiptFile(null)
      setExecutorComment("")
      
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Erreur lors de l'exécution: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setExecutingTransaction(null)
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

  const handleDownloadIBAN = (transaction: Transaction) => {
    const ibanFileData = transaction.details?.iban_file_data
    
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
        description: `Erreur lors du téléchargement: ${error.message}`,
        variant: "destructive"
      })
    }
  }

  const renderTransactionDetails = (details: any, type: string, transaction?: any) => {
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
            {/* DÉSACTIVÉ: Mode de frais (peut être réactivé plus tard) */}
            {/* {details.fee_mode && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Mode de frais</span>
                  <p className="text-sm text-gray-900">
                    {details.fee_mode === "with_fees" ? "Avec frais" : 
                     details.fee_mode === "without_fees" ? "Sans frais" : 
                     details.fee_mode}
                  </p>
                </div>
              </div>
            )} */}
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
            {/* DÉSACTIVÉ: Détails de calcul si disponibles (peut être réactivé plus tard) */}
            {/* {(details.fees !== undefined || details.tax !== undefined) && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <h5 className="text-xs font-semibold text-gray-700 mb-2">Détails du calcul</h5>
                <div className="space-y-1 text-xs">
                  {details.fees !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Frais:</span>
                      <span className="font-medium">{(details.fees || 0).toLocaleString("fr-FR")} XAF</span>
                    </div>
                  )}
                  {details.tax !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Taxe:</span>
                      <span className="font-medium">{(details.tax || 0).toLocaleString("fr-FR")} XAF</span>
                    </div>
                  )}
                  {details.amount_to_collect !== undefined && (
                    <div className="flex justify-between pt-1 border-t border-gray-300">
                      <span className="text-gray-700 font-semibold">Montant à collecter:</span>
                      <span className="font-semibold">{(details.amount_to_collect || 0).toLocaleString("fr-FR")} {details.received_currency || details.receivedCurrency || 'XAF'}</span>
                    </div>
                  )}
                </div>
              </div>
            )} */}
            {/* Montant réel et commission si disponibles (pour les transactions validées) */}
            {transaction && transaction.real_amount_eur && transaction.commission_amount && (
              <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded-lg border border-blue-200">
                <div>
                  <span className="text-xs font-medium text-blue-700 uppercase tracking-wide">Montant réel envoyé</span>
                  <p className="text-sm font-semibold text-blue-900">{transaction.real_amount_eur.toLocaleString("fr-FR")} EUR</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-green-700 uppercase tracking-wide">Commission</span>
                  <p className="text-sm font-semibold text-green-900">{transaction.commission_amount.toLocaleString("fr-FR")} XAF</p>
                </div>
              </div>
            )}
            {(details.iban_file || details.ibanFile) && transaction && (
              <div>
                <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">Fichier IBAN</span>
                <button
                  onClick={() => handleDownloadIBAN(transaction)}
                  className="text-sm text-blue-600 font-medium hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                  title="Cliquez pour télécharger le fichier IBAN"
                >
                  📎 Fichier IBAN joint
                </button>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-800">
          Gestion des Transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="validation" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="validation">
              Validation ({transactions.length})
            </TabsTrigger>
            <TabsTrigger value="execution">
              Exécution ({pendingExecutionTransactions.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="validation" className="space-y-4 mt-4">
            {transactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Aucune transaction en attente de validation</p>
              </div>
            ) : (
              <>
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
                    Une fois validées, elles apparaîtront dans l'onglet "Exécution".
                  </p>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="execution" className="space-y-4 mt-4">
            {pendingExecutionTransactions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Aucune transaction en attente d'exécution</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingExecutionTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
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
                      {transaction.real_amount_eur && (
                        <div className="mt-1 text-xs text-gray-400">
                          Montant réel: {transaction.real_amount_eur} EUR
                        </div>
                      )}
                      {transaction.commission_amount && (
                        <div className="mt-1 text-xs text-green-600 font-medium">
                          Commission: {formatAmount(transaction.commission_amount, 'XAF')}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800">Validée</Badge>
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
                        className="text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => handleExecuteTransaction(transaction.id)}
                        disabled={executingTransaction === transaction.id}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        {executingTransaction === transaction.id ? 'Exécution...' : 'Exécuter'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
                    {renderTransactionDetails(selectedTransaction.details, selectedTransaction.type, selectedTransaction)}
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
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs font-medium text-blue-900 mb-1">Taux de change appliqué :</p>
                  <p className="text-sm text-blue-800">
                    1 EUR = {rates.EUR.toLocaleString("fr-FR")} XAF
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Le montant réel en EUR sera converti en XAF à ce taux pour calculer la commission.
                  </p>
                </div>
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
                className="mt-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setExecuteDialogOpen(false)
                  setReceiptFile(null)
                  setExecutorComment("")
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmExecuteTransaction}
                disabled={!receiptFile || executingTransaction === transactionToExecute}
                className="bg-green-600 hover:bg-green-700"
              >
                <Upload className="h-4 w-4 mr-2" />
                Confirmer l'exécution
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
