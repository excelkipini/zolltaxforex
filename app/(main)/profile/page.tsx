import { requireAuth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profil",
  description: "Informations du profil utilisateur et paramètres personnels"
}

export default async function ProfilePage() {
  const session = await requireAuth()
  const user = session.user

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil utilisateur</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm"><span>Nom</span><span className="font-medium">{user.name}</span></div>
          <div className="flex justify-between text-sm"><span>Email</span><span className="font-medium">{user.email}</span></div>
          <div className="flex justify-between text-sm"><span>Rôle</span><span className="font-medium capitalize">{user.role.replace("_", " ")}</span></div>
          {user.agency && (
            <div className="flex justify-between text-sm"><span>Agence</span><span className="font-medium">{user.agency}</span></div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


