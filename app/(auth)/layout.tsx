import type { ReactNode } from "react"
import type { Metadata } from "next"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre compte ZOLL TAX FOREX"
}

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Vérifier si l'utilisateur est déjà connecté côté serveur
  const user = await getCurrentUser()
  
  if (user) {
    // Rediriger vers le dashboard si déjà connecté
    redirect("/dashboard")
  }

  return <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">{children}</div>
}
