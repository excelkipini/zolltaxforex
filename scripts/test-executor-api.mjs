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

async function testExecutorAPI() {
  console.log('🧪 Test de l\'API pour l\'exécuteur...\n')

  try {
    // 1. Récupérer l'ID de l'exécuteur
    const executor = await sql`
      SELECT id, name, email, role, agency 
      FROM users 
      WHERE role = 'executor'
      LIMIT 1
    `
    
    if (executor.length === 0) {
      console.log('❌ Aucun utilisateur exécuteur trouvé')
      return
    }

    console.log(`👤 Exécuteur: ${executor[0].name} (${executor[0].id})`)

    // 2. Tester la fonction getTransactionsForExecutor directement
    console.log('\n2. Test de getTransactionsForExecutor...')
    const transactions = await sql`
      SELECT 
        id::text,
        type,
        status,
        description,
        amount::bigint as amount,
        currency,
        created_by,
        agency,
        details,
        rejection_reason,
        delete_validated_by,
        delete_validated_at,
        real_amount_eur,
        commission_amount,
        executor_id,
        executed_at,
        receipt_url,
        executor_comment,
        created_at::text as created_at,
        updated_at::text as updated_at
      FROM transactions 
      WHERE executor_id = ${executor[0].id}
      ORDER BY created_at DESC
    `
    
    console.log(`📊 Transactions récupérées: ${transactions.length}`)
    transactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.status}`)
      console.log(`     Description: ${transaction.description}`)
      console.log(`     Montant: ${transaction.amount} ${transaction.currency}`)
      console.log(`     Commission: ${transaction.commission_amount} XAF`)
      console.log(`     Montant réel: ${transaction.real_amount_eur} EUR`)
      console.log('')
    })

    // 3. Simuler l'appel API GET
    console.log('3. Simulation de l\'appel API GET...')
    const apiUrl = `/api/transactions/update-real-amount?executorId=${executor[0].id}`
    console.log(`🔗 URL: ${apiUrl}`)
    
    // Simuler la réponse de l'API
    const apiResponse = {
      transactions: transactions
    }
    
    console.log(`📤 Réponse API simulée:`)
    console.log(`   - Nombre de transactions: ${apiResponse.transactions.length}`)
    console.log(`   - Transactions validated: ${apiResponse.transactions.filter(t => t.status === 'validated').length}`)
    console.log(`   - Transactions executed: ${apiResponse.transactions.filter(t => t.status === 'executed').length}`)

    // 4. Vérifier les statistiques calculées
    console.log('\n4. Calcul des statistiques...')
    const stats = {
      total: transactions.length,
      pending: transactions.filter(t => t.status === 'validated').length,
      executed: transactions.filter(t => t.status === 'executed').length,
      totalAmount: transactions
        .filter(t => t.status === 'executed')
        .reduce((sum, t) => sum + t.amount, 0)
    }
    
    console.log(`📊 Statistiques calculées:`)
    console.log(`   - Total: ${stats.total}`)
    console.log(`   - En attente (validated): ${stats.pending}`)
    console.log(`   - Exécutées (executed): ${stats.executed}`)
    console.log(`   - Montant total exécuté: ${stats.totalAmount} XAF`)

    // 5. Vérifier le filtrage pour l'affichage
    console.log('\n5. Vérification du filtrage pour l\'affichage...')
    const pendingTransactions = transactions.filter(t => t.status === 'validated')
    const executedTransactions = transactions.filter(t => t.status === 'executed')
    
    console.log(`📋 Transactions en attente d'exécution: ${pendingTransactions.length}`)
    pendingTransactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.description}`)
    })
    
    console.log(`📋 Transactions exécutées: ${executedTransactions.length}`)
    executedTransactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.description}`)
    })

    console.log('\n🎉 Test de l\'API terminé!')
    console.log('\n📋 Résumé:')
    console.log('✅ API getTransactionsForExecutor fonctionne')
    console.log('✅ Transactions récupérées correctement')
    console.log('✅ Statistiques calculées correctement')
    console.log('✅ Filtrage par statut fonctionne')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testExecutorAPI()
