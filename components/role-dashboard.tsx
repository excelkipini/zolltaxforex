"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  TrendingUp,
  Users,
  Building2,
  CreditCard,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  FileText,
} from "lucide-react"
import type { SessionUser } from "@/lib/auth-client"
import { getRoleDisplayName } from "@/lib/rbac"
import { AuditorPendingTransactions } from "./views/auditor-pending-transactions"
import { CashierDashboard } from "./views/cashier-dashboard"
import { AccountingDashboard } from "./views/accounting-dashboard"
import { AuditorDashboard } from "./views/auditor-dashboard"
import ExecutorDashboard from "./views/executor-dashboard"
import { useExchangeRates } from "@/hooks/use-exchange-rates"
import { useDocumentTitle } from "@/hooks/use-document-title"

interface RoleDashboardProps {
  user: SessionUser
}

export function RoleDashboard({ user }: RoleDashboardProps) {
  // Mettre à jour le titre de la page
  useDocumentTitle({ title: "Tableau de bord" })
  
  // Utiliser les taux de change dynamiques
  const { rates: exchangeRates } = useExchangeRates()

  // Si c'est un caissier, utiliser le composant spécialisé
  if (user.role === "cashier") {
    return <CashierDashboard user={user} />
  }

  // Si c'est un comptable ou un directeur, utiliser le composant spécialisé
  if (user.role === "accounting" || user.role === "director") {
    return <AccountingDashboard user={user} />
  }

  // Si c'est un auditeur, utiliser le composant spécialisé
  if (user.role === "auditor") {
    return <AuditorDashboard user={user} />
  }

  // Si c'est un exécuteur, utiliser le composant spécialisé
  if (user.role === "executor") {
    return <ExecutorDashboard user={user} />
  }

  const getDashboardContent = () => {
    switch (user.role) {

      case "director":
      case "delegate":
        return {
          title: user.role === "director" ? "Interface Directeur" : "Interface Délégué",
          subtitle: "Supervision générale",
          stats: [
            { label: "Transactions", value: "24", icon: ArrowUpRight, color: "text-blue-600" },
            {
              label: "Chiffre d'affaires",
              value: "5,420,000",
              suffix: "XAF",
              icon: DollarSign,
              color: "text-green-600",
            },
            { label: "Utilisateurs actifs", value: "15", icon: Users, color: "text-purple-600" },
            { label: "Agences", value: "3", icon: Building2, color: "text-orange-600" },
          ],
          alerts: [{ type: "info", message: "Rapport hebdomadaire disponible" }],
          recentActivity: [
            "Objectifs mensuels atteints (105%)",
            "Nouvel utilisateur: Marie Dubois",
            "Agence Nord: Performance excellente",
          ],
        }

      default:
        return {
          title: "Interface Super Admin",
          subtitle: "Administration système",
          stats: [
            { label: "Système", value: "Opérationnel", icon: CheckCircle, color: "text-green-600" },
            { label: "Utilisateurs", value: "15", icon: Users, color: "text-blue-600" },
            { label: "Agences", value: "3", icon: Building2, color: "text-purple-600" },
            { label: "Uptime", value: "99.9%", icon: TrendingUp, color: "text-green-600" },
          ],
          alerts: [{ type: "info", message: "Système fonctionnel - Aucune intervention requise" }],
          recentActivity: [
            "Sauvegarde automatique effectuée",
            "Mise à jour sécurité appliquée",
            "Nouveau certificat SSL installé",
          ],
        }
    }
  }

  const content = getDashboardContent()

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
            {content.subtitle}
          </p>
        </div>
      </div>

      {/* Alerts */}
      {content.alerts.map((alert, index) => (
        <Alert key={index} className={alert.type === "warning" ? "border-orange-200 bg-orange-50" : ""}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ))}

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {content.stats.map((stat, index) => {
          const Icon = stat.icon
          return (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stat.value}
                  {stat.suffix && <span className="text-sm text-muted-foreground ml-1">{stat.suffix}</span>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>


      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activité récente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {content.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3 w-3 text-green-600" />
                {activity}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Section spéciale pour les auditeurs : transactions en attente */}
      {user.role === "auditor" && (
        <div className="mt-6">
          <AuditorPendingTransactions user={user} />
        </div>
      )}
    </div>
  )
}
