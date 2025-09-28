import { type NextRequest, NextResponse } from "next/server"
import { loginAsRole } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { role } = body

    if (!role) {
      return NextResponse.json({ error: "Role is required" }, { status: 400 })
    }

    const user = await loginAsRole(role)
    if (!user) {
      return NextResponse.json({ error: "Failed to login as role" }, { status: 400 })
    }

    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
