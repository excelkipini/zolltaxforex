import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listTransactions, createTransaction, updateTransactionStatus } from "@/lib/transactions-queries"

export async function GET() {
  const { user } = await requireAuth()
  
  try {
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
