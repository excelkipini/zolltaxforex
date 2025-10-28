"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Download,
  Eye,
  Calendar,
  User,
  Building,
  Globe
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

type RiaTransaction = {
  id: string
  sc_numero_transfert: string
  pin?: string
  mode_livraison?: string
  guichetier: string
  succursale: string
  code_agence: string
  sent_amount: number
  sending_currency: string
  pays_origine?: string
  pays_destination?: string
  montant_paiement?: number
  devise_beneficiaire?: string
  commission_sa: number
  devise_commission_sa: string
  date_operation: string
  taux?: number
  ttf: number
  cte: number
  tva1: number
  montant_a_payer?: number
  frais_client?: number
  action: 'Envoyé' | 'Payé' | 'Annulé' | 'Remboursé' | 'En attente'
  created_at: string
  updated_at: string
}

interface RiaTransactionsViewProps {
  initialData?: {
    transactions: RiaTransaction[]
    count: number
    filters: any
  }
}

export function RiaTransactionsView({ initialData }: RiaTransactionsViewProps) {
  const { toast } = useToast()
  const [transactions, setTransactions] = useState<RiaTransaction[]>(initialData?.transactions || [])
  const [loading, setLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(initialData?.count || 0)
  
  // Filtres
  const [filters, setFilters] = useState({
    dateFrom: "",
    dateTo: "",
    guichetier: "all",
    agence: "all",
    action: "all",
    paysDestination: "all",
    search: ""
  })

  // Options pour les filtres
  const [filterOptions, setFilterOptions] = useState({
    agences: [] as { id: string; name: string }[],
    guichetiers: [] as { id: string; name: string }[],
    paysDestinations: [] as { id: string; name: string }[],
    actions: [
      { id: "Envoyé", name: "Envoyé" },
      { id: "Payé", name: "Payé" },
      { id: "Annulé", name: "Annulé" },
      { id: "Remboursé", name: "Remboursé" },
      { id: "En attente", name: "En attente" }
    ]
  })

  const fetchTransactions = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "all") params.append(key, value)
      })

      const response = await fetch(`/api/ria-transactions?${params}`)
      if (!response.ok) throw new Error("Erreur lors du chargement des transactions")
      
      const data = await response.json()
      setTransactions(data.data.transactions)
      setTotalCount(data.data.count)
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

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch('/api/ria-dashboard')
      if (response.ok) {
        const data = await response.json()
        setFilterOptions(prev => ({
          ...prev,
          ...data.data.filters,
          // Garder les actions définies localement
          actions: prev.actions
        }))
      }
    } catch (error) {
      console.error('Erreur lors du chargement des options de filtre:', error)
    }
  }

  useEffect(() => {
    if (!initialData) {
      fetchFilterOptions()
      fetchTransactions()
    }
  }, [])

  useEffect(() => {
    if (!initialData) {
      fetchTransactions()
    }
  }, [filters])

  const formatCurrency = (amount: number, currency: string = 'XAF') => {
    return amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ' + currency
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: fr })
  }

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'Envoyé': return 'default'
      case 'Payé': return 'secondary'
      case 'Annulé': return 'destructive'
      case 'Remboursé': return 'outline'
      case 'En attente': return 'secondary'
      default: return 'outline'
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      dateFrom: "",
      dateTo: "",
      guichetier: "all",
      agence: "all",
      action: "all",
      paysDestination: "all",
      search: ""
    })
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions RIA</h1>
          <p className="text-gray-600">
            {totalCount} transaction(s) trouvée(s)
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={fetchTransactions} disabled={loading}>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Recherche</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Numéro de transfert, guichetier..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date de début</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date de fin</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Action</label>
              <Select value={filters.action} onValueChange={(value) => handleFilterChange('action', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les actions</SelectItem>
                  {filterOptions.actions?.map(action => (
                    <SelectItem key={action.id} value={action.id}>
                      {action.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Agence</label>
              <Select value={filters.agence} onValueChange={(value) => handleFilterChange('agence', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les agences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les agences</SelectItem>
                  {filterOptions.agences?.map(agence => (
                    <SelectItem key={agence.id} value={agence.name}>
                      {agence.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Guichetier</label>
              <Select value={filters.guichetier} onValueChange={(value) => handleFilterChange('guichetier', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les guichetiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les guichetiers</SelectItem>
                  {filterOptions.guichetiers?.map(guichetier => (
                    <SelectItem key={guichetier.id} value={guichetier.name}>
                      {guichetier.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Pays de destination</label>
              <Select value={filters.paysDestination} onValueChange={(value) => handleFilterChange('paysDestination', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pays</SelectItem>
                  {filterOptions.paysDestinations?.map(pays => (
                    <SelectItem key={pays.id} value={pays.name}>
                      {pays.name}
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Effacer les filtres
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table des transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro Transfert</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Guichetier</TableHead>
                <TableHead>Agence</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Pays Destination</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Chargement...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center">
                    Aucune transaction trouvée
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">
                      {transaction.sc_numero_transfert}
                    </TableCell>
                    <TableCell>
                      {formatDate(transaction.date_operation)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{transaction.guichetier}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-gray-400" />
                        <span>{transaction.succursale}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatCurrency(transaction.sent_amount, transaction.sending_currency)}
                    </TableCell>
                    <TableCell>
                      {formatCurrency(transaction.commission_sa, transaction.devise_commission_sa)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <span>{transaction.pays_destination || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(transaction.action)}>
                        {transaction.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
