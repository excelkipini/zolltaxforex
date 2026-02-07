import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { ExchangeView } from "@/components/views/exchange-view"
import { getDefaultAgencyId, getEffectiveSettings } from "@/lib/agency-limits-queries"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Bureau de change",
  description: "Opérations de change - Conversion de devises et gestion des taux"
}

export default async function ExchangePage({ searchParams }: { searchParams?: { agency?: string } }) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const agencyId = searchParams?.agency ?? (await getDefaultAgencyId())
  const eff = await getEffectiveSettings(agencyId ?? undefined)

  return (
    <PermissionGuard user={user} route="/exchange">
      <ExchangeView 
        buyRates={{ USD: eff.usd_buy, EUR: eff.eur_buy, GBP: eff.gbp_buy }} 
        sellRates={{ USD: eff.usd_sell, EUR: eff.eur_sell, GBP: eff.gbp_sell }} 
        commissionPercent={eff.commission} 
      />
    </PermissionGuard>
  )
}
