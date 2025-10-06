#!/usr/bin/env node

import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Charger les variables d'environnement
config({ path: '.env.local' })

console.log("📊 Test des statistiques des cartes...")

async function testCardStats() {
  try {
    const sql = neon(process.env.DATABASE_URL)
    
    // Récupérer toutes les cartes
    console.log("🔍 Récupération des cartes...")
    const allCards = await sql`
      SELECT cid, country, status, monthly_limit, monthly_used, recharge_limit
      FROM cards
      ORDER BY cid
    `
    
    console.log(`\n📋 Total des cartes: ${allCards.length}`)
    
    // Statistiques par statut
    const activeCards = allCards.filter(c => c.status === 'active')
    const inactiveCards = allCards.filter(c => c.status === 'inactive')
    
    console.log(`✅ Cartes actives: ${activeCards.length}`)
    console.log(`❌ Cartes inactives: ${inactiveCards.length}`)
    
    // Calculs des limites
    const totalLimitAll = allCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
    const totalLimitActive = activeCards.reduce((sum, c) => sum + Number(c.monthly_limit), 0)
    const totalUsedActive = activeCards.reduce((sum, c) => sum + Number(c.monthly_used), 0)
    const totalAvailable = totalLimitActive - totalUsedActive
    
    console.log(`\n💰 Limites mensuelles:`)
    console.log(`  • Toutes les cartes: ${totalLimitAll.toLocaleString()} FCFA`)
    console.log(`  • Cartes actives seulement: ${totalLimitActive.toLocaleString()} FCFA`)
    console.log(`  • Utilisé (cartes actives): ${totalUsedActive.toLocaleString()} FCFA`)
    console.log(`  • Disponible (cartes actives): ${totalAvailable.toLocaleString()} FCFA`)
    
    // Test de la fonction getDistributionStats
    console.log(`\n🧮 Test de getDistributionStats...`)
    const stats = await sql`
      SELECT 
        COUNT(*) as total_cards,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_cards,
        COUNT(CASE WHEN status = 'active' AND monthly_used < monthly_limit THEN 1 END) as available_cards,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_limit ELSE 0 END), 0) as total_limit,
        COALESCE(SUM(CASE WHEN status = 'active' THEN monthly_used ELSE 0 END), 0) as total_used
      FROM cards
    `
    
    const result = stats[0]
    console.log(`  • Total cartes: ${result.total_cards}`)
    console.log(`  • Cartes actives: ${result.active_cards}`)
    console.log(`  • Cartes disponibles: ${result.available_cards}`)
    console.log(`  • Limite totale (actives): ${Number(result.total_limit).toLocaleString()} FCFA`)
    console.log(`  • Utilisé total (actives): ${Number(result.total_used).toLocaleString()} FCFA`)
    console.log(`  • Disponible: ${(Number(result.total_limit) - Number(result.total_used)).toLocaleString()} FCFA`)
    
    // Vérification de cohérence
    console.log(`\n✅ Vérification de cohérence:`)
    const isConsistent = (
      Number(result.active_cards) === activeCards.length &&
      Number(result.total_limit) === totalLimitActive &&
      Number(result.total_used) === totalUsedActive
    )
    
    if (isConsistent) {
      console.log(`  ✅ Les statistiques sont cohérentes!`)
    } else {
      console.log(`  ❌ Incohérence détectée!`)
    }
    
    console.log(`\n🎉 Test terminé!`)
    
  } catch (error) {
    console.error("❌ Erreur lors du test:", error.message)
  }
}

testCardStats()
