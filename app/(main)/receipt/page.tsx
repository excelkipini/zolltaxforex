import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { redirect } from "next/navigation"
import ReceiptClient from "./receipt-client"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Transfert International",
  description: "Création de reçus imprimables avec QR Code"
}

// Forcer le rechargement des données à chaque fois
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ReceiptPage() {
  const { user } = await requireAuth()
  
  // Vérifier les permissions - caissiers et comptables peuvent émettre des reçus
  if (!hasPermission(user, "view_receipts")) {
    redirect("/dashboard")
  }
  
  return <ReceiptClient />
}
