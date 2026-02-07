"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Wallet, 
  Building2, 
  PiggyBank, 
  TrendingUp, 
  Edit, 
  History,
  RefreshCw,
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  Landmark,
  BadgeDollarSign,
  Receipt,
  Download,
  FileText,
  FileSpreadsheet,
  ChevronDown
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageLoader } from "@/components/ui/page-loader"
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
  const [transactionsPage, setTransactionsPage] = React.useState(1)
  const [transactionsPerPage, setTransactionsPerPage] = React.useState(10)
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false)
  const [transferAmount, setTransferAmount] = React.useState("")
  const [transferDescription, setTransferDescription] = React.useState("")
  const [transferring, setTransferring] = React.useState(false)
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

  // Transférer des fonds de Commissions Reçus vers Compte UBA
  const handleTransferFunds = async () => {
    const amount = parseFloat(transferAmount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erreur",
        description: "Le montant doit être un nombre positif",
        variant: "destructive"
      })
      return
    }

    if (!transferDescription.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une description pour ce transfert",
        variant: "destructive"
      })
      return
    }

    // Vérifier le solde avant de soumettre
    const receiptAccount = accounts.find(a => a.account_type === "receipt_commissions")
    if (receiptAccount && amount > Number(receiptAccount.current_balance)) {
      toast({
        title: "Solde insuffisant",
        description: `Le solde de Commissions Reçus est de ${formatAmount(Number(receiptAccount.current_balance))}. Vous ne pouvez pas transférer ${formatAmount(amount)}.`,
        variant: "destructive"
      })
      return
    }

    try {
      setTransferring(true)
      const response = await fetch('/api/cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transfer-funds',
          amount,
          description: transferDescription.trim(),
          updatedBy: user.name
        })
      })

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Transfert effectué",
          description: result.message,
        })
        setTransferDialogOpen(false)
        setTransferAmount("")
        setTransferDescription("")
        await loadCashData()
      } else {
        throw new Error(result.error)
      }
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Erreur lors du transfert",
        variant: "destructive"
      })
    } finally {
      setTransferring(false)
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

      const transactionsResponse = await fetch('/api/cash?action=transactions&limit=2000')
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

  const totalPages = Math.max(1, Math.ceil(transactions.length / transactionsPerPage))
  const paginatedTransactions = transactions.slice(
    (transactionsPage - 1) * transactionsPerPage,
    transactionsPage * transactionsPerPage
  )

  React.useEffect(() => {
    if (transactions.length > 0 && (transactionsPage - 1) * transactionsPerPage >= transactions.length) {
      setTransactionsPage(1)
    }
  }, [transactions.length, transactionsPerPage, transactionsPage])

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

  const getTransTypeLabel = (t: CashTransaction) => {
    switch (t.transaction_type) {
      case "deposit": return "Dépôt"
      case "withdrawal": return "Retrait"
      case "transfer": return "Transfert"
      case "expense": return "Dépense"
      case "commission": return "Commission"
      default: return t.transaction_type
    }
  }

  const handleExportCashCsv = () => {
    if (transactions.length === 0) return
    const headers = ["Date", "Compte", "Type", "Montant", "Description", "Utilisateur"]
    const rows = transactions.map(t => [
      `"${formatDate(t.created_at)}"`,
      `"${accounts.find(a => a.account_type === t.account_type)?.account_name || t.account_type}"`,
      `"${getTransTypeLabel(t)}"`,
      t.amount,
      `"${t.description.replace(/"/g, '""')}"`,
      `"${t.created_by}"`
    ].join(","))
    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `caisse-transactions-${new Date().toISOString().split("T")[0]}.csv`
    a.style.visibility = "hidden"; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const handleExportCashPdf = () => {
    if (transactions.length === 0) return
    const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance), 0)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Caisse</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #2563eb;margin-bottom:10px}.header h1{font-size:18px;color:#1e3a5f;font-weight:700}.header .subtitle{font-size:11px;color:#64748b;margin-top:2px}.header .meta{text-align:right;font-size:10px;color:#64748b}
.summary{display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap}.summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;min-width:150px}.summary-card .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}.summary-card .value{font-size:16px;font-weight:700;color:#1e293b;margin-top:2px}
table{width:100%;border-collapse:collapse}thead th{background:#1e3a5f;color:#fff;padding:7px 8px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}thead th:first-child{border-radius:4px 0 0 0}thead th:last-child{border-radius:0 4px 0 0}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:6px 8px;font-size:10px;vertical-align:middle}.amount{font-weight:600;text-align:right;white-space:nowrap}
.footer{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>ZOLL TAX FOREX</h1><div class="subtitle">Historique des Transactions de la Caisse</div></div><div class="meta">Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}<br/>Par : ${user.name}</div></div>
<div class="summary">
<div class="summary-card"><div class="label">Solde total</div><div class="value">${totalBalance.toLocaleString("fr-FR")} FCFA</div></div>
<div class="summary-card"><div class="label">Comptes actifs</div><div class="value">${accounts.filter(a => Number(a.current_balance) > 0).length}</div></div>
<div class="summary-card"><div class="label">Transactions</div><div class="value">${transactions.length}</div></div>
</div>
<table><thead><tr><th>#</th><th>Date</th><th>Compte</th><th>Type</th><th>Montant</th><th>Description</th><th>Utilisateur</th></tr></thead>
<tbody>${transactions.map((t, i) => {
      const isCredit = t.transaction_type === 'deposit' || t.transaction_type === 'commission' || (t.transaction_type === 'transfer' && t.account_type === 'uba')
      return `<tr><td>${i+1}</td><td>${formatDate(t.created_at)}</td><td>${accounts.find(a => a.account_type === t.account_type)?.account_name || t.account_type}</td><td>${getTransTypeLabel(t)}</td><td class="amount" style="color:${isCredit ? '#10b981' : '#ef4444'}">${isCredit ? '+' : '-'}${Number(t.amount).toLocaleString("fr-FR")} FCFA</td><td>${t.description}</td><td>${t.created_by}</td></tr>`
    }).join("")}</tbody></table>
<div class="footer"><span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span><span>${transactions.length} enregistrements</span></div>
</body></html>`
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
  }

  // Configuration visuelle par type de compte
  const accountConfig: Record<string, { icon: React.ReactNode; gradient: string; iconBg: string; textColor: string; label: string }> = {
    coffre: {
      icon: <PiggyBank className="h-5 w-5" />,
      gradient: "from-amber-500/10 via-orange-500/5 to-transparent",
      iconBg: "bg-amber-100 text-amber-700",
      textColor: "text-amber-700",
      label: "Espèces"
    },
    commissions: {
      icon: <BadgeDollarSign className="h-5 w-5" />,
      gradient: "from-purple-500/10 via-violet-500/5 to-transparent",
      iconBg: "bg-purple-100 text-purple-700",
      textColor: "text-purple-700",
      label: "Transferts d'argent"
    },
    receipt_commissions: {
      icon: <Receipt className="h-5 w-5" />,
      gradient: "from-indigo-500/10 via-blue-500/5 to-transparent",
      iconBg: "bg-indigo-100 text-indigo-700",
      textColor: "text-indigo-700",
      label: "Transfert International"
    },
    ecobank: {
      icon: <Landmark className="h-5 w-5" />,
      gradient: "from-emerald-500/10 via-green-500/5 to-transparent",
      iconBg: "bg-emerald-100 text-emerald-700",
      textColor: "text-emerald-700",
      label: "Banque"
    },
    uba: {
      icon: <Building2 className="h-5 w-5" />,
      gradient: "from-blue-500/10 via-sky-500/5 to-transparent",
      iconBg: "bg-blue-100 text-blue-700",
      textColor: "text-blue-700",
      label: "Banque"
    },
  }

  // Obtenir l'icône pour le type de compte (pour le tableau historique)
  const getAccountIcon = (accountType: string) => {
    return accountConfig[accountType]?.icon || <Wallet className="h-5 w-5" />
  }

  // Obtenir la couleur pour le type de compte (pour le tableau historique)
  const getAccountColor = (accountType: string) => {
    return accountConfig[accountType]?.textColor || "text-gray-600"
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

    // Empêcher la mise à jour manuelle pour les comptes dérivés
    if (selectedAccount.account_type === 'commissions' || selectedAccount.account_type === 'receipt_commissions' || selectedAccount.account_type === 'ria_excedents') {
      toast({
        title: "Action non autorisée",
        description: "Ce compte est calculé automatiquement. Utilisez la réconciliation pour mettre à jour le solde.",
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
        <PageLoader message="Chargement des données de caisse..." overlay={false} />
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

  // Calcul du solde total
  const totalBalance = accounts
    .filter((a) => a.account_type !== "ria_excedents")
    .reduce((sum, a) => sum + Number(a.current_balance), 0)

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion de la Caisse</h1>
          <p className="text-muted-foreground mt-1">Suivi et gestion des soldes des comptes bancaires et du coffre</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button 
            onClick={() => setTransferDialogOpen(true)} 
            className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md"
          >
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            Transfert de fonds
          </Button>
          <Button onClick={handleSyncCommissions} variant="outline" size="sm" disabled={syncing}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync...' : 'Sync commissions'}
          </Button>
          <Button onClick={handleSyncReceiptCommissions} variant="outline" size="sm" disabled={syncingReceipts}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncingReceipts ? 'animate-spin' : ''}`} />
            {syncingReceipts ? 'Sync...' : 'Sync reçus'}
          </Button>
          <Button onClick={loadCashData} variant="outline" size="sm">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Solde global */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-100 font-medium">Solde total de la caisse</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">{formatAmount(totalBalance)}</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
            <Wallet className="h-6 w-6 text-white" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-blue-200">
          <span>{accounts.filter(a => a.account_type !== "ria_excedents").length} comptes actifs</span>
          <span>•</span>
          <span>Dernière mise à jour: {formatDate(accounts.reduce((latest, a) => a.last_updated > latest ? a.last_updated : latest, accounts[0]?.last_updated || ""))}</span>
        </div>
      </div>

      {/* Comptes */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comptes & Caisses</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {accounts
            .filter((a) => a.account_type !== "ria_excedents")
            .sort((a, b) => {
              const order: Record<string, number> = {
                coffre: 0,
                commissions: 1,
                receipt_commissions: 2,
                ecobank: 3,
                uba: 4,
              }
              return (order[a.account_type] ?? 99) - (order[b.account_type] ?? 99)
            })
            .map((account) => {
              const config = accountConfig[account.account_type] || {
                icon: <Wallet className="h-5 w-5" />,
                gradient: "from-gray-500/10 to-transparent",
                iconBg: "bg-gray-100 text-gray-700",
                textColor: "text-gray-700",
                label: ""
              }
              const isAutoCalculated = account.account_type === 'commissions' || account.account_type === 'receipt_commissions' || account.account_type === 'ria_excedents'
              
              return (
                <div 
                  key={account.id} 
                  className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${config.gradient} bg-white p-4 shadow-sm hover:shadow-md transition-all duration-200`}
                >
                  {/* En-tête carte */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`h-10 w-10 rounded-lg ${config.iconBg} flex items-center justify-center shadow-sm`}>
                      {config.icon}
                    </div>
                    {!isAutoCalculated && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdateBalance(account)}
                        className="h-7 w-7 p-0 hover:bg-black/5"
                      >
                        <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    )}
                    {isAutoCalculated && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">Auto</Badge>
                    )}
                  </div>

                  {/* Nom du compte */}
                  <p className="text-sm font-semibold text-foreground leading-tight">{account.account_name}</p>
                  {config.label && (
                    <p className={`text-[11px] ${config.textColor} font-medium mt-0.5`}>{config.label}</p>
                  )}

                  {/* Solde */}
                  <p className="text-xl font-bold mt-2 tracking-tight">{formatAmount(Number(account.current_balance))}</p>

                  {/* Date de mise à jour */}
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Mis à jour {formatDate(account.last_updated)}
                  </p>
                </div>
              )
            })}
        </div>
      </div>

      {/* Historique des transactions avec pagination */}
      <Card className="shadow-sm">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-5 w-5 text-muted-foreground" />
              Historique des transactions
            </CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs px-2.5">
                    <Download className="h-3.5 w-3.5" />
                    Exporter
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={handleExportCashCsv} className="gap-2 cursor-pointer text-xs">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Exporter en CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportCashPdf} className="gap-2 cursor-pointer text-xs">
                    <FileText className="h-4 w-4 text-red-500" />
                    Exporter en PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge variant="secondary" className="font-normal">
                {transactions.length} opération{transactions.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </div>
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
              {paginatedTransactions.map((transaction) => (
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
                      || (transaction.transaction_type === 'transfer' && transaction.account_type === 'uba')
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {transaction.transaction_type === 'deposit' || transaction.transaction_type === 'commission'
                      || (transaction.transaction_type === 'transfer' && transaction.account_type === 'uba')
                      ? '+' : '-'}
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

          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="h-8 w-8 mx-auto mb-2" />
              <p>Aucune transaction enregistrée</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Éléments par page:</Label>
                <Select
                  value={String(transactionsPerPage)}
                  onValueChange={(v) => {
                    setTransactionsPerPage(Number(v))
                    setTransactionsPage(1)
                  }}
                >
                  <SelectTrigger className="w-[80px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                Affichage de {transactions.length === 0 ? 0 : (transactionsPage - 1) * transactionsPerPage + 1} à{" "}
                {Math.min(transactionsPage * transactionsPerPage, transactions.length)} sur{" "}
                {transactions.length} opérations
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransactionsPage((p) => Math.max(1, p - 1))}
                  disabled={transactionsPage <= 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransactionsPage((p) => p + 1)}
                  disabled={transactionsPage >= totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
                disabled={selectedAccount?.account_type === 'commissions' || selectedAccount?.account_type === 'receipt_commissions' || selectedAccount?.account_type === 'ria_excedents'}
              />
              {(selectedAccount?.account_type === 'commissions' || selectedAccount?.account_type === 'receipt_commissions' || selectedAccount?.account_type === 'ria_excedents') && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ce compte est calculé automatiquement. Lancez une réconciliation pour le rafraîchir.
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">Description de la modification</Label>
              <Input
                id="description"
                value={updateDescription}
                onChange={(e) => setUpdateDescription(e.target.value)}
                placeholder="Ex: Ajustement de solde, dépôt initial..."
                disabled={selectedAccount?.account_type === 'commissions' || selectedAccount?.account_type === 'receipt_commissions' || selectedAccount?.account_type === 'ria_excedents'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={confirmUpdateBalance}
              disabled={updating || !newBalance || !updateDescription.trim() || (selectedAccount?.account_type === 'commissions' || selectedAccount?.account_type === 'receipt_commissions' || selectedAccount?.account_type === 'ria_excedents')}
            >
              {updating ? "Mise à jour..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de transfert de fonds */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
              Transfert de fonds
            </DialogTitle>
            <DialogDescription>
              Transférer un montant de la caisse <strong>Commissions Reçus</strong> vers le <strong>Compte UBA</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Aperçu des soldes */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                <p className="text-xs font-medium text-indigo-600 mb-1">Commissions Reçus</p>
                <p className="text-lg font-bold text-indigo-900">
                  {formatAmount(accounts.find(a => a.account_type === "receipt_commissions")?.current_balance ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                <p className="text-xs font-medium text-blue-600 mb-1">Compte UBA</p>
                <p className="text-lg font-bold text-blue-900">
                  {formatAmount(accounts.find(a => a.account_type === "uba")?.current_balance ?? 0)}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="transfer-amount">Montant à transférer (XAF) *</Label>
              <Input
                id="transfer-amount"
                type="number"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0"
                min="1"
                step="1"
                className="mt-1"
              />
              {transferAmount && !isNaN(parseFloat(transferAmount)) && parseFloat(transferAmount) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatAmount(parseFloat(transferAmount))} sera transféré
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="transfer-description">Description *</Label>
              <Input
                id="transfer-description"
                value={transferDescription}
                onChange={(e) => setTransferDescription(e.target.value)}
                placeholder="Ex: Versement commissions vers UBA"
                className="mt-1"
              />
            </div>

            {/* Aperçu après transfert */}
            {transferAmount && !isNaN(parseFloat(transferAmount)) && parseFloat(transferAmount) > 0 && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Aperçu après transfert</p>
                <div className="flex justify-between text-sm">
                  <span>Commissions Reçus :</span>
                  <span className={`font-medium ${
                    Number(accounts.find(a => a.account_type === "receipt_commissions")?.current_balance ?? 0) - parseFloat(transferAmount) < 0 
                      ? "text-red-600" 
                      : "text-gray-900"
                  }`}>
                    {formatAmount(Number(accounts.find(a => a.account_type === "receipt_commissions")?.current_balance ?? 0) - parseFloat(transferAmount))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Compte UBA :</span>
                  <span className="font-medium text-green-700">
                    {formatAmount(Number(accounts.find(a => a.account_type === "uba")?.current_balance ?? 0) + parseFloat(transferAmount))}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleTransferFunds}
              disabled={transferring || !transferAmount || !transferDescription.trim()}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white"
            >
              {transferring ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Transfert en cours...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Confirmer le transfert
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
