import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { TransactionsView } from "@/components/views/transactions-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Opérations",
  description: "Gestion des opérations - Transactions, réceptions et transferts"
}

export default async function TransactionsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard user={user} route="/transactions">
      <TransactionsView user={user} />
    </PermissionGuard>
  )
}
