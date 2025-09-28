"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  CreditCard, 
  Upload, 
  RefreshCw, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  DollarSign,
  Zap,
  FileText
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

type CardData = {
  id: string
  cid: string
  last_recharge_date?: string
  expiration_date?: string
  status: "active" | "inactive"
  monthly_limit: number
  monthly_used: number
  created_at: string
  updated_at: string
}

export default function CardsClient({ 
  initialCards, 
  initialDistributionStats 
}: { 
  initialCards: CardData[]
  initialDistributionStats?: {
    total_limit: number
    total_used: number
    total_available: number
    active_cards: number
    available_cards: number
  }
}) {
  // Log des données initiales pour debug
  // Initialisation des données
  
  const [cards, setCards] = React.useState<CardData[]>(initialCards)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "inactive">("all")
  const [expirationFilter, setExpirationFilter] = React.useState<"all" | "year" | "3months" | "week">("all")
  const [usageFilter, setUsageFilter] = React.useState<"all" | "empty" | "used" | "full">("all")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CardData | null>(null)
  const [distributionOpen, setDistributionOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [distributionStats, setDistributionStats] = React.useState<{
    total_limit: number
    total_used: number
    total_available: number
    active_cards: number
    available_cards: number
  }>(() => {
    // Utiliser les statistiques initiales si disponibles, sinon les calculer
    if (initialDistributionStats) {
      return initialDistributionStats
    }
    
    // Calculer les statistiques initiales à partir des cartes initiales
    const totalLimit = initialCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
    const totalUsed = initialCards.reduce((sum, c) => sum + Number(c.monthly_used), 0)
    const activeCards = initialCards.filter(c => c.status === 'active').length
    const availableCards = initialCards.filter(c => c.status === 'active' && Number(c.monthly_used) < Number(c.monthly_limit)).length
    
    return {
      total_limit: totalLimit,
      total_used: totalUsed,
      total_available: totalLimit - totalUsed,
      active_cards: activeCards,
      available_cards: availableCards
    }
  })

  // État pour la sélection multiple
  const [selectedCards, setSelectedCards] = React.useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)

  // État pour la distribution
  const [distributionAmount, setDistributionAmount] = React.useState("")
  const [maxCards, setMaxCards] = React.useState("10")
  const [distributionResult, setDistributionResult] = React.useState<any>(null)

  // Fonction pour charger les cartes depuis l'API
  const loadCards = React.useCallback(async () => {
    try {
      const res = await fetch("/api/cards")
      const data = await res.json()
      if (res.ok && data?.ok && Array.isArray(data.data.cards)) {
        const newCards = data.data.cards
        setCards(newCards)
        
        // Charger les statistiques de distribution si disponibles, sinon les recalculer
        if (data.data.distributionStats) {
          setDistributionStats(data.data.distributionStats)
        } else {
          // Recalculer les statistiques à partir des nouvelles cartes
          const totalLimit = newCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
          const totalUsed = newCards.reduce((sum, c) => sum + Number(c.monthly_used), 0)
          const activeCards = newCards.filter(c => c.status === 'active').length
          const availableCards = newCards.filter(c => c.status === 'active' && Number(c.monthly_used) < Number(c.monthly_limit)).length
          
          setDistributionStats({
            total_limit: totalLimit,
            total_used: totalUsed,
            total_available: totalLimit - totalUsed,
            active_cards: activeCards,
            available_cards: availableCards
          })
        }
      }
    } catch (error) {
      // Erreur lors du chargement des cartes
    }
  }, [])

  // Ne pas charger automatiquement au montage - utiliser les données initiales
  // Les données seront rechargées seulement lors des actions utilisateur

  // Fonctions pour la sélection multiple
  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const newSet = new Set(prev)
      if (newSet.has(cardId)) {
        newSet.delete(cardId)
      } else {
        newSet.add(cardId)
      }
      return newSet
    })
  }

  const selectAllCards = () => {
    setSelectedCards(new Set(filtered.map(card => card.id)))
  }

  const clearSelection = () => {
    setSelectedCards(new Set())
  }

  const handleBulkDelete = async () => {
    if (selectedCards.size === 0) return
    
    setPending(true)
    try {
      const deletePromises = Array.from(selectedCards).map(cardId =>
        fetch(`/api/cards?id=${cardId}`, { method: 'DELETE' })
      )
      
      await Promise.all(deletePromises)
      await loadCards()
      clearSelection()
      setBulkDeleteOpen(false)
      alert(`${selectedCards.size} cartes supprimées avec succès`)
    } catch (error) {
      alert(`Erreur lors de la suppression: ${error}`)
    } finally {
      setPending(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getUsagePercentage = (used: number, limit: number) => {
    return Math.round((used / limit) * 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600"
    if (percentage >= 75) return "text-orange-600"
    if (percentage >= 50) return "text-yellow-600"
    return "text-green-600"
  }

  const filtered = cards
    .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
    .filter((c) => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return c.cid.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
    })
    .filter((c) => {
      // Filtre par date d'expiration
      if (expirationFilter === "all") return true
      if (!c.expiration_date) return false
      
      const expirationDate = new Date(c.expiration_date)
      const now = new Date()
      const diffTime = expirationDate.getTime() - now.getTime()
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      
      switch (expirationFilter) {
        case "year":
          return diffDays > 0 && diffDays <= 365
        case "3months":
          return diffDays > 0 && diffDays <= 90
        case "week":
          return diffDays > 0 && diffDays <= 7
        default:
          return true
      }
    })
    .filter((c) => {
      // Filtre par usage
      if (usageFilter === "all") return true
      
      const usagePercentage = getUsagePercentage(c.monthly_used, c.monthly_limit)
      
      switch (usageFilter) {
        case "empty":
          return usagePercentage === 0
        case "used":
          return usagePercentage > 0 && usagePercentage < 100
        case "full":
          return usagePercentage >= 100
        default:
          return true
      }
    })

  function onCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function onEdit(card: CardData) {
    setEditing(card)
    setDialogOpen(true)
  }

  async function submitCard(form: {
    id?: string
    cid: string
    last_recharge_date?: string
    expiration_date?: string
    status: "active" | "inactive"
    monthly_limit: number
  }) {
    setPending(true)
    try {
      const method = form.id ? "PUT" : "POST"
      const res = await fetch("/api/cards", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      
      await loadCards()
      setDialogOpen(false)
      setEditing(null)
    } finally {
      setPending(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer cette carte ?")) return
    setPending(true)
    try {
      const res = await fetch(`/api/cards?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      await loadCards()
    } finally {
      setPending(false)
    }
  }

  async function handleDistribution() {
    if (!distributionAmount || parseFloat(distributionAmount) <= 0) {
      alert("Montant requis")
      return
    }

    setPending(true)
    try {
      const res = await fetch("/api/cards/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(distributionAmount),
          maxCards: parseInt(maxCards)
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      
      setDistributionResult(data.data)
      setDistributionAmount("")
      await loadCards()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestion des Cartes</h1>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadCards} 
                  disabled={pending}
                  className="h-8 w-8 p-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Actualiser les données</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <Button 
            variant="outline" 
            onClick={() => setImportOpen(true)} 
            disabled={pending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer Excel
          </Button>
          
          <Button 
            variant="outline" 
            onClick={() => setDistributionOpen(true)} 
            disabled={pending}
          >
            <DollarSign className="h-4 w-4 mr-2" />
            Distribuer
          </Button>
          
          <Button onClick={onCreate} disabled={pending}>
            <CreditCard className="h-4 w-4 mr-2" />
            Nouvelle carte
          </Button>
          
          {selectedCards.size > 0 && (
            <>
              <Button 
                variant="destructive" 
                onClick={() => setBulkDeleteOpen(true)}
                disabled={pending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer ({selectedCards.size})
              </Button>
              
              <Button 
                variant="outline" 
                onClick={clearSelection}
                disabled={pending}
              >
                Annuler sélection
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Cartes</p>
                <p className="text-2xl font-bold">{cards.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Cartes Actives</p>
                <p className="text-2xl font-bold">{cards.filter(c => c.status === 'active').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Limite Totale</p>
                <p className="text-lg font-bold">{formatCurrency(cards.reduce((sum, c) => sum + Number(c.monthly_limit), 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Utilisé ce Mois</p>
                <p className="text-lg font-bold">{formatCurrency(cards.reduce((sum, c) => sum + Number(c.monthly_used), 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Disponible à Distribuer</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(distributionStats.total_available)}
                </p>
                <p className="text-xs text-gray-500">
                  {distributionStats.available_cards} cartes disponibles
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liste des Cartes</CardTitle>
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <Input
                placeholder="Rechercher CID..."
                className="w-48"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="active">Actives</SelectItem>
                  <SelectItem value="inactive">Inactives</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expirationFilter} onValueChange={(v: any) => setExpirationFilter(v)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes dates</SelectItem>
                  <SelectItem value="year">Dans 1 an</SelectItem>
                  <SelectItem value="3months">Dans 3 mois</SelectItem>
                  <SelectItem value="week">Dans 1 semaine</SelectItem>
                </SelectContent>
              </Select>
              <Select value={usageFilter} onValueChange={(v: any) => setUsageFilter(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous usages</SelectItem>
                  <SelectItem value="empty">Vide</SelectItem>
                  <SelectItem value="used">Utilisé</SelectItem>
                  <SelectItem value="full">Rempli</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    <input
                      type="checkbox"
                      checked={selectedCards.size === filtered.length && filtered.length > 0}
                      onChange={selectedCards.size === filtered.length ? clearSelection : selectAllCards}
                      className="rounded border-gray-300"
                    />
                  </th>
                  {["CID", "Statut", "Limite Mensuelle", "Utilisé", "Usage %", "Dernière Recharge", "Expiration", "Actions"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {h === "Actions" ? (
                        <div className="flex items-center space-x-1">
                          <MoreHorizontal className="h-4 w-4" />
                          <span>{h}</span>
                        </div>
                      ) : (
                        h
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filtered.map((card) => {
                  const usagePercentage = getUsagePercentage(card.monthly_used, card.monthly_limit)
                  return (
                    <tr key={card.id} className={selectedCards.has(card.id) ? "bg-blue-50" : ""}>
                      <td className="px-6 py-4 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedCards.has(card.id)}
                          onChange={() => toggleCardSelection(card.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{card.cid}</td>
                      <td className="px-6 py-4 text-sm">
                        <Badge variant={card.status === 'active' ? 'default' : 'secondary'}>
                          {card.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(card.monthly_limit)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(card.monthly_used)}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={getUsageColor(usagePercentage)}>
                          {usagePercentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {card.last_recharge_date ? new Date(card.last_recharge_date).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {card.expiration_date ? new Date(card.expiration_date).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <TooltipProvider>
                          <div className="flex items-center space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => onEdit(card)} 
                                  disabled={pending}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Modifier la carte</p>
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => onDelete(card.id)} 
                                  disabled={pending}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Supprimer la carte</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-sm text-gray-500 text-center" colSpan={8}>
                      Aucune carte trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs pour édition, distribution et import - à compléter */}
      <CardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitCard}
        pending={pending}
      />

      <DistributionDialog
        open={distributionOpen}
        onOpenChange={setDistributionOpen}
        onDistribute={handleDistribution}
        amount={distributionAmount}
        setAmount={setDistributionAmount}
        maxCards={maxCards}
        setMaxCards={setMaxCards}
        result={distributionResult}
        pending={pending}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={() => loadCards()}
        pending={pending}
      />

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        selectedCount={selectedCards.size}
        pending={pending}
      />
    </div>
  )
}

// Composant pour le dialog d'édition de carte
function CardDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: CardData | null
  onSubmit: (data: any) => void
  pending: boolean
}) {
  const [cid, setCid] = React.useState("")
  const [lastRechargeDate, setLastRechargeDate] = React.useState("")
  const [expirationDate, setExpirationDate] = React.useState("")
  const [status, setStatus] = React.useState<"active" | "inactive">("active")
  const [monthlyLimit, setMonthlyLimit] = React.useState("2000000")

  React.useEffect(() => {
    if (initial) {
      setCid(initial.cid)
      setLastRechargeDate(initial.last_recharge_date || "")
      setExpirationDate(initial.expiration_date || "")
      setStatus(initial.status)
      setMonthlyLimit(initial.monthly_limit.toString())
    } else {
      setCid("")
      setLastRechargeDate("")
      setExpirationDate("")
      setStatus("active")
      setMonthlyLimit("2000000")
    }
  }, [initial, open])

  function handleSubmit() {
    onSubmit({
      id: initial?.id,
      cid,
      last_recharge_date: lastRechargeDate || undefined,
      expiration_date: expirationDate || undefined,
      status,
      monthly_limit: parseInt(monthlyLimit)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier la carte" : "Nouvelle carte"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cid">CID *</Label>
            <Input 
              id="cid" 
              className="mt-1" 
              value={cid} 
              onChange={(e) => setCid(e.target.value)}
              placeholder="Ex: 21174132"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="lastRecharge">Dernière Recharge</Label>
              <Input 
                id="lastRecharge" 
                type="date"
                className="mt-1" 
                value={lastRechargeDate} 
                onChange={(e) => setLastRechargeDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="expiration">Date d'Expiration</Label>
              <Input 
                id="expiration" 
                type="date"
                className="mt-1" 
                value={expirationDate} 
                onChange={(e) => setExpirationDate(e.target.value)}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="limit">Limite Mensuelle (XAF)</Label>
              <Input 
                id="limit" 
                type="number"
                className="mt-1" 
                value={monthlyLimit} 
                onChange={(e) => setMonthlyLimit(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !cid}>
            {initial ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour le dialog de distribution
function DistributionDialog({
  open,
  onOpenChange,
  onDistribute,
  amount,
  setAmount,
  maxCards,
  setMaxCards,
  result,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onDistribute: () => void
  amount: string
  setAmount: (v: string) => void
  maxCards: string
  setMaxCards: (v: string) => void
  result: any
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Distribution Automatique</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Montant à Distribuer (XAF) *</Label>
              <Input 
                id="amount" 
                type="number"
                className="mt-1" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ex: 5000000"
              />
            </div>
            <div>
              <Label htmlFor="maxCards">Nombre Max de Cartes</Label>
              <Input 
                id="maxCards" 
                type="number"
                className="mt-1" 
                value={maxCards} 
                onChange={(e) => setMaxCards(e.target.value)}
                min="1"
                max="50"
              />
            </div>
          </div>

          {result && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg">
              <h4 className="font-semibold text-green-800 mb-2">Résultat de la Distribution</h4>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Montant total distribué:</span> {new Intl.NumberFormat('fr-FR').format(result.total_distributed)} XAF</p>
                <p><span className="font-medium">Cartes utilisées:</span> {result.cards_used}</p>
                
                {result.remaining_amount > 0 && (
                  <div className="mt-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                    <p className="text-yellow-800">
                      <span className="font-medium">⚠️ Montant restant:</span> {new Intl.NumberFormat('fr-FR').format(result.remaining_amount)} XAF
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Toutes les cartes disponibles sont remplies. Le montant restant ne peut pas être distribué.
                    </p>
                  </div>
                )}
                
                {result.distributions && result.distributions.length > 0 && (
                  <div className="mt-3">
                    <p className="font-medium">Détail par carte:</p>
                    <div className="max-h-32 overflow-y-auto">
                      {result.distributions.map((dist: any, index: number) => (
                        <div key={index} className="flex justify-between py-1">
                          <span>CID {dist.cid}:</span>
                          <span>{new Intl.NumberFormat('fr-FR').format(dist.amount)} XAF</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Fermer
          </Button>
          <Button onClick={onDistribute} disabled={pending || !amount || parseFloat(amount) <= 0}>
            Distribuer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour le dialog d'import
function ImportDialog({
  open,
  onOpenChange,
  onImport,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onImport: () => void
  pending: boolean
}) {
  const [excelData, setExcelData] = React.useState("")
  const [file, setFile] = React.useState<File | null>(null)
  const [parsedData, setParsedData] = React.useState<any[]>([])
  const [parsing, setParsing] = React.useState(false)

  // Fonction pour parser le format de date Excel
  function parseExcelDate(dateStr: string): string | undefined {
    if (!dateStr) return undefined
    
    try {
      // Format: 09-22-25 10:28:08 AM
      const match = dateStr.match(/(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(AM|PM)/)
      if (match) {
        const [, month, day, year, hour, minute, second, ampm] = match
        const fullYear = parseInt(year) + 2000 // Convertir 25 -> 2025
        const hour24 = ampm === 'PM' && parseInt(hour) !== 12 ? parseInt(hour) + 12 : 
                     ampm === 'AM' && parseInt(hour) === 12 ? 0 : parseInt(hour)
        
        const date = new Date(fullYear, parseInt(month) - 1, parseInt(day), hour24, parseInt(minute), parseInt(second))
        return date.toISOString().split('T')[0] // Retourner au format YYYY-MM-DD
      }
      
      // Essayer de parser comme date normale
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    } catch (error) {
    }
    
    return undefined
  }

  // Fonction pour extraire le CID de la référence
  function extractCID(reference: string): string | null {
    const cidMatch = reference.match(/CID:\s*(\d{8})/)
    return cidMatch ? cidMatch[1] : null
  }

  // Fonction pour parser le fichier Excel/CSV
  function parseFile(content: string): any[] {
    const lines = content.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    
    // Trouver les indices des colonnes Date et Reference
    const dateIndex = headers.findIndex(h => h === 'date')
    const referenceIndex = headers.findIndex(h => h === 'reference')
    
    
    if (dateIndex === -1 || referenceIndex === -1) {
      return []
    }
    
    const data = lines.slice(1).map((line, index) => {
      // Parser la ligne CSV en gérant les guillemets
      const values = parseCSVLine(line)
      
      if (values.length < Math.max(dateIndex, referenceIndex) + 1) {
        return null
      }
      
      const dateValue = values[dateIndex] || ''
      const referenceValue = values[referenceIndex] || ''
      
      
      // Extraire le CID de la référence
      const cid = extractCID(referenceValue)
      if (!cid) {
        return null
      }
      
      const parsedDate = parseExcelDate(dateValue)
      
      return {
        cid,
        last_recharge_date: parsedDate,
        reference: referenceValue
      }
    }).filter(Boolean)
    
    return data
  }

  // Fonction pour parser une ligne CSV en gérant les guillemets
  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Guillemet échappé
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // Fin du champ
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    // Ajouter le dernier champ
    result.push(current.trim())
    
    return result
  }

  // Gestionnaire de changement de fichier
  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) {
      return
    }
    
    setFile(selectedFile)
    setParsing(true)
    setParsedData([]) // Reset des données précédentes
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      
      try {
        const parsed = parseFile(content)
        
        setParsedData(parsed)
        setExcelData(content)
      } catch (error) {
        setParsedData([])
      } finally {
        setParsing(false)
      }
    }
    reader.onerror = () => {
      setParsing(false)
    }
    reader.readAsText(selectedFile)
  }

  async function handleImport() {
    if (parsedData.length === 0) {
      alert("Aucune donnée valide trouvée")
      return
    }

    try {
      const res = await fetch("/api/cards/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: parsedData }),
      })
      
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      
      // Afficher un message détaillé avec les résultats
      const { created, skipped, total } = data.data
      let message = `Import terminé !\n\n`
      message += `✅ ${created} cartes créées avec succès\n`
      if (skipped > 0) {
        message += `⚠️ ${skipped} cartes ignorées (déjà existantes)\n`
      }
      message += `📊 Total traité: ${total} cartes`
      
      alert(message)
      onImport()
      onOpenChange(false)
      setExcelData("")
      setFile(null)
      setParsedData([])
    } catch (error: any) {
      alert(`Erreur: ${error.message}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import depuis Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="file">Fichier Excel/CSV</Label>
            <Input
              id="file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="mt-1"
              disabled={parsing}
            />
            <p className="text-sm text-gray-600 mt-1">
              Formats supportés: CSV, XLSX, XLS
              {parsing && <span className="text-blue-600 ml-2">⏳ Parsing en cours...</span>}
            </p>
          </div>
          
          {parsedData.length > 0 && (
            <div className="p-3 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">
                Données parsées ({parsedData.length} cartes trouvées)
              </h4>
              <div className="max-h-40 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1">CID</th>
                      <th className="text-left p-1">Date</th>
                      <th className="text-left p-1">Référence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((card, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-1 font-mono">{card.cid}</td>
                        <td className="p-1">{card.last_recharge_date || '-'}</td>
                        <td className="p-1 text-xs truncate max-w-32" title={card.reference}>
                          {card.reference}
                        </td>
                      </tr>
                    ))}
                    {parsedData.length > 10 && (
                      <tr>
                        <td colSpan={3} className="p-1 text-center text-gray-500">
                          ... et {parsedData.length - 10} autres
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-1">Format attendu:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Colonnes: <code>Date,Reference</code> (ou format complet avec 9 colonnes)</li>
              <li>• Format date: <code>09-22-25 10:28:08 AM</code></li>
              <li>• Référence doit contenir: <code>CID: XXXXXXXX</code></li>
              <li>• Une carte par ligne</li>
              <li>• Les doublons de CID seront ignorés</li>
              <li>• Support des guillemets et virgules dans les champs</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={pending || parsing || parsedData.length === 0}
          >
            {parsing ? "Parsing..." : 
             pending ? "Import..." : 
             parsedData.length > 0 ? `Importer (${parsedData.length} cartes)` : 
             "Aucune donnée valide"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour le dialog de suppression en lot
function BulkDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  selectedCount,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  selectedCount: number
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            <span>Confirmation de suppression</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-red-800 font-medium">
              Êtes-vous sûr de vouloir supprimer {selectedCount} carte{selectedCount > 1 ? 's' : ''} ?
            </p>
            <p className="text-red-700 text-sm mt-2">
              Cette action est irréversible. Les cartes sélectionnées seront définitivement supprimées.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm} 
            disabled={pending}
          >
            {pending ? "Suppression..." : `Supprimer ${selectedCount} carte${selectedCount > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
