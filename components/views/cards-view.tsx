"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { 
  CreditCard, 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  Edit, 
  Trash2, 
  History,
  Settings,
  TrendingUp,
  Users,
  DollarSign,
  Battery,
  Calendar
} from "lucide-react"

type CardData = {
  id: string
  cid: string
  country: "Mali" | "RDC" | "France" | "Congo"
  last_recharge_date?: string
  expiration_date?: string
  status: "active" | "inactive"
  monthly_limit: number
  monthly_used: number
  recharge_limit: number
  created_at: string
  updated_at: string
}

type CountryStats = {
  totalCards: number
  activeCards: number
  totalMonthlyLimit: number
  totalMonthlyUsed: number
  totalRechargeLimit: number
  averageUsage: number
}

type RechargeHistory = {
  id: string
  card_id: string
  amount: number
  recharged_by: string
  recharge_date: string
  notes?: string
  created_at: string
  card_cid: string
  card_country: string
}

export function CardsView() {
  const [cards, setCards] = useState<CardData[]>([])
  const [countries, setCountries] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string>("all")
  const [stats, setStats] = useState<CountryStats | null>(null)
  const [rechargeHistory, setRechargeHistory] = useState<RechargeHistory[]>([])
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isRechargeDialogOpen, setIsRechargeDialogOpen] = useState(false)
  const [isLimitsDialogOpen, setIsLimitsDialogOpen] = useState(false)
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    cid: "",
    country: "Mali" as "Mali" | "RDC" | "France" | "Congo",
    last_recharge_date: "",
    expiration_date: "",
    status: "active" as "active" | "inactive",
    monthly_limit: 0,
    recharge_limit: 0
  })

  const [rechargeData, setRechargeData] = useState({
    amount: "",
    notes: ""
  })

  const [limitsData, setLimitsData] = useState({
    country: "Mali" as "Mali" | "RDC" | "France" | "Congo",
    monthly_limit: 0,
    recharge_limit: 0
  })

  // Charger les cartes depuis l'API
  useEffect(() => {
    const loadCards = async () => {
      try {
        setLoading(true)
        const res = await fetch("/api/cards")
        const data = await res.json()
        if (res.ok && data?.ok) {
          setCards(data.data)
          // Extraire les pays uniques
          const uniqueCountries = [...new Set(data.data.map((card: CardData) => card.country))]
          setCountries(uniqueCountries)
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de charger les cartes",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Erreur réseau",
          description: "Impossible de se connecter au serveur",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }
    loadCards()
  }, [toast])

  // Charger les statistiques par pays
  useEffect(() => {
    const loadStats = async () => {
      if (selectedCountry === "all") return
      
      try {
        const res = await fetch(`/api/cards/stats?country=${selectedCountry}`)
        const data = await res.json()
        if (res.ok && data?.ok) {
          setStats(data.data)
        }
      } catch (error) {
        console.error("Erreur lors du chargement des statistiques:", error)
      }
    }

    loadStats()
  }, [selectedCountry])

  // Charger l'historique des recharges
  useEffect(() => {
    const loadRechargeHistory = async () => {
      try {
        const res = await fetch("/api/cards/recharge-history")
        const data = await res.json()
        if (res.ok && data?.ok) {
          setRechargeHistory(data.data)
        }
      } catch (error) {
        console.error("Erreur lors du chargement de l'historique:", error)
      }
    }

    loadRechargeHistory()
  }, [])

  const handleCreateCard = async () => {
    if (!formData.cid.trim() || !formData.country) {
      toast({
        title: "Erreur",
        description: "Tous les champs sont requis",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (res.ok && data?.ok) {
        toast({
          title: "Succès",
          description: "Carte créée avec succès",
        })
        setIsDialogOpen(false)
        setFormData({
          cid: "",
          country: "Mali",
          last_recharge_date: "",
          expiration_date: "",
          status: "active",
          monthly_limit: 0,
          recharge_limit: 0
        })
        // Recharger les cartes
        window.location.reload()
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la création",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur de connexion",
        variant: "destructive"
      })
    }
  }

  const handleRechargeCard = async () => {
    if (!selectedCard || !rechargeData.amount) {
      toast({
        title: "Erreur",
        description: "Montant requis",
        variant: "destructive"
      })
      return
    }

    const amount = parseFloat(rechargeData.amount)
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Erreur",
        description: "Montant invalide",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch("/api/cards/recharge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cardId: selectedCard.id,
          amount: amount,
          notes: rechargeData.notes
        }),
      })

      const data = await res.json()

      if (res.ok && data?.ok) {
        toast({
          title: "Succès",
          description: "Recharge effectuée avec succès",
        })
        setIsRechargeDialogOpen(false)
        setRechargeData({ amount: "", notes: "" })
        setSelectedCard(null)
        // Recharger les cartes
        window.location.reload()
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la recharge",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur de connexion",
        variant: "destructive"
      })
    }
  }

  const handleUpdateLimits = async () => {
    if (!limitsData.country || limitsData.monthly_limit <= 0 || limitsData.recharge_limit <= 0) {
      toast({
        title: "Erreur",
        description: "Tous les champs sont requis",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch("/api/cards/update-limits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(limitsData),
      })

      const data = await res.json()

      if (res.ok && data?.ok) {
        toast({
          title: "Succès",
          description: "Limites mises à jour avec succès",
        })
        setIsLimitsDialogOpen(false)
        setLimitsData({
          country: "Mali",
          monthly_limit: 0,
          recharge_limit: 0
        })
        // Recharger les cartes
        window.location.reload()
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la mise à jour",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur de connexion",
        variant: "destructive"
      })
    }
  }

  // Filtrer les cartes
  const filteredCards = cards.filter(card => {
    const matchesCountry = selectedCountry === "all" || card.country === selectedCountry
    const matchesStatus = filter === "all" || card.status === filter
    const matchesSearch = searchTerm === "" || 
      card.cid.toLowerCase().includes(searchTerm.toLowerCase())
    
    return matchesCountry && matchesStatus && matchesSearch
  })

  // Calculer les statistiques globales
  const globalStats = {
    totalCards: cards.length,
    activeCards: cards.filter(card => card.status === "active").length,
    totalMonthlyLimit: cards.reduce((sum, card) => sum + card.monthly_limit, 0),
    totalMonthlyUsed: cards.reduce((sum, card) => sum + card.monthly_used, 0),
    totalRechargeLimit: cards.reduce((sum, card) => sum + card.recharge_limit, 0),
    averageUsage: cards.length > 0 ? cards.reduce((sum, card) => sum + (card.monthly_used / card.monthly_limit), 0) / cards.length : 0
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' XAF'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR')
  }

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'Mali': '🇲🇱',
      'RDC': '🇨🇩',
      'France': '🇫🇷',
      'Congo': '🇨🇬'
    }
    return flags[country] || '🌍'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800">Actif</Badge>
      case "inactive":
        return <Badge className="bg-red-100 text-red-800">Inactif</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0
    return Math.round((used / limit) * 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return "text-red-600"
    if (percentage >= 70) return "text-orange-600"
    return "text-green-600"
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Chargement des cartes...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-600" />
              Total Cartes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{globalStats.totalCards}</div>
            <p className="text-xs text-muted-foreground">
              {globalStats.activeCards} actives
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Limite Mensuelle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatAmount(globalStats.totalMonthlyLimit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Plafond total
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-orange-600" />
              Utilisation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatAmount(globalStats.totalMonthlyUsed)}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.round(globalStats.averageUsage * 100)}% moyenne
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Battery className="h-4 w-4 text-purple-600" />
              Limite Recharge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatAmount(globalStats.totalRechargeLimit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Par transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Statistiques par pays */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Statistiques - {getCountryFlag(selectedCountry)} {selectedCountry}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalCards}</div>
                <div className="text-sm text-muted-foreground">Cartes</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.activeCards}</div>
                <div className="text-sm text-muted-foreground">Actives</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{Math.round(stats.averageUsage * 100)}%</div>
                <div className="text-sm text-muted-foreground">Utilisation</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contrôles et filtres */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gestion des Cartes
            </span>
            <div className="flex gap-2">
              <Button
                onClick={() => setIsLimitsDialogOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Limites
              </Button>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Nouvelle Carte
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="search">Rechercher</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Rechercher par CID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div>
                <Label htmlFor="country-filter">Pays</Label>
                <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {countries.map(country => (
                      <SelectItem key={country} value={country}>
                        {getCountryFlag(country)} {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status-filter">Statut</Label>
                <Select value={filter} onValueChange={(value: "all" | "active" | "inactive") => setFilter(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Table des cartes */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CID</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Limite Mensuelle</TableHead>
                  <TableHead>Utilisation</TableHead>
                  <TableHead>Limite Recharge</TableHead>
                  <TableHead>Dernière Recharge</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">{card.cid}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getCountryFlag(card.country)}</span>
                        <span>{card.country}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(card.status)}</TableCell>
                    <TableCell>{formatAmount(card.monthly_limit)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={getUsageColor(getUsagePercentage(card.monthly_used, card.monthly_limit))}>
                          {formatAmount(card.monthly_used)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({getUsagePercentage(card.monthly_used, card.monthly_limit)}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatAmount(card.recharge_limit)}</TableCell>
                    <TableCell>
                      {card.last_recharge_date ? formatDate(card.last_recharge_date) : 'Jamais'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedCard(card)
                            setIsRechargeDialogOpen(true)
                          }}
                          className="text-green-600 border-green-600 hover:bg-green-50"
                        >
                          <Battery className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredCards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Aucune carte trouvée
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historique des recharges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historique des Recharges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Carte</TableHead>
                  <TableHead>Pays</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Rechargé par</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rechargeHistory.slice(0, 10).map((recharge) => (
                  <TableRow key={recharge.id}>
                    <TableCell className="font-medium">{recharge.card_cid}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{getCountryFlag(recharge.card_country)}</span>
                        <span>{recharge.card_country}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-green-600 font-semibold">
                      {formatAmount(recharge.amount)}
                    </TableCell>
                    <TableCell>{recharge.recharged_by}</TableCell>
                    <TableCell>{formatDate(recharge.recharge_date)}</TableCell>
                    <TableCell>{recharge.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de création de carte */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nouvelle Carte</DialogTitle>
            <DialogDescription>
              Créer une nouvelle carte avec les informations requises.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cid" className="text-right">
                CID *
              </Label>
              <Input
                id="cid"
                value={formData.cid}
                onChange={(e) => setFormData({ ...formData, cid: e.target.value })}
                className="col-span-3"
                placeholder="Identifiant de la carte"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="country" className="text-right">
                Pays *
              </Label>
              <Select
                value={formData.country}
                onValueChange={(value: "Mali" | "RDC" | "France" | "Congo") => 
                  setFormData({ ...formData, country: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mali">🇲🇱 Mali</SelectItem>
                  <SelectItem value="RDC">🇨🇩 RDC</SelectItem>
                  <SelectItem value="France">🇫🇷 France</SelectItem>
                  <SelectItem value="Congo">🇨🇬 Congo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="monthly_limit" className="text-right">
                Limite Mensuelle *
              </Label>
              <Input
                id="monthly_limit"
                type="number"
                value={formData.monthly_limit}
                onChange={(e) => setFormData({ ...formData, monthly_limit: parseInt(e.target.value) || 0 })}
                className="col-span-3"
                placeholder="Limite mensuelle en XAF"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="recharge_limit" className="text-right">
                Limite Recharge *
              </Label>
              <Input
                id="recharge_limit"
                type="number"
                value={formData.recharge_limit}
                onChange={(e) => setFormData({ ...formData, recharge_limit: parseInt(e.target.value) || 0 })}
                className="col-span-3"
                placeholder="Limite de recharge en XAF"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="expiration_date" className="text-right">
                Date d'expiration
              </Label>
              <Input
                id="expiration_date"
                type="date"
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateCard}>
              Créer la carte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de recharge */}
      <Dialog open={isRechargeDialogOpen} onOpenChange={setIsRechargeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Recharger la carte</DialogTitle>
            <DialogDescription>
              Recharger la carte {selectedCard?.cid} ({getCountryFlag(selectedCard?.country || '')} {selectedCard?.country})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                Montant *
              </Label>
              <Input
                id="amount"
                type="number"
                value={rechargeData.amount}
                onChange={(e) => setRechargeData({ ...rechargeData, amount: e.target.value })}
                className="col-span-3"
                placeholder="Montant en XAF"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <Input
                id="notes"
                value={rechargeData.notes}
                onChange={(e) => setRechargeData({ ...rechargeData, notes: e.target.value })}
                className="col-span-3"
                placeholder="Commentaires (optionnel)"
              />
            </div>
            {selectedCard && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-700">
                  <div>Limite de recharge: {formatAmount(selectedCard.recharge_limit)}</div>
                  <div>Utilisation mensuelle: {formatAmount(selectedCard.monthly_used)} / {formatAmount(selectedCard.monthly_limit)}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRechargeDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRechargeCard}>
              Recharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de mise à jour des limites */}
      <Dialog open={isLimitsDialogOpen} onOpenChange={setIsLimitsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Mettre à jour les limites</DialogTitle>
            <DialogDescription>
              Modifier les limites par défaut pour un pays.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="limits_country" className="text-right">
                Pays *
              </Label>
              <Select
                value={limitsData.country}
                onValueChange={(value: "Mali" | "RDC" | "France" | "Congo") => 
                  setLimitsData({ ...limitsData, country: value })
                }
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Mali">🇲🇱 Mali</SelectItem>
                  <SelectItem value="RDC">🇨🇩 RDC</SelectItem>
                  <SelectItem value="France">🇫🇷 France</SelectItem>
                  <SelectItem value="Congo">🇨🇬 Congo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="limits_monthly" className="text-right">
                Limite Mensuelle *
              </Label>
              <Input
                id="limits_monthly"
                type="number"
                value={limitsData.monthly_limit}
                onChange={(e) => setLimitsData({ ...limitsData, monthly_limit: parseInt(e.target.value) || 0 })}
                className="col-span-3"
                placeholder="Limite mensuelle en XAF"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="limits_recharge" className="text-right">
                Limite Recharge *
              </Label>
              <Input
                id="limits_recharge"
                type="number"
                value={limitsData.recharge_limit}
                onChange={(e) => setLimitsData({ ...limitsData, recharge_limit: parseInt(e.target.value) || 0 })}
                className="col-span-3"
                placeholder="Limite de recharge en XAF"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLimitsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateLimits}>
              Mettre à jour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}