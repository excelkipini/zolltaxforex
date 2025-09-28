import { listCards, getDistributionStats } from "@/lib/cards-queries"
import CardsClient from "./cards-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Gestion des Cartes",
  description: "Gestion des cartes - Distribution automatique et import Excel"
}

// Forcer le rechargement des données à chaque fois
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CardsPage() {
  const cards = await listCards()
  const distributionStats = await getDistributionStats()
  
  
  return (
    <CardsClient 
      initialCards={cards} 
      initialDistributionStats={distributionStats}
    />
  )
}