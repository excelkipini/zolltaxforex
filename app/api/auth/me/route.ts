import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    return NextResponse.json({ 
      ok: true, 
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Non authentifié" 
    }, { status: 401 })
  }
}
