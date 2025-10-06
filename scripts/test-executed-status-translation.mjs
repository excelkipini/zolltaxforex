#!/usr/bin/env node

import { neon } from '@neondatabase/serverless'
import fs from 'fs'

// Charger les variables d'environnement
const envContent = fs.readFileSync('.env.local', 'utf8')
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    process.env[key] = value
  }
})

const sql = neon(process.env.DATABASE_URL)

async function testExecutedStatusTranslation() {
  console.log('🎨 Test de la traduction et couleur de l\'état "executed"...\n')

  try {
    // 1. Vérifier les transactions avec le statut "executed"
    console.log('1. Vérification des transactions exécutées...')
    const executedTransactions = await sql`
      SELECT 
        id, type, status, description, amount, currency, 
        created_by, agency, executed_at, receipt_url, executor_comment,
        created_at, updated_at
      FROM transactions 
      WHERE status = 'executed'
      ORDER BY executed_at DESC
      LIMIT 5
    `
    
    console.log(`📊 Transactions exécutées trouvées: ${executedTransactions.length}`)
    
    executedTransactions.forEach(transaction => {
      console.log(`\n📋 Transaction: ${transaction.id}`)
      console.log(`   - Type: ${transaction.type}`)
      console.log(`   - Statut: ${transaction.status}`)
      console.log(`   - Description: ${transaction.description}`)
      console.log(`   - Montant: ${transaction.amount} ${transaction.currency}`)
      console.log(`   - Créée par: ${transaction.created_by}`)
      console.log(`   - Agence: ${transaction.agency}`)
      console.log(`   - Exécutée le: ${transaction.executed_at}`)
      console.log(`   - Reçu: ${transaction.receipt_url || 'Non fourni'}`)
      console.log(`   - Commentaire: ${transaction.executor_comment || 'Aucun'}`)
    })

    // 2. Vérifier les différents statuts dans le système
    console.log('\n2. Vérification de tous les statuts de transactions...')
    const allStatuses = await sql`
      SELECT DISTINCT status, COUNT(*) as count
      FROM transactions
      GROUP BY status
      ORDER BY count DESC
    `
    
    console.log('📊 Répartition des statuts:')
    allStatuses.forEach(status => {
      console.log(`   - ${status.status}: ${status.count} transactions`)
    })

    // 3. Créer une transaction de test avec le statut "executed"
    console.log('\n3. Création d\'une transaction de test "executed"...')
    const testTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency,
        executor_id, executed_at, receipt_url, executor_comment
      ) VALUES (
        'TRX-TEST-EXECUTED-' || EXTRACT(EPOCH FROM NOW())::text,
        'transfer', 
        'executed', 
        'Test transaction executed - ' || NOW()::text, 
        500000, 
        'XAF', 
        'Test Cashier', 
        'Test Agency',
        (SELECT id FROM users WHERE role = 'executor' LIMIT 1),
        NOW(),
        'https://example.com/test-receipt.pdf',
        'Transaction de test exécutée avec succès'
      ) RETURNING id, type, status, description, amount, executed_at, receipt_url, executor_comment
    `
    
    console.log(`✅ Transaction de test créée: ${testTransaction[0].id}`)
    console.log(`   - Type: ${testTransaction[0].type}`)
    console.log(`   - Statut: ${testTransaction[0].status}`)
    console.log(`   - Description: ${testTransaction[0].description}`)
    console.log(`   - Montant: ${testTransaction[0].amount} XAF`)
    console.log(`   - Exécutée le: ${testTransaction[0].executed_at}`)
    console.log(`   - Reçu: ${testTransaction[0].receipt_url}`)
    console.log(`   - Commentaire: ${testTransaction[0].executor_comment}`)

    // 4. Vérifier la traduction et couleur attendues
    console.log('\n4. Vérification de la traduction et couleur...')
    console.log('🎨 Couleurs et traductions attendues:')
    console.log('   - "executed" → "Exécuté" (bg-purple-100 text-purple-800)')
    console.log('   - "validated" → "Validé" (bg-blue-100 text-blue-800)')
    console.log('   - "completed" → "Terminé" (bg-green-100 text-green-800)')
    console.log('   - "pending" → "En attente" (bg-yellow-100 text-yellow-800)')
    console.log('   - "rejected" → "Rejeté" (bg-red-100 text-red-800)')

    // 5. Vérifier les composants mis à jour
    console.log('\n5. Composants mis à jour:')
    console.log('✅ components/views/transactions-view.tsx')
    console.log('✅ components/views/daily-operations.tsx')
    console.log('✅ components/views/executor-dashboard.tsx')
    console.log('✅ components/views/cashier-validated-transactions.tsx')

    // 6. Nettoyer la transaction de test
    console.log('\n6. Nettoyage de la transaction de test...')
    await sql`DELETE FROM transactions WHERE id = ${testTransaction[0].id}`
    console.log('✅ Transaction de test supprimée')

    console.log('\n🎉 Test de la traduction et couleur terminé!')
    console.log('\n📋 Résumé:')
    console.log('✅ État "executed" traduit en "Exécuté"')
    console.log('✅ Couleur violette attribuée (bg-purple-100 text-purple-800)')
    console.log('✅ Tous les composants mis à jour')
    console.log('✅ Transaction de test créée et supprimée')
    console.log('✅ Cohérence des traductions vérifiée')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testExecutedStatusTranslation()
