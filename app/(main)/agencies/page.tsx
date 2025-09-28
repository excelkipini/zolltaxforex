import { listAgencies } from "@/lib/agencies-queries"
import AgenciesClient from "./agencies-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Agences",
  description: "Gestion des agences - Création, modification et administration"
}

export default async function AgenciesPage() {
  const agencies = await listAgencies()
  return <AgenciesClient initialAgencies={agencies} />
}
