import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { listAgencies, createAgency, AVAILABLE_COUNTRIES } from "@/lib/agencies-queries"

export async function GET() {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et admins peuvent voir toutes les agences
  const canViewAll = user.role === "director" || user.role === "delegate" || user.role === "super_admin"
  
  if (!canViewAll) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const agencies = await listAgencies()
    return NextResponse.json({ ok: true, data: agencies })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les directeurs et admins peuvent créer des agences
  const canCreate = user.role === "director" || user.role === "delegate" || user.role === "super_admin"
  
  if (!canCreate) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, country, address, status = "active" } = body

    if (!name || !country || !address) {
      return NextResponse.json({ ok: false, error: "Tous les champs sont requis" }, { status: 400 })
    }

    if (!AVAILABLE_COUNTRIES.includes(country)) {
      return NextResponse.json({ 
        ok: false, 
        error: `Pays non valide. Pays disponibles: ${AVAILABLE_COUNTRIES.join(", ")}` 
      }, { status: 400 })
    }

    const agency = await createAgency({ name, country, address, status })
    return NextResponse.json({ ok: true, data: agency })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
