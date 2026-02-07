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
  Globe,
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

  // --- Export CSV ---
  const handleExportCsv = () => {
    if (transactions.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune transaction à exporter.", variant: "destructive" })
      return
    }
    try {
      const headers = ["N° Transfert","Date","Guichetier","Agence","Montant","Devise","Commission","Devise comm.","Pays destination","Action","TTF","CTE","TVA"]
      const rows = transactions.map(t => [
        t.sc_numero_transfert,
        `"${formatDate(t.date_operation)}"`,
        `"${t.guichetier}"`,
        `"${t.succursale}"`,
        t.sent_amount,
        t.sending_currency,
        t.commission_sa,
        t.devise_commission_sa,
        `"${t.pays_destination || ""}"`,
        `"${t.action}"`,
        t.ttf,
        t.cte,
        t.tva1
      ])
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ria-transactions-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: "Export CSV réussi", description: `${transactions.length} transactions exportées.` })
    } catch {
      toast({ title: "Erreur d'export", description: "Impossible d'exporter les données.", variant: "destructive" })
    }
  }

  // --- Export PDF ---
  const handleExportPdf = () => {
    if (transactions.length === 0) {
      toast({ title: "Aucune donnée", description: "Aucune transaction à exporter.", variant: "destructive" })
      return
    }
    try {
      const fmt = (n: number) => n.toLocaleString("fr-FR")
      const totalAmount = transactions.reduce((s, t) => s + t.sent_amount, 0)
      const totalCommission = transactions.reduce((s, t) => s + t.commission_sa, 0)
      const filterInfo: string[] = []
      if (filters.dateFrom || filters.dateTo) filterInfo.push(`Période : ${filters.dateFrom || "..."} au ${filters.dateTo || "..."}`)
      if (filters.agence !== "all") filterInfo.push(`Agence : ${filters.agence}`)
      if (filters.guichetier !== "all") filterInfo.push(`Guichetier : ${filters.guichetier}`)
      if (filters.action !== "all") filterInfo.push(`Action : ${filters.action}`)
      if (filters.paysDestination !== "all") filterInfo.push(`Pays : ${filters.paysDestination}`)

      const actionColors: Record<string, string> = { "Envoyé": "#2563eb", "Payé": "#10b981", "Annulé": "#ef4444", "Remboursé": "#f59e0b", "En attente": "#64748b" }

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transactions RIA</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #2563eb;margin-bottom:10px}
.header h1{font-size:18px;color:#1e3a5f;font-weight:700}.header .sub{font-size:11px;color:#64748b;margin-top:2px}
.header .meta{text-align:right;font-size:10px;color:#64748b}
.filters{font-size:9px;color:#64748b;margin-bottom:10px}.filters span{background:#eff6ff;color:#2563eb;padding:2px 6px;border-radius:3px;margin-right:4px}
.cards{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;min-width:130px}
.card .label{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}.card .val{font-size:15px;font-weight:700;color:#1e293b;margin-top:2px}
table{width:100%;border-collapse:collapse}
thead th{background:#1e3a5f;color:#fff;padding:6px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase}
thead th:first-child{border-radius:4px 0 0 0}thead th:last-child{border-radius:0 4px 0 0}
tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:5px 6px;font-size:9px}.r{text-align:right;font-weight:600}
.status{display:inline-block;padding:2px 8px;border-radius:10px;font-size:8px;font-weight:600;color:#fff}
.footer{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>ZOLL TAX FOREX</h1><div class="sub">Transactions RIA</div></div>
<div class="meta">Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div></div>
${filterInfo.length ? `<div class="filters">Filtres : ${filterInfo.map(f=>`<span>${f}</span>`).join("")}</div>` : ""}
<div class="cards">
<div class="card"><div class="label">Transactions</div><div class="val">${fmt(transactions.length)}</div></div>
<div class="card"><div class="label">Montant total</div><div class="val">${fmt(totalAmount)} XAF</div></div>
<div class="card"><div class="label">Commissions totales</div><div class="val">${fmt(totalCommission)} XAF</div></div>
</div>
<table><thead><tr><th>#</th><th>N° Transfert</th><th>Date</th><th>Guichetier</th><th>Agence</th><th style="text-align:right">Montant</th><th style="text-align:right">Commission</th><th>Pays dest.</th><th>Action</th></tr></thead>
<tbody>${transactions.map((t,i)=>`<tr><td>${i+1}</td><td style="font-size:8px">${t.sc_numero_transfert}</td><td>${formatDate(t.date_operation)}</td><td>${t.guichetier}</td><td>${t.succursale}</td><td class="r">${fmt(t.sent_amount)} ${t.sending_currency}</td><td class="r">${fmt(t.commission_sa)} ${t.devise_commission_sa}</td><td>${t.pays_destination||"-"}</td><td><span class="status" style="background:${actionColors[t.action]||"#64748b"}">${t.action}</span></td></tr>`).join("")}</tbody></table>
<div class="footer"><span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span><span>${fmt(transactions.length)} transactions • Total : ${fmt(totalAmount)} XAF</span></div>
</body></html>`
      const w = window.open("", "_blank")
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
      toast({ title: "Export PDF prêt", description: `${transactions.length} transactions prêtes à imprimer.` })
    } catch {
      toast({ title: "Erreur d'export", description: "Impossible de générer le PDF.", variant: "destructive" })
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exporter
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExportCsv} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Exporter en CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                Exporter en PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
