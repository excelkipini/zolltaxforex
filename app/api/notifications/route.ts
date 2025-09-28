import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createNotification, listUnreadNotifications, markNotificationsRead } from "@/lib/notifications-queries"

export async function GET() {
  const { user } = await requireAuth()
  try {
    const items = await listUnreadNotifications({ role: user.role, userName: user.name, limit: 50 })
    return NextResponse.json({ ok: true, data: items })
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Erreur chargement notifications" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  await requireAuth()
  try {
    const body = await request.json()
    const n = await createNotification({
      message: String(body?.message || ""),
      target_role: body?.target_role ? String(body.target_role) : null,
      target_user_name: body?.target_user_name ? String(body.target_user_name) : null,
    })
    return NextResponse.json({ ok: true, data: n })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur création notification" }, { status: 400 })
  }
}

export async function PUT(request: NextRequest) {
  await requireAuth()
  try {
    const body = await request.json()
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    await markNotificationsRead(ids)
    return NextResponse.json({ ok: true, data: null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Erreur mise à jour notifications" }, { status: 400 })
  }
}


