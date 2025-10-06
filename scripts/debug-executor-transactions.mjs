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

async function debugExecutorTransactions() {
  console.log('🔍 Diagnostic des transactions pour l\'exécuteur...\n')

  try {
    // 1. Vérifier les utilisateurs exécuteurs
    console.log('1. Vérification des utilisateurs exécuteurs...')
    const executors = await sql`
      SELECT id, name, email, role, agency 
      FROM users 
      WHERE role = 'executor'
    `
    
    console.log(`📊 Utilisateurs exécuteurs trouvés: ${executors.length}`)
    executors.forEach(executor => {
      console.log(`   - ${executor.name} (${executor.id}) - ${executor.agency}`)
    })

    if (executors.length === 0) {
      console.log('❌ Aucun utilisateur exécuteur trouvé')
      return
    }

    const executor = executors[0]

    // 2. Vérifier toutes les transactions avec executor_id
    console.log('\n2. Vérification des transactions assignées à des exécuteurs...')
    const assignedTransactions = await sql`
      SELECT 
        id, type, status, description, amount, currency,
        executor_id, commission_amount, real_amount_eur,
        created_at, updated_at
      FROM transactions 
      WHERE executor_id IS NOT NULL
      ORDER BY created_at DESC
    `
    
    console.log(`📊 Transactions avec executor_id: ${assignedTransactions.length}`)
    assignedTransactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.status} (${transaction.description})`)
      console.log(`     Exécuteur: ${transaction.executor_id}`)
      console.log(`     Commission: ${transaction.commission_amount} XAF`)
      console.log(`     Montant réel: ${transaction.real_amount_eur} EUR`)
    })

    // 3. Vérifier les transactions assignées à cet exécuteur spécifique
    console.log(`\n3. Transactions assignées à ${executor.name}...`)
    const executorTransactions = await sql`
      SELECT 
        id, type, status, description, amount, currency,
        executor_id, commission_amount, real_amount_eur,
        created_at, updated_at
      FROM transactions 
      WHERE executor_id = ${executor.id}
      ORDER BY created_at DESC
    `
    
    console.log(`📊 Transactions assignées à ${executor.name}: ${executorTransactions.length}`)
    executorTransactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.status} (${transaction.description})`)
      console.log(`     Montant: ${transaction.amount} ${transaction.currency}`)
      console.log(`     Commission: ${transaction.commission_amount} XAF`)
      console.log(`     Montant réel: ${transaction.real_amount_eur} EUR`)
    })

    // 4. Vérifier les transactions en attente d'exécution (validated)
    console.log('\n4. Transactions en attente d\'exécution (validated)...')
    const pendingExecution = await sql`
      SELECT 
        id, type, status, description, amount, currency,
        executor_id, commission_amount, real_amount_eur,
        created_at, updated_at
      FROM transactions 
      WHERE status = 'validated' AND executor_id IS NOT NULL
      ORDER BY created_at DESC
    `
    
    console.log(`📊 Transactions validated avec executor_id: ${pendingExecution.length}`)
    pendingExecution.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.status} (${transaction.description})`)
      console.log(`     Exécuteur: ${transaction.executor_id}`)
      console.log(`     Commission: ${transaction.commission_amount} XAF`)
    })

    // 5. Tester l'API directement
    console.log('\n5. Test de l\'API getTransactionsForExecutor...')
    const apiTransactions = await sql`
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
      WHERE executor_id = ${executor.id}
      ORDER BY created_at DESC
    `
    
    console.log(`📊 Résultat de l'API: ${apiTransactions.length} transactions`)
    apiTransactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.status} (${transaction.description})`)
    })

    // 6. Créer une transaction de test si nécessaire
    if (executorTransactions.length === 0) {
      console.log('\n6. Création d\'une transaction de test...')
      const testTransaction = await sql`
        INSERT INTO transactions (
          id, type, status, description, amount, currency, created_by, agency,
          executor_id, commission_amount, real_amount_eur
        ) VALUES (
          'TRX-TEST-EXECUTOR-' || EXTRACT(EPOCH FROM NOW())::text,
          'transfer', 
          'validated', 
          'Test transaction for executor - ' || NOW()::text, 
          1000000, 
          'XAF', 
          'Test Cashier', 
          'Test Agency',
          ${executor.id},
          5000,
          100
        ) RETURNING id, type, status, description, amount, executor_id, commission_amount
      `
      
      console.log(`✅ Transaction de test créée: ${testTransaction[0].id}`)
      console.log(`   - Statut: ${testTransaction[0].status}`)
      console.log(`   - Exécuteur: ${testTransaction[0].executor_id}`)
      console.log(`   - Commission: ${testTransaction[0].commission_amount} XAF`)
    }

    console.log('\n🎉 Diagnostic terminé!')

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error)
  }
}

debugExecutorTransactions()
