"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ROLE_MAPPING } from "@/lib/users-queries"

type User = {
  id: string
  name: string
  email: string
  role: "super_admin" | "director" | "accounting" | "cashier" | "auditor" | "delegate" | "executor" | "cash_manager"
  agency: string
  password_hash?: string
  last_login?: string
  created_at: string
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

type FilterKey = "all" | "director" | "accounting" | "cashier" | "auditor" | "delegate" | "executor" | "cash_manager"

export function UsersView() {
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [availableRoles, setAvailableRoles] = useState<string[]>([
    "Directeur Général",
    "Comptable", 
    "Auditeur",
    "Caissier",
    "Délégué",
    "Exécuteur",
    "Responsable caisse",
    "Admin"
  ])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const { toast } = useToast()

  // États du formulaire
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    roleLabel: "",
    agency: "",
    password: ""
  })

  // Charger les données depuis l'API
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch("/api/users")
        const data = await res.json()
        if (res.ok && data?.ok) {
          setUsers(data.data.users)
          setAgencies(data.data.agencies)
          setAvailableRoles(data.data.availableRoles || [])
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de charger les utilisateurs",
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
    loadData()
  }, [toast])

  const handleCreateUser = async () => {
    console.log('🔍 Données du formulaire:', formData)
    console.log('🔍 Agences disponibles:', agencies)
    console.log('🔍 Rôles disponibles:', availableRoles)
    
    if (!formData.name.trim() || !formData.email.trim() || !formData.roleLabel || !formData.agency || !formData.password.trim()) {
      console.log('❌ Validation échouée:', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        roleLabel: formData.roleLabel,
        agency: formData.agency,
        password: formData.password.trim()
      })
      toast({
        title: "Erreur",
        description: "Tous les champs sont requis",
        variant: "destructive"
      })
      return
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          roleLabel: formData.roleLabel,
          agency: formData.agency,
          password: formData.password.trim()
        })
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        setUsers(prev => [data.data, ...prev])
        setFormData({ name: "", email: "", roleLabel: "", agency: "", password: "" })
        setDialogOpen(false)
        toast({
          title: "Succès",
          description: `Utilisateur "${formData.name}" créé avec succès`
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
        description: "Impossible de créer l'utilisateur",
        variant: "destructive"
      })
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      user.agency.toLowerCase().includes(search.toLowerCase())
    
    const matchesFilter = filter === "all" || user.role === filter
    
    return matchesSearch && matchesFilter
  })

  const getRoleLabel = (role: User["role"]) => {
    const entry = Object.entries(ROLE_MAPPING).find(([_, value]) => value === role)
    return entry ? entry[0] : role
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des utilisateurs</h2>
        <Button onClick={() => setDialogOpen(true)}>Nouvel utilisateur</Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-medium">Liste des utilisateurs ({filteredUsers.length})</div>
          <div className="flex gap-2">
            <Input 
              placeholder="Rechercher..." 
              className="w-56" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={filter} onValueChange={(value: FilterKey) => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="director">Directeur</SelectItem>
                <SelectItem value="accounting">Comptable</SelectItem>
                <SelectItem value="cashier">Caissier</SelectItem>
                <SelectItem value="auditor">Auditeur</SelectItem>
                <SelectItem value="delegate">Délégué</SelectItem>
                <SelectItem value="executor">Exécuteur</SelectItem>
                <SelectItem value="cash_manager">Responsable caisse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Nom","Email","Rôle","Agence","Dernière connexion","Actions"].map((h)=>(
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredUsers.map((user)=>(
                <tr key={user.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{getRoleLabel(user.role)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.agency}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Jamais"}
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
          <div>Affichage <span>1</span>-<span>{filteredUsers.length}</span> sur <span>{filteredUsers.length}</span></div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>Précédent</Button>
            <Button variant="outline" size="sm" disabled>Suivant</Button>
          </div>
        </div>
      </Card>

      {/* Dialog pour créer un nouvel utilisateur */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
            <DialogTitle>Nouvel utilisateur</DialogTitle>
            <DialogDescription>
              Créez un nouvel utilisateur avec les informations suivantes.
            </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
              <Label htmlFor="name">Nom complet *</Label>
              <Input
                id="name"
                className="mt-1"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Jean Dupont"
              />
          </div>
          <div>
              <Label htmlFor="email">Email *</Label>
            <Input
                id="email"
              type="email"
              className="mt-1"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Ex: jean.dupont@example.com"
            />
          </div>
            <div>
              <Label htmlFor="role">Rôle *</Label>
              <Select value={formData.roleLabel} onValueChange={(value) => setFormData(prev => ({ ...prev, roleLabel: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionnez un rôle" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="agency">Agence *</Label>
              <Select value={formData.agency} onValueChange={(value) => setFormData(prev => ({ ...prev, agency: value }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionnez une agence" />
                </SelectTrigger>
                <SelectContent>
                  {agencies.map((agency) => (
                    <SelectItem key={agency.id} value={agency.name}>
                      {agency.name} ({agency.country})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="password">Mot de passe *</Label>
              <Input
                id="password"
                type="password"
                className="mt-1"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mot de passe temporaire"
              />
            </div>
          </div>
        <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
            Annuler
          </Button>
            <Button onClick={handleCreateUser}>
              Créer l'utilisateur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  )
}