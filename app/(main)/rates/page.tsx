import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"
import { getSettingsAction } from "./actions"
import { RatesView } from "@/components/views/rates-view"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Taux & Plafonds",
  description: "Configuration des taux de change et plafonds - Gestion des paramètres financiers"
}

export default async function RatesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <PermissionGuard 
      user={user} 
      route="/rates"
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Accès refusé</h2>
            <p className="text-gray-600 mb-4">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
            <p className="text-sm text-gray-500">Contactez votre administrateur pour obtenir les permissions appropriées.</p>
          </div>
        </div>
      }
    >
      <RatesPageContent user={user} />
    </PermissionGuard>
  )
}

async function RatesPageContent({ user }: { user: any }) {
  try {
    // Charge paramètres + historique côté serveur
    const { settings, history } = await getSettingsAction()
    
    return (
      <RatesView initialSettings={settings} initialHistory={history} currentUser={user} />
    )
  } catch (error: any) {
    // Si l'erreur est "Non autorisé", afficher le message d'erreur
    if (error.message === "Non autorisé") {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Accès refusé</h2>
            <p className="text-gray-600 mb-4">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
            <p className="text-sm text-gray-500">Contactez votre administrateur pour obtenir les permissions appropriées.</p>
          </div>
        </div>
      )
    }
    
    // Pour les autres erreurs, afficher un message générique
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Erreur</h2>
          <p className="text-gray-600 mb-4">Une erreur est survenue lors du chargement de la page.</p>
          <p className="text-sm text-gray-500">Veuillez réessayer plus tard.</p>
        </div>
      </div>
    )
  }
}
