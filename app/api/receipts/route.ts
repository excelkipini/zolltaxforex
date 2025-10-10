import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { listReceipts, searchReceipts, getReceiptStats } from "@/lib/receipts-queries"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    // Vérifier les permissions
    if (!hasPermission(user, "view_receipts")) {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let receipts
    if (search) {
      receipts = await searchReceipts(search, limit)
    } else {
      receipts = await listReceipts(limit, offset)
    }

    const stats = await getReceiptStats()

    return NextResponse.json({
      ok: true,
      receipts,
      stats
    })

  } catch (error: any) {
    console.error('Erreur lors de la récupération des reçus:', error)
    return NextResponse.json(
      { error: error.message || "Erreur lors de la récupération des reçus" },
      { status: 500 }
    )
  }
}
