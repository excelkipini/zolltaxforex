import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { 
  createExpense, 
  listExpensesForUser, 
  setExpenseStatus,
  validateExpenseByAccounting,
  validateExpenseByDirector,
  getExpensesPendingAccounting,
  getExpensesPendingDirector
} from "@/lib/expenses-queries"

export async function GET() {
  const { user } = await requireAuth()
  const isDirectorDelegate = user.role === "director" || user.role === "delegate"
  const canModerateAll = isDirectorDelegate
  const canViewAll = isDirectorDelegate || user.role === "accounting"
  
  try {
    // Pour les comptables et directeurs, retourner toutes les dépenses avec leurs états
    if (canViewAll) {
      const allExpenses = await listExpensesForUser(user.name, true)
      return NextResponse.json({ ok: true, data: allExpenses, type: "all_expenses" })
    }
    
    // Pour les autres rôles, retourner les dépenses selon les permissions
    const items = await listExpensesForUser(user.name, canViewAll)
    return NextResponse.json({ ok: true, data: items })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Erreur chargement dépenses" }, { status: 500 })
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


