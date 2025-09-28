import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { ExpensesView } from "@/components/views/expenses-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dépenses",
  description: "Gestion des dépenses - Soumission, validation et suivi"
}

export default async function ExpensesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard user={user} route="/expenses">
      <ExpensesView user={user} />
    </PermissionGuard>
  )
}
