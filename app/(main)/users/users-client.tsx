"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ActionGuard, ReadOnlyWrapper } from "@/components/permission-guard"
import { Plus, Edit, Trash2, Users, Shield, Eye } from "lucide-react"
import { getRoleDisplayName } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth"
import type { User } from "@/lib/types"

interface UsersClientProps {
  user: SessionUser
}

export function UsersClient({ user }: UsersClientProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)

  // Mock data for demonstration
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: "1",
        name: "Marie Caissier",
        email: "caissier@zolltaxforex.com",
        role: "cashier",
        agency: "Agence Centre",
        last_login: new Date().toISOString(),
      },
      {
        id: "2",
        name: "Jean Comptable",
        email: "comptable@zolltaxforex.com",
        role: "accounting",
        agency: "Agence Centre",
        last_login: new Date().toISOString(),
      },
      {
        id: "3",
        name: "Paul Directeur",
        email: "directeur@zolltaxforex.com",
        role: "director",
        agency: "Direction Générale",
        last_login: new Date().toISOString(),
      },
      {
        id: "4",
        name: "Sophie Délégué",
        email: "delegue@zolltaxforex.com",
        role: "delegate",
        agency: "Direction Générale",
        last_login: new Date().toISOString(),
      },
      {
        id: "5",
        name: "Marc Auditeur",
        email: "auditeur@zolltaxforex.com",
        role: "auditor",
        agency: "Audit Interne",
        last_login: new Date().toISOString(),
      },
    ]

    setTimeout(() => {
      setUsers(mockUsers)
      setLoading(false)
    }, 500)
  }, [])

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      super_admin: "bg-red-100 text-red-800",
      director: "bg-purple-100 text-purple-800",
      delegate: "bg-orange-100 text-orange-800",
      accounting: "bg-green-100 text-green-800",
      cashier: "bg-blue-100 text-blue-800",
      auditor: "bg-gray-100 text-gray-800",
    }
    return colors[role] || "bg-gray-100 text-gray-800"
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Gestion des utilisateurs</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Chargement des utilisateurs...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ReadOnlyWrapper user={user} editPermission="users:edit">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8" />
              Gestion des utilisateurs
            </h1>
            <p className="text-muted-foreground mt-1">
              {user.role === "auditor"
                ? "Consultation des comptes utilisateurs (mode audit)"
                : "Administration des comptes utilisateurs du système"}
            </p>
          </div>

          <ActionGuard user={user} permission="users:create">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvel utilisateur
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nom complet</Label>
                    <Input id="name" placeholder="Nom de l'utilisateur" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="email@exemple.com" />
                  </div>
                  <div>
                    <Label htmlFor="role">Rôle</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un rôle" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cashier">Caissier</SelectItem>
                        <SelectItem value="accounting">Comptable</SelectItem>
                        <SelectItem value="delegate">Délégué DG</SelectItem>
                        <SelectItem value="executor">Exécuteur</SelectItem>
                        <SelectItem value="cash_manager">Responsable caisse</SelectItem>
                        {user.role === "super_admin" && (
                          <>
                            <SelectItem value="director">Directeur</SelectItem>
                            <SelectItem value="auditor">Auditeur</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="agency">Agence</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une agence" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="centre">Agence Centre</SelectItem>
                        <SelectItem value="nord">Agence Nord</SelectItem>
                        <SelectItem value="sud">Agence Sud</SelectItem>
                        <SelectItem value="direction">Direction Générale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={() => setIsDialogOpen(false)}>Créer l'utilisateur</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </ActionGuard>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Liste des utilisateurs ({users.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Agence</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userItem) => (
                  <TableRow key={userItem.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{userItem.name}</div>
                        <div className="text-sm text-muted-foreground">{userItem.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(userItem.role)}>{getRoleDisplayName(userItem.role)}</Badge>
                    </TableCell>
                    <TableCell>{userItem.agency}</TableCell>
                    <TableCell>
                      {userItem.last_login ? new Date(userItem.last_login).toLocaleDateString("fr-FR") : "Jamais"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <ActionGuard
                          user={user}
                          permission="users:view"
                          fallback={
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          }
                        >
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </ActionGuard>

                        <ActionGuard user={user} permission="users:edit">
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </ActionGuard>

                        <ActionGuard user={user} permission="users:delete">
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </ActionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {user.role === "auditor" && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <Shield className="h-4 w-4" />
                <span className="font-medium">Mode Audit</span>
              </div>
              <p className="text-sm text-blue-700 mt-1">
                Vous consultez les utilisateurs en mode audit. Aucune modification n'est possible.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ReadOnlyWrapper>
  )
}
