"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, Trash2, MoreHorizontal, RefreshCw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Agency, AgencyStatus } from "@/lib/types"
import { createAgencyAction, updateAgencyAction, deleteAgencyAction } from "./actions"

export default function AgenciesClient({ initialAgencies }: { initialAgencies: Agency[] }) {
  const [search, setSearch] = React.useState("")
  const [agencies, setAgencies] = React.useState<Agency[]>(initialAgencies)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Agency | null>(null)
  const [confirmId, setConfirmId] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  // Fonction pour charger les agences depuis l'API
  const loadAgencies = React.useCallback(async () => {
    try {
      const res = await fetch("/api/agencies")
      const data = await res.json()
      if (res.ok && data?.ok && Array.isArray(data.data)) {
        setAgencies(data.data)
      }
    } catch (error) {
    }
  }, [])

  // Charger les agences au montage du composant et toutes les 30 secondes
  React.useEffect(() => {
    loadAgencies()
    const interval = setInterval(loadAgencies, 30000) // Recharger toutes les 30 secondes
    return () => clearInterval(interval)
  }, [loadAgencies])

  const filtered = agencies.filter((a) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      a.name.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) || a.address.toLowerCase().includes(q)
    )
  })

  function onCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function onEdit(a: Agency) {
    setEditing(a)
    setDialogOpen(true)
  }

  function onDelete(id: string) {
    setConfirmId(id)
  }

  async function submitAgency(data: {
    id?: string
    name: string
    country: string
    address: string
    status: AgencyStatus
  }) {
    startTransition(async () => {
      if (data.id) {
        const res = await updateAgencyAction({
          id: data.id,
          name: data.name,
          country: data.country,
          address: data.address,
          status: data.status,
        })
        if (!res.ok) return alert(res.error)
        const a = res.data as Agency
        setAgencies((prev) => prev.map((x) => (x.id === a.id ? a : x)))
      } else {
        const res = await createAgencyAction({
          name: data.name,
          country: data.country,
          address: data.address,
          status: data.status,
        })
        if (!res.ok) return alert(res.error)
        const a = res.data as Agency
        setAgencies((prev) => [a, ...prev])
      }
      
      // Recharger les agences pour mettre à jour le nombre d'utilisateurs
      await loadAgencies()
      
      setDialogOpen(false)
      setEditing(null)
    })
  }

  async function confirmDelete() {
    if (!confirmId) return
    startTransition(async () => {
      const res = await deleteAgencyAction(confirmId)
      if (!res.ok) return alert(res.error)
      setAgencies((prev) => prev.filter((a) => a.id !== confirmId))
      
      // Recharger les agences pour mettre à jour le nombre d'utilisateurs
      await loadAgencies()
      
      setConfirmId(null)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des agences</h2>
        <div className="flex items-center space-x-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadAgencies} 
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
          <Button onClick={onCreate} disabled={pending}>
            Nouvelle agence
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="text-lg font-medium">Liste des agences</div>
          <Input
            placeholder="Rechercher nom/pays/adresse..."
            className="w-56"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Nom", "Pays", "Adresse", "Utilisateurs", "Statut", "Actions"].map((h) => (
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
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{a.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.country}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.address}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{a.users}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${a.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
                    >
                      {a.status === "active" ? "Active" : "Inactive"}
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
                              onClick={() => onEdit(a)} 
                              disabled={pending}
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
                              onClick={() => onDelete(a.id)} 
                              disabled={pending}
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
              {filtered.length === 0 && (
                <tr>
                  <td className="px-6 py-8 text-sm text-gray-500" colSpan={6}>
                    Aucune agence trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 text-sm text-gray-500">
          <div>
            Affichage <span>1</span>-<span>{filtered.length}</span> sur <span>{agencies.length}</span>
          </div>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled>
              Précédent
            </Button>
            <Button variant="outline" size="sm" disabled>
              Suivant
            </Button>
          </div>
        </div>
      </Card>

      <AgencyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={submitAgency}
        pending={pending}
      />

      <ConfirmDeleteDialog
        open={!!confirmId}
        onCancel={() => setConfirmId(null)}
        onConfirm={confirmDelete}
        pending={pending}
      />
    </div>
  )
}

function AgencyDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  pending,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: Agency | null
  onSubmit: (data: {
    id?: string
    name: string
    country: string
    address: string
    status: AgencyStatus
  }) => void
  pending: boolean
}) {
  const [name, setName] = React.useState("")
  const [country, setCountry] = React.useState("Cameroun")
  const [address, setAddress] = React.useState("")
  const [status, setStatus] = React.useState<AgencyStatus>("active")

  React.useEffect(() => {
    if (initial) {
      setName(initial.name)
      setCountry(initial.country)
      setAddress(initial.address)
      setStatus(initial.status)
    } else {
      setName("")
      setCountry("Cameroun")
      setAddress("")
      setStatus("active")
    }
  }, [initial, open])

  function handleSubmit() {
    onSubmit({
      id: initial?.id,
      name,
      country,
      address,
      status,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier l'agence" : "Nouvelle agence"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="ag-name">Nom</Label>
            <Input id="ag-name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ag-country">Pays</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionnez un pays" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Congo">Congo</SelectItem>
                  <SelectItem value="RDC">RDC</SelectItem>
                  <SelectItem value="Cameroun">Cameroun</SelectItem>
                  <SelectItem value="France">France</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="ag-address">Adresse</Label>
            <Input id="ag-address" className="mt-1" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {initial ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmDeleteDialog({
  open,
  onCancel,
  onConfirm,
  pending,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onCancel() : undefined)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Supprimer l'agence</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Êtes-vous sûr de vouloir supprimer cette agence ? Cette action est irréversible.
        </p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
