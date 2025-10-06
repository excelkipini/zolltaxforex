"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  User,
  CreditCard,
  RefreshCw,
  DollarSign,
  Upload,
  Trash2,
  Edit,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

interface ActionHistoryEntry {
  id: string
  user_id: string
  user_name: string
  user_role: string
  action_type: string
  action_description: string
  target_card_id?: string
  target_card_cid?: string
  old_values?: any
  new_values?: any
  metadata?: any
  ip_address?: string
  user_agent?: string
  created_at: string
}

interface ActionHistoryStats {
  total_actions: number
  actions_by_type: Record<string, number>
  actions_by_user: Array<{ user_name: string; count: number }>
  recent_actions: number
}

export default function CardsHistoryPage() {
  const [actions, setActions] = React.useState<ActionHistoryEntry[]>([])
  const [stats, setStats] = React.useState<ActionHistoryStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [totalPages, setTotalPages] = React.useState(1)
  const [filters, setFilters] = React.useState({
    action_type: 'all',
    user_id: '',
    target_card_id: '',
    date_from: '',
    date_to: '',
    card_search: ''
  })
  const [sortConfig, setSortConfig] = React.useState<{
    key: string | null
    direction: 'asc' | 'desc'
  }>({ key: null, direction: 'asc' })
  const [users, setUsers] = React.useState<Array<{id: string, name: string}>>([])
  const [selectedAction, setSelectedAction] = React.useState<ActionHistoryEntry | null>(null)
  const [detailsOpen, setDetailsOpen] = React.useState(false)

  const loadHistory = async (pageNum = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '50',
        ...Object.fromEntries(Object.entries(filters).filter(([key, v]) => {
          // Ne pas filtrer action_type même si c'est "all"
          if (key === 'action_type') {
            return true
          }
          return v
        }))
      })

      const res = await fetch(`/api/cards/history?${params}`)
      const data = await res.json()

      console.log('🔍 Debug loadHistory:', {
        url: `/api/cards/history?${params}`,
        status: res.status,
        data: data
      })

      if (data.ok) {
        console.log('🔍 Debug actions:', {
          actions: data.data.actions,
          actionsLength: data.data.actions?.length,
          pagination: data.data.pagination
        })
        setActions(data.data.actions)
        setTotalPages(data.data.pagination.total_pages)
        setPage(data.data.pagination.page)
      } else {
        console.error('❌ API Error:', data.error)
      }
    } catch (error) {
      console.error('Erreur lors du chargement de l\'historique:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const res = await fetch('/api/cards/history?type=stats')
      const data = await res.json()

      if (data.ok) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error)
    }
  }

  const loadUsers = async () => {
    try {
      const res = await fetch('/api/cards/history?type=users')
      const data = await res.json()
      if (data.ok) {
        setUsers(data.data)
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error)
    }
  }

  React.useEffect(() => {
    loadHistory()
    loadStats()
    loadUsers()
  }, [])

  React.useEffect(() => {
    loadHistory(1)
  }, [filters])

  const getActionIcon = (actionType: string) => {
    const icons = {
      create: <CreditCard className="h-4 w-4 text-green-600" />,
      update: <Edit className="h-4 w-4 text-blue-600" />,
      delete: <Trash2 className="h-4 w-4 text-red-600" />,
      bulk_delete: <Trash2 className="h-4 w-4 text-red-600" />,
      recharge: <DollarSign className="h-4 w-4 text-purple-600" />,
      distribute: <RefreshCw className="h-4 w-4 text-orange-600" />,
      reset_usage: <RefreshCw className="h-4 w-4 text-red-600" />,
      bulk_import: <Upload className="h-4 w-4 text-indigo-600" />,
      import: <Upload className="h-4 w-4 text-indigo-600" />,
      export: <Download className="h-4 w-4 text-gray-600" />
    }
    return icons[actionType as keyof typeof icons] || <History className="h-4 w-4" />
  }

  const getActionBadgeColor = (actionType: string) => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
      bulk_delete: 'bg-red-100 text-red-800',
      recharge: 'bg-purple-100 text-purple-800',
      distribute: 'bg-orange-100 text-orange-800',
      reset_usage: 'bg-red-100 text-red-800',
      bulk_import: 'bg-indigo-100 text-indigo-800',
      import: 'bg-indigo-100 text-indigo-800',
      export: 'bg-gray-100 text-gray-800'
    }
    return colors[actionType as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const formatActionType = (actionType: string) => {
    const types = {
      create: 'Création',
      update: 'Modification',
      delete: 'Suppression',
      bulk_delete: 'Suppression en masse',
      recharge: 'Recharge',
      distribute: 'Distribution',
      reset_usage: 'Réinitialisation',
      bulk_import: 'Import en masse',
      import: 'Import',
      export: 'Export'
    }
    return types[actionType as keyof typeof types] || actionType
  }

  const formatRole = (role: string) => {
    const roles = {
      director: 'Directeur',
      super_admin: 'Super Admin',
      accounting: 'Comptable',
      cashier: 'Caissier',
      auditor: 'Auditeur',
      executor: 'Exécuteur'
    }
    return roles[role as keyof typeof roles] || role
  }

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-gray-600" />
      : <ArrowDown className="h-4 w-4 text-gray-600" />
  }

  const sortedActions = React.useMemo(() => {
    if (!sortConfig.key) return actions

    return [...actions].sort((a, b) => {
      let aValue = a[sortConfig.key as keyof ActionHistoryEntry]
      let bValue = b[sortConfig.key as keyof ActionHistoryEntry]

      // Gestion spéciale pour les dates
      if (sortConfig.key === 'created_at') {
        aValue = new Date(aValue as string).getTime()
        bValue = new Date(bValue as string).getTime()
      }

      // Gestion des valeurs nulles/undefined
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })
  }, [actions, sortConfig])

  const handleViewDetails = (action: ActionHistoryEntry) => {
    setSelectedAction(action)
    setDetailsOpen(true)
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(Object.entries(filters).filter(([key, v]) => {
          // Ne pas filtrer action_type même si c'est "all"
          if (key === 'action_type') {
            return true
          }
          return v
        })),
        export: 'true'
      })

      const res = await fetch(`/api/cards/history?${params}`)
      const blob = await res.blob()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `historique-cartes-${format(new Date(), 'yyyy-MM-dd')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Erreur lors de l\'export:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Historique des Actions</h1>
          <p className="text-gray-600">Suivi des actions effectuées sur les cartes</p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_actions.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actions Récentes</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recent_actions}</div>
              <p className="text-xs text-muted-foreground">Dernières 24h</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Action la Plus Fréquente</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(() => {
                  const mostFrequent = Object.entries(stats.actions_by_type).sort(([,a], [,b]) => b - a)[0]
                  return mostFrequent ? formatActionType(mostFrequent[0]) : 'N/A'
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                {Object.entries(stats.actions_by_type).sort(([,a], [,b]) => b - a)[0]?.[1] || 0} fois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateur le Plus Actif</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.actions_by_user[0]?.user_name || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.actions_by_user[0]?.count || 0} actions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtres
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="text-sm font-medium">Type d'action</label>
              <Select value={filters.action_type} onValueChange={(value) => setFilters(prev => ({ ...prev, action_type: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="create">Création</SelectItem>
                  <SelectItem value="update">Modification</SelectItem>
                  <SelectItem value="delete">Suppression</SelectItem>
                  <SelectItem value="bulk_delete">Suppression en masse</SelectItem>
                  <SelectItem value="recharge">Recharge</SelectItem>
                  <SelectItem value="distribute">Distribution</SelectItem>
                  <SelectItem value="reset_usage">Réinitialisation</SelectItem>
                  <SelectItem value="bulk_import">Import en masse</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Utilisateur</label>
              <Select value={filters.user_id || "all"} onValueChange={(value) => setFilters(prev => ({ ...prev, user_id: value === "all" ? "" : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Tous les utilisateurs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les utilisateurs</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Recherche par carte</label>
              <Input
                placeholder="Numéro de carte..."
                value={filters.card_search}
                onChange={(e) => setFilters(prev => ({ ...prev, card_search: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Date de début</label>
              <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Date de fin</label>
              <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tableau des actions */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Actions</CardTitle>
          <CardDescription>
            {loading ? 'Chargement...' : `${actions.length} action(s) trouvée(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('action_type')}
                  >
                    <div className="flex items-center gap-2">
                      Action
                      {getSortIcon('action_type')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('user_name')}
                  >
                    <div className="flex items-center gap-2">
                      Utilisateur
                      {getSortIcon('user_name')}
                    </div>
                  </TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('target_card_cid')}
                  >
                    <div className="flex items-center gap-2">
                      Carte
                      {getSortIcon('target_card_cid')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center gap-2">
                      Date
                      {getSortIcon('created_at')}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedActions
                  .filter(action => {
                    // Filtrage par recherche de carte
                    if (filters.card_search) {
                      const searchTerm = filters.card_search.toLowerCase()
                      return action.target_card_cid?.toLowerCase().includes(searchTerm) || false
                    }
                    return true
                  })
                  .map((action) => (
                  <TableRow key={action.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionIcon(action.action_type)}
                        <Badge className={getActionBadgeColor(action.action_type)}>
                          {formatActionType(action.action_type)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{action.user_name}</div>
                        <div className="text-sm text-gray-500">{formatRole(action.user_role)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="truncate">{action.action_description}</div>
                    </TableCell>
                    <TableCell>
                      {action.target_card_cid ? (
                        <Badge variant="outline">{action.target_card_cid}</Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(action.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(action)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Page {page} sur {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHistory(page - 1)}
                  disabled={page <= 1}
                >
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadHistory(page + 1)}
                  disabled={page >= totalPages}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de détails */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Détails de l'Action</DialogTitle>
          </DialogHeader>
          
          {selectedAction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Type d'action</label>
                  <div className="flex items-center gap-2 mt-1">
                    {getActionIcon(selectedAction.action_type)}
                    <Badge className={getActionBadgeColor(selectedAction.action_type)}>
                      {formatActionType(selectedAction.action_type)}
                    </Badge>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <div className="mt-1">
                    {format(new Date(selectedAction.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: fr })}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  {selectedAction.action_description}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Utilisateur</label>
                  <div className="mt-1">
                    <div className="font-medium">{selectedAction.user_name}</div>
                    <div className="text-sm text-gray-500">{formatRole(selectedAction.user_role)}</div>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Carte concernée</label>
                  <div className="mt-1">
                    {selectedAction.target_card_cid ? (
                      <Badge variant="outline">{selectedAction.target_card_cid}</Badge>
                    ) : (
                      <span className="text-gray-400">Action globale</span>
                    )}
                  </div>
                </div>
              </div>

              {selectedAction.metadata && (
                <div>
                  <label className="text-sm font-medium">Métadonnées</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-md">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedAction.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedAction.old_values && (
                <div>
                  <label className="text-sm font-medium">Valeurs avant</label>
                  <div className="mt-1 p-3 bg-red-50 rounded-md">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedAction.old_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {selectedAction.new_values && (
                <div>
                  <label className="text-sm font-medium">Valeurs après</label>
                  <div className="mt-1 p-3 bg-green-50 rounded-md">
                    <pre className="text-sm overflow-x-auto">
                      {JSON.stringify(selectedAction.new_values, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Adresse IP</label>
                  <div className="mt-1 text-sm font-mono">
                    {selectedAction.ip_address || 'Non disponible'}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium">User Agent</label>
                  <div className="mt-1 text-sm">
                    {selectedAction.user_agent ? (
                      <div className="truncate" title={selectedAction.user_agent}>
                        {selectedAction.user_agent}
                      </div>
                    ) : (
                      'Non disponible'
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
