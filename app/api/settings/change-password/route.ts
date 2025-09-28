import { NextRequest, NextResponse } from "next/server"
import { handleChangePassword } from "@/app/(main)/settings/actions"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await handleChangePassword({ current: String(body?.current || ""), next: String(body?.next || "") })
    if (!res.ok) return NextResponse.json(res, { status: 400 })
    return NextResponse.json(res)
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}


