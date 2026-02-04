import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { ExchangeManagementView } from "@/components/views/exchange-management-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gestion de change",
  description: "Caisses XAF, USD, EUR - Appro, Vente et Cession de devises",
}

export default async function ExchangeManagementPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard user={user} route="/exchange">
      <ExchangeManagementView user={user} />
    </PermissionGuard>
  )
}
