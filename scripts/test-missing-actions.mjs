#!/usr/bin/env node

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Client } from 'pg'

const client = new Client({
  connectionString: process.env.DATABASE_URL
})

await client.connect()

console.log('🔍 Test de l\'Enregistrement des Actions Manquantes')
console.log('=' .repeat(60))

async function testMissingActions() {
  try {
    console.log('\n📊 Vérification des actions dans l\'historique...')
    
    // Vérifier les actions de suppression
    const deleteActions = await client.query(`
      SELECT 
        action_type,
        action_description,
        user_name,
        created_at
      FROM cards_action_history
      WHERE action_type = 'delete'
      ORDER BY created_at DESC
      LIMIT 5
    `)
    
    console.log(`\n🗑️ Actions de suppression trouvées: ${deleteActions.rows.length}`)
    deleteActions.rows.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action.action_description} - ${action.user_name} - ${action.created_at}`)
    })
    
    // Vérifier les actions de distribution
    const distributeActions = await client.query(`
      SELECT 
        action_type,
        action_description,
        user_name,
        created_at
      FROM cards_action_history
      WHERE action_type = 'distribute'
      ORDER BY created_at DESC
      LIMIT 5
    `)
    
    console.log(`\n📤 Actions de distribution trouvées: ${distributeActions.rows.length}`)
    distributeActions.rows.forEach((action, index) => {
      console.log(`   ${index + 1}. ${action.action_description} - ${action.user_name} - ${action.created_at}`)
    })
    
    // Vérifier toutes les actions récentes
    const recentActions = await client.query(`
      SELECT 
        action_type,
        action_description,
        user_name,
        created_at
      FROM cards_action_history
      ORDER BY created_at DESC
      LIMIT 10
    `)
    
    console.log(`\n📋 Actions récentes (10 dernières):`)
    recentActions.rows.forEach((action, index) => {
      console.log(`   ${index + 1}. [${action.action_type}] ${action.action_description} - ${action.user_name} - ${action.created_at}`)
    })
    
    // Compter par type d'action
    const actionCounts = await client.query(`
      SELECT 
        action_type,
        COUNT(*) as count
      FROM cards_action_history
      GROUP BY action_type
      ORDER BY count DESC
    `)
    
    console.log(`\n📊 Répartition par type d'action:`)
    actionCounts.rows.forEach(stat => {
      console.log(`   ${stat.action_type}: ${stat.count} actions`)
    })
    
    console.log('\n🎯 Diagnostic:')
    if (deleteActions.rows.length === 0) {
      console.log('   ❌ PROBLÈME: Aucune action de suppression trouvée')
      console.log('   🔍 Cause possible: La fonction deleteCard ne s\'exécute pas ou logCardsAction échoue')
    } else {
      console.log('   ✅ Les actions de suppression sont enregistrées')
    }
    
    if (distributeActions.rows.length === 0) {
      console.log('   ❌ PROBLÈME: Aucune action de distribution trouvée')
      console.log('   🔍 Cause possible: La fonction distributeAmountToSpecificCards ne s\'exécute pas ou logCardsAction échoue')
    } else {
      console.log('   ✅ Les actions de distribution sont enregistrées')
    }
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message)
  } finally {
    await client.end()
  }
}

// Exécuter le test
testMissingActions()
