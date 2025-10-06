import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les super admins peuvent exécuter les migrations
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Non autorisé - Seuls les super admins peuvent exécuter les migrations" }, { status: 403 })
  }

  try {
    console.log('🔄 Migration des recharges existantes vers l\'historique des actions')
    
    // Récupérer toutes les recharges existantes
    const recharges = await sql`
      SELECT 
        cr.id,
        cr.card_id,
        cr.amount,
        cr.recharged_by,
        cr.recharge_date,
        cr.notes,
        cr.created_at,
        c.cid,
        c.country,
        c.monthly_limit,
        c.monthly_used
      FROM card_recharges cr
      JOIN cards c ON cr.card_id = c.id
      ORDER BY cr.created_at ASC
    `
    
    console.log(`📋 ${recharges.length} recharges trouvées`)
    
    // Récupérer les utilisateurs pour mapper les noms aux IDs
    const users = await sql`
      SELECT id, name, role
      FROM users
    `
    
    const userMap = new Map()
    users.forEach(user => {
      userMap.set(user.name, user)
    })
    
    console.log(`👥 ${users.length} utilisateurs trouvés`)
    
    let migratedCount = 0
    let skippedCount = 0
    
    for (const recharge of recharges) {
      try {
        // Trouver l'utilisateur correspondant
        const rechargeUser = userMap.get(recharge.recharged_by)
        
        if (!rechargeUser) {
          console.log(`⚠️  Utilisateur "${recharge.recharged_by}" non trouvé pour la recharge ${recharge.id}`)
          skippedCount++
          continue
        }
        
        // Vérifier si l'action existe déjà
        const existingAction = await sql`
          SELECT id
          FROM cards_action_history
          WHERE action_type = 'recharge'
          AND target_card_id = ${recharge.card_id}
          AND metadata->>'recharge_id' = ${recharge.id}
        `
        
        if (existingAction.length > 0) {
          console.log(`⏭️  Action déjà migrée pour la recharge ${recharge.id}`)
          skippedCount++
          continue
        }
        
        // Enregistrer l'action dans l'historique
        await sql`
          INSERT INTO cards_action_history (
            user_id, user_name, user_role, action_type, action_description,
            target_card_id, target_card_cid, old_values, new_values, metadata,
            ip_address, user_agent
          ) VALUES (
            ${rechargeUser.id}::uuid, ${rechargeUser.name}, ${rechargeUser.role}, 'recharge', 
            ${`Recharge de ${recharge.amount.toLocaleString()} XAF sur la carte ${recharge.cid} (${recharge.country})`},
            ${recharge.card_id}::uuid, ${recharge.cid}, null,
            ${JSON.stringify({
              recharge_amount: recharge.amount,
              recharge_date: recharge.recharge_date,
              notes: recharge.notes
            })},
            ${JSON.stringify({
              recharge_id: recharge.id,
              recharged_by: recharge.recharged_by,
              card_country: recharge.country,
              card_monthly_limit: recharge.monthly_limit,
              card_monthly_used: recharge.monthly_used,
              migrated_at: new Date().toISOString()
            })},
            null, null
          )
        `
        
        migratedCount++
        
        if (migratedCount % 10 === 0) {
          console.log(`📈 ${migratedCount} actions migrées...`)
        }
        
      } catch (error) {
        console.error(`❌ Erreur lors de la migration de la recharge ${recharge.id}:`, error.message)
        skippedCount++
      }
    }
    
    // Vérifier le résultat
    const totalActions = await sql`
      SELECT COUNT(*) as total
      FROM cards_action_history
    `
    
    const actionTypes = await sql`
      SELECT action_type, COUNT(*) as count
      FROM cards_action_history
      GROUP BY action_type
      ORDER BY count DESC
    `
    
    console.log('🎉 Migration terminée!')
    console.log(`✅ ${migratedCount} actions migrées`)
    console.log(`⏭️  ${skippedCount} actions ignorées`)
    console.log(`📊 Total traité: ${migratedCount + skippedCount}`)
    
    return NextResponse.json({ 
      ok: true, 
      message: "Migration des recharges terminée avec succès",
      data: {
        migrated_count: migratedCount,
        skipped_count: skippedCount,
        total_processed: migratedCount + skippedCount,
        total_actions: totalActions[0].total,
        action_types: actionTypes
      }
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la migration:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
