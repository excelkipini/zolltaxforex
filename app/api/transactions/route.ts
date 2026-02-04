import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listTransactions, listTransactionsFiltered, listTransactionsCount, createTransaction, updateTransactionStatus, deleteAllTransactions, listTransactionFilterOptions } from "@/lib/transactions-queries"

export async function GET(request: NextRequest) {
  await requireAuth()

  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") ?? undefined
  const from = searchParams.get("from") ?? undefined
  const to = searchParams.get("to") ?? undefined
  const status = searchParams.get("status") ?? undefined
  const cashier = searchParams.get("cashier") ?? undefined
  const transferMethod = searchParams.get("transferMethod") ?? undefined
  const search = searchParams.get("search") ?? undefined
  const pageParam = searchParams.get("page")
  const limitParam = searchParams.get("limit")
  const filterOptions = searchParams.get("filterOptions") // ?status=validated ou executed pour options
  const page = pageParam != null ? Math.max(1, parseInt(String(pageParam), 10) || 1) : undefined
  const limit = limitParam != null ? Math.max(1, Math.min(100, parseInt(String(limitParam), 10) || 10)) : undefined
  const useFilters = type != null || from != null || to != null || status != null || (cashier != null && cashier !== "all") || (transferMethod != null && transferMethod !== "all") || (search != null && search.trim() !== "")
  const usePagination = page != null && limit != null

  try {
    if (filterOptions === "validated" || filterOptions === "executed") {
      const options = await listTransactionFilterOptions(filterOptions)
      return NextResponse.json({ ok: true, ...options })
    }
    const filterCreatedBy = cashier && cashier !== "all" ? cashier : undefined
    const filterTransferMethod = transferMethod && transferMethod !== "all" ? transferMethod : undefined
    const filterSearch = search?.trim() || undefined
    if (usePagination) {
      const offset = (page - 1) * limit
      const [transactions, total] = await Promise.all([
        listTransactionsFiltered({
          type,
          fromDate: from,
          toDate: to,
          status,
          createdBy: filterCreatedBy,
          transferMethod: filterTransferMethod,
          search: filterSearch,
          limit,
          offset,
        }),
        listTransactionsCount({
          type,
          fromDate: from,
          toDate: to,
          status,
          createdBy: filterCreatedBy,
          transferMethod: filterTransferMethod,
          search: filterSearch,
        }),
      ])
      return NextResponse.json({ ok: true, data: transactions, total })
    }
    if (useFilters) {
      const transactions = await listTransactionsFiltered({
        type,
        fromDate: from,
        toDate: to,
        status,
        createdBy: filterCreatedBy,
        transferMethod: filterTransferMethod,
        search: filterSearch,
      })
      return NextResponse.json({ ok: true, data: transactions })
    }
    const transactions = await listTransactions()
    return NextResponse.json({ ok: true, data: transactions })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les caissiers peuvent créer des transactions
  const canCreate = user.role === "cashier"
  
  if (!canCreate) {
    return NextResponse.json({ ok: false, error: "Seuls les caissiers peuvent créer des transactions" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { type, description, amount, currency, details } = body

    if (!type || !description || !amount || !details) {
      return NextResponse.json({ ok: false, error: "Tous les champs sont requis" }, { status: 400 })
    }

    const transaction = await createTransaction({
      type,
      description,
      amount: Number(amount),
      currency: currency || "XAF",
      created_by: user.name,
      agency: user.agency,
      details
    })

    return NextResponse.json({ ok: true, data: transaction })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  
  try {
    const body = await request.json()
    const { id, status, rejection_reason } = body

    if (!id || !status) {
      return NextResponse.json({ ok: false, error: "ID et statut requis" }, { status: 400 })
    }

    // Vérifier les permissions selon le statut
    if (status === "validated" || status === "rejected") {
      // Seuls les auditeurs peuvent valider/rejeter les transactions
      if (user.role !== "auditor") {
        return NextResponse.json({ ok: false, error: "Seuls les auditeurs peuvent valider ou rejeter les transactions" }, { status: 403 })
      }
    } else if (status === "completed") {
      // Seuls les caissiers peuvent clôturer les transactions
      if (user.role !== "cashier") {
        return NextResponse.json({ ok: false, error: "Seuls les caissiers peuvent clôturer les transactions" }, { status: 403 })
      }
    }

    const transaction = await updateTransactionStatus(id, status, rejection_reason)
    return NextResponse.json({ ok: true, data: transaction })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE() {
  const { user } = await requireAuth()
  
  // Seuls les super administrateurs peuvent supprimer toutes les transactions
  if (user.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Seuls les super administrateurs peuvent supprimer toutes les transactions" }, { status: 403 })
  }

  try {
    const result = await deleteAllTransactions()
    return NextResponse.json({ 
      ok: true, 
      message: `${result.count} transaction(s) supprimée(s) avec succès`,
      count: result.count 
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
