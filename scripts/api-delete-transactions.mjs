#!/usr/bin/env node

/**
 * Script pour supprimer toutes les transactions via l'API
 * 
 * Usage: node scripts/api-delete-transactions.mjs [API_URL] [AUTH_TOKEN]
 * 
 * Exemple:
 * node scripts/api-delete-transactions.mjs http://localhost:3000 "your-auth-token"
 */

const API_URL = process.argv[2] || 'http://localhost:3000'
const AUTH_TOKEN = process.argv[3]

async function deleteAllTransactionsViaAPI() {
  try {
    console.log('🗑️  Suppression de toutes les transactions via l\'API...')
    console.log(`📡 URL de l'API: ${API_URL}`)
    
    if (!AUTH_TOKEN) {
      console.error('❌ Token d\'authentification requis!')
      console.log('Usage: node scripts/api-delete-transactions.mjs [API_URL] [AUTH_TOKEN]')
      process.exit(1)
    }
    
    const response = await fetch(`${API_URL}/api/transactions`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      console.error('❌ Erreur API:', result.error || 'Erreur inconnue')
      process.exit(1)
    }
    
    console.log('✅', result.message)
    console.log(`📊 ${result.count} transaction(s) supprimée(s)`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des transactions:', error.message)
    process.exit(1)
  }
}

// Exécuter le script
deleteAllTransactionsViaAPI()
  .then(() => {
    console.log('🎉 Script terminé avec succès!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
