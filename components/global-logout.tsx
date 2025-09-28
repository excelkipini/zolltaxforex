"use client"

import { useCallback } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"

export function GlobalLogout() {
  const pathname = usePathname()

  // Ne pas afficher sur la page de login
  if (pathname?.startsWith("/login") || pathname === "/") {
    return null
  }

  const onLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      try {
        localStorage.removeItem("maf_session")
      } catch {}
      window.location.href = "/login"
    } catch {
      // ignore
    }
  }, [])

  return (
    <div className="fixed right-4 top-4 z-50 md:hidden">
      <Button size="sm" variant="outline" onClick={onLogout}>
        Déconnexion
      </Button>
    </div>
  )
}


