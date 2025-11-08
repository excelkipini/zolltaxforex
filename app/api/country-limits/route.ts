import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { COUNTRY_LIMITS, Country } from "@/lib/cards-queries"

export async function GET(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, super admins et comptables peuvent voir les plafonds
  const canView = user.role === "director" || user.role === "delegate" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canView) {
    return NextResponse.json({ ok: false, error: "Non autorisé" }, { status: 403 })
  }

  try {
    // Retourner les plafonds actuels par pays
    const limits = Object.entries(COUNTRY_LIMITS).map(([country, limits]) => ({
      country: country as Country,
      monthly_limit: limits.monthly_limit,
      recharge_limit: limits.recharge_limit
    }))

    return NextResponse.json({ 
      ok: true, 
      data: { limits }
    })
  } catch (error: any) {
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, super admins et comptables peuvent modifier les plafonds par pays
  const canModify = user.role === "director" || user.role === "delegate" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canModify) {
    return NextResponse.json({ 
      ok: false, 
      error: "Non autorisé - Seuls les directeurs, comptables et super admins peuvent modifier les plafonds par pays" 
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { country, monthly_limit, recharge_limit } = body

    if (!country || !monthly_limit || !recharge_limit) {
      return NextResponse.json({ 
        ok: false, 
        error: "Pays, limite mensuelle et limite de recharge requis" 
      }, { status: 400 })
    }

    // Valider que le pays existe
    if (!(country in COUNTRY_LIMITS)) {
      return NextResponse.json({ 
        ok: false, 
        error: "Pays non valide" 
      }, { status: 400 })
    }

    // Valider les valeurs numériques
    const monthlyLimit = Number(monthly_limit)
    const rechargeLimit = Number(recharge_limit)

    if (isNaN(monthlyLimit) || isNaN(rechargeLimit) || monthlyLimit <= 0 || rechargeLimit <= 0) {
      return NextResponse.json({ 
        ok: false, 
        error: "Les limites doivent être des nombres positifs" 
      }, { status: 400 })
    }

    // Valider que la limite de recharge ne dépasse pas la limite mensuelle
    if (rechargeLimit > monthlyLimit) {
      return NextResponse.json({ 
        ok: false, 
        error: "La limite de recharge ne peut pas dépasser la limite mensuelle" 
      }, { status: 400 })
    }

    // Mettre à jour les limites dans COUNTRY_LIMITS
    // Note: En production, vous pourriez vouloir stocker cela dans une base de données
    COUNTRY_LIMITS[country as Country] = {
      monthly_limit: monthlyLimit,
      recharge_limit: rechargeLimit
    }

    console.log(`🔧 Plafonds mis à jour pour ${country}:`)
    console.log(`   - Limite mensuelle: ${monthlyLimit.toLocaleString()} XAF`)
    console.log(`   - Limite de recharge: ${rechargeLimit.toLocaleString()} XAF`)
    console.log(`   - Modifié par: ${user.name}`)

    // Mettre à jour automatiquement les cartes existantes pour ce pays
    let updatedCardsCount = 0
    try {
      const { sql } = await import("@/lib/db")
      
      const updateResult = await sql`
        UPDATE cards 
        SET 
          monthly_limit = ${monthlyLimit},
          recharge_limit = ${rechargeLimit},
          updated_at = NOW()
        WHERE country = ${country}
      `
      
      updatedCardsCount = updateResult.count || 0
      console.log(`🔄 ${updatedCardsCount} cartes mises à jour pour ${country}`)
    } catch (updateError) {
      console.error(`❌ Erreur lors de la mise à jour des cartes pour ${country}:`, updateError)
      // Ne pas faire échouer la requête si la mise à jour des cartes échoue
    }

    return NextResponse.json({ 
      ok: true, 
      message: `Plafonds mis à jour avec succès pour ${country}${updatedCardsCount > 0 ? ` (${updatedCardsCount} cartes mises à jour)` : ''}`,
      data: {
        country,
        monthly_limit: monthlyLimit,
        recharge_limit: rechargeLimit,
        updated_cards_count: updatedCardsCount,
        updated_by: user.name,
        updated_at: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour des plafonds:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
