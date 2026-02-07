import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { RiaUnifiedView } from "@/components/views/ria-unified-view"
import { 
  getDashboardData,
  getGuichetierStats, 
  getAgenceStats, 
  getUniqueAgences,
  getUniqueGuichetiers,
  getTimeSeriesData
} from "@/lib/ria-transactions-queries"

export default async function RiaPage() {
  const { user } = await requireAuth()
  
  if (!hasPermission(user, "view_ria_dashboard") || user.role === "auditor" || user.role === "executor") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Accès non autorisé</h2>
          <p className="text-gray-600">Vous n&apos;avez pas les permissions nécessaires pour accéder à cette page.</p>
        </div>
      </div>
    )
  }

  // Récupérer les données initiales pour le tableau de bord
  const [dashboardData, guichetierStats, agenceStats, timeSeriesData, agences, guichetiers] = await Promise.all([
    getDashboardData(),
    getGuichetierStats(),
    getAgenceStats(),
    getTimeSeriesData(),
    getUniqueAgences(),
    getUniqueGuichetiers()
  ])

  return (
    <RiaUnifiedView 
      initialDashboardData={{
        ...dashboardData,
        guichetierStats,
        agenceStats,
        timeSeriesData,
        filters: {
          agences,
          guichetiers
        }
      }}
    />
  )
}
