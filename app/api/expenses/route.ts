import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { 
  createExpense, 
  listExpensesForUser, 
  setExpenseStatus,
  validateExpenseByAccounting,
  validateExpenseByDirector,
  getExpensesPendingAccounting,
  getExpensesPendingDirector,
  getExpensesStats,
  getExpensesPendingForDashboard,
  deleteExpense,
  updateExpense
} from "@/lib/expenses-queries"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  const isDirectorDelegate = user.role === "director" || user.role === "delegate"
  const canModerateAll = isDirectorDelegate
  const canViewAll = isDirectorDelegate || user.role === "accounting"
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type")
  const limitParam = searchParams.get("limit")

  try {
    // Tableau de bord : stats + liste des dépenses en attente (léger, rapide)
    if (type === "dashboard") {
      const [stats, pendingList] = await Promise.all([
        getExpensesStats(user.name, canViewAll, user.role),
        getExpensesPendingForDashboard(user.name, canViewAll, user.role),
      ])
      return NextResponse.json({
        ok: true,
        data: { stats, pendingList: pendingList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) },
        type: "dashboard",
      })
    }

    // Stats seules (très léger)
    if (type === "stats") {
      const stats = await getExpensesStats(user.name, canViewAll, user.role)
      return NextResponse.json({ ok: true, data: stats, type: "stats" })
    }

    // Liste complète (avec limite optionnelle pour premier chargement plus rapide)
    const parsed = limitParam ? parseInt(limitParam, 10) : NaN
    const limit = Number.isNaN(parsed) ? 1000 : Math.min(2000, Math.max(1, parsed))
    if (canViewAll) {
      const allExpenses = await listExpensesForUser(user.name, true, limit)
      return NextResponse.json({ ok: true, data: allExpenses, type: "all_expenses" })
    }
    const items = await listExpensesForUser(user.name, canViewAll, limit)
    return NextResponse.json({ ok: true, data: items })
  } catch (e: any) {
    console.error("[GET /api/expenses]", e?.message ?? e)
    return NextResponse.json(
      { ok: false, error: "Erreur chargement dépenses", details: process.env.NODE_ENV === "development" ? (e?.message ?? String(e)) : undefined },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  try {
    const body = await request.json()
    const created = await createExpense({
      description: String(body?.description || ""),
      amount: Number(body?.amount || 0),
      category: String(body?.category || "Autre"),
      requested_by: user.name,
      agency: String(body?.agency || user.agency || "Agence Centrale"),
      comment: String(body?.comment || ""),
      deduct_from_excedents: Boolean(body?.deduct_from_excedents || false),
      deducted_cashier_id: body?.deducted_cashier_id ? String(body.deducted_cashier_id) : null,
    })
    return NextResponse.json({ ok: true, data: created })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur création dépense" }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  const canModerateAll = user.role === "director" || user.role === "delegate"
  if (!canModerateAll) return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  try {
    const body = await request.json()
    const updated = await setExpenseStatus(
      String(body?.id || ""), 
      String(body?.status || "pending") as any,
      String(body?.rejection_reason || "")
    )
    return NextResponse.json({ ok: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur mise à jour dépense" }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const { user } = await requireAuth()
  try {
    const body = await request.json()
    const id = String(body?.id ?? "")
    if (!id) return NextResponse.json({ ok: false, error: "ID de dépense requis" }, { status: 400 })
    const canViewAll = user.role === "director" || user.role === "delegate" || user.role === "accounting"
    const expenses = await listExpensesForUser(user.name, canViewAll, 1000)
    const expense = expenses.find((e) => e.id === id)
    if (!expense) return NextResponse.json({ ok: false, error: "Dépense non trouvée" }, { status: 404 })
    const isCreator = expense.requested_by === user.name
    if (!isCreator && !canViewAll) {
      return NextResponse.json({ ok: false, error: "Vous ne pouvez modifier que vos propres dépenses" }, { status: 403 })
    }
    const updated = await updateExpense(id, {
      description: String(body?.description ?? expense.description),
      amount: Number(body?.amount ?? expense.amount),
      category: String(body?.category ?? expense.category),
      agency: String(body?.agency ?? expense.agency),
      comment: body?.comment !== undefined ? String(body.comment) : expense.comment,
    })
    return NextResponse.json({ ok: true, data: updated })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur modification dépense" }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const { user } = await requireAuth()
  
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ ok: false, error: "ID de dépense requis" }, { status: 400 })
    }
    
    // Vérifier les permissions : le créateur de la dépense, les comptables et les directeurs peuvent supprimer
    // Mais seulement si la dépense n'est pas validée par le directeur
    const expense = await listExpensesForUser(user.name, user.role === "director" || user.role === "delegate" || user.role === "accounting")
    const targetExpense = expense.find(e => e.id === id)
    
    if (!targetExpense) {
      return NextResponse.json({ ok: false, error: "Dépense non trouvée" }, { status: 404 })
    }
    
    // Vérifier que l'utilisateur a le droit de supprimer cette dépense
    const isCreator = targetExpense.requested_by === user.name
    const canModerate = user.role === "director" || user.role === "delegate" || user.role === "accounting"
    
    if (!isCreator && !canModerate) {
      return NextResponse.json({ ok: false, error: "Vous n'avez pas l'autorisation de supprimer cette dépense" }, { status: 403 })
    }
    
    // Supprimer la dépense (la fonction vérifie que ce n'est pas validé par le directeur)
    await deleteExpense(id)
    
    return NextResponse.json({ ok: true, message: "Dépense supprimée avec succès" })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur lors de la suppression" }, { status: 400 })
  }
}


