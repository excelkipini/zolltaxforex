"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Building, 
  Upload,
  RefreshCw,
  Download,
  Filter,
  Calendar
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts"
import { RiaCsvImport } from "./ria-csv-import"
import { useToast } from "@/hooks/use-toast"
// Imports de date supprimés car non utilisés

type DashboardData = {
  // Indicateurs primaires
  montant_principal_total: number
  montant_brut: number
  total_frais: number
  remboursements: number
  versement_banque: number
  montant_a_debiter: number
  montant_en_coffre: number
  
  // Indicateurs secondaires
  commissions_ria: number
  tva_ria: number
  commissions_uba: number
  tva_uba: number
  commissions_ztf: number
  tva_ztf: number
  ca_ztf: number
  cte: number
  ttf: number
  
  // Statistiques
  nb_transactions: number
  nb_paiements: number
  nb_annulations: number
  nb_remboursements: number
  montant_moyen: number
  total_delestage: number
}

type GuichetierStats = {
  guichetier: string
  agence: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

type AgenceStats = {
  agence: string
  nb_transactions: number
  montant_total: number
  montant_moyen: number
  commissions_generes: number
}

type TimeSeriesData = {
  date: string
  transactions: number
  montant_total: number
  montant_principal: number
  commissions: number
  paiements: number
  annulations: number
  remboursements: number
  variation_transactions: number
  variation_montant: number
  delestage: number
}

// Type supprimé - PaysStats n'est plus utilisé

interface RiaDashboardProps {
  initialData?: {
    guichetierStats: GuichetierStats[]
    agenceStats: AgenceStats[]
    timeSeriesData: TimeSeriesData[]
    filters: {
      agences: { id: string; name: string }[]
      guichetiers: { id: string; name: string }[]
    }
  } & DashboardData
  onImportSuccess?: () => void
}

export function RiaDashboard({ initialData, onImportSuccess }: RiaDashboardProps) {
  const { toast } = useToast()
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    montant_principal_total: initialData?.montant_principal_total || 0,
    montant_brut: initialData?.montant_brut || 0,
    total_frais: initialData?.total_frais || 0,
    remboursements: initialData?.remboursements || 0,
    versement_banque: initialData?.versement_banque || 0,
    montant_a_debiter: initialData?.montant_a_debiter || 0,
    montant_en_coffre: initialData?.montant_en_coffre || 0,
    commissions_ria: initialData?.commissions_ria || 0,
    tva_ria: initialData?.tva_ria || 0,
    commissions_uba: initialData?.commissions_uba || 0,
    tva_uba: initialData?.tva_uba || 0,
    commissions_ztf: initialData?.commissions_ztf || 0,
    tva_ztf: initialData?.tva_ztf || 0,
    ca_ztf: initialData?.ca_ztf || 0,
    cte: initialData?.cte || 0,
    ttf: initialData?.ttf || 0,
    nb_transactions: initialData?.nb_transactions || 0,
    nb_paiements: initialData?.nb_paiements || 0,
    nb_annulations: initialData?.nb_annulations || 0,
    nb_remboursements: initialData?.nb_remboursements || 0,
    montant_moyen: initialData?.montant_moyen || 0,
    total_delestage: initialData?.total_delestage || 0
  })
  const [guichetierStats, setGuichetierStats] = useState<GuichetierStats[]>(initialData?.guichetierStats || [])
  const [agenceStats, setAgenceStats] = useState<AgenceStats[]>(initialData?.agenceStats || [])
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>(initialData?.timeSeriesData || [])
  const [filters, setFilters] = useState({
    agences: initialData?.filters.agences || [],
    guichetiers: initialData?.filters.guichetiers || []
  })
  const [loading, setLoading] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [pendingDeclarations, setPendingDeclarations] = useState<any[]>([])
  const [actionDialog, setActionDialog] = useState<{open: boolean; id: string | null; action: 'validate' | 'reject' | null}>({ open: false, id: null, action: null })
  const [actionComment, setActionComment] = useState("")
  
  // Filtres de recherche
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedAgence, setSelectedAgence] = useState("Toutes")
  const [selectedGuichetier, setSelectedGuichetier] = useState("Tous")

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      if (selectedAgence !== 'Toutes') params.append('agence', selectedAgence)
      if (selectedGuichetier !== 'Tous') params.append('guichetier', selectedGuichetier)

      const response = await fetch(`/api/ria-dashboard?${params}`)
      if (!response.ok) throw new Error("Erreur lors du chargement des données")
      
      const data = await response.json()
      setDashboardData({
        montant_principal_total: data.data.montant_principal_total || 0,
        montant_brut: data.data.montant_brut || 0,
        total_frais: data.data.total_frais || 0,
        remboursements: data.data.remboursements || 0,
        versement_banque: data.data.versement_banque || 0,
        montant_a_debiter: data.data.montant_a_debiter || 0,
        montant_en_coffre: data.data.montant_en_coffre || 0,
        commissions_ria: data.data.commissions_ria || 0,
        tva_ria: data.data.tva_ria || 0,
        commissions_uba: data.data.commissions_uba || 0,
        tva_uba: data.data.tva_uba || 0,
        commissions_ztf: data.data.commissions_ztf || 0,
        tva_ztf: data.data.tva_ztf || 0,
        ca_ztf: data.data.ca_ztf || 0,
        cte: data.data.cte || 0,
        ttf: data.data.ttf || 0,
        nb_transactions: data.data.nb_transactions || 0,
        nb_paiements: data.data.nb_paiements || 0,
        nb_annulations: data.data.nb_annulations || 0,
        nb_remboursements: data.data.nb_remboursements || 0,
        montant_moyen: data.data.montant_moyen || 0,
        total_delestage: data.data.total_delestage || 0
      })
      setGuichetierStats(data.data.guichetierStats)
      setAgenceStats(data.data.agenceStats)
      setTimeSeriesData(data.data.timeSeriesData)
      setFilters(data.data.filters)
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: `Échec du chargement: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Charger les arrêtés en attente (Responsable caisse, Directeur, Comptable)
  const loadPendingDeclarations = async () => {
    try {
      const res = await fetch('/api/ria-cash-declarations?type=pending')
      const data = await res.json()
      if (res.ok && data?.data) setPendingDeclarations(data.data)
    } catch (e) {
      // ignore
    }
  }

  useEffect(() => {
    if (!initialData) {
      fetchDashboardData()
    }
  }, [dateFrom, dateTo, selectedAgence, selectedGuichetier])

  useEffect(() => {
    loadPendingDeclarations()
  }, [])

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' XAF'
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`
  }

  // Formatage des montants
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // Couleurs pour les graphiques
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

  // Préparer les données pour les graphiques
  const guichetierChartData = guichetierStats.slice(0, 8).map(stat => ({
    name: stat.guichetier.length > 15 ? stat.guichetier.substring(0, 15) + '...' : stat.guichetier,
    fullName: stat.guichetier,
    transactions: stat.nb_transactions,
    montant: stat.montant_total,
    commissions: stat.commissions_generes
  }))

  const agenceChartData = agenceStats.map(stat => ({
    name: stat.agence.length > 15 ? stat.agence.substring(0, 15) + '...' : stat.agence,
    fullName: stat.agence,
    transactions: stat.nb_transactions,
    montant: stat.montant_total,
    commissions: stat.commissions_generes
  }))

  // Données pour le graphique en secteurs des agences
  const agencePieData = agenceStats.map((stat, index) => ({
    name: stat.agence,
    value: stat.montant_total,
    color: COLORS[index % COLORS.length]
  }))

  return (
    <div className="space-y-6">
      {/* Section Arrêtés en Attente de Validation (au-dessus du header) */}
      {pendingDeclarations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Arrêtés en Attente de Validation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingDeclarations.map((decl: any) => (
                <div key={decl.id} className="p-4 rounded-lg border flex items-center justify-between bg-gray-50">
                  <div>
                    <div className="font-semibold">{decl.guichetier}</div>
                    <div className="text-sm text-muted-foreground">
                      Date: {new Date(decl.declaration_date).toLocaleDateString('fr-FR')} | Montant brut: {new Intl.NumberFormat('fr-FR').format(decl.montant_brut)} FCFA | Délestage: {new Intl.NumberFormat('fr-FR').format(decl.total_delestage)} FCFA
                    </div>
                    {decl.delestage_comment && (
                      <div className="text-xs text-muted-foreground mt-1">Commentaire délestage: {decl.delestage_comment}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={async () => {
                        try {
                          const r = await fetch('/api/ria-cash-declarations', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: decl.id, action: 'validate', data: { comment: actionComment } })
                          })
                          const d = await r.json()
                          if (!r.ok) throw new Error(d?.error || 'Erreur validation')
                          toast({ title: 'Succès', description: "Arrêté validé avec succès." })
                          loadPendingDeclarations()
                          fetchDashboardData()
                        } catch (e: any) {
                          toast({ title: 'Erreur', description: e.message || 'Erreur lors de la validation', variant: 'destructive' })
                        }
                      }}
                    >
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        const comment = prompt('Motif du rejet (obligatoire)') || ''
                        if (!comment.trim()) return
                        try {
                          const r = await fetch('/api/ria-cash-declarations', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ id: decl.id, action: 'reject', data: { comment } })
                          })
                          const d = await r.json()
                          if (!r.ok) throw new Error(d?.error || 'Erreur rejet')
                          toast({ title: 'Rejeté', description: "Arrêté rejeté avec succès." })
                          loadPendingDeclarations()
                          fetchDashboardData()
                        } catch (e: any) {
                          toast({ title: 'Erreur', description: e.message || 'Erreur lors du rejet', variant: 'destructive' })
                        }
                      }}
                    >
                      Rejeter
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <RiaCsvImport
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportSuccess={() => {
          fetchDashboardData()
          if (onImportSuccess) {
            onImportSuccess()
          }
        }}
      />

      {/* En-tête avec actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord RIA</h1>
          <p className="text-gray-600">
            Indicateurs financiers et statistiques des opérations RIA
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importer CSV
          </Button>
          <Button variant="outline" onClick={fetchDashboardData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtres</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Date de début</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Date de fin</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agence">Agence</Label>
              <Select value={selectedAgence} onValueChange={setSelectedAgence}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une agence" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Toutes">Toutes les agences</SelectItem>
                  {filters.agences.map(agence => (
                    <SelectItem key={agence.id} value={agence.name}>
                      {agence.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guichetier">Guichetier</Label>
              <Select value={selectedGuichetier} onValueChange={setSelectedGuichetier}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un guichetier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tous">Tous les guichetiers</SelectItem>
                  {filters.guichetiers.map(guichetier => (
                    <SelectItem key={guichetier.id} value={guichetier.name}>
                      {guichetier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchDashboardData} disabled={loading} className="w-full">
                <Filter className="h-4 w-4 mr-2" />
                Appliquer
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Indicateurs principaux avec design amélioré */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Montant principal total</CardTitle>
            <div className="bg-indigo-600 p-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">{formatAmount(dashboardData.montant_principal_total)}</div>
            <p className="text-xs text-indigo-700 mt-1">Somme de Sent Amount</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-800">Total frais</CardTitle>
            <div className="bg-amber-600 p-2 rounded-lg">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-900">{formatAmount(dashboardData.total_frais)}</div>
            <p className="text-xs text-amber-700 mt-1">Somme de Commission SA</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-50 to-teal-100 border-teal-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-teal-800">Montant brut</CardTitle>
            <div className="bg-teal-600 p-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-teal-900">{formatAmount(dashboardData.montant_brut)}</div>
            <p className="text-xs text-teal-700 mt-1">Sent Amount + TTF + CTE + TVA + Frais Client</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-800">Remboursements</CardTitle>
            <div className="bg-rose-600 p-2 rounded-lg">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-900">{formatAmount(dashboardData.remboursements)}</div>
            <p className="text-xs text-rose-700 mt-1">Somme des lignes annulées ou remboursées</p>
          </CardContent>
        </Card>
      </div>

      {/* Deuxième ligne d'indicateurs avec design amélioré */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Versement banque</CardTitle>
            <div className="bg-emerald-600 p-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-900">{formatAmount(dashboardData.versement_banque)}</div>
            <p className="text-xs text-emerald-700 mt-1">Montant brut – Remboursements</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-violet-100 border-violet-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-violet-800">Montant à débiter</CardTitle>
            <div className="bg-violet-600 p-2 rounded-lg">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-violet-900">{formatAmount(dashboardData.montant_a_debiter)}</div>
            <p className="text-xs text-violet-700 mt-1">Versement banque – (Commissions ZTF + TVA ZTF + CA ZTF + TVA RIA + TTF)</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-800">Montant en coffre</CardTitle>
            <div className="bg-cyan-600 p-2 rounded-lg">
              <DollarSign className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">{formatAmount(dashboardData.montant_en_coffre)}</div>
            <p className="text-xs text-cyan-700 mt-1">Commissions ZTF + TVA ZTF + CA ZTF + TVA RIA + TTF</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Total Délestage</CardTitle>
            <div className="bg-orange-600 p-2 rounded-lg">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{formatAmount(dashboardData.total_delestage)}</div>
            <p className="text-xs text-orange-700 mt-1">Somme des délestages par guichetier</p>
          </CardContent>
        </Card>
      </div>

      {/* Répartition des commissions avec design amélioré */}
      <Card className="border-2 border-gray-200">
        <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Répartition des commissions et taxes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50 hover:bg-gray-50">
                  <TableHead className="font-semibold text-gray-700 w-1/3">Élément</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-1/3 text-right">Montant (FCFA)</TableHead>
                  <TableHead className="font-semibold text-gray-700 w-1/3">Formule de calcul</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="hover:bg-blue-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">Commission RIA</TableCell>
                  <TableCell className="text-right font-semibold text-blue-700">{formatAmount(dashboardData.commissions_ria)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Frais client × 70 / 100</TableCell>
                </TableRow>
                <TableRow className="hover:bg-blue-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">TVA RIA</TableCell>
                  <TableCell className="text-right font-semibold text-blue-700">{formatAmount(dashboardData.tva_ria)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Commission RIA × 18.9 / 100</TableCell>
                </TableRow>
                <TableRow className="hover:bg-green-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">Commission UBA</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{formatAmount(dashboardData.commissions_uba)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Frais client × 15 / 100</TableCell>
                </TableRow>
                <TableRow className="hover:bg-green-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">TVA UBA</TableCell>
                  <TableCell className="text-right font-semibold text-green-700">{formatAmount(dashboardData.tva_uba)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Commission UBA × 18.9 / 100</TableCell>
                </TableRow>
                <TableRow className="hover:bg-orange-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">Commission ZTF</TableCell>
                  <TableCell className="text-right font-semibold text-orange-700">{formatAmount(dashboardData.commissions_ztf)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Commission UBA</TableCell>
                </TableRow>
                <TableRow className="hover:bg-orange-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">CA ZTF</TableCell>
                  <TableCell className="text-right font-semibold text-orange-700">{formatAmount(dashboardData.ca_ztf)}</TableCell>
                  <TableCell className="text-sm text-gray-600">TVA UBA × 5 / 100</TableCell>
                </TableRow>
                <TableRow className="hover:bg-orange-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">TVA ZTF</TableCell>
                  <TableCell className="text-right font-semibold text-orange-700">{formatAmount(dashboardData.tva_ztf)}</TableCell>
                  <TableCell className="text-sm text-gray-600">TVA UBA – CA ZTF</TableCell>
                </TableRow>
                <TableRow className="hover:bg-purple-50 transition-colors">
                  <TableCell className="font-medium text-gray-800">CTE</TableCell>
                  <TableCell className="text-right font-semibold text-purple-700">{formatAmount(dashboardData.cte)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Sent Amount × 0.25 / 100</TableCell>
                </TableRow>
                <TableRow className="hover:bg-purple-50 transition-colors border-b-2">
                  <TableCell className="font-medium text-gray-800">TTF</TableCell>
                  <TableCell className="text-right font-semibold text-purple-700">{formatAmount(dashboardData.ttf)}</TableCell>
                  <TableCell className="text-sm text-gray-600">Sent Amount × 1.5 / 100</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Graphique de variation temporelle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Évolution des Transactions dans le Temps</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeSeriesData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée disponible pour la période sélectionnée
            </div>
          ) : (
            <div className="space-y-6">
              {/* KPI clés de la période */}
              <div>
                <h4 className="text-lg font-medium mb-4">KPI Clés de la Période</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {timeSeriesData.reduce((sum, day) => sum + day.transactions, 0)}
                    </div>
                    <div className="text-sm text-blue-600">Total Transactions</div>
                    <div className="text-xs text-gray-500">
                      Moyenne: {(timeSeriesData.reduce((sum, day) => sum + day.transactions, 0) / timeSeriesData.length).toFixed(1)}/jour
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatAmount(timeSeriesData.reduce((sum, day) => sum + day.montant_total, 0))}
                    </div>
                    <div className="text-sm text-green-600">Montant Total</div>
                    <div className="text-xs text-gray-500">
                      Moyenne: {formatAmount(timeSeriesData.reduce((sum, day) => sum + day.montant_total, 0) / timeSeriesData.length)}/jour
                    </div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {formatAmount(timeSeriesData.reduce((sum, day) => sum + day.commissions, 0))}
                    </div>
                    <div className="text-sm text-yellow-600">Commissions Générées</div>
                    <div className="text-xs text-gray-500">
                      Moyenne: {formatAmount(timeSeriesData.reduce((sum, day) => sum + day.commissions, 0) / timeSeriesData.length)}/jour
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {timeSeriesData.length > 0 ? 
                        ((timeSeriesData.reduce((sum, day) => sum + day.paiements, 0) / timeSeriesData.reduce((sum, day) => sum + day.transactions, 0)) * 100).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-purple-600">Taux de Paiement</div>
                    <div className="text-xs text-gray-500">
                      Paiements / Total Transactions
                    </div>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-indigo-600">
                      {timeSeriesData.length > 1 ? 
                        (timeSeriesData.slice(1).reduce((sum, day) => sum + day.variation_transactions, 0) / (timeSeriesData.length - 1)).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-indigo-600">Variation Moy. Transactions</div>
                    <div className="text-xs text-gray-500">
                      Moyenne des variations journalières
                    </div>
                  </div>
                  <div className="bg-pink-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-pink-600">
                      {timeSeriesData.length > 1 ? 
                        (timeSeriesData.slice(1).reduce((sum, day) => sum + day.variation_montant, 0) / (timeSeriesData.length - 1)).toFixed(1) : 0}%
                    </div>
                    <div className="text-sm text-pink-600">Variation Moy. Montant</div>
                    <div className="text-xs text-gray-500">
                      Moyenne des variations journalières
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphique combiné - Montants et Transactions */}
              <div>
                <h4 className="text-lg font-medium mb-4">Évolution des Montants et Transactions</h4>
                <ResponsiveContainer width="100%" height={500}>
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                      fontSize={12}
                    />
                    <YAxis 
                      yAxisId="montants"
                      orientation="left"
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      fontSize={12}
                      label={{ value: 'Montants (XAF)', angle: -90, position: 'insideLeft' }}
                    />
                    <YAxis 
                      yAxisId="transactions"
                      orientation="right"
                      fontSize={12}
                      label={{ value: 'Nombre de Transactions', angle: 90, position: 'insideRight' }}
                    />
                    <YAxis 
                      yAxisId="variations"
                      orientation="right"
                      yOffset={80}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                      fontSize={12}
                      label={{ value: 'Variation (%)', angle: 90, position: 'insideRight' }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                                    const isAmount = ['montant_total', 'montant_principal', 'commissions', 'delestage'].includes(name)
                        const isVariation = ['variation_transactions', 'variation_montant'].includes(name)
                        return [
                          isAmount ? formatAmount(value) : 
                          isVariation ? `${value.toFixed(1)}%` : value, 
                          name === 'montant_total' ? 'Montant Total' : 
                          name === 'montant_principal' ? 'Montant Principal' : 
                          name === 'commissions' ? 'Commissions' :
                          name === 'transactions' ? 'Total Transactions' :
                          name === 'paiements' ? 'Paiements' :
                          name === 'annulations' ? 'Annulations' :
                          name === 'remboursements' ? 'Remboursements' :
                          name === 'delestage' ? 'Délestage' :
                          name === 'variation_transactions' ? 'Variation Transactions' :
                          name === 'variation_montant' ? 'Variation Montant' : name
                        ]
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    />
                    <Legend />
                    {/* Lignes des montants (axe gauche) */}
                    <Line 
                      yAxisId="montants"
                      type="monotone" 
                      dataKey="montant_total" 
                      stroke="#0088FE" 
                      strokeWidth={3}
                      name="Montant Total"
                      dot={{ fill: '#0088FE', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      yAxisId="montants"
                      type="monotone" 
                      dataKey="montant_principal" 
                      stroke="#00C49F" 
                      strokeWidth={2}
                      name="Montant Principal"
                      dot={{ fill: '#00C49F', strokeWidth: 2, r: 3 }}
                    />
                    <Line 
                      yAxisId="montants"
                      type="monotone" 
                      dataKey="commissions" 
                      stroke="#FFBB28" 
                      strokeWidth={2}
                      name="Commissions"
                      dot={{ fill: '#FFBB28', strokeWidth: 2, r: 3 }}
                    />
                    {/* Lignes des transactions (axe droit) */}
                    <Line 
                      yAxisId="transactions"
                      type="monotone" 
                      dataKey="transactions" 
                      stroke="#8884D8" 
                      strokeWidth={3}
                      name="Total Transactions"
                      dot={{ fill: '#8884D8', strokeWidth: 2, r: 4 }}
                    />
                    <Line 
                      yAxisId="transactions"
                      type="monotone" 
                      dataKey="paiements" 
                      stroke="#82CA9D" 
                      strokeWidth={2}
                      name="Paiements"
                      dot={{ fill: '#82CA9D', strokeWidth: 2, r: 3 }}
                    />
                    <Line 
                      yAxisId="transactions"
                      type="monotone" 
                      dataKey="annulations" 
                      stroke="#FF7C7C" 
                      strokeWidth={2}
                      name="Annulations"
                      dot={{ fill: '#FF7C7C', strokeWidth: 2, r: 3 }}
                    />
                    <Line 
                      yAxisId="transactions"
                      type="monotone" 
                      dataKey="remboursements" 
                      stroke="#FFC658" 
                      strokeWidth={2}
                      name="Remboursements"
                      dot={{ fill: '#FFC658', strokeWidth: 2, r: 3 }}
                    />
                    <Line 
                      yAxisId="montants"
                      type="monotone" 
                      dataKey="delestage" 
                      stroke="#FF6B6B" 
                      strokeWidth={2}
                      name="Délestage"
                      dot={{ fill: '#FF6B6B', strokeWidth: 2, r: 3 }}
                    />
                    {/* Lignes de variation (axe des variations) */}
                    <Line 
                      yAxisId="variations"
                      type="monotone" 
                      dataKey="variation_transactions" 
                      stroke="#9C27B0" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Variation Transactions"
                      dot={{ fill: '#9C27B0', strokeWidth: 2, r: 3 }}
                    />
                    <Line 
                      yAxisId="variations"
                      type="monotone" 
                      dataKey="variation_montant" 
                      stroke="#E91E63" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Variation Montant"
                      dot={{ fill: '#E91E63', strokeWidth: 2, r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graphique des statistiques par guichetier */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Statistiques par Guichetier</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {guichetierChartData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée disponible
            </div>
          ) : (
            <div className="space-y-6">
              {/* Graphique en barres - Montants par guichetier */}
              <div>
                <h4 className="text-lg font-medium mb-4">Montants totaux par Guichetier</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={guichetierChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      fontSize={12}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatAmount(value), 
                        name === 'montant' ? 'Montant Total' : name === 'commissions' ? 'Commissions' : 'Transactions'
                      ]}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload
                        return data ? data.fullName : label
                      }}
                    />
                    <Bar dataKey="montant" fill="#0088FE" name="Montant Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Graphique en barres - Transactions par guichetier */}
              <div>
                <h4 className="text-lg font-medium mb-4">Nombre de Transactions par Guichetier</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={guichetierChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        value, 
                        name === 'transactions' ? 'Transactions' : name
                      ]}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload
                        return data ? data.fullName : label
                      }}
                    />
                    <Bar dataKey="transactions" fill="#00C49F" name="Transactions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graphiques des statistiques par agence */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building className="h-5 w-5" />
            <span>Statistiques par Agence</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agenceChartData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Aucune donnée disponible
            </div>
          ) : (
            <div className="space-y-6">
              {/* Graphique en secteurs - Répartition des montants par agence */}
              <div>
                <h4 className="text-lg font-medium mb-4">Répartition des Montants par Agence</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={agencePieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {agencePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatAmount(value), 'Montant Total']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Graphique en barres - Montants par agence */}
              <div>
                <h4 className="text-lg font-medium mb-4">Montants totaux par Agence</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agenceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis 
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                      fontSize={12}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        formatAmount(value), 
                        name === 'montant' ? 'Montant Total' : name === 'commissions' ? 'Commissions' : 'Transactions'
                      ]}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload
                        return data ? data.fullName : label
                      }}
                    />
                    <Bar dataKey="montant" fill="#FFBB28" name="Montant Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Graphique en barres - Transactions par agence */}
              <div>
                <h4 className="text-lg font-medium mb-4">Nombre de Transactions par Agence</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={agenceChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        value, 
                        name === 'transactions' ? 'Transactions' : name
                      ]}
                      labelFormatter={(label, payload) => {
                        const data = payload?.[0]?.payload
                        return data ? data.fullName : label
                      }}
                    />
                    <Bar dataKey="transactions" fill="#FF8042" name="Transactions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
