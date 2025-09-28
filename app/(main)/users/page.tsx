import { requireAuth } from "@/lib/auth"
import { PermissionGuard } from "@/components/permission-guard"
import { listUsers } from "@/lib/users-queries"
import UsersDbClient from "./users-db-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Utilisateurs",
  description: "Gestion des utilisateurs - Création, modification et administration"
}

export default async function UsersPage() {
  const session = await requireAuth()
  const hasDb = !!process.env.DATABASE_URL
  const users = hasDb ? await listUsers() : []

  return (
    <PermissionGuard user={session.user} permission="users:view">
      <div className="space-y-6">
        {!hasDb && (
          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            Base de données non configurée (DATABASE_URL manquant). Affichage désactivé.
          </div>
        )}

        {hasDb && <UsersDbClient initial={users as any} currentUser={session.user} />}
      </div>
    </PermissionGuard>
  )
}
