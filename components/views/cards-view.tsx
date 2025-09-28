"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

type CardData = {
  id: string
  card_number: string
  card_type: "debit" | "credit" | "prepaid"
  holder_name: string
  expiry_date: string
  status: "active" | "inactive" | "blocked" | "expired"
  agency: string
  created_by: string
  created_at: string
  updated_at: string
}

export function CardsView() {
  const [cards, setCards] = useState<CardData[]>([])
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "blocked" | "expired">("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    card_number: "",
    card_type: "",
    holder_name: "",
    expiry_date: ""
  })
  const { toast } = useToast()

  // Charger les cartes depuis l'API
  useEffect(() => {
    const loadCards = async () => {
      try {
        const res = await fetch("/api/cards")
        const data = await res.json()
        if (res.ok && data?.ok) {
          setCards(data.data)
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
      }
    }
    loadCards()
  }, [toast])

  const handleCreateCard = async () => {
    if (!formData.card_number.trim() || !formData.card_type || !formData.holder_name.trim() || !formData.expiry_date) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_number: formData.card_number.trim(),
          card_type: formData.card_type,
          holder_name: formData.holder_name.trim(),
          expiry_date: formData.expiry_date
        })
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        setCards(prev => [data.data, ...prev])
        setFormData({ card_number: "", card_type: "", holder_name: "", expiry_date: "" })
        setIsDialogOpen(false)
        toast({
          title: "Succès",
          description: `Carte "${formData.card_number}" créée avec succès`
        })
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la création",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur réseau",
        description: "Impossible de créer la carte",
        variant: "destructive"
      })
    }
  }

  const filteredCards = cards.filter(card => {
    const matchesSearch = 
      card.card_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.holder_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.agency.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesFilter = filter === "all" || card.status === filter
    
    return matchesSearch && matchesFilter
  })

  const getStatusColor = (status: CardData["status"]) => {
    switch (status) {
      case "active": return "bg-emerald-100 text-emerald-800"
      case "inactive": return "bg-gray-100 text-gray-800"
      case "blocked": return "bg-red-100 text-red-800"
      case "expired": return "bg-orange-100 text-orange-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: CardData["status"]) => {
    switch (status) {
      case "active": return "Active"
      case "inactive": return "Inactive"
      case "blocked": return "Bloquée"
      case "expired": return "Expirée"
      default: return status
    }
  }

  const getTypeLabel = (type: CardData["card_type"]) => {
    switch (type) {
      case "debit": return "Débit"
      case "credit": return "Crédit"
      case "prepaid": return "Prépayée"
      default: return type
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des cartes</h2>
        <Button onClick={() => setIsDialogOpen(true)}>Nouvelle carte</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-medium">Liste des cartes ({filteredCards.length})</div>
          <div className="flex gap-2">
            <Input 
              placeholder="Rechercher..." 
              className="w-56" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="active">Actives</SelectItem>
                <SelectItem value="inactive">Inactives</SelectItem>
                <SelectItem value="blocked">Bloquées</SelectItem>
                <SelectItem value="expired">Expirées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Numéro","Type","Titulaire","Expiration","Agence","Statut","Actions"].map((h)=>(
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredCards.map((card)=>(
                <tr key={card.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{card.card_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{getTypeLabel(card.card_type)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{card.holder_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(card.expiry_date).toLocaleDateString()}
                    </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{card.agency}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`rounded-full px-2 py-1 text-xs ${getStatusColor(card.status)}`}>
                      {getStatusLabel(card.status)}
                    </span>
                    </td>
                  <td className="px-6 py-4 text-sm">
                    <Button variant="link" className="px-0 mr-3">Modifier</Button>
                    <Button variant="link" className="px-0 text-red-600">Supprimer</Button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 text-sm text-gray-500">
          <div>Affichage <span>1</span>-<span>{filteredCards.length}</span> sur <span>{filteredCards.length}</span></div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>Précédent</Button>
            <Button variant="outline" size="sm" disabled>Suivant</Button>
          </div>
        </div>
      </Card>

      {/* Dialog pour créer une nouvelle carte */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
      <DialogHeader>
            <DialogTitle>Nouvelle carte</DialogTitle>
            <DialogDescription>
              Créez une nouvelle carte avec les informations suivantes.
            </DialogDescription>
      </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="card_number">Numéro de carte *</Label>
              <Input
                id="card_number"
                className="mt-1"
                value={formData.card_number}
                onChange={(e) => setFormData(prev => ({ ...prev, card_number: e.target.value }))}
                placeholder="Ex: 1234 5678 9012 3456"
              />
            </div>
            <div>
              <Label htmlFor="card_type">Type de carte *</Label>
              <Select value={formData.card_type} onValueChange={(value) => setFormData(prev => ({ ...prev, card_type: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionnez un type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Débit</SelectItem>
                  <SelectItem value="credit">Crédit</SelectItem>
                  <SelectItem value="prepaid">Prépayée</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="holder_name">Nom du titulaire *</Label>
              <Input
                id="holder_name"
                className="mt-1"
                value={formData.holder_name}
                onChange={(e) => setFormData(prev => ({ ...prev, holder_name: e.target.value }))}
                placeholder="Ex: Jean Dupont"
              />
            </div>
            <div>
              <Label htmlFor="expiry_date">Date d'expiration *</Label>
              <Input
                id="expiry_date"
                type="date"
                className="mt-1"
                value={formData.expiry_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              />
            </div>
      </div>
      <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateCard}>
              Créer la carte
            </Button>
      </DialogFooter>
    </DialogContent>
      </Dialog>
    </div>
  )
}