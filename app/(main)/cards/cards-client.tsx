"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { getCountryLimits } from "@/lib/cards-queries"
import { 
  CreditCard, 
  Upload, 
  RefreshCw, 
  Edit, 
  Trash2, 
  MoreHorizontal,
  DollarSign,
  Zap,
  ChevronUp,
  ChevronDown,
  FileText,
  History
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
  const [countryFilter, setCountryFilter] = React.useState<"all" | "Mali" | "RDC" | "France" | "Congo">("all")
  const [usageFilter, setUsageFilter] = React.useState<"all" | "empty" | "used" | "full">("all")
  
  // États pour le tri
  const [sortField, setSortField] = React.useState<"cid" | "country" | "status" | "monthly_limit" | "monthly_used" | "availability" | "usage_percentage" | "recharge_limit" | "last_recharge_date">("cid")
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CardData | null>(null)
  const [distributionOpen, setDistributionOpen] = React.useState(false)
  const [rechargeOpen, setRechargeOpen] = React.useState(false)
  const [selectedCardForRecharge, setSelectedCardForRecharge] = React.useState<CardData | null>(null)
  
  // États pour la distribution en masse
  const [distributionAmount, setDistributionAmount] = React.useState("")
  const [selectedCountry, setSelectedCountry] = React.useState<"Mali" | "RDC" | "France" | "Congo">("Mali")
  const [availableCards, setAvailableCards] = React.useState<CardData[]>([])
  const [selectedCards, setSelectedCards] = React.useState<Set<string>>(new Set())
  const [remainingAmount, setRemainingAmount] = React.useState(0)

  // Statistiques filtrées par pays
  const filteredCards = React.useMemo(() => {
    return cards.filter(c => countryFilter === "all" ? true : c.country === countryFilter)
  }, [cards, countryFilter])

  const filteredStats = React.useMemo(() => {
    const activeCards = filteredCards.filter(c => c.status === 'active')
    const totalCards = filteredCards.length
    const activeCardsCount = activeCards.length
    const totalLimit = activeCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
    const totalUsed = filteredCards.reduce((sum, c) => sum + Number(c.monthly_used), 0)
    const totalAvailable = activeCards.reduce((sum, c) => {
      const monthlyAvailable = Number(c.monthly_limit) - Number(c.monthly_used)
      return sum + Math.max(0, monthlyAvailable)
    }, 0)
    const availableCardsCount = activeCards.filter(c => {
      const monthlyAvailable = Number(c.monthly_limit) - Number(c.monthly_used)
      return monthlyAvailable > 0
    }).length

    return {
      totalCards,
      activeCardsCount,
      totalLimit,
      totalUsed,
      totalAvailable,
      availableCardsCount
    }
  }, [filteredCards])
  const [importOpen, setImportOpen] = React.useState(false)
  const [defaultCountry, setDefaultCountry] = React.useState<"Mali" | "RDC" | "France" | "Congo">("Mali")
  const [pending, setPending] = React.useState(false)
  const [countryLimitsOpen, setCountryLimitsOpen] = React.useState(false)
  const [countryLimits, setCountryLimits] = React.useState<Array<{
    country: "Mali" | "RDC" | "France" | "Congo"
    monthly_limit: number
    recharge_limit: number
  }>>([])
  const [updatingCountryLimits, setUpdatingCountryLimits] = React.useState(false)
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
    
    // Calculer les statistiques initiales à partir des cartes actives seulement
    const activeInitialCards = initialCards.filter(c => c.status === 'active')
    const totalLimit = activeInitialCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
    const totalUsed = activeInitialCards.reduce((sum, c) => sum + Number(c.monthly_used), 0)
    const activeCards = activeInitialCards.length
    const availableCards = activeInitialCards.filter(c => Number(c.monthly_used) < Number(c.monthly_limit)).length
    
    return {
      total_limit: totalLimit,
      total_used: totalUsed,
      total_available: totalLimit - totalUsed,
      active_cards: activeCards,
      available_cards: availableCards
    }
  })

  // État pour la sélection multiple
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false)
  const [resetUsageOpen, setResetUsageOpen] = React.useState(false)

  // État pour la recharge
  const [rechargeAmount, setRechargeAmount] = React.useState("")
  const [rechargeNotes, setRechargeNotes] = React.useState("")

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
          // Recalculer les statistiques à partir des nouvelles cartes actives seulement
          const activeNewCards = newCards.filter(c => c.status === 'active')
          const totalLimit = activeNewCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
          const totalUsed = activeNewCards.reduce((sum, c) => sum + Number(c.monthly_used), 0)
          const activeCards = activeNewCards.length
          const availableCards = activeNewCards.filter(c => Number(c.monthly_used) < Number(c.monthly_limit)).length
          
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


  // Fonction pour charger les cartes disponibles pour un pays
  const loadAvailableCards = React.useCallback(async (country: "Mali" | "RDC" | "France" | "Congo") => {
    try {
      const res = await fetch(`/api/cards?action=available&country=${country}`)
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        setAvailableCards(data.cards || [])
      } else {
        console.error('Erreur lors du chargement des cartes disponibles:', data.error)
        setAvailableCards([])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des cartes disponibles:', error)
      setAvailableCards([])
    }
  }, [])

  // Fonction pour calculer le montant restant
  const calculateRemainingAmount = React.useCallback((amount: number, selectedCardIds: Set<string>) => {
    let totalCapacity = 0
    
    selectedCardIds.forEach(cardId => {
      const card = availableCards.find(c => c.id === cardId)
      if (card) {
        // Disponibilité = limite mensuelle - utilisation mensuelle
        const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
        // Le montant par transaction ne peut pas dépasser la limite de recharge
        const maxPerTransaction = Number(card.recharge_limit)
        // La capacité effective est le minimum entre la disponibilité mensuelle et la limite de recharge
        const effectiveCapacity = Math.min(monthlyAvailable, maxPerTransaction)
        totalCapacity += Math.max(0, effectiveCapacity)
      }
    })
    
    return Math.max(0, amount - totalCapacity)
  }, [availableCards])

  // Fonction pour charger les plafonds par pays
  const loadCountryLimits = React.useCallback(async () => {
    try {
      console.log('🔄 Chargement des plafonds par pays...')
      const res = await fetch("/api/country-limits")
      const data = await res.json()
      
      console.log('📊 Réponse API plafonds:', { status: res.status, data })
      
      if (res.ok && data?.ok) {
        console.log('✅ Plafonds chargés:', data.data.limits)
        setCountryLimits(data.data.limits)
      } else {
        console.error('❌ Erreur lors du chargement des plafonds:', data.error)
        // En cas d'erreur, utiliser les plafonds par défaut
        const defaultLimits = [
          { country: "Mali" as const, monthly_limit: 2400000, recharge_limit: 810000 },
          { country: "RDC" as const, monthly_limit: 2500000, recharge_limit: 550000 },
          { country: "France" as const, monthly_limit: 2500000, recharge_limit: 650000 },
          { country: "Congo" as const, monthly_limit: 2000000, recharge_limit: 800000 }
        ]
        setCountryLimits(defaultLimits)
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des plafonds:', error)
      // En cas d'erreur, utiliser les plafonds par défaut
      const defaultLimits = [
        { country: "Mali" as const, monthly_limit: 2400000, recharge_limit: 810000 },
        { country: "RDC" as const, monthly_limit: 2500000, recharge_limit: 550000 },
        { country: "France" as const, monthly_limit: 2500000, recharge_limit: 650000 },
        { country: "Congo" as const, monthly_limit: 2000000, recharge_limit: 800000 }
      ]
      setCountryLimits(defaultLimits)
    }
  }, [])

  // Fonction pour mettre à jour les plafonds par pays
  const updateCountryLimits = React.useCallback(async (country: "Mali" | "RDC" | "France" | "Congo", monthlyLimit: number, rechargeLimit: number) => {
    setUpdatingCountryLimits(true)
    try {
      const res = await fetch("/api/country-limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          monthly_limit: monthlyLimit,
          recharge_limit: rechargeLimit
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        alert(`Plafonds mis à jour avec succès pour ${country}`)
        
        // Recharger les plafonds et les cartes
        await loadCountryLimits()
        await loadCards()
      } else {
        alert(`Erreur: ${data.error || "Erreur lors de la mise à jour"}`)
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des plafonds:', error)
      alert('Erreur lors de la mise à jour des plafonds')
    } finally {
      setUpdatingCountryLimits(false)
    }
  }, [loadCountryLimits, loadCards])

  // Charger les plafonds par pays au montage
  React.useEffect(() => {
    loadCountryLimits()
  }, [loadCountryLimits])

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
      const res = await fetch('/api/cards/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: Array.from(selectedCards)
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        await loadCards()
        clearSelection()
        setBulkDeleteOpen(false)
        alert(`${data.data.deleted_count} cartes supprimées avec succès`)
      } else {
        alert(`Erreur lors de la suppression: ${data?.error || 'Erreur inconnue'}`)
      }
    } catch (error) {
      alert(`Erreur lors de la suppression: ${error}`)
    } finally {
      setPending(false)
    }
  }

  // Fonction pour réinitialiser l'usage des cartes
  const handleResetUsage = async () => {
    setPending(true)
    try {
      const res = await fetch("/api/cards/reset-usage", { method: "POST" })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        alert(data.message || "Usage des cartes réinitialisé avec succès")
        await loadCards()
        setResetUsageOpen(false)
      } else {
        alert(`Erreur: ${data.error || "Erreur lors de la réinitialisation"}`)
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error)
      alert('Erreur lors de la réinitialisation de l\'usage')
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

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'Mali': '🇲🇱',
      'RDC': '🇨🇩',
      'France': '🇫🇷',
      'Congo': '🇨🇬'
    }
    return flags[country] || '🌍'
  }

  const getAvailableCountries = () => {
    const countries = [...new Set(cards.map(card => card.country))]
    return countries.sort()
  }

  // Fonction pour gérer le tri
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  // Fonction pour obtenir la valeur de tri
  const getSortValue = (card: CardData, field: typeof sortField) => {
    switch (field) {
      case "cid":
        return card.cid
      case "country":
        return card.country
      case "status":
        return card.status
      case "monthly_limit":
        return Number(card.monthly_limit)
      case "monthly_used":
        return Number(card.monthly_used)
      case "availability":
        return Number(card.monthly_limit) - Number(card.monthly_used)
      case "usage_percentage":
        return getUsagePercentage(card.monthly_used, card.monthly_limit)
      case "recharge_limit":
        return Number(card.recharge_limit)
      case "last_recharge_date":
        return card.last_recharge_date ? new Date(card.last_recharge_date).getTime() : 0
      default:
        return card.cid
    }
  }

  const filtered = filteredCards
    .filter((c) => (statusFilter === "all" ? true : c.status === statusFilter))
    .filter((c) => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return c.cid.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)
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
    .sort((a, b) => {
      const aValue = getSortValue(a, sortField)
      const bValue = getSortValue(b, sortField)
      
      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
      return 0
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
    country: "Mali" | "RDC" | "France" | "Congo"
    last_recharge_date?: string
    expiration_date?: string
    status: "active" | "inactive"
    monthly_limit: number
    recharge_limit: number
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

  async function handleRecharge() {
    if (!selectedCardForRecharge || !rechargeAmount || parseFloat(rechargeAmount) <= 0) {
      alert("Montant requis")
      return
    }

    const amount = parseFloat(rechargeAmount)
    if (amount > selectedCardForRecharge.recharge_limit) {
      alert(`Le montant ne peut pas dépasser la limite de recharge de ${formatCurrency(selectedCardForRecharge.recharge_limit)}`)
      return
    }

    setPending(true)
    try {
      const res = await fetch("/api/cards/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: selectedCardForRecharge.id,
          amount: amount,
          notes: rechargeNotes
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      
      alert("Recharge effectuée avec succès")
      setRechargeOpen(false)
      setSelectedCardForRecharge(null)
      setRechargeAmount("")
      setRechargeNotes("")
      await loadCards()
    } finally {
      setPending(false)
    }
  }

  // Fonction pour gérer la sélection des cartes
  const handleCardSelection = (cardId: string, checked: boolean) => {
    const newSelection = new Set(selectedCards)
    if (checked) {
      newSelection.add(cardId)
    } else {
      newSelection.delete(cardId)
    }
    setSelectedCards(newSelection)
  }

  // Fonction pour sélectionner/désélectionner toutes les cartes
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Sélectionner seulement les cartes non épuisées
      const availableIds = new Set(availableCards
        .filter(card => {
          const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
          return monthlyAvailable > 0
        })
        .map(card => card.id)
      )
      setSelectedCards(availableIds)
    } else {
      setSelectedCards(new Set())
    }
  }

  // Fonction pour exécuter la distribution
  const handleDistribution = async () => {
    if (!distributionAmount || selectedCards.size === 0) {
      alert('Veuillez saisir un montant et sélectionner au moins une carte')
      return
    }

    setPending(true)
    try {
      const res = await fetch('/api/cards/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseInt(distributionAmount),
          country: selectedCountry,
          cardIds: Array.from(selectedCards)
        })
      })

      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || 'Erreur lors de la distribution')
        return
      }

      alert(`Distribution réussie ! ${data.data.cards_used} cartes utilisées, ${data.data.total_distributed.toLocaleString()} XAF distribués`)
      
      // Réinitialiser le formulaire
      setDistributionAmount("")
      setSelectedCards(new Set())
      setRemainingAmount(0)
      setDistributionOpen(false)
      
      // Recharger les cartes
      await loadCards()
    } catch (error) {
      console.error('Erreur lors de la distribution:', error)
      alert('Erreur lors de la distribution')
    } finally {
      setPending(false)
    }
  }

  // Charger les cartes disponibles quand le pays change
  React.useEffect(() => {
    if (distributionOpen && selectedCountry) {
      loadAvailableCards(selectedCountry)
      setSelectedCards(new Set()) // Réinitialiser la sélection
    }
  }, [distributionOpen, selectedCountry, loadAvailableCards])

  // Calculer le montant restant quand les cartes sélectionnées ou le montant changent
  React.useEffect(() => {
    if (distributionAmount && selectedCards.size > 0) {
      const amount = parseInt(distributionAmount) || 0
      const remaining = calculateRemainingAmount(amount, selectedCards)
      setRemainingAmount(remaining)
    } else {
      setRemainingAmount(parseInt(distributionAmount) || 0)
    }
  }, [distributionAmount, selectedCards, calculateRemainingAmount])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gestion des Cartes</h1>
        <div className="flex items-center space-x-2">
          {/* Bouton Distribuer - Vert et plus gros */}
          <Button 
            onClick={() => setDistributionOpen(true)} 
            disabled={pending}
            className="bg-green-600 hover:bg-green-700 text-white h-10 px-6"
          >
            <DollarSign className="h-5 w-5 mr-2" />
            Distribuer
          </Button>
          
          {/* Bouton Importer Excel */}
          <Button 
            variant="outline" 
            onClick={() => setImportOpen(true)} 
            disabled={pending}
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer Excel
          </Button>
          
          {/* Bouton Nouvelle carte */}
          <Button onClick={onCreate} disabled={pending}>
            <CreditCard className="h-4 w-4 mr-2" />
            Nouvelle carte
          </Button>
          
          {/* Bouton Plafonds */}
          <Button 
            onClick={() => {
              setCountryLimitsOpen(true)
              loadCountryLimits()
            }}
            disabled={pending}
            variant="outline"
            className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
          >
            <Zap className="h-4 w-4 mr-2" />
            Plafonds
          </Button>
          
          {/* Bouton Historique des actions */}
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/cards/history'} 
            disabled={pending}
          >
            <History className="h-4 w-4 mr-2" />
            Historique des actions
          </Button>
          
          {/* Bouton Réinitialiser avec libellé - Rouge */}
          <Button 
            onClick={() => setResetUsageOpen(true)} 
            disabled={pending}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Réinitialiser
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
                <p className="text-2xl font-bold">{filteredStats.totalCards}</p>
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
                <p className="text-2xl font-bold">{filteredStats.activeCardsCount}</p>
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
                <p className="text-lg font-bold">{formatCurrency(filteredStats.totalLimit)}</p>
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
                <p className="text-lg font-bold">{formatCurrency(filteredStats.totalUsed)}</p>
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
                  {formatCurrency(filteredStats.totalAvailable)}
                </p>
                <p className="text-xs text-gray-500">
                  {filteredStats.availableCardsCount} cartes disponibles
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
              <Select value={countryFilter} onValueChange={(v: any) => setCountryFilter(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous pays</SelectItem>
                  {getAvailableCountries().map(country => (
                    <SelectItem key={country} value={country}>
                      {getCountryFlag(country)} {country}
                    </SelectItem>
                  ))}
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
                  {[
                    { label: "CID", field: "cid" as const },
                    { label: "Pays", field: "country" as const },
                    { label: "Statut", field: "status" as const },
                    { label: "Limite Mensuelle", field: "monthly_limit" as const },
                    { label: "Utilisé", field: "monthly_used" as const },
                    { label: "Disponibilité", field: "availability" as const },
                    { label: "Usage %", field: "usage_percentage" as const },
                    { label: "Limite Recharge", field: "recharge_limit" as const },
                    { label: "Dernière Recharge", field: "last_recharge_date" as const },
                    { label: "Actions", field: null }
                  ].map(({ label, field }) => (
                    <th key={label} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      {field ? (
                        <button
                          onClick={() => handleSort(field)}
                          className="flex items-center space-x-1 hover:text-gray-700 transition-colors"
                        >
                          <span>{label}</span>
                          <div className="flex flex-col">
                            <ChevronUp 
                              className={`h-3 w-3 ${
                                sortField === field && sortDirection === "asc" 
                                  ? "text-blue-600" 
                                  : "text-gray-300"
                              }`} 
                            />
                            <ChevronDown 
                              className={`h-3 w-3 -mt-1 ${
                                sortField === field && sortDirection === "desc" 
                                  ? "text-blue-600" 
                                  : "text-gray-300"
                              }`} 
                            />
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center space-x-1">
                          <MoreHorizontal className="h-4 w-4" />
                          <span>{label}</span>
                        </div>
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
                        <div className="flex items-center gap-2">
                          <span>{getCountryFlag(card.country)}</span>
                          <span>{card.country}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge variant={card.status === 'active' ? 'default' : 'secondary'}>
                          {card.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(card.monthly_limit)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(card.monthly_used)}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-medium">
                        {formatCurrency(Number(card.monthly_limit) - Number(card.monthly_used))}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={getUsageColor(usagePercentage)}>
                          {usagePercentage}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatCurrency(card.recharge_limit)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {card.last_recharge_date ? new Date(card.last_recharge_date).toLocaleDateString('fr-FR') : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <TooltipProvider>
                          <div className="flex items-center space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    setSelectedCardForRecharge(card)
                                    setRechargeOpen(true)
                                  }} 
                                  disabled={pending}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <Zap className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Recharger la carte</p>
                              </TooltipContent>
                            </Tooltip>
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
                    <td className="px-6 py-8 text-sm text-gray-500 text-center" colSpan={10}>
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
        amount={distributionAmount}
        setAmount={setDistributionAmount}
        selectedCountry={selectedCountry}
        setSelectedCountry={setSelectedCountry}
        availableCards={availableCards}
        selectedCards={selectedCards}
        onCardSelection={handleCardSelection}
        onSelectAll={handleSelectAll}
        remainingAmount={remainingAmount}
        onDistribute={handleDistribution}
        pending={pending}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={() => loadCards()}
        pending={pending}
        defaultCountry={defaultCountry}
        setDefaultCountry={setDefaultCountry}
      />

      <CountryLimitsDialog
        open={countryLimitsOpen}
        onOpenChange={setCountryLimitsOpen}
        limits={countryLimits}
        onUpdate={updateCountryLimits}
        pending={updatingCountryLimits}
      />

      <BulkDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        onConfirm={handleBulkDelete}
        selectedCount={selectedCards.size}
        pending={pending}
      />

      <ResetUsageDialog
        open={resetUsageOpen}
        onOpenChange={setResetUsageOpen}
        onConfirm={handleResetUsage}
        pending={pending}
      />

      <RechargeDialog
        open={rechargeOpen}
        onOpenChange={setRechargeOpen}
        onRecharge={handleRecharge}
        card={selectedCardForRecharge}
        amount={rechargeAmount}
        setAmount={setRechargeAmount}
        notes={rechargeNotes}
        setNotes={setRechargeNotes}
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
  const [country, setCountry] = React.useState<"Mali" | "RDC" | "France" | "Congo">("Mali")
  const [lastRechargeDate, setLastRechargeDate] = React.useState("")
  const [expirationDate, setExpirationDate] = React.useState("")
  const [status, setStatus] = React.useState<"active" | "inactive">("active")
  const [monthlyLimit, setMonthlyLimit] = React.useState("2000000")
  const [rechargeLimit, setRechargeLimit] = React.useState("500000")

  React.useEffect(() => {
    if (initial) {
      setCid(initial.cid)
      setCountry(initial.country)
      setLastRechargeDate(initial.last_recharge_date || "")
      setExpirationDate(initial.expiration_date || "")
      setStatus(initial.status)
      setMonthlyLimit(initial.monthly_limit.toString())
      setRechargeLimit(initial.recharge_limit.toString())
    } else {
      setCid("")
      setCountry("Mali")
      setLastRechargeDate("")
      setExpirationDate("")
      setStatus("active")
      setMonthlyLimit("2000000")
      setRechargeLimit("500000")
    }
  }, [initial, open])

  // Mettre à jour automatiquement les plafonds quand le pays change
  React.useEffect(() => {
    // Pour les nouvelles cartes ou si le pays a été modifié
    if (!initial || (initial && country !== initial.country)) {
      const limits = getCountryLimits(country)
      setMonthlyLimit(limits.monthly_limit.toString())
      setRechargeLimit(limits.recharge_limit.toString())
    }
  }, [country, initial])

  // Déterminer si les plafonds doivent être désactivés
  const areLimitsDisabled = initial && country === initial.country

  function handleSubmit() {
    onSubmit({
      id: initial?.id,
      cid,
      country,
      last_recharge_date: lastRechargeDate || undefined,
      expiration_date: expirationDate || undefined,
      status,
      monthly_limit: parseInt(monthlyLimit),
      recharge_limit: parseInt(rechargeLimit)
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
          
          <div>
            <Label htmlFor="country">Pays *</Label>
            <Select value={country} onValueChange={(v: any) => setCountry(v)}>
              <SelectTrigger className="mt-1">
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
                disabled={areLimitsDisabled}
              />
              {areLimitsDisabled && (
                <p className="text-xs text-gray-500 mt-1">
                  ⚠️ La modification des plafonds est désactivée pour les cartes existantes
                </p>
              )}
              {initial && country !== initial.country && (
                <p className="text-xs text-green-600 mt-1">
                  ✅ Les plafonds ont été mis à jour selon le nouveau pays
                </p>
              )}
            </div>
          </div>
          
          <div>
            <Label htmlFor="rechargeLimit">Limite de Recharge (XAF)</Label>
            <Input 
              id="rechargeLimit" 
              type="number"
              className="mt-1" 
              value={rechargeLimit} 
              onChange={(e) => setRechargeLimit(e.target.value)}
              disabled={areLimitsDisabled}
            />
            {areLimitsDisabled && (
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ La modification des plafonds est désactivée pour les cartes existantes
              </p>
            )}
            {initial && country !== initial.country && (
              <p className="text-xs text-green-600 mt-1">
                ✅ Les plafonds ont été mis à jour selon le nouveau pays
              </p>
            )}
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

// Composant pour le dialog de distribution en masse
function DistributionDialog({
  open,
  onOpenChange,
  amount,
  setAmount,
  selectedCountry,
  setSelectedCountry,
  availableCards,
  selectedCards,
  onCardSelection,
  onSelectAll,
  remainingAmount,
  onDistribute,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: string
  setAmount: (amount: string) => void
  selectedCountry: "Mali" | "RDC" | "France" | "Congo"
  setSelectedCountry: (country: "Mali" | "RDC" | "France" | "Congo") => void
  availableCards: CardData[]
  selectedCards: Set<string>
  onCardSelection: (cardId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  remainingAmount: number
  onDistribute: () => void
  pending: boolean
}) {
  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'Mali': '🇲🇱',
      'RDC': '🇨🇩',
      'France': '🇫🇷',
      'Congo': '🇨🇬'
    }
    return flags[country] || '🌍'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const getCapacityColor = (capacity: number, limit: number) => {
    const percentage = (capacity / limit) * 100
    if (percentage >= 90) return "text-red-600"
    if (percentage >= 75) return "text-orange-600"
    return "text-green-600"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Distribution en Masse
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Étape 1: Montant à distribuer */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-800 mb-3">1. Montant à Distribuer</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="amount">Montant Total (XAF) *</Label>
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
                <Label htmlFor="country">Pays *</Label>
                <Select value={selectedCountry} onValueChange={(value: "Mali" | "RDC" | "France" | "Congo") => setSelectedCountry(value)}>
                  <SelectTrigger className="mt-1">
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
            </div>
          </div>

          {/* Étape 2: Cartes disponibles */}
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-green-800">
                2. Cartes Disponibles - {getCountryFlag(selectedCountry)} {selectedCountry}
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableCards.filter(card => {
                    const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
                    return monthlyAvailable > 0
                  }).length > 0 && selectedCards.size === availableCards.filter(card => {
                    const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
                    return monthlyAvailable > 0
                  }).length}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-green-700">Tout sélectionner</span>
            </div>
          </div>

            {availableCards.filter(card => {
              const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
              return monthlyAvailable > 0
            }).length === 0 ? (
              <p className="text-gray-500 text-center py-4">Aucune carte disponible pour ce pays</p>
            ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                       {availableCards
                         .filter((card) => {
                           // Filtrer les cartes épuisées (disponibilité = 0)
                           const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
                           return monthlyAvailable > 0
                         })
                         .map((card) => {
                           // Disponibilité = limite mensuelle - utilisation mensuelle
                           const monthlyAvailable = Number(card.monthly_limit) - Number(card.monthly_used)
                           const isSelected = selectedCards.has(card.id)
                  
                  return (
                    <div 
                      key={card.id} 
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-100 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => onCardSelection(card.id, !isSelected)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            onCardSelection(card.id, e.target.checked)
                          }}
                          className="rounded"
                        />
                        <span className="font-medium text-sm">{card.cid}</span>
                        <Badge variant={card.status === 'active' ? 'default' : 'secondary'}>
                          {card.status === 'active' ? 'Active' : 'Inactive'}
                        </Badge>
                  </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Disponibilité:</span>
                          <span className="text-green-600 font-medium">
                            {formatCurrency(monthlyAvailable)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Limite:</span>
                          <span>{formatCurrency(Number(card.recharge_limit))}</span>
                    </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Utilisé:</span>
                          <span>{formatCurrency(Number(card.monthly_used))}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
                  </div>
                )}
              </div>

          {/* Étape 3: Résumé et montant restant */}
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="font-semibold text-purple-800 mb-3">3. Résumé de la Distribution</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{selectedCards.size}</div>
                <div className="text-sm text-purple-700">Cartes Sélectionnées</div>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(parseInt(amount) || 0)}
                </div>
                <div className="text-sm text-green-700">Montant Total</div>
              </div>
              
              <div className="text-center">
                <div className={`text-2xl font-bold ${remainingAmount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatCurrency(remainingAmount)}
                </div>
                <div className={`text-sm ${remainingAmount > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                  {remainingAmount > 0 ? 'Montant Restant' : 'Tout Distribué'}
                </div>
              </div>
            </div>

            {remainingAmount > 0 && (
              <div className="mt-3 p-3 bg-orange-100 border border-orange-200 rounded-lg">
                <p className="text-orange-800 text-sm">
                  ⚠️ <strong>{formatCurrency(remainingAmount)}</strong> ne pourront pas être distribués 
                  car les cartes sélectionnées n'ont pas assez de capacité disponible.
                </p>
            </div>
          )}
        </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
          </Button>
            <Button 
              onClick={onDistribute}
              disabled={pending || !amount || selectedCards.size === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {pending ? 'Distribution...' : 'Distribuer'}
          </Button>
          </div>
        </div>
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
  defaultCountry,
  setDefaultCountry,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onImport: () => void
  pending: boolean
  defaultCountry: "Mali" | "RDC" | "France" | "Congo"
  setDefaultCountry: (country: "Mali" | "RDC" | "France" | "Congo") => void
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
        body: JSON.stringify({ cards: parsedData, country: defaultCountry }),
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
          
          <div>
            <Label htmlFor="defaultCountry">Pays par défaut (optionnel)</Label>
            <Select value={defaultCountry} onValueChange={(value: "Mali" | "RDC" | "France" | "Congo") => setDefaultCountry(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choisir un pays" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mali">Mali</SelectItem>
                <SelectItem value="RDC">RDC</SelectItem>
                <SelectItem value="France">France</SelectItem>
                <SelectItem value="Congo">Congo</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500 mt-1">
              💡 Le pays sera appliqué à toutes les cartes importées (par défaut: Mali)
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
              <li>• <strong>Pays:</strong> Optionnel - sera défini selon votre sélection ci-dessus</li>
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

// Composant pour le dialog de recharge
function RechargeDialog({
  open,
  onOpenChange,
  onRecharge,
  card,
  amount,
  setAmount,
  notes,
  setNotes,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecharge: () => void
  card: CardData | null
  amount: string
  setAmount: (v: string) => void
  notes: string
  setNotes: (v: string) => void
  pending: boolean
}) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XAF',
      minimumFractionDigits: 0
    }).format(amount)
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-green-600" />
            <span>Recharger la carte</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {card && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">CID:</span>
                <span className="font-mono">{card.cid}</span>
                <span>{getCountryFlag(card.country)}</span>
                <span>{card.country}</span>
              </div>
              <div className="text-sm text-gray-600">
                <div>Limite de recharge: <span className="font-semibold text-green-600">{formatCurrency(card.recharge_limit)}</span></div>
                <div>Utilisation mensuelle: <span className="font-semibold">{formatCurrency(card.monthly_used)} / {formatCurrency(card.monthly_limit)}</span></div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="rechargeAmount">Montant à recharger (XAF) *</Label>
            <Input 
              id="rechargeAmount" 
              type="number"
              className="mt-1" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 100000"
              max={card?.recharge_limit || undefined}
            />
            {card && (
              <p className="text-xs text-gray-500 mt-1">
                Maximum: {formatCurrency(card.recharge_limit)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="rechargeNotes">Notes (optionnel)</Label>
            <Input 
              id="rechargeNotes" 
              className="mt-1" 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Commentaires sur la recharge..."
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button 
            onClick={onRecharge} 
            disabled={pending || !amount || parseFloat(amount) <= 0 || (card && parseFloat(amount) > card.recharge_limit)}
            className="bg-green-600 hover:bg-green-700"
          >
            {pending ? "Recharge..." : "Recharger"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour la suppression en lot
function BulkDeleteDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  selectedCount, 
  pending 
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  selectedCount: number
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-red-600" />
            Supprimer les cartes sélectionnées
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <p className="text-sm text-gray-600">
            Êtes-vous sûr de vouloir supprimer <span className="font-semibold text-red-600">{selectedCount}</span> carte{selectedCount > 1 ? 's' : ''} ?
          </p>
          <p className="text-xs text-red-500 mt-2">
            ⚠️ Cette action est irréversible.
          </p>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button 
            variant="destructive" 
            onClick={onConfirm} 
            disabled={pending}
            className="bg-red-600 hover:bg-red-700"
          >
            {pending ? "Suppression..." : `Supprimer ${selectedCount} carte${selectedCount > 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour la gestion des plafonds par pays
function CountryLimitsDialog({
  open,
  onOpenChange,
  limits,
  onUpdate,
  pending
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  limits: Array<{
    country: "Mali" | "RDC" | "France" | "Congo"
    monthly_limit: number
    recharge_limit: number
  }>
  onUpdate: (country: "Mali" | "RDC" | "France" | "Congo", monthlyLimit: number, rechargeLimit: number) => void
  pending: boolean
}) {
  const [editingCountry, setEditingCountry] = React.useState<"Mali" | "RDC" | "France" | "Congo" | null>(null)
  const [monthlyLimit, setMonthlyLimit] = React.useState("")
  const [rechargeLimit, setRechargeLimit] = React.useState("")

  const getCountryFlag = (country: string) => {
    const flags: Record<string, string> = {
      'Mali': '🇲🇱',
      'RDC': '🇨🇩', 
      'France': '🇫🇷',
      'Congo': '🇨🇬'
    }
    return flags[country] || '🌍'
  }

  const handleEdit = (country: "Mali" | "RDC" | "France" | "Congo") => {
    const limit = limits.find(l => l.country === country)
    if (limit) {
      setEditingCountry(country)
      setMonthlyLimit(limit.monthly_limit.toString())
      setRechargeLimit(limit.recharge_limit.toString())
    }
  }

  const handleSave = () => {
    if (!editingCountry || !monthlyLimit || !rechargeLimit) return
    
    const monthly = parseInt(monthlyLimit)
    const recharge = parseInt(rechargeLimit)
    
    if (isNaN(monthly) || isNaN(recharge) || monthly <= 0 || recharge <= 0) {
      alert("Les limites doivent être des nombres positifs")
      return
    }
    
    if (recharge > monthly) {
      alert("La limite de recharge ne peut pas dépasser la limite mensuelle")
      return
    }
    
    onUpdate(editingCountry, monthly, recharge)
    setEditingCountry(null)
    setMonthlyLimit("")
    setRechargeLimit("")
  }

  const handleCancel = () => {
    setEditingCountry(null)
    setMonthlyLimit("")
    setRechargeLimit("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-600" />
            Gestion des Plafonds par Pays
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-1">Instructions:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Cliquez sur "Modifier" pour changer les plafonds d'un pays</li>
              <li>• Les nouvelles cartes utiliseront automatiquement ces plafonds</li>
              <li>• Les cartes existantes sont automatiquement mises à jour</li>
              <li>• La limite de recharge ne peut pas dépasser la limite mensuelle</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {limits.map((limit) => (
              <Card key={limit.country} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getCountryFlag(limit.country)}</span>
                    <h3 className="font-semibold text-lg">{limit.country}</h3>
                  </div>
                  {editingCountry === limit.country ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSave} disabled={pending}>
                        Enregistrer
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancel}>
                        Annuler
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleEdit(limit.country)}
                      disabled={pending}
                    >
                      Modifier
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Limite Mensuelle (XAF)</Label>
                    {editingCountry === limit.country ? (
                      <Input
                        type="number"
                        value={monthlyLimit}
                        onChange={(e) => setMonthlyLimit(e.target.value)}
                        className="mt-1"
                        placeholder="Ex: 2400000"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {limit.monthly_limit.toLocaleString()} XAF
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Limite de Recharge (XAF)</Label>
                    {editingCountry === limit.country ? (
                      <Input
                        type="number"
                        value={rechargeLimit}
                        onChange={(e) => setRechargeLimit(e.target.value)}
                        className="mt-1"
                        placeholder="Ex: 810000"
                      />
                    ) : (
                      <p className="text-lg font-semibold text-gray-900 mt-1">
                        {limit.recharge_limit.toLocaleString()} XAF
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Composant pour la réinitialisation de l'usage
function ResetUsageDialog({ 
  open, 
  onOpenChange, 
  onConfirm, 
  pending 
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-600" />
            Réinitialiser l'usage des cartes
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4 space-y-3">
          <p className="text-sm text-gray-600">
            Cette action va remettre à <span className="font-semibold text-orange-600">0</span> l'utilisation mensuelle de toutes les cartes actives.
          </p>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-xs text-orange-800">
              ⚠️ <strong>Attention :</strong> Cette action affectera toutes les cartes actives du système.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Êtes-vous sûr de vouloir continuer ?
          </p>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={pending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {pending ? "Réinitialisation..." : "Réinitialiser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
