"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RoleBasedSidebar } from "@/components/role-based-sidebar"
import { HeaderBar } from "@/components/header-bar"
import { PageLoader } from "@/components/ui/page-loader"
import { getSessionClient, SessionUser } from "@/lib/auth-client"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Vérifier la session côté client
        const sessionUser = getSessionClient()
        
        if (sessionUser) {
          setUser(sessionUser)
        } else {
          // Vérifier côté serveur via API
          const response = await fetch("/api/auth/check")
          const data = await response.json()
          
          if (data.authenticated && data.user) {
            setUser(data.user)
          } else {
            router.push("/login")
          }
        }
      } catch (error) {
        router.push("/login")
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (loading) {
    return <PageLoader message="Chargement..." overlay={false} className="min-h-screen" />
  }

  if (!user) {
    return null // Redirection en cours
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <RoleBasedSidebar user={user} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-white border-b">
          <div className="px-6 py-3">
            <HeaderBar user={user} />
          </div>
        </div>
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
