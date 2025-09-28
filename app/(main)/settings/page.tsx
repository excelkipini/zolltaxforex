import { requireAuth } from "@/lib/auth"
import SettingsClient from "./settings-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Configuration des paramètres utilisateur et préférences du système"
}

export default async function SettingsPage() {
  const { user } = await requireAuth()
  return <SettingsClient user={user} />
}
