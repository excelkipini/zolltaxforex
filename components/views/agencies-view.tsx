"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, Trash2, MoreHorizontal } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { AVAILABLE_COUNTRIES } from "@/lib/agencies-queries"

// Composant personnalisé pour la sélection du pays
function CountrySelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      id="country"
      name="country"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    >
      <option value="">-- Sélectionnez un pays --</option>
      <option value="Congo">Congo</option>
      <option value="RDC">RDC</option>
      <option value="Cameroun">Cameroun</option>
      <option value="France">France</option>
    </select>
  )
}

type Agency = {
  id: string
  name: string
  country: string
  address: string
  status: "active" | "inactive"
  users: number
  created_at: string
}

export function AgenciesView() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCountry, setNewCountry] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()


  // Charger les agences depuis l'API
  useEffect(() => {
    const loadAgencies = async () => {
      try {
        const res = await fetch("/api/agencies")
        const data = await res.json()
        if (res.ok && data?.ok) {
          setAgencies(data.data)
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de charger les agences",
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
    loadAgencies()
  }, [toast])

  const handleCreateAgency = async () => {
    if (!newName.trim() || !newCountry || !newAddress.trim()) {
      toast({
        title: "Erreur",
        description: "Tous les champs sont requis",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          country: newCountry,
          address: newAddress.trim()
        })
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        setAgencies(prev => [data.data, ...prev])
        setNewName("")
        setNewCountry("")
        setNewAddress("")
        setIsDialogOpen(false)
        toast({
          title: "Succès",
          description: `Agence "${newName}" créée avec succès`
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
        description: "Impossible de créer l'agence",
        variant: "destructive"
      })
    }
  }

  const filteredAgencies = agencies.filter(agency =>
    agency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
    agency.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des agences</h2>
        <Button onClick={() => setIsDialogOpen(true)}>Nouvelle agence</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-medium">Liste des agences ({filteredAgencies.length})</div>
          <Input 
            placeholder="Rechercher..." 
            className="w-56" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Nom","Pays","Adresse","Utilisateurs","Statut","Actions"].map((h)=>(
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
              {filteredAgencies.map((agency)=>(
                <tr key={agency.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{agency.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{agency.country}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{agency.address}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{agency.users}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`rounded-full px-2 py-1 text-xs ${agency.status==="active"?"bg-emerald-100 text-emerald-800":"bg-red-100 text-red-800"}`}>
                      {agency.status==="active"?"Active":"Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <TooltipProvider>
                      <div className="flex items-center space-x-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Modifier l'agence</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Supprimer l'agence</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 text-sm text-gray-500">
          <div>Affichage <span>1</span>-<span>{filteredAgencies.length}</span> sur <span>{filteredAgencies.length}</span></div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>Précédent</Button>
            <Button variant="outline" size="sm" disabled>Suivant</Button>
          </div>
        </div>
      </Card>

      {/* Dialog pour créer une nouvelle agence */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle agence</DialogTitle>
            <DialogDescription>
              Créez une nouvelle agence avec les informations suivantes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom de l'agence *</Label>
              <Input
                id="name"
                className="mt-1"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Agence Centrale"
              />
            </div>
            <div>
              <Label htmlFor="country">Pays *</Label>
              <div className="mt-1">
                <CountrySelector 
                  value={newCountry} 
                  onChange={setNewCountry}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Adresse *</Label>
              <Input
                id="address"
                className="mt-1"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Ex: Douala, Cameroun"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateAgency}>
              Créer l'agence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}