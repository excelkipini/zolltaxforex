import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { TransferOperationsView } from "@/components/views/transfer-operations-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Opérations - Transfert d'argent",
  description: "Opérations de transfert d'argent - Suivi des transferts par date"
}

export default async function TransferOperationsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard user={user} route="/transfer">
      <TransferOperationsView user={{ name: user.name, role: user.role }} />
    </PermissionGuard>
  )
}
