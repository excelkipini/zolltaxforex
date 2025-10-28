import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { RiaTransactionsView } from "@/components/views/ria-transactions-view"

export default async function RiaTransactionsPage() {
  const { user } = await requireAuth()
  
  if (!hasPermission(user, "view_ria_transactions")) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Accès non autorisé</h2>
          <p className="text-gray-600">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
        </div>
      </div>
    )
  }

  return <RiaTransactionsView />
}
