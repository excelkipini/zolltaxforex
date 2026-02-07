"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { 
  ArrowUpRight, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  AlertTriangle,
  Activity,
  Send,
  ArrowLeftRight,
  Banknote,
  Clock,
  Receipt
} from "lucide-react"
import { SessionUser } from "@/lib/auth"
import { getRoleDisplayName } from "@/lib/rbac"
import { CashierPendingTransactions } from "./cashier-validated-transactions"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { useExchangeRates } from "@/hooks/use-exchange-rates"

interface CashierDashboardProps {
  user: SessionUser
}

export function CashierDashboard({ user }: CashierDashboardProps) {
  // Mettre à jour le titre de la page
  useDocumentTitle({ title: "Tableau de bord Caissier" })
  
  // Utiliser les taux de change dynamiques
  const { rates: exchangeRates, loading: ratesLoading } = useExchangeRates()
  
  const [stats, setStats] = React.useState({
    totalOperations: 0,
    pendingOperations: 0,
    validatedOperations: 0,
    completedOperations: 0,
    rejectedOperations: 0,
    operationsInProgress: 0,
    totalAmount: 0
  })
  const [loading, setLoading] = React.useState(true)

  // Charger les statistiques depuis l'API
  React.useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/transactions')
        const data = await response.json()
        
        if (response.ok && data?.ok && Array.isArray(data.data)) {
          // Convertir les montants en nombres comme dans transactions-view.tsx
          const apiTransactions = data.data.map((item: any) => ({
            ...item,
            amount: Number(item.amount), // Convertir en nombre
            details: typeof item.details === 'string' ? JSON.parse(item.details) : item.details
          }))
          
          const transactions = apiTransactions.filter(t => t.created_by === user.name)
          
          const totalOperations = transactions.length
          const pendingOperations = transactions.filter(t => t.status === 'pending').length
          const validatedOperations = transactions.filter(t => t.status === 'validated').length
          const completedOperations = transactions.filter(t => t.status === 'completed').length
          const rejectedOperations = transactions.filter(t => t.status === 'rejected').length
          
          // Opérations en cours de traitement = en attente + validées
          const operationsInProgress = pendingOperations + validatedOperations
          
          const completedTransactions = transactions.filter(t => t.status === 'completed')
          const totalAmount = completedTransactions.reduce((sum, t) => sum + t.amount, 0)
          
          setStats({
            totalOperations,
            pendingOperations,
            validatedOperations,
            completedOperations,
            rejectedOperations,
            operationsInProgress,
            totalAmount
          })
        }
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [user.name])

  const formatAmount = (amount: number) => {
    return amount.toLocaleString("fr-FR")
  }

  const statsCards = [
    { 
      label: "Opérations", 
      value: stats.totalOperations.toString(), 
      icon: Activity, 
      color: "text-blue-600" 
    },
    { 
      label: "En attente", 
      value: stats.pendingOperations.toString(), 
      icon: Clock, 
      color: "text-yellow-600" 
    },
    { 
      label: "Validées", 
      value: stats.validatedOperations.toString(), 
      icon: CheckCircle, 
      color: "text-orange-600" 
    },
    { 
      label: "Terminées", 
      value: stats.completedOperations.toString(), 
      icon: CheckCircle, 
      color: "text-emerald-600" 
    },
    { 
      label: "Rejetées", 
      value: stats.rejectedOperations.toString(), 
      icon: XCircle, 
      color: "text-red-600" 
    },
    { 
      label: "Montant total", 
      value: formatAmount(stats.totalAmount), 
      suffix: "XAF", 
      icon: DollarSign, 
      color: "text-purple-600" 
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bonjour, {user.name} 👋</h1>
          <p className="text-muted-foreground">
            <Badge variant="secondary" className="mr-2">
              {getRoleDisplayName(user.role)}
            </Badge>
            Opérations quotidiennes
          </p>
        </div>
      </div>

      {/* Alerts */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {stats.operationsInProgress > 0 
            ? `${stats.operationsInProgress} opération(s) en cours de traitement`
            : "Aucune opération en cours"
          }
        </AlertDescription>
      </Alert>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statsCards.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? "..." : stat.value}
                  {stat.suffix && <span className="text-sm text-muted-foreground ml-1">{stat.suffix}</span>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Taux de change actuels (Achat / Vente) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Taux de change actuels
          </CardTitle>
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
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/reception">
                <ArrowLeftRight className="h-6 w-6" />
                <span className="text-sm">Réception/Envoi</span>
              </a>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/transfer">
                <Send className="h-6 w-6" />
                <span className="text-sm">Transfert d'argent</span>
              </a>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/exchange">
                <Banknote className="h-6 w-6" />
                <span className="text-sm">Bureau de change</span>
              </a>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/expenses">
                <Receipt className="h-6 w-6" />
                <span className="text-sm">Nouvelle dépense</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Transactions en attente */}
      <CashierPendingTransactions user={user} />
    </div>
  )
}
