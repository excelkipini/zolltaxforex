import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { ReceptionView } from "@/components/views/reception-view"
import { getDefaultAgencyId, getEffectiveSettings } from "@/lib/agency-limits-queries"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Réception/Envoi",
  description: "Opérations de réception et d'envoi - Gestion des transferts et commissions"
}

export default async function ReceptionPage({ searchParams }: { searchParams?: { agency?: string } }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const agencyId = searchParams?.agency ?? (await getDefaultAgencyId())
  const eff = await getEffectiveSettings(agencyId ?? undefined)

  return (
    <PermissionGuard user={user} route="/reception">
      <ReceptionView commissionPercent={eff.commission} transferLimit={eff.transfer_limit} />
    </PermissionGuard>
  )
}
