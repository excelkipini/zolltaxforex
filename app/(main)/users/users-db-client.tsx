"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Edit, Trash2, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Role } from "@/lib/rbac"
import { hasPermission, getRoleDisplayName } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth-client"

type DbUser = {
  id: string
  name: string
  email: string
  role: Role
  agency: string
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

export default function UsersDbClient({ initial, currentUser }: { initial: DbUser[], currentUser: SessionUser }) {
  const [users, setUsers] = React.useState<DbUser[]>(initial)
  const [agencies, setAgencies] = React.useState<Agency[]>([])
  const [search, setSearch] = React.useState("")
  const [filter, setFilter] = React.useState<"all" | Role>("all")
  const [agencyFilter, setAgencyFilter] = React.useState<"all" | string>("all")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<DbUser | null>(null)
  const [pending, setPending] = React.useState(false)

  // Fonction pour formater la date de dernière connexion
  const formatLastLogin = (lastLogin: string | undefined) => {
    if (!lastLogin) return '-'
    try {
      const date = new Date(lastLogin)
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return lastLogin
    }
  }

  // Fonction pour charger les agences
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

  // Charger les agences au montage du composant
  React.useEffect(() => {
    loadAgencies()
  }, [loadAgencies])

  const filtered = users
    .filter((u) => (filter === "all" ? true : u.role === filter))
    .filter((u) => (agencyFilter === "all" ? true : u.agency === agencyFilter))
    .filter((u) => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    })

  function onCreate() {
    setEditing(null)
    setDialogOpen(true)
  }

  function onEdit(u: DbUser) {
    setEditing(u)
    setDialogOpen(true)
  }

  async function submitUser(form: {
    id?: string
    name: string
    email: string
    role: Role
    agency: string
    password?: string
  }) {
    setPending(true)
    try {
      const method = form.id ? "PUT" : "POST"
      
      // Convertir le rôle interne vers le label attendu par l'API
      const roleMapping: Record<Role, string> = {
        "super_admin": "Admin",
        "director": "Directeur Général",
        "accounting": "Comptable",
        "cashier": "Caissier",
        "auditor": "Auditeur",
        "delegate": "Délégué",
        "executor": "Exécuteur",
        "cash_manager": "Responsable caisse"
      }
      
      const res = await fetch("/api/users", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          roleLabel: roleMapping[form.role]
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      const u: DbUser = data.data
      setUsers((prev) => (form.id ? prev.map((x) => (x.id === u.id ? u : x)) : [u, ...prev]))
      
      // Recharger les agences pour mettre à jour le nombre d'utilisateurs
      await loadAgencies()
      
      setDialogOpen(false)
      setEditing(null)
    } finally {
      setPending(false)
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Supprimer cet utilisateur ?")) return
    setPending(true)
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok || !data?.ok) {
        alert(data?.error || "Erreur")
        return
      }
      setUsers((prev) => prev.filter((u) => u.id !== id))
      
      // Recharger les agences pour mettre à jour le nombre d'utilisateurs
      await loadAgencies()
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
        {hasPermission(currentUser, "create_users") && (
          <Button onClick={onCreate} disabled={pending}>Nouvel utilisateur</Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-lg font-medium">Liste des utilisateurs</div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrer par rôle" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les rôles</SelectItem>
                {(["super_admin","director","accounting","cashier","auditor","delegate","executor"] as Role[]).map((r)=>(
                  <SelectItem key={r} value={r}>{getRoleDisplayName(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={agencyFilter} onValueChange={(v: any) => setAgencyFilter(v)}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrer par agence" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les agences</SelectItem>
                {agencies.map((agency) => (
                  <SelectItem key={agency.id} value={agency.name}>{agency.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Rechercher nom/email..." value={search} onChange={(e)=>setSearch(e.target.value)} className="w-56" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Nom','Email','Rôle','Agences','Dernière connexion','Actions'].map((h)=> (
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
              {filtered.map((u)=> (
                <tr key={u.id}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{getRoleDisplayName(u.role)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{u.agency || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatLastLogin(u.last_login)}</td>
                  <td className="px-6 py-4 text-sm">
                    <TooltipProvider>
                      <div className="flex items-center space-x-2">
                        {hasPermission(currentUser, "edit_users") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={()=>onEdit(u)} 
                                disabled={pending}
                                className="h-8 w-8 p-0"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Modifier l'utilisateur</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {hasPermission(currentUser, "delete_users") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={()=>onDelete(u.id)} 
                                disabled={pending}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Supprimer l'utilisateur</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {!hasPermission(currentUser, "edit_users") && !hasPermission(currentUser, "delete_users") && (
                          <span className="text-gray-400 text-xs">Aucune action</span>
                        )}
                      </div>
                    </TooltipProvider>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && (
                <tr><td className="px-6 py-8 text-sm text-gray-500" colSpan={6}>Aucun utilisateur trouvé.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UserDialog open={dialogOpen} onOpenChange={setDialogOpen} initial={editing} onSubmit={submitUser} pending={pending} agencies={agencies} currentUser={currentUser} />
    </div>
  )
}

function UserDialog({ open, onOpenChange, initial, onSubmit, pending, agencies, currentUser }: {
  open: boolean
  onOpenChange: (o: boolean)=>void
  initial: DbUser | null
  onSubmit: (data: { id?: string; name: string; email: string; role: Role; agency: string; password?: string })=>void
  pending: boolean
  agencies: Agency[]
  currentUser: SessionUser
}) {
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [role, setRole] = React.useState<Role>("cashier")
  const [agency, setAgency] = React.useState("")
  const [password, setPassword] = React.useState("")

  React.useEffect(()=>{
    if (initial) {
      setName(initial.name)
      setEmail(initial.email)
      setRole(initial.role)
      setAgency(initial.agency || "")
      setPassword("")
    } else {
      setName("")
      setEmail("")
      setRole("cashier")
      setAgency("")
      setPassword("")
    }
  }, [initial, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial?"Modifier l'utilisateur":"Nouvel utilisateur"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="u-name">Nom</Label>
            <Input id="u-name" className="mt-1" value={name} onChange={(e)=>setName(e.target.value)} readOnly={!hasPermission(currentUser, "edit_users")} />
          </div>
          <div>
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" className="mt-1" value={email} onChange={(e)=>setEmail(e.target.value)} readOnly={!hasPermission(currentUser, "edit_users")} />
          </div>
          <div>
            <Label>Rôle</Label>
            <Select value={role} onValueChange={(v: Role)=>setRole(v)} disabled={!hasPermission(currentUser, "edit_users")}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir un rôle" /></SelectTrigger>
              <SelectContent>
                {(["super_admin","director","accounting","cashier","auditor","delegate","executor","cash_manager"] as Role[]).map((r)=>(
                  <SelectItem key={r} value={r}>{getRoleDisplayName(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Agence</Label>
            <Select value={agency} onValueChange={setAgency} disabled={!hasPermission(currentUser, "edit_users")}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir une agence" /></SelectTrigger>
              <SelectContent>
                {agencies.map((a)=>(
                  <SelectItem key={a.id} value={a.name}>{a.name} ({a.country})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="u-pwd">Mot de passe {initial?"(laisser vide pour ne pas changer)":""}</Label>
            <Input id="u-pwd" type="password" className="mt-1" value={password} onChange={(e)=>setPassword(e.target.value)} readOnly={!hasPermission(currentUser, "edit_users")} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={pending}>Annuler</Button>
          {hasPermission(currentUser, "edit_users") && (
            <Button onClick={()=> onSubmit({ id: initial?.id, name, email, role, agency, password: password || undefined })} disabled={pending}>
              {initial?"Enregistrer":"Créer"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


