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
      // Ne renvoyer que les champs nécessaires aux écrans clients
      const publicSettings = {
        usd: settings.usd,
        eur: settings.eur,
        gbp: settings.gbp,
        commission: settings.commission,
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
    const { usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission } = body

    const updates: any = {}
    if (usd !== undefined && !isNaN(Number(usd))) updates.usd = Number(usd)
    if (eur !== undefined && !isNaN(Number(eur))) updates.eur = Number(eur)
    if (gbp !== undefined && !isNaN(Number(gbp))) updates.gbp = Number(gbp)
    if (transfer_limit !== undefined && !isNaN(Number(transfer_limit))) updates.transfer_limit = Number(transfer_limit)
    if (daily_limit !== undefined && !isNaN(Number(daily_limit))) updates.daily_limit = Number(daily_limit)
    if (card_limit !== undefined && !isNaN(Number(card_limit))) updates.card_limit = Number(card_limit)
    if (commission !== undefined && !isNaN(Number(commission))) updates.commission = Number(commission)

    const updatedSettings = await updateSettings(updates, user.name)
    return NextResponse.json({ ok: true, data: updatedSettings })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
