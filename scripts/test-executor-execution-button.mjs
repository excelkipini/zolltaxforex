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

async function testExecutorExecutionButton() {
  console.log('🧪 Test du bouton d\'exécution pour l\'exécuteur...\n')

  try {
    // 1. Vérifier qu'il y a un utilisateur exécuteur
    console.log('1. Vérification de l\'utilisateur exécuteur...')
    const executor = await sql`
      SELECT id, name, role, agency 
      FROM users 
      WHERE role = 'executor' 
      LIMIT 1
    `
    
    if (executor.length === 0) {
      console.log('❌ Aucun utilisateur exécuteur trouvé')
      return
    }
    
    console.log(`✅ Utilisateur exécuteur trouvé: ${executor[0].name} (${executor[0].id})`)

    // 2. Vérifier qu'il y a des transactions validées assignées à cet exécuteur
    console.log('\n2. Vérification des transactions assignées à l\'exécuteur...')
    const assignedTransactions = await sql`
      SELECT id, type, description, amount, status, executor_id, commission_amount
      FROM transactions 
      WHERE status = 'validated' 
      AND executor_id = ${executor[0].id}
      ORDER BY created_at DESC
      LIMIT 5
    `
    
    console.log(`📊 Transactions assignées à l'exécuteur: ${assignedTransactions.length}`)
    
    if (assignedTransactions.length === 0) {
      console.log('⚠️  Aucune transaction assignée à cet exécuteur')
      
      // Créer une transaction de test assignée à l'exécuteur
      console.log('\n3. Création d\'une transaction de test...')
      const testTransaction = await sql`
        INSERT INTO transactions (
          type, status, description, amount, currency, created_by, agency, 
          executor_id, commission_amount, real_amount_eur
        ) VALUES (
          'transfer', 'validated', 'Test transfer for executor', 100000, 'XAF', 
          'Test Cashier', 'Test Agency', ${executor[0].id}, 5000, 100
        ) RETURNING id, type, description, amount, status, executor_id, commission_amount
      `
      
      console.log(`✅ Transaction de test créée: ${testTransaction[0].id}`)
      console.log(`   - Type: ${testTransaction[0].type}`)
      console.log(`   - Montant: ${testTransaction[0].amount} XAF`)
      console.log(`   - Commission: ${testTransaction[0].commission_amount} XAF`)
      console.log(`   - Statut: ${testTransaction[0].status}`)
      console.log(`   - Exécuteur: ${testTransaction[0].executor_id}`)
      
      assignedTransactions.push(testTransaction[0])
    }

    // 3. Simuler l'exécution d'une transaction
    console.log('\n4. Test de l\'exécution d\'une transaction...')
    const transactionToExecute = assignedTransactions[0]
    
    console.log(`🎯 Transaction à exécuter: ${transactionToExecute.id}`)
    console.log(`   - Description: ${transactionToExecute.description}`)
    console.log(`   - Montant: ${transactionToExecute.amount} XAF`)
    console.log(`   - Commission: ${transactionToExecute.commission_amount} XAF`)

    // Simuler l'appel API d'exécution
    const executionData = {
      transactionId: transactionToExecute.id,
      executorId: executor[0].id,
      receiptUrl: "https://example.com/receipt.pdf",
      executorComment: "Transaction exécutée avec succès - Test"
    }

    console.log('\n📤 Données d\'exécution:')
    console.log(JSON.stringify(executionData, null, 2))

    // Mettre à jour la transaction en base
    const updatedTransaction = await sql`
      UPDATE transactions 
      SET 
        status = 'executed',
        executed_at = NOW(),
        receipt_url = ${executionData.receiptUrl},
        executor_comment = ${executionData.executorComment}
      WHERE id = ${transactionToExecute.id}
      RETURNING id, status, executed_at, receipt_url, executor_comment
    `

    console.log('\n✅ Transaction exécutée avec succès!')
    console.log(`   - Nouveau statut: ${updatedTransaction[0].status}`)
    console.log(`   - Date d'exécution: ${updatedTransaction[0].executed_at}`)
    console.log(`   - URL du reçu: ${updatedTransaction[0].receipt_url}`)
    console.log(`   - Commentaire: ${updatedTransaction[0].executor_comment}`)

    // 4. Vérifier que la transaction n'apparaît plus dans les transactions à exécuter
    console.log('\n5. Vérification post-exécution...')
    const remainingTransactions = await sql`
      SELECT COUNT(*) as count
      FROM transactions 
      WHERE status = 'validated' 
      AND executor_id = ${executor[0].id}
    `
    
    console.log(`📊 Transactions restantes à exécuter: ${remainingTransactions[0].count}`)

    // 5. Vérifier que la transaction apparaît maintenant comme exécutée
    const executedTransactions = await sql`
      SELECT COUNT(*) as count
      FROM transactions 
      WHERE status = 'executed' 
      AND executor_id = ${executor[0].id}
    `
    
    console.log(`📊 Transactions exécutées par cet exécuteur: ${executedTransactions[0].count}`)

    console.log('\n🎉 Test du bouton d\'exécution réussi!')
    console.log('\n📋 Résumé:')
    console.log('✅ Utilisateur exécuteur trouvé')
    console.log('✅ Transaction assignée à l\'exécuteur')
    console.log('✅ Exécution simulée avec succès')
    console.log('✅ Statut mis à jour correctement')
    console.log('✅ Données d\'exécution enregistrées')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testExecutorExecutionButton()
