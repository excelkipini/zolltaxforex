#!/usr/bin/env node

import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Charger les variables d'environnement
config({ path: '.env.local' })

console.log("🧪 Test de l'importation des cartes...")

async function testCardImport() {
  try {
    const sql = neon(process.env.DATABASE_URL)
    
    // Vérifier les cartes existantes
    console.log("📊 Vérification des cartes existantes...")
    const existingCards = await sql`
      SELECT COUNT(*) as count, country 
      FROM cards 
      GROUP BY country
      ORDER BY country
    `
    
    console.log("Cartes existantes par pays:")
    existingCards.forEach(row => {
      console.log(`  • ${row.country}: ${row.count} cartes`)
    })
    
    // Tester l'ajout d'une carte de test
    console.log("\n🔧 Test d'ajout d'une carte de test...")
    
    const testCardId = `TEST_${Date.now()}`
    
    const result = await sql`
      INSERT INTO cards (cid, country, status, monthly_limit, monthly_used, recharge_limit, created_at, updated_at)
      VALUES (${testCardId}, 'Mali', 'active', 2000000, 0, 500000, NOW(), NOW())
      RETURNING id, cid, country, status
    `
    
    if (result.length > 0) {
      console.log("✅ Carte de test créée avec succès:")
      console.log(`  • ID: ${result[0].id}`)
      console.log(`  • CID: ${result[0].cid}`)
      console.log(`  • Pays: ${result[0].country}`)
      console.log(`  • Statut: ${result[0].status}`)
      
      // Nettoyer la carte de test
      await sql`DELETE FROM cards WHERE cid = ${testCardId}`
      console.log("🧹 Carte de test supprimée")
    } else {
      console.log("❌ Échec de création de la carte de test")
    }
    
    // Vérifier la structure de la table
    console.log("\n📋 Structure de la table cards:")
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'cards'
      ORDER BY ordinal_position
    `
    
    columns.forEach(col => {
      console.log(`  • ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(requis)' : '(optionnel)'}`)
    })
    
    console.log("\n🎉 Test terminé avec succès!")
    
  } catch (error) {
    console.error("❌ Erreur lors du test:", error.message)
  }
}

testCardImport()
