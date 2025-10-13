"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Wallet, 
  Building2, 
  PiggyBank, 
  TrendingUp, 
  Edit, 
  History,
  RefreshCw,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

type CashAccount = {
  id: string
  account_type: "uba" | "ecobank" | "coffre" | "commissions" | "receipt_commissions"
  account_name: string
  current_balance: number
  last_updated: string
  updated_by: string
  created_at: string
}

type CashTransaction = {
  id: string
  account_type: "uba" | "ecobank" | "coffre" | "commissions" | "receipt_commissions"
  transaction_type: "deposit" | "withdrawal" | "transfer" | "expense" | "commission"
  amount: number
  description: string
  reference_id?: string
  created_by: string
  created_at: string
}

interface CashManagementProps {
  user: { name: string; role: string }
}

export function CashManagement({ user }: CashManagementProps) {
  const [accounts, setAccounts] = React.useState<CashAccount[]>([])
  const [transactions, setTransactions] = React.useState<CashTransaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [updateDialogOpen, setUpdateDialogOpen] = React.useState(false)
  const [selectedAccount, setSelectedAccount] = React.useState<CashAccount | null>(null)
  const [newBalance, setNewBalance] = React.useState("")
  const [updateDescription, setUpdateDescription] = React.useState("")
  const [updating, setUpdating] = React.useState(false)
  const [syncing, setSyncing] = React.useState(false)
  const [syncingReceipts, setSyncingReceipts] = React.useState(false)
  const { toast } = useToast()

  // Synchroniser les commissions existantes
  const handleSyncCommissions = async () => {
    try {
      setSyncing(true)

      const response = await fetch('/api/cash?action=sync-commissions')
      const result = await response.json()

      if (result.success) {
        toast({
          title: "Synchronisation réussie",
          description: result.message,
        })
        
        // Recharger les données pour voir les mises à jour
        await loadCashData()
      } else {
        throw new Error(result.error)
      }

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la synchronisation: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setSyncing(false)
    }
  }

  // Synchroniser les commissions des reçus existants
  const handleSyncReceiptCommissions = async () => {
    try {
      setSyncingReceipts(true)

      const response = await fetch('/api/cash?action=sync-receipt-commissions')
      const result = await response.json()

      if (result.success) {
        toast({
          title: "Synchronisation réussie",
          description: result.message,
        })
        
        // Recharger les données pour voir les mises à jour
        await loadCashData()
      } else {
        throw new Error(result.error)
      }

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la synchronisation des commissions des reçus: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setSyncingReceipts(false)
    }
  }

  // Charger les données de caisse
  const loadCashData = async () => {
    try {
      setLoading(true)
      
      // Charger les comptes
      const accountsResponse = await fetch('/api/cash?action=accounts')
      const accountsData = await accountsResponse.json()
      
      if (accountsData.success) {
        setAccounts(accountsData.accounts)
      }

      // Charger les transactions récentes
      const transactionsResponse = await fetch('/api/cash?action=transactions&limit=20')
      const transactionsData = await transactionsResponse.json()
      
      if (transactionsData.success) {
        setTransactions(transactionsData.transactions)
      }

    } catch (error) {
      console.error('Erreur lors du chargement des données de caisse:', error)
      toast({
        title: "Erreur",
        description: "Impossible de charger les données de caisse",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadCashData()
  }, [])

  // Formater le montant
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XAF",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  // Formater la date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("fr-FR")
  }

  // Obtenir l'icône pour le type de compte
  const getAccountIcon = (accountType: string) => {
    switch (accountType) {
      case 'uba':
        return <Building2 className="h-5 w-5" />
      case 'ecobank':
        return <Building2 className="h-5 w-5" />
      case 'coffre':
        return <PiggyBank className="h-5 w-5" />
      case 'commissions':
        return <TrendingUp className="h-5 w-5" />
      case 'receipt_commissions':
        return <TrendingUp className="h-5 w-5" />
      default:
        return <Wallet className="h-5 w-5" />
    }
  }

  // Obtenir la couleur pour le type de compte
  const getAccountColor = (accountType: string) => {
    switch (accountType) {
      case 'uba':
        return "text-blue-600"
      case 'ecobank':
        return "text-green-600"
      case 'coffre':
        return "text-orange-600"
      case 'commissions':
        return "text-purple-600"
      case 'receipt_commissions':
        return "text-indigo-600"
      default:
        return "text-gray-600"
    }
  }

  // Obtenir le badge pour le type de transaction
  const getTransactionBadge = (transactionType: string) => {
    switch (transactionType) {
      case 'deposit':
        return <Badge className="bg-green-100 text-green-800">Dépôt</Badge>
      case 'withdrawal':
        return <Badge className="bg-red-100 text-red-800">Retrait</Badge>
      case 'transfer':
        return <Badge className="bg-blue-100 text-blue-800">Transfert</Badge>
      case 'expense':
        return <Badge className="bg-orange-100 text-orange-800">Dépense</Badge>
      case 'commission':
        return <Badge className="bg-purple-100 text-purple-800">Commission</Badge>
      default:
        return <Badge variant="secondary">{transactionType}</Badge>
    }
  }

  // Traduire les types d'opération dans les descriptions
  const translateOperationType = (description: string) => {
    return description
      .replace(/cash_deposit/g, 'Dépôt espèces')
      .replace(/transfer/g, 'Transfert')
      .replace(/exchange/g, 'Bureau de change')
      .replace(/card_recharge/g, 'Recharge de carte')
      .replace(/cash_withdrawal/g, 'Retrait espèces')
      .replace(/other/g, 'Autre')
  }

  // Ouvrir le dialog de mise à jour
  const handleUpdateBalance = (account: CashAccount) => {
    setSelectedAccount(account)
    setNewBalance(account.current_balance.toString())
    setUpdateDescription("")
    setUpdateDialogOpen(true)
  }

  // Confirmer la mise à jour du solde
  const confirmUpdateBalance = async () => {
    if (!selectedAccount || !newBalance || !updateDescription.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      })
      return
    }

    const balance = parseFloat(newBalance)
    if (isNaN(balance) || balance < 0) {
      toast({
        title: "Erreur",
        description: "Le solde doit être un nombre positif",
        variant: "destructive"
      })
      return
    }

    try {
      setUpdating(true)

      const response = await fetch('/api/cash', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update-balance',
          accountType: selectedAccount.account_type,
          newBalance: balance,
          description: updateDescription.trim(),
          updatedBy: user.name
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Succès",
          description: "Solde mis à jour avec succès",
        })
        
        setUpdateDialogOpen(false)
        await loadCashData() // Recharger les données
      } else {
        throw new Error(result.error)
      }

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Erreur lors de la mise à jour: ${error.message}`,
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des données de caisse...</p>
        </div>
      </div>
    )
  }

  // Afficher un message si aucun compte n'est chargé
  if (accounts.length === 0) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gestion de la Caisse</h1>
            <p className="text-gray-600 mt-1">Suivi et gestion des soldes des comptes bancaires et du coffre</p>
          </div>
          <Button onClick={loadCashData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
        
        <div className="text-center py-8">
          <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Aucun compte de caisse trouvé</h3>
          <p className="text-gray-600 mb-4">
            Les comptes de caisse n'ont pas encore été initialisés. 
            Cliquez sur "Actualiser" pour les créer automatiquement.
          </p>
          <Button onClick={loadCashData} className="bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Initialiser les comptes
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion de la Caisse</h1>
          <p className="text-gray-600 mt-1">Suivi et gestion des soldes des comptes bancaires et du coffre</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncCommissions} variant="outline" disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronisation...' : 'Synchroniser commissions'}
          </Button>
          <Button onClick={handleSyncReceiptCommissions} variant="outline" disabled={syncingReceipts}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncingReceipts ? 'animate-spin' : ''}`} />
            {syncingReceipts ? 'Synchronisation...' : 'Synchroniser commissions reçus'}
          </Button>
          <Button onClick={loadCashData} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Statistiques des comptes */}
      <div className="grid grid-cols-5 gap-4">
        {accounts.map((account) => (
          <Card key={account.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{account.account_name}</CardTitle>
              <div className={`${getAccountColor(account.account_type)}`}>
                {getAccountIcon(account.account_type)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatAmount(account.current_balance)}</div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">
                  Mis à jour: {formatDate(account.last_updated)}
                </p>
                {account.account_type !== 'commissions' && account.account_type !== 'receipt_commissions' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpdateBalance(account)}
                    className="h-6 px-2"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Onglets pour les détails */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="transactions">Historique des transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
                Informations importantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>Compte UBA :</strong> Solde du compte bancaire UBA pour les opérations de transfert
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Compte Ecobank :</strong> Solde du compte bancaire Ecobank pour les opérations de transfert
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-800">
                  <strong>Coffre :</strong> Espèces disponibles pour les opérations courantes
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-800">
                  <strong>Commissions Transferts :</strong> Commissions générées par les transferts d'argent (≥ 10000 XAF)
                </p>
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <p className="text-sm text-indigo-800">
                  <strong>Commissions Reçus :</strong> Commissions générées par l'émission de reçus
                </p>
                <p className="text-xs text-indigo-700 mt-1">
                  Les dépenses validées par le Directeur sont automatiquement déduites du solde Commissions Reçus
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historique des transactions récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Compte</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Utilisateur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="text-sm">
                        {formatDate(transaction.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getAccountIcon(transaction.account_type)}
                          <span className="text-sm font-medium">
                            {accounts.find(a => a.account_type === transaction.account_type)?.account_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTransactionBadge(transaction.transaction_type)}
                      </TableCell>
                      <TableCell className={`font-medium ${
                        transaction.transaction_type === 'deposit' || transaction.transaction_type === 'commission' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'commission' ? '+' : '-'}
                        {formatAmount(Math.abs(transaction.amount))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {translateOperationType(transaction.description)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {transaction.created_by}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {transactions.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-8 w-8 mx-auto mb-2" />
                  <p>Aucune transaction enregistrée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de mise à jour du solde */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Mettre à jour le solde
            </DialogTitle>
            <DialogDescription>
              Modifier le solde du compte {selectedAccount?.account_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="balance">Nouveau solde (XAF)</Label>
              <Input
                id="balance"
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="0"
                min="0"
                step="1"
              />
            </div>
            <div>
              <Label htmlFor="description">Description de la modification</Label>
              <Input
                id="description"
                value={updateDescription}
                onChange={(e) => setUpdateDescription(e.target.value)}
                placeholder="Ex: Ajustement de solde, dépôt initial..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={confirmUpdateBalance}
              disabled={updating || !newBalance || !updateDescription.trim()}
            >
              {updating ? "Mise à jour..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
