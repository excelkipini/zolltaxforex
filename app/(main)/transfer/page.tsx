import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { TransferView } from "@/components/views/transfer-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transfert d'argent",
  description: "Opérations de transfert d'argent - Envoi de fonds et gestion des bénéficiaires"
}

export default async function TransferPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard user={user} route="/transfer">
      <TransferView />
    </PermissionGuard>
  )
}
