"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Check, CheckCircle2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Types pour les transactions
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

interface CashierValidatedTransactionsProps {
  user: { name: string; role: string }
}

export function CashierPendingTransactions({ user }: CashierValidatedTransactionsProps) {
  const [transactions, setTransactions] = React.useState<Transaction[]>([])
  const [bulkCompleteDialogOpen, setBulkCompleteDialogOpen] = React.useState(false)
  const [isBulkCompleting, setIsBulkCompleting] = React.useState(false)
  const { toast } = useToast()

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

          // Filtrer les transactions validées créées par ce caissier (à clôturer)
          const validatedTransactions = apiTransactions.filter(t => 
            t.status === "validated" && t.created_by === user.name
          )
          
          setTransactions(validatedTransactions)
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
    const handleTransactionStatusChanged = () => loadTransactions()

    window.addEventListener('transferCreated', handleTransferCreated as EventListener)
    window.addEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    
    return () => {
      window.removeEventListener('transferCreated', handleTransferCreated as EventListener)
      window.removeEventListener('transactionStatusChanged', handleTransactionStatusChanged as EventListener)
    }
  }, [user.name])

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

  const handleBulkComplete = () => {
    setBulkCompleteDialogOpen(true)
  }

  const confirmBulkComplete = async () => {
    if (transactions.length === 0) {
      toast({
        title: "Erreur",
        description: "Aucune transaction à clôturer",
        variant: "destructive"
      })
      return
    }

    setIsBulkCompleting(true)
    
    try {
      const completionPromises = transactions.map(transaction => 
        fetch('/api/transactions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: transaction.id,
            status: 'completed'
          })
        })
      )

      const responses = await Promise.all(completionPromises)
      
      // Vérifier que toutes les réponses sont OK
      const failedCompletions = responses.filter(response => !response.ok)
      
      if (failedCompletions.length > 0) {
        throw new Error(`${failedCompletions.length} transaction(s) n'ont pas pu être clôturées`)
      }

      // Vider la liste des transactions
      setTransactions([])
      
      toast({
        title: "Clôture en masse réussie",
        description: `${transactions.length} transaction(s) ont été clôturées avec succès`,
      })
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('transactionStatusChanged', { 
        detail: { transactionIds: transactions.map(t => t.id), status: 'completed' } 
      }))
      
    } catch (error) {
      toast({
        title: "Erreur lors de la clôture en masse",
        description: `Erreur: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setIsBulkCompleting(false)
      setBulkCompleteDialogOpen(false)
    }
  }

  const formatAmount = (amount: number, currency: string) => {
    return `${amount.toLocaleString("fr-FR")} ${currency}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR")
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-gray-800">
            Mes Transactions à Clôturer
          </CardTitle>
          {transactions.length > 0 && (
            <Button
              onClick={handleBulkComplete}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={isBulkCompleting}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isBulkCompleting ? "Clôture..." : "Clôturer toutes"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Aucune transaction à clôturer</p>
            <p className="text-sm">Toutes vos transactions validées ont été clôturées</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg bg-green-50">
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
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">Validé</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-600 hover:bg-green-50"
                    onClick={() => handleCompleteTransaction(transaction.id)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Clôturer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-4 p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            <strong>Note :</strong> Ces transactions ont été validées par un auditeur et sont prêtes à être clôturées. 
            Cliquez sur "Clôturer" pour finaliser chaque transaction.
          </p>
        </div>
      </CardContent>

      {/* Dialogue de clôture en masse */}
      <Dialog open={bulkCompleteDialogOpen} onOpenChange={setBulkCompleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Clôturer toutes les transactions validées
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir clôturer toutes les transactions validées ? 
              Cette action marquera ces transactions comme terminées.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-800 mb-2">Transactions qui seront clôturées :</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="text-sm text-green-700">
                    <span className="font-medium">{transaction.id}</span> - {getTypeLabel(transaction.type)} - {formatAmount(transaction.amount, transaction.currency)}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCompleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={confirmBulkComplete}
              disabled={isBulkCompleting}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {isBulkCompleting ? "Clôture..." : `Clôturer ${transactions.length} transaction(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
