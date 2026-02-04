import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { getSettings, updateSettings, getSettingsHistory } from "@/lib/settings-queries"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get('type') // 'public' pour accès lecture restreint

  // Accès public (authentifié) aux taux/commissions uniquement
  if (type === 'public') {
    try {
      const settings = await getSettings()
      const publicSettings = {
        usd: settings.usd,
        eur: settings.eur,
        gbp: settings.gbp,
        commission: settings.commission,
        transfer_commission_min_xaf: settings.transfer_commission_min_xaf,
        card_fee_xaf: settings.card_fee_xaf,
        commission_international_pct: settings.commission_international_pct,
      }
      return NextResponse.json({ ok: true, data: { settings: publicSettings } })
    } catch (error: any) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }
  }

  // Accès complet réservé aux rôles autorisés
  const canView = user.role === "director" || user.role === "delegate" || user.role === "super_admin" || user.role === "auditor" || user.role === "accounting"
  if (!canView) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const settings = await getSettings()
    const history = await getSettingsHistory()
    return NextResponse.json({ ok: true, data: { settings, history } })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs, admins et comptables peuvent modifier les paramètres
  const canModify = user.role === "director" || user.role === "delegate" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canModify) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()

    const toNum = (v: unknown): number | null => {
      if (v === undefined || v === null) return null
      if (typeof v === "number" && !Number.isNaN(v)) return v
      const s = String(v).trim().replace(/,/g, ".")
      const n = parseFloat(s.replace(/[^0-9.-]/g, ""))
      return Number.isNaN(n) ? null : n
    }
    const toInt = (v: unknown): number | null => {
      const n = toNum(v)
      return n === null ? null : Math.round(n)
    }

    const updates: any = {}
    const u = toNum(body.usd); if (u !== null && u > 0) updates.usd = u
    const e = toNum(body.eur); if (e !== null && e > 0) updates.eur = e
    const g = toNum(body.gbp); if (g !== null && g > 0) updates.gbp = g
    const tl = toInt(body.transfer_limit); if (tl !== null && tl >= 0) updates.transfer_limit = tl
    const dl = toInt(body.daily_limit); if (dl !== null && dl >= 0) updates.daily_limit = dl
    const cl = toInt(body.card_limit); if (cl !== null && cl >= 0) updates.card_limit = cl
    const c = toNum(body.commission); if (c !== null && c >= 0 && c <= 100) updates.commission = c
    const tmin = toInt(body.transfer_commission_min_xaf); if (tmin !== null && tmin >= 0) updates.transfer_commission_min_xaf = tmin
    const cf = toInt(body.card_fee_xaf); if (cf !== null && cf >= 0) updates.card_fee_xaf = cf
    const cint = toNum(body.commission_international_pct); if (cint !== null && cint >= 0 && cint <= 100) updates.commission_international_pct = cint

    const updatedSettings = await updateSettings(updates, user.name)
    return NextResponse.json({ ok: true, data: updatedSettings })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
