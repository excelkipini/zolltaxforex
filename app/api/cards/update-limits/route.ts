import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { COUNTRY_LIMITS } from "@/lib/cards-queries"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Les directeurs, super admins et comptables peuvent exécuter cette mise à jour
  const canUpdate = user.role === "director" || user.role === "super_admin" || user.role === "accounting"
  
  if (!canUpdate) {
    return NextResponse.json({ ok: false, error: "Non autorisé - Seuls les directeurs, comptables et super admins peuvent exécuter cette mise à jour" }, { status: 403 })
  }

  try {
    console.log('🔧 Début de la mise à jour des limites des cartes...')
    
    // Récupérer toutes les cartes existantes
    const existingCards = await sql`
      SELECT id, cid, country, monthly_limit, recharge_limit
      FROM cards
      ORDER BY country, cid
    `
    
    console.log(`📊 ${existingCards.length} cartes trouvées`)
    
    const updateResults = {
      total: existingCards.length,
      updated: 0,
      skipped: 0,
      errors: 0,
      details: [] as Array<{
        cid: string
        country: string
        oldMonthly: number
        oldRecharge: number
        newMonthly: number
        newRecharge: number
        status: 'updated' | 'skipped' | 'error'
        error?: string
      }>
    }
    
    // Traiter chaque carte
    for (const card of existingCards) {
      const country = card.country as keyof typeof COUNTRY_LIMITS
      const limits = COUNTRY_LIMITS[country]
      
      if (!limits) {
        console.log(`⚠️ Pays non reconnu: ${country} pour la carte ${card.cid}`)
        updateResults.details.push({
          cid: card.cid,
          country: card.country,
          oldMonthly: card.monthly_limit,
          oldRecharge: card.recharge_limit,
          newMonthly: card.monthly_limit,
          newRecharge: card.recharge_limit,
          status: 'error',
          error: 'Pays non reconnu'
        })
        updateResults.errors++
        continue
      }
      
      // Vérifier si la carte a besoin d'être mise à jour
      const needsUpdate = card.monthly_limit !== limits.monthly_limit || 
                          card.recharge_limit !== limits.recharge_limit
      
      if (!needsUpdate) {
        console.log(`✅ Carte ${card.cid} (${country}) - Limites déjà correctes`)
        updateResults.details.push({
          cid: card.cid,
          country: card.country,
          oldMonthly: card.monthly_limit,
          oldRecharge: card.recharge_limit,
          newMonthly: card.monthly_limit,
          newRecharge: card.recharge_limit,
          status: 'skipped'
        })
        updateResults.skipped++
        continue
      }
      
      try {
        // Mettre à jour la carte
        await sql`
          UPDATE cards 
          SET 
            monthly_limit = ${limits.monthly_limit},
            recharge_limit = ${limits.recharge_limit},
            updated_at = NOW()
          WHERE id = ${card.id}
        `
        
        console.log(`🔄 Carte ${card.cid} (${country}) mise à jour:`)
        console.log(`   - Limite mensuelle: ${card.monthly_limit.toLocaleString()} → ${limits.monthly_limit.toLocaleString()}`)
        console.log(`   - Limite de recharge: ${card.recharge_limit.toLocaleString()} → ${limits.recharge_limit.toLocaleString()}`)
        
        updateResults.details.push({
          cid: card.cid,
          country: card.country,
          oldMonthly: card.monthly_limit,
          oldRecharge: card.recharge_limit,
          newMonthly: limits.monthly_limit,
          newRecharge: limits.recharge_limit,
          status: 'updated'
        })
        updateResults.updated++
        
      } catch (error: any) {
        console.log(`❌ Erreur lors de la mise à jour de ${card.cid}:`, error.message)
        updateResults.details.push({
          cid: card.cid,
          country: card.country,
          oldMonthly: card.monthly_limit,
          oldRecharge: card.recharge_limit,
          newMonthly: limits.monthly_limit,
          newRecharge: limits.recharge_limit,
          status: 'error',
          error: error.message
        })
        updateResults.errors++
      }
    }
    
    console.log('📋 Résumé de la mise à jour:')
    console.log(`   - Total: ${updateResults.total}`)
    console.log(`   - Mises à jour: ${updateResults.updated}`)
    console.log(`   - Ignorées: ${updateResults.skipped}`)
    console.log(`   - Erreurs: ${updateResults.errors}`)
    
    return NextResponse.json({ 
      ok: true, 
      message: "Mise à jour des limites terminée",
      data: {
        summary: {
          total: updateResults.total,
          updated: updateResults.updated,
          skipped: updateResults.skipped,
          errors: updateResults.errors
        },
        details: updateResults.details,
        executed_by: user.name,
        executed_at: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour des limites:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
