#!/usr/bin/env node

/**
 * Script simple pour supprimer toutes les transactions
 * Utilise directement la fonction deleteAllTransactions
 */

// Import dynamique pour éviter les problèmes de modules
async function deleteAllTransactions() {
  try {
    console.log('🗑️  Suppression de toutes les transactions...')
    
    // Import dynamique du module db
    const { sql } = await import('../lib/db.js')
    
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
    console.log('⚠️  ATTENTION: Cette opération supprimera TOUTES les transactions de manière irréversible!')
    
    // Supprimer toutes les transactions
    const deleteResult = await sql`
      DELETE FROM transactions
    `
    
    console.log(`✅ ${transactionCount} transaction(s) supprimée(s) avec succès!`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des transactions:', error.message)
    
    // Si c'est une erreur de connexion DB, utiliser l'approche alternative
    if (error.message.includes('DATABASE_URL') || error.message.includes('connection')) {
      console.log('💡 Tentative via l\'API REST...')
      await deleteViaAPI()
    } else {
      throw error
    }
  }
}

async function deleteViaAPI() {
  try {
    console.log('🌐 Suppression via l\'API REST...')
    
    // Note: Dans un vrai environnement, vous devriez utiliser un token d'authentification valide
    const response = await fetch('http://localhost:3000/api/transactions', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      console.error('❌ Erreur API:', result.error || 'Erreur inconnue')
      return
    }
    
    console.log('✅', result.message)
    console.log(`📊 ${result.count} transaction(s) supprimée(s)`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression via API:', error.message)
    throw error
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
