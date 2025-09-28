"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Download, TrendingUp, DollarSign, Users, BarChart3, PieChart } from "lucide-react"
import { ActionGuard } from "@/components/permission-guard"
import type { SessionUser } from "@/lib/auth"

interface ReportsViewProps {
  user: SessionUser
}

export function ReportsView({ user }: ReportsViewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState("month")
  const [selectedReport, setSelectedReport] = useState("financial")

  // Mock data - replace with real data
  const financialSummary = {
    revenue: 15420000,
    expenses: 2340000,
    netProfit: 13080000,
    margin: 84.8,
  }

  const kpis = {
    transactions: 1247,
    avgTransaction: 12365,
    growth: 15.3,
    activeUsers: 89,
  }

  const reportTypes = [
    {
      id: "financial",
      title: "Rapport Financier",
      description: "Revenus, dépenses et bénéfices",
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      id: "operational",
      title: "Rapport Opérationnel",
      description: "Transactions et activités",
      icon: BarChart3,
      color: "text-blue-600",
    },
    {
      id: "audit",
      title: "Rapport d'Audit",
      description: "Contrôles et conformité",
      icon: FileText,
      color: "text-purple-600",
    },
    {
      id: "performance",
      title: "Rapport Performance",
      description: "KPIs et indicateurs",
      icon: TrendingUp,
      color: "text-orange-600",
    },
  ]

  const quickReports =
    user.role === "accounting"
      ? [
          { title: "Rapport Financier Mensuel", description: "Synthèse comptable complète", action: "Générer" },
          { title: "Analyse des Dépenses", description: "Détail par catégorie", action: "Analyser" },
          { title: "Évolution du CA", description: "Tendances et projections", action: "Consulter" },
        ]
      : user.role === "director" || user.role === "delegate"
        ? [
            { title: "Tableau de Bord Exécutif", description: "Vue d'ensemble stratégique", action: "Générer" },
            { title: "Performance par Agence", description: "Comparatif des agences", action: "Analyser" },
            { title: "Rapport Mensuel DG", description: "Synthèse pour direction", action: "Consulter" },
          ]
        : [
            { title: "Rapport Standard", description: "Vue d'ensemble des activités", action: "Consulter" },
            { title: "Historique Transactions", description: "Détail des opérations", action: "Exporter" },
          ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rapports et Analyses</h1>
          <p className="text-gray-600 mt-1">
            {user.role === "accounting"
              ? "Rapports financiers et comptables"
              : user.role === "director" || user.role === "delegate"
                ? "Rapports de direction et supervision"
                : "Consultation des rapports"}
          </p>
        </div>
        <ActionGuard user={user} permission="reports:export">
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Nouveau rapport
          </Button>
        </ActionGuard>
      </div>

      {/* Quick Actions for Accounting */}
      {user.role === "accounting" && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <CardTitle className="text-green-700">Actions Rapides Comptables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickReports.map((report, index) => (
                <Button key={index} variant="outline" className="h-auto p-4 justify-start bg-transparent">
                  <div className="text-left">
                    <div className="font-medium">{report.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{report.description}</div>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Revenus
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{financialSummary.revenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">XAF ce mois</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-red-600" />
              Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{financialSummary.expenses.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">XAF ce mois</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Bénéfice Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{financialSummary.netProfit.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">XAF ce mois</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PieChart className="h-4 w-4 text-purple-600" />
              Marge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{financialSummary.margin}%</div>
            <p className="text-xs text-muted-foreground">Marge bénéficiaire</p>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Transactions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.transactions}</div>
            <p className="text-xs text-muted-foreground">Ce mois</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Montant Moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgTransaction.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">XAF par transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Croissance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">+{kpis.growth}%</div>
            <p className="text-xs text-muted-foreground">vs mois précédent</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Utilisateurs Actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.activeUsers}</div>
            <p className="text-xs text-muted-foreground">Cette semaine</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Generation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Génération de Rapports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedReport} onValueChange={setSelectedReport}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Type de rapport" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                  <SelectItem value="quarter">Ce trimestre</SelectItem>
                  <SelectItem value="year">Cette année</SelectItem>
                </SelectContent>
              </Select>

              <ActionGuard user={user} permission="reports:export">
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Générer
                </Button>
              </ActionGuard>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {reportTypes.map((type) => {
                const Icon = type.icon
                return (
                  <Card
                    key={type.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === type.id ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Icon className={`h-8 w-8 ${type.color}`} />
                        <div>
                          <h3 className="font-medium">{type.title}</h3>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Rapports Récents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "Rapport Financier - Janvier 2025", date: "2025-01-14", size: "2.4 MB", type: "PDF" },
              { name: "Analyse Opérationnelle - Semaine 2", date: "2025-01-13", size: "1.8 MB", type: "Excel" },
              { name: "Audit Mensuel - Décembre 2024", date: "2025-01-10", size: "3.1 MB", type: "PDF" },
            ].map((report, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400" />
                  <div>
                    <div className="font-medium">{report.name}</div>
                    <div className="text-sm text-gray-500">
                      {report.date} • {report.size}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{report.type}</Badge>
                  <Button size="sm" variant="ghost">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
