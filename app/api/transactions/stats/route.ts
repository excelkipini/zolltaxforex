import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getTransactionStats } from "@/lib/transactions-queries"

export async function GET(request: NextRequest) {
  await requireAuth()
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from") ?? undefined
    const to = searchParams.get("to") ?? undefined
    const cashier = searchParams.get("cashier") ?? undefined
    const transferMethod = searchParams.get("transferMethod") ?? undefined
    const search = searchParams.get("search") ?? undefined
    const hasFilters = from || to || (cashier && cashier !== "all") || (transferMethod && transferMethod !== "all") || (search?.trim() ?? "")
    const filters =
      hasFilters
        ? {
            fromDate: from || undefined,
            toDate: to || undefined,
            createdBy: cashier && cashier !== "all" ? cashier : undefined,
            transferMethod: transferMethod && transferMethod !== "all" ? transferMethod : undefined,
            search: search?.trim() || undefined,
          }
        : undefined
    const stats = await getTransactionStats(filters)
    return NextResponse.json({ ok: true, ...stats })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
