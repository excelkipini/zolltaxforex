import { CashSettlementsView } from "@/components/views/cash-settlements-view"
import { getCurrentUser } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { redirect } from "next/navigation"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Arrêté de caisse",
  description: "Gestion des arrêtés de caisse quotidiens"
}

// Forcer le rechargement des données à chaque fois
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CashSettlementsPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect("/login")
  }

  // Vérifier les permissions pour accéder aux arrêtés de caisse
  if (!hasPermission(user, "view_cash_settlements")) {
    redirect("/dashboard")
  }

  return <CashSettlementsView user={user} />
}
