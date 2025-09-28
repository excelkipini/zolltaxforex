import { NextRequest, NextResponse } from "next/server"
import { handleUpdateProfile } from "@/app/(main)/settings/actions"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const res = await handleUpdateProfile({ name: String(body?.name || ""), email: String(body?.email || "") })
    if (!res.ok) return NextResponse.json(res, { status: 400 })
    return NextResponse.json(res)
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Erreur serveur" }, { status: 500 })
  }
}


