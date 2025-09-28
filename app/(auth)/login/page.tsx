"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, LogIn } from "lucide-react"
import { type SessionUser, getSessionClient } from "@/lib/auth-client"
import { ZollLogo } from "@/components/ui/zoll-logo"
import { getCopyrightText } from "@/lib/constants"


export default function LoginPage() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  // Vérifier si l'utilisateur est déjà connecté
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Vérifier la session côté client d'abord
        const sessionUser = getSessionClient()
        
        if (sessionUser && sessionUser.expires > Date.now()) {
          router.replace("/dashboard")
          return
        }

        // Vérifier côté serveur via API
        const response = await fetch("/api/auth/check")
        const data = await response.json()
        
        if (data.authenticated && data.user) {
          // Stocker la session côté client pour éviter les futures vérifications
          const toStore = {
            user: data.user as SessionUser,
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          }
          try {
            localStorage.setItem("maf_session", JSON.stringify(toStore))
          } catch {}
          
          router.replace("/dashboard")
          return
        }
        
      } catch (error) {
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsPending(true)
    setError(null)

    try {
      // Appel API serveur pour créer la session cookie
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.message || "Identifiants invalides")
        return
      }

      // Récupérer l'utilisateur depuis l'API et stocker côté client (facilite les checks client)
      const check = await fetch("/api/auth/check")
      const session = await check.json()
      if (session?.authenticated && session?.user) {
        const toStore = {
          user: session.user as SessionUser,
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }
        try {
          localStorage.setItem("maf_session", JSON.stringify(toStore))
        } catch {}
      }

      // Redirection
      router.replace("/dashboard")
    } catch (err) {
      setError("Erreur de connexion")
    } finally {
      setIsPending(false)
    }
  }


  // Afficher un loader pendant la vérification de l'authentification
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification de la session...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <ZollLogo size="xl" className="justify-center" />
          <p className="text-xl text-gray-600">Système interne de gestion des opérations</p>
        </div>

        <div className="flex justify-center">
          {/* Login Form */}
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">Connexion</CardTitle>
              <CardDescription>Connectez-vous à votre compte pour accéder au système</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form 
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="votre.email@exemple.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Votre mot de passe"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isPending}>
                  {isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Connexion en cours...
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 mr-2" />
                      Se connecter
                    </>
                  )}
                </Button>
              </form>

            </CardContent>
          </Card>

        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>{getCopyrightText()}</p>
        </div>
      </div>
    </div>
  )
}
