import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { ReportsView } from "@/components/views/reports-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Rapports",
  description: "Génération de rapports - Analyses financières et statistiques opérationnelles"
}

export default async function ReportsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard user={user} route="/reports">
      <ReportsView user={user} />
    </PermissionGuard>
  )
}
