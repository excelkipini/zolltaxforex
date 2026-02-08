import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import {
  getExchangeCaisseBalances,
  getExchangeOperations,
  executeAchatDevise,
  executeVente,
  executeCession,
  executeApproAgence,
  updateExchangeCaisseBalanceManual,
  getAllAgenciesWithCaisses,
  getCommissionsGenerated,
  getLastApproRate,
  type ExchangeCaisseCurrency,
} from "@/lib/exchange-caisse-queries"

export async function GET(request: NextRequest) {
  await requireAuth()
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get("action")
    const agencyId = searchParams.get("agencyId")
    const limit = Math.min(2000, parseInt(searchParams.get("limit") || "1000", 10) || 1000)

    // Récupérer toutes les agences avec leurs caisses
    if (action === "agencies") {
      const agencies = await getAllAgenciesWithCaisses()
      return NextResponse.json({ success: true, agencies })
    }

    // Récupérer les opérations
    if (action === "operations") {
      const includeAll = searchParams.get("includeAll") === "true"
      const operations = await getExchangeOperations(limit, agencyId || null, includeAll)
      return NextResponse.json({ success: true, operations })
    }
    
    // Récupérer les commissions générées
    if (action === "commissions") {
      const commissions = await getCommissionsGenerated(agencyId || null)
      return NextResponse.json({ success: true, commissions })
    }

    // Récupérer les soldes d'une caisse spécifique (principale ou agence)
    const caisses = await getExchangeCaisseBalances(agencyId || null)
    const byCurrency = Object.fromEntries(caisses.map((c) => [c.currency, c]))
    const roundRate = (n: number) => Math.round(n * 100) / 100
    const toRate = (v: unknown): number | null =>
      v == null ? null : roundRate(Number(v))
    
    // Récupérer les commissions générées pour cette caisse
    const commissions = await getCommissionsGenerated(agencyId || null)
    
    // Récupérer les taux réels avec fallback sur l'historique des opérations
    const [rateUsd, rateEur, rateGbp] = await Promise.all([
      getLastApproRate("USD", agencyId || null),
      getLastApproRate("EUR", agencyId || null),
      getLastApproRate("GBP", agencyId || null),
    ])
    
    return NextResponse.json({
      success: true,
      caisses,
      agencyId: agencyId || null,
      xaf: Number(byCurrency.XAF?.balance) || 0,
      usd: Number(byCurrency.USD?.balance) || 0,
      eur: Number(byCurrency.EUR?.balance) || 0,
      gbp: Number(byCurrency.GBP?.balance) || 0,
      lastApproRateUsd: rateUsd != null ? roundRate(Number(rateUsd)) : (toRate(byCurrency.USD?.last_appro_rate) ?? null),
      lastApproRateEur: rateEur != null ? roundRate(Number(rateEur)) : (toRate(byCurrency.EUR?.last_appro_rate) ?? null),
      lastApproRateGbp: rateGbp != null ? roundRate(Number(rateGbp)) : (toRate(byCurrency.GBP?.last_appro_rate) ?? null),
      lastManualMotifXaf: byCurrency.XAF?.last_manual_motif ?? null,
      lastManualMotifUsd: byCurrency.USD?.last_manual_motif ?? null,
      lastManualMotifEur: byCurrency.EUR?.last_manual_motif ?? null,
      lastManualMotifGbp: byCurrency.GBP?.last_manual_motif ?? null,
      commissionUsd: Number(commissions.USD) || 0,
      commissionEur: Number(commissions.EUR) || 0,
      commissionGbp: Number(commissions.GBP) || 0,
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
    const agencyId = body?.agencyId || null

    // Achat devise (anciennement Appro) - uniquement sur caisse principale
    if (action === "appro" || action === "achat-devise") {
      const p = body
      const deviseAchetee = p.deviseAchetee === "EUR" ? "EUR" : p.deviseAchetee === "GBP" ? "GBP" : "USD"
      const result = await executeAchatDevise(
        {
          deviseAchat: (p.deviseAchat || "XAF") as ExchangeCaisseCurrency,
          montant: Number(p.montant) || 0,
          deviseAchetee,
          tauxAchat: Number(p.tauxAchat) || 0,
          depensesTransport: Number(p.depensesTransport) || 0,
          depensesBeach: Number(p.depensesBeach) || 0,
          depensesEchangeBillets: Number(p.depensesEchangeBillets) || 0,
          deductFromXaf: !!p.deductFromXaf,
          deductFromUsd: !!p.deductFromUsd,
          deductFromEur: !!p.deductFromEur,
          deductFromGbp: !!p.deductFromGbp,
        },
        userName
      )
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, tauxReel: result.tauxReel, totalDeviseDisponible: result.totalDeviseDisponible })
    }

    // Appro agence - transférer de la caisse principale vers les agences
    if (action === "appro-agence") {
      const distributions = body?.distributions
      if (!Array.isArray(distributions) || distributions.length === 0) {
        return NextResponse.json({ success: false, error: "Aucune distribution spécifiée" }, { status: 400 })
      }
      
      const result = await executeApproAgence({ distributions }, userName)
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    // Vente - peut être sur n'importe quelle caisse
    if (action === "vente") {
      const p = body
      const deviseVendu = p.deviseVendu === "EUR" ? "EUR" : p.deviseVendu === "GBP" ? "GBP" : "USD"
      const result = await executeVente(
        {
          beneficiaire: String(p.beneficiaire || "").trim(),
          idType: p.idType || null,
          idTypeLabel: p.idTypeLabel || null,
          idNumber: p.idNumber ? String(p.idNumber).trim() : null,
          deviseVendu,
          montantVendu: Number(p.montantVendu) || 0,
          deviseRecu: String(p.deviseRecu || "XAF"),
          tauxDuJour: Number(p.tauxDuJour) || 0,
          montantRecu: Number(p.montantRecu) || 0,
        },
        userName,
        agencyId
      )
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, commission: result.commission })
    }

    // Cession - peut être sur n'importe quelle caisse
    if (action === "cession") {
      const p = body
      const result = await executeCession(
        {
          devise: (p.devise || "XAF") as ExchangeCaisseCurrency,
          montant: Number(p.montant) || 0,
          beneficiaire: String(p.beneficiaire || "").trim(),
        },
        userName,
        agencyId
      )
      if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    // Mise à jour manuelle du solde
    if (action === "update-balance") {
      // Les caissiers et auditeurs n'ont pas le droit de modifier les soldes des caisses
      const BALANCE_EDIT_ROLES = ["director", "accounting", "super_admin", "delegate"]
      const userRole = session.user?.role
      if (!userRole || !BALANCE_EDIT_ROLES.includes(userRole)) {
        return NextResponse.json(
          { success: false, error: "Vous n'avez pas l'autorisation de modifier le solde des caisses." },
          { status: 403 }
        )
      }

      const currency = (body?.currency || "XAF") as ExchangeCaisseCurrency
      if (!["XAF", "USD", "EUR", "GBP"].includes(currency)) {
        return NextResponse.json({ success: false, error: "Devise invalide" }, { status: 400 })
      }
      const newBalance = Number(body?.newBalance)
      if (isNaN(newBalance) || newBalance < 0) {
        return NextResponse.json({ success: false, error: "Solde invalide" }, { status: 400 })
      }
      const motif = typeof body?.motif === "string" ? body.motif.trim() || null : null
      await updateExchangeCaisseBalanceManual(currency, newBalance, userName, motif, agencyId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: "Action inconnue" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message }, { status: 500 })
  }
}
