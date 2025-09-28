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
  Activity,
  TrendingUp,
  FileText,
  AlertTriangle,
} from "lucide-react"
import type { SessionUser } from "@/lib/auth-client"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { AuditorPendingTransactions } from "./auditor-pending-transactions"

interface AuditorDashboardProps {
  user: SessionUser
}

export function AuditorDashboard({ user }: AuditorDashboardProps) {
  const [loading, setLoading] = React.useState(true)
  const [stats, setStats] = React.useState({
    pendingTransactions: 0,
    validatedTransactions: 0,
    completedTransactions: 0,
    rejectedTransactions: 0,
    totalPendingAmount: 0,
  })

  // Mettre à jour le titre de la page
  useDocumentTitle({ title: "Tableau de bord Auditeur" })

  // Charger les statistiques des transactions
  const loadStats = async () => {
    try {
      const response = await fetch('/api/transactions')
      const data = await response.json()
      
      if (response.ok && data?.ok && Array.isArray(data.data)) {
        const transactions = data.data
        
        const pendingTransactions = transactions.filter((t: any) => t.status === 'pending')
        const validatedTransactions = transactions.filter((t: any) => t.status === 'validated')
        const completedTransactions = transactions.filter((t: any) => t.status === 'completed')
        const rejectedTransactions = transactions.filter((t: any) => t.status === 'rejected')
        
        const totalPendingAmount = pendingTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0)

        setStats({
          pendingTransactions: pendingTransactions.length,
          validatedTransactions: validatedTransactions.length,
          completedTransactions: completedTransactions.length,
          rejectedTransactions: rejectedTransactions.length,
          totalPendingAmount,
        })
      }
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    loadStats()
  }, [])

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
      label: "Opérations en attente", 
      value: stats.pendingTransactions.toString(), 
      icon: Clock, 
      color: "text-yellow-600",
      description: "En attente de validation"
    },
    { 
      label: "Opérations validées", 
      value: stats.validatedTransactions.toString(), 
      icon: CheckCircle, 
      color: "text-green-600",
      description: "Validées par l'auditeur"
    },
    { 
      label: "Opérations terminées", 
      value: stats.completedTransactions.toString(), 
      icon: Activity, 
      color: "text-blue-600",
      description: "Clôturées par les caissiers"
    },
    { 
      label: "Opérations rejetées", 
      value: stats.rejectedTransactions.toString(), 
      icon: XCircle, 
      color: "text-red-600",
      description: "Refusées par l'auditeur"
    }
  ]

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-6">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement du tableau de bord...</p>
        </div>
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
            Tableau de bord auditeur - Contrôle et validation des opérations
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/transactions">
              <Activity className="h-4 w-4 mr-2" />
              Voir toutes les opérations
            </a>
          </Button>
        </div>
      </div>

      {/* Section 1: Notifications des transactions en attente */}
      {stats.pendingTransactions > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <Bell className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800">
            Transactions en attente de validation
          </AlertTitle>
          <AlertDescription className="text-yellow-700">
            <strong>{stats.pendingTransactions}</strong> transaction{stats.pendingTransactions > 1 ? 's' : ''} en attente 
            pour un montant total de <strong>{formatAmount(stats.totalPendingAmount)}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Section 2: Statistiques des opérations */}
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

      {/* Section 3: Transactions en attente de validation */}
      <AuditorPendingTransactions user={user} />

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
              <a href="/transactions">
                <Activity className="h-6 w-6" />
                <span className="text-sm">Voir opérations</span>
              </a>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/expenses">
                <FileText className="h-6 w-6" />
                <span className="text-sm">Gérer dépenses</span>
              </a>
            </Button>
            
            <Button variant="outline" className="h-20 flex flex-col gap-2" asChild>
              <a href="/reports">
                <TrendingUp className="h-6 w-6" />
                <span className="text-sm">Générer rapport</span>
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
