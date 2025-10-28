import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { 
  getDashboardData,
  getGuichetierStats, 
  getAgenceStats, 
  getUniqueAgences,
  getUniqueGuichetiers,
  getTimeSeriesData
} from "@/lib/ria-transactions-queries"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  
  if (!hasPermission(user, "view_ria_dashboard")) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom') || undefined
    const dateTo = searchParams.get('dateTo') || undefined
    const agence = searchParams.get('agence') || undefined
    const guichetier = searchParams.get('guichetier') || undefined

    // Récupérer toutes les données du tableau de bord
    const [
      dashboardData,
      guichetierStats,
      agenceStats,
      timeSeriesData,
      uniqueAgences,
      uniqueGuichetiers
    ] = await Promise.all([
      getDashboardData({ dateFrom, dateTo, agence, guichetier }),
      getGuichetierStats({ dateFrom, dateTo, agence }),
      getAgenceStats({ dateFrom, dateTo }),
      getTimeSeriesData({ dateFrom, dateTo, agence, guichetier }),
      getUniqueAgences(),
      getUniqueGuichetiers()
    ])

    return NextResponse.json({
      ok: true,
      data: {
        ...dashboardData,
        guichetierStats,
        agenceStats,
        timeSeriesData,
        filters: {
          agences: uniqueAgences,
          guichetiers: uniqueGuichetiers
        }
      }
    })

  } catch (error: any) {
    console.error("Erreur lors de la récupération du tableau de bord RIA:", error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message 
    }, { status: 500 })
  }
}
