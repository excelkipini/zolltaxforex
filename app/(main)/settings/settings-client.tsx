"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

export default function SettingsClient({ user }: { user: { name: string; email: string } }) {
  const [name, setName] = React.useState(user.name)
  const [email, setEmail] = React.useState(user.email)
  const { toast } = useToast()
  const [profilePending, setProfilePending] = React.useState(false)
  const [pwdPending, setPwdPending] = React.useState(false)
  const [profileError, setProfileError] = React.useState<string | null>(null)
  const [pwdError, setPwdError] = React.useState<string | null>(null)
  const [pwdOk, setPwdOk] = React.useState(false)

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfilePending(true)
    setProfileError(null)
    try {
      const res = await fetch("/api/settings/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setProfileError(data?.error || "Erreur lors de la mise à jour du profil")
        return
      }
      toast({ title: "Profil mis à jour" })
    } finally {
      setProfilePending(false)
    }
  }

  async function submitPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPwdPending(true)
    setPwdError(null)
    setPwdOk(false)
    const form = new FormData(e.currentTarget)
    try {
      const res = await fetch("/api/settings/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: String(form.get("current") || ""), next: String(form.get("next") || "") }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setPwdError(data?.error || "Erreur lors du changement de mot de passe")
        return
      }
      setPwdOk(true)
      toast({ title: "Mot de passe mis à jour" })
      e.currentTarget.reset()
    } finally {
      setPwdPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Paramètres utilisateur</h2>

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitProfile} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                className="mt-1"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {profileError && <p className="text-sm text-red-600">{profileError}</p>}
            <Button type="submit" disabled={profilePending}>
              {profilePending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitPassword} className="space-y-4 max-w-md">
            <div>
              <Label htmlFor="current">Mot de passe actuel</Label>
              <Input id="current" name="current" type="password" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="next">Nouveau mot de passe</Label>
              <Input id="next" name="next" type="password" className="mt-1" />
            </div>
            {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
            {pwdOk && <p className="text-sm text-emerald-600">Mot de passe mis à jour.</p>}
            <Button type="submit" disabled={pwdPending}>
              {pwdPending ? "Mise à jour..." : "Changer mon mot de passe"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
