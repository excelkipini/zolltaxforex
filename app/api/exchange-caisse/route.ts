import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import {
  getExchangeCaisseBalances,
  getCoffreBalance,
  getExchangeOperations,
  executeAppro,
  executeVente,
  executeCession,
  updateExchangeCaisseBalanceManual,
  type ExchangeCaisseCurrency,
} from "@/lib/exchange-caisse-queries"

export async function GET(request: NextRequest) {
  await requireAuth()
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10) || 50)

    if (action === "operations") {
      const operations = await getExchangeOperations(limit)
      return NextResponse.json({ success: true, operations })
    }

    const [caisses, coffreBalance] = await Promise.all([
      getExchangeCaisseBalances(),
      getCoffreBalance(),
    ])
    const byCurrency = Object.fromEntries(caisses.map((c) => [c.currency, c]))
    const roundRate = (n: number) => Math.round(n * 100) / 100
    const toRate = (v: unknown): number | null =>
      v == null ? null : roundRate(Number(v))
    return NextResponse.json({
      success: true,
      caisses,
      coffreBalance,
      xaf: byCurrency.XAF?.balance ?? 0,
      usd: byCurrency.USD?.balance ?? 0,
      eur: byCurrency.EUR?.balance ?? 0,
      lastApproRateUsd: toRate(byCurrency.USD?.last_appro_rate) ?? null,
      lastApproRateEur: toRate(byCurrency.EUR?.last_appro_rate) ?? null,
      lastManualMotifXaf: byCurrency.XAF?.last_manual_motif ?? null,
      lastManualMotifUsd: byCurrency.USD?.last_manual_motif ?? null,
      lastManualMotifEur: byCurrency.EUR?.last_manual_motif ?? null,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await requireAuth()
  const userName = session.user?.name ?? "system"
  try {
    const body = await request.json()
    const action = body?.action

    if (action === "appro") {
      const p = body
      const result = await executeAppro(
        {
          deviseAchat: (p.deviseAchat || "XAF") as ExchangeCaisseCurrency,
          montant: Number(p.montant) || 0,
          deviseAchetee: p.deviseAchetee === "EUR" ? "EUR" : "USD",
          tauxAchat: Number(p.tauxAchat) || 0,
          depensesTransport: Number(p.depensesTransport) || 0,
          depensesBeach: Number(p.depensesBeach) || 0,
          depensesEchangeBillets: Number(p.depensesEchangeBillets) || 0,
          deductFromXaf: !!p.deductFromXaf,
          deductFromUsd: !!p.deductFromUsd,
          deductFromEur: !!p.deductFromEur,
          deductFromCoffre: !!p.deductFromCoffre,
        },
        userName
      )
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === "vente") {
      const p = body
      const result = await executeVente(
        {
          beneficiaire: String(p.beneficiaire || "").trim(),
          deviseVendu: p.deviseVendu === "EUR" ? "EUR" : "USD",
          montantVendu: Number(p.montantVendu) || 0,
          deviseRecu: String(p.deviseRecu || "XAF"),
          tauxDuJour: Number(p.tauxDuJour) || 0,
          montantRecu: Number(p.montantRecu) || 0,
        },
        userName
      )
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, commission: result.commission })
    }

    if (action === "cession") {
      const p = body
      const result = await executeCession(
        {
          devise: (p.devise || "XAF") as ExchangeCaisseCurrency,
          montant: Number(p.montant) || 0,
          beneficiaire: String(p.beneficiaire || "").trim(),
        },
        userName
      )
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (action === "update-balance") {
      const currency = (body?.currency || "XAF") as ExchangeCaisseCurrency
      if (!["XAF", "USD", "EUR"].includes(currency)) {
        return NextResponse.json({ success: false, error: "Devise invalide" }, { status: 400 })
      }
      const newBalance = Number(body?.newBalance)
      if (isNaN(newBalance) || newBalance < 0) {
        return NextResponse.json({ success: false, error: "Solde invalide" }, { status: 400 })
      }
      const motif = typeof body?.motif === "string" ? body.motif.trim() || null : null
      await updateExchangeCaisseBalanceManual(currency, newBalance, userName, motif)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: "Action inconnue" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}
