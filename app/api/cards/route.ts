import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { 
  listCards, 
  createCard, 
  updateCard, 
  deleteCard, 
  distributeAmount,
  bulkCreateCardsFromExcel,
  getAvailableCardsForDistribution,
  getDistributionStats
} from "@/lib/cards-queries"

export async function GET() {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, admins et comptables peuvent voir les cartes
  const canView = user.role === "director" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canView) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const cards = await listCards()
    const availableCards = await getAvailableCardsForDistribution()
    const distributionStats = await getDistributionStats()
    
    return NextResponse.json({ 
      ok: true, 
      data: { 
        cards, 
        availableCards,
        totalCards: cards.length,
        activeCards: cards.filter(c => c.status === 'active').length,
        totalMonthlyLimit: cards.reduce((sum, c) => sum + Number(c.monthly_limit), 0),
        totalMonthlyUsed: cards.reduce((sum, c) => sum + Number(c.monthly_used), 0),
        distributionStats
      } 
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et admins peuvent créer des cartes
  const canCreate = user.role === "director" || user.role === "super_admin"
  
  if (!canCreate) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { cid, last_recharge_date, expiration_date, status = "active", monthly_limit = 2000000 } = body

    if (!cid) {
      return NextResponse.json({ ok: false, error: "CID requis" }, { status: 400 })
    }

    const card = await createCard({
      cid,
      last_recharge_date,
      expiration_date,
      status,
      monthly_limit
    })

    return NextResponse.json({ ok: true, data: card })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et admins peuvent modifier des cartes
  const canModify = user.role === "director" || user.role === "super_admin"
  
  if (!canModify) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { id, cid, last_recharge_date, expiration_date, status, monthly_limit } = body

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID carte requis" }, { status: 400 })
    }

    const updateData: any = {}
    if (cid !== undefined) updateData.cid = String(cid)
    if (last_recharge_date !== undefined) updateData.last_recharge_date = String(last_recharge_date)
    if (expiration_date !== undefined) updateData.expiration_date = String(expiration_date)
    if (status !== undefined) updateData.status = String(status)
    if (monthly_limit !== undefined) updateData.monthly_limit = Number(monthly_limit)

    const updatedCard = await updateCard({ id: String(id), ...updateData })
    return NextResponse.json({ ok: true, data: updatedCard })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et super admins peuvent supprimer des cartes
  const canDelete = user.role === "director" || user.role === "super_admin"
  
  if (!canDelete) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ ok: false, error: "ID carte requis" }, { status: 400 })
    }

    await deleteCard(String(id))
    return NextResponse.json({ ok: true, message: "Carte supprimée avec succès" })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}