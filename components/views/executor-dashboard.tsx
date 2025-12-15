"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  Upload,
  Play,
  FileText,
  User,
  FileUp
} from "lucide-react"
import { useDocumentTitle } from "@/hooks/use-document-title"

interface Transaction {
  id: string
  type: string
  status: string
  description: string
  amount: number
  currency: string
  created_by: string
  agency: string
  real_amount_eur?: number
  commission_amount?: number
  executor_id?: string
  executed_at?: string
  receipt_url?: string
  executor_comment?: string
  created_at: string
  updated_at: string
}

interface ExecutorDashboardProps {
  user: {
    id: string
    name: string
    email: string
    role: string
    agency: string
  }
}

export default function ExecutorDashboard({ user }: ExecutorDashboardProps) {
  useDocumentTitle("Tableau de Bord - Exécuteur")

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [executingTransaction, setExecutingTransaction] = useState<string | null>(null)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [executorComment, setExecutorComment] = useState("")

  const loadTransactions = async () => {
    try {
      const response = await fetch(`/api/transactions/update-real-amount?executorId=${user.id}`)
      const data = await response.json()
      // S'assurer que les montants sont des nombres (évite la concaténation de chaînes)
      // Utiliser Number() au lieu de parseInt() pour préserver les valeurs décimales
      const transactions = (data.transactions || []).map((t: any) => ({
        ...t,
        amount: typeof t.amount === 'string' ? Number(t.amount) : Number(t.amount || 0),
        commission_amount: t.commission_amount != null ? (typeof t.commission_amount === 'string' ? Number(t.commission_amount) : Number(t.commission_amount)) : undefined
      }))
      setTransactions(transactions)
    } catch (error) {
      console.error('Erreur lors du chargement des transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransactions()
  }, [user.id])

  const handleExecuteTransaction = async (transactionId: string) => {
    if (!receiptFile) {
      alert('Veuillez sélectionner un fichier de reçu')
      return
    }

    try {
      setExecutingTransaction(transactionId)
      
      // Créer un FormData pour l'upload du fichier
      // Note: executorId n'est plus nécessaire car l'API utilise l'utilisateur authentifié
      const formData = new FormData()
      formData.append('transactionId', transactionId)
      formData.append('receiptFile', receiptFile)
      if (executorComment.trim()) {
        formData.append('executorComment', executorComment.trim())
      }
      
      const response = await fetch('/api/transactions/execute', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        alert('Transaction exécutée avec succès !')
        setReceiptFile(null)
        setExecutorComment("")
        await loadTransactions() // Recharger les transactions
      } else {
        alert(`Erreur: ${data.error}`)
      }
    } catch (error) {
      console.error('Erreur lors de l\'exécution:', error)
      alert('Erreur lors de l\'exécution de la transaction')
    } finally {
      setExecutingTransaction(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-orange-100 text-orange-800"
      case "validated":
        return "bg-blue-100 text-blue-800"
      case "executed":
        return "bg-green-100 text-green-800"
      case "rejected":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "En attente"
      case "validated":
        return "Validée"
      case "executed":
        return "Exécutée"
      case "rejected":
        return "Rejetée"
      case "completed":
        return "Terminée"
      default:
        return status
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR')
  }

  // Calculer les statistiques
  const stats = {
    total: transactions.length,
    pending: transactions.filter(t => t.status === 'validated').length,
    executed: transactions.filter(t => t.status === 'executed').length,
    totalAmount: transactions
      .filter(t => t.status === 'executed')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Chargement des transactions...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tableau de Bord - Exécuteur</h1>
          <p className="text-muted-foreground">
            Bienvenue, {user.name} - {user.agency}
          </p>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Transactions</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              En attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">À exécuter</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Exécutées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.executed}</div>
            <p className="text-xs text-muted-foreground">Terminées</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-purple-600" />
              Montant total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatAmount(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">Exécuté</p>
          </CardContent>
        </Card>
      </div>

      {/* Transactions en attente d'exécution */}
      {stats.pending > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Transactions en attente d'exécution ({stats.pending})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions
                .filter(t => t.status === 'validated')
                .map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(transaction.status)}>
                          {getStatusLabel(transaction.status)}
                        </Badge>
                        <span className="font-medium">{transaction.id}</span>
                        <span className="text-sm text-muted-foreground">
                          {transaction.description}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{formatAmount(transaction.amount)}</div>
                        {transaction.commission_amount && (
                          <div className="text-sm text-green-600">
                            Commission: {formatAmount(transaction.commission_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <strong>Créé par:</strong> {transaction.created_by}
                      </div>
                      <div>
                        <strong>Agence:</strong> {transaction.agency}
                      </div>
                      <div>
                        <strong>Montant réel:</strong> {transaction.real_amount_eur} EUR
                      </div>
                      <div>
                        <strong>Date:</strong> {formatDate(transaction.created_at)}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            className="bg-green-600 hover:bg-green-700"
                            disabled={executingTransaction === transaction.id}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            {executingTransaction === transaction.id ? 'Exécution...' : 'Exécuter'}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Exécuter la transaction</DialogTitle>
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
                                onClick={() => handleExecuteTransaction(transaction.id)}
                                disabled={!receiptFile || executingTransaction === transaction.id}
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
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions exécutées */}
      {stats.executed > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Transactions exécutées ({stats.executed})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions
                .filter(t => t.status === 'executed')
                .map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(transaction.status)}>
                          {getStatusLabel(transaction.status)}
                        </Badge>
                        <span className="font-medium">{transaction.id}</span>
                        <span className="text-sm text-muted-foreground">
                          {transaction.description}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{formatAmount(transaction.amount)}</div>
                        {transaction.commission_amount && (
                          <div className="text-sm text-green-600">
                            Commission: {formatAmount(transaction.commission_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                      <div>
                        <strong>Créé par:</strong> {transaction.created_by}
                      </div>
                      <div>
                        <strong>Agence:</strong> {transaction.agency}
                      </div>
                      <div>
                        <strong>Exécuté le:</strong> {formatDate(transaction.executed_at!)}
                      </div>
                      <div>
                        <strong>Reçu:</strong> 
                        {transaction.receipt_url ? (
                          <a 
                            href={transaction.receipt_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline ml-1"
                          >
                            Voir
                          </a>
                        ) : (
                          <span className="text-red-600 ml-1">Non disponible</span>
                        )}
                      </div>
                    </div>

                    {transaction.executor_comment && (
                      <div className="bg-gray-50 p-3 rounded">
                        <strong className="text-sm">Commentaire:</strong>
                        <p className="text-sm text-muted-foreground mt-1">
                          {transaction.executor_comment}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message si aucune transaction */}
      {stats.total === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Aucune transaction assignée</h3>
            <p className="text-muted-foreground">
              Vous n'avez actuellement aucune transaction assignée à exécuter.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
