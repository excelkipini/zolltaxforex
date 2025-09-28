#!/usr/bin/env node

/**
 * Script pour supprimer toutes les transactions via curl
 * Plus simple et plus fiable
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

async function deleteAllTransactions() {
  try {
    console.log('🗑️  Suppression de toutes les transactions...')
    
    // Attendre que le serveur soit prêt
    console.log('⏳ Attente du démarrage du serveur...')
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Vérifier d'abord le nombre de transactions
    console.log('📊 Vérification du nombre de transactions...')
    const countResponse = await fetch('http://localhost:3000/api/transactions')
    
    if (!countResponse.ok) {
      console.error('❌ Impossible de se connecter à l\'API')
      return
    }
    
    const countData = await countResponse.json()
    const transactionCount = countData.data?.length || 0
    
    if (transactionCount === 0) {
      console.log('✅ Aucune transaction trouvée dans la base de données.')
      return
    }
    
    console.log(`📊 ${transactionCount} transaction(s) trouvée(s)`)
    console.log('⚠️  ATTENTION: Cette opération supprimera TOUTES les transactions de manière irréversible!')
    
    // Supprimer toutes les transactions
    console.log('🗑️  Suppression en cours...')
    const deleteResponse = await fetch('http://localhost:3000/api/transactions', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    const result = await deleteResponse.json()
    
    if (!deleteResponse.ok) {
      console.error('❌ Erreur lors de la suppression:', result.error || 'Erreur inconnue')
      return
    }
    
    console.log('✅', result.message)
    console.log(`📊 ${result.count} transaction(s) supprimée(s)`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des transactions:', error.message)
    
    // Essayer avec curl comme alternative
    console.log('💡 Tentative avec curl...')
    try {
      const { stdout, stderr } = await execAsync('curl -X DELETE http://localhost:3000/api/transactions')
      console.log('✅ Suppression réussie via curl')
      console.log(stdout)
    } catch (curlError) {
      console.error('❌ Erreur curl:', curlError.message)
    }
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
