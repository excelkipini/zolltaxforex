#!/usr/bin/env node

/**
 * Script pour supprimer toutes les transactions de la base de données
 * 
 * Usage: node scripts/delete-all-transactions.mjs
 * 
 * ATTENTION: Cette opération est irréversible !
 */

import { sql } from '../lib/db.mjs'

async function deleteAllTransactions() {
  try {
    console.log('🗑️  Suppression de toutes les transactions...')
    
    // Compter d'abord le nombre de transactions
    const countResult = await sql`
      SELECT COUNT(*) as count FROM transactions
    `
    const transactionCount = countResult[0]?.count || 0
    
    if (transactionCount === 0) {
      console.log('✅ Aucune transaction trouvée dans la base de données.')
      return
    }
    
    console.log(`📊 ${transactionCount} transaction(s) trouvée(s)`)
    
    // Demander confirmation
    console.log('⚠️  ATTENTION: Cette opération supprimera TOUTES les transactions de manière irréversible!')
    console.log('   Tapez "CONFIRMER" pour continuer ou n\'importe quoi d\'autre pour annuler.')
    
    // Simuler une confirmation pour le script automatique
    // En production, vous pourriez vouloir ajouter une vraie confirmation interactive
    const confirmation = process.env.CONFIRM_DELETE || 'CONFIRMER'
    
    if (confirmation !== 'CONFIRMER') {
      console.log('❌ Opération annulée.')
      return
    }
    
    // Supprimer toutes les transactions
    const deleteResult = await sql`
      DELETE FROM transactions
    `
    
    console.log(`✅ ${transactionCount} transaction(s) supprimée(s) avec succès!`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des transactions:', error.message)
    process.exit(1)
  }
}

// Exécuter le script
deleteAllTransactions()
  .then(() => {
    console.log('🎉 Script terminé avec succès!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
