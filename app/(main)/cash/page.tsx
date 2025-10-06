import { CashManagement } from "@/components/views/cash-management"
import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function CashPage() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect("/login")
  }

  // Vérifier que l'utilisateur a la permission d'accéder à la caisse
  if (user.role !== "accounting" && user.role !== "super_admin") {
    redirect("/dashboard")
  }

  return <CashManagement user={user} />
}
