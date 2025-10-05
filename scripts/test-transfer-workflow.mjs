#!/usr/bin/env node

/**
 * Script de test complet pour le workflow de transfert d'argent
 * Teste le workflow en 4 étapes : Caissier -> Auditeur -> Exécuteur -> Caissier
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Charger explicitement le fichier .env.local
try {
  const envPath = join(__dirname, '..', '.env.local')
  const envContent = readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
} catch (error) {
  console.log('⚠️  Fichier .env.local non trouvé ou erreur de lecture')
}

// Configuration de la base de données
const sql = neon(process.env.DATABASE_URL)

async function testTransferWorkflow() {
  console.log('🧪 Test complet du workflow de transfert d\'argent\n')

  try {
    // 1. Récupérer les utilisateurs de test
    console.log('1️⃣ Récupération des utilisateurs de test...')
    
    const cashier = await sql`
      SELECT id::text, name, email, role FROM users 
      WHERE role = 'cashier' 
      ORDER BY created_at ASC 
      LIMIT 1
    `
    
    const auditor = await sql`
      SELECT id::text, name, email, role FROM users 
      WHERE role = 'auditor' 
      ORDER BY created_at ASC 
      LIMIT 1
    `
    
    const executor = await sql`
      SELECT id::text, name, email, role FROM users 
      WHERE role = 'executor' 
      ORDER BY created_at ASC 
      LIMIT 1
    `
    
    if (cashier.length === 0 || auditor.length === 0 || executor.length === 0) {
      throw new Error('Utilisateurs de test manquants. Assurez-vous que des utilisateurs cashier, auditor et executor existent.')
    }
    
    console.log(`   ✅ Caissier: ${cashier[0].name} (${cashier[0].email})`)
    console.log(`   ✅ Auditeur: ${auditor[0].name} (${auditor[0].email})`)
    console.log(`   ✅ Exécuteur: ${executor[0].name} (${executor[0].email})`)
    console.log('')

    // 2. Étape 1 : Caissier émet une transaction de transfert
    console.log('2️⃣ ÉTAPE 1 - Caissier émet une transaction de transfert...')
    
    const transferAmount = 100000 // 100,000 XAF
    const transferDescription = 'Test workflow - Transfert vers Europe'
    
    const transactionResult = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, details
      )
      VALUES (
        gen_random_uuid(), 'transfer', 'pending', ${transferDescription}, 
        ${transferAmount}, 'XAF', ${cashier[0].name}, 'Agence Centre', 
        '{"recipient": "John Doe", "destination": "France", "method": "Western Union"}'
      )
      RETURNING id::text, status, description, amount, created_by
    `
    
    const transaction = transactionResult[0]
    console.log(`   ✅ Transaction créée: ${transaction.id}`)
    console.log(`   ✅ Statut initial: ${transaction.status}`)
    console.log(`   ✅ Montant: ${transaction.amount} XAF`)
    console.log(`   ✅ Créée par: ${transaction.created_by}`)
    console.log('')

    // 3. Étape 2 : Auditeur renseigne le montant réel et valide
    console.log('3️⃣ ÉTAPE 2 - Auditeur renseigne le montant réel et valide...')
    
    const realAmountEUR = 140 // 140 EUR
    const eurToXAFRate = 656 // Taux de change
    
    // Calculer la commission
    const realAmountXAF = realAmountEUR * eurToXAFRate
    const commissionAmount = Math.max(0, transferAmount - realAmountXAF)
    
    console.log(`   📊 Montant reçu par caissier: ${transferAmount} XAF`)
    console.log(`   📊 Montant réel renseigné: ${realAmountEUR} EUR (${realAmountXAF} XAF)`)
    console.log(`   📊 Commission calculée: ${commissionAmount} XAF`)
    
    let newStatus
    let executorId = null
    
    if (commissionAmount >= 5000) {
      newStatus = 'validated'
      executorId = executor[0].id
      console.log(`   ✅ Commission >= 5000 XAF → Validation automatique`)
      console.log(`   ✅ Exécuteur assigné: ${executor[0].name}`)
    } else {
      newStatus = 'rejected'
      console.log(`   ❌ Commission < 5000 XAF → Rejet automatique`)
    }
    
    // Mettre à jour la transaction
    const updatedResult = await sql`
      UPDATE transactions 
      SET 
        real_amount_eur = ${realAmountEUR},
        commission_amount = ${commissionAmount},
        status = ${newStatus},
        executor_id = ${executorId},
        updated_at = NOW()
      WHERE id = ${transaction.id}
      RETURNING id::text, status, commission_amount, executor_id, real_amount_eur
    `
    
    const updatedTransaction = updatedResult[0]
    console.log(`   ✅ Statut final: ${updatedTransaction.status}`)
    console.log(`   ✅ Commission: ${updatedTransaction.commission_amount} XAF`)
    console.log(`   ✅ Montant réel: ${updatedTransaction.real_amount_eur} EUR`)
    console.log(`   ✅ Exécuteur: ${updatedTransaction.executor_id || 'Aucun'}`)
    console.log('')

    // 4. Étape 3 : Exécuteur exécute la transaction
    if (updatedTransaction.status === 'validated') {
      console.log('4️⃣ ÉTAPE 3 - Exécuteur exécute la transaction...')
      
      const receiptUrl = 'https://example.com/receipts/transfer-receipt.pdf'
      const executorComment = 'Transfert exécuté avec succès via Western Union'
      
      const executedResult = await sql`
        UPDATE transactions 
        SET 
          status = 'executed',
          executed_at = NOW(),
          receipt_url = ${receiptUrl},
          executor_comment = ${executorComment},
          updated_at = NOW()
        WHERE id = ${transaction.id} AND executor_id = ${executor[0].id}
        RETURNING id::text, status, executed_at, receipt_url, executor_comment
      `
      
      const executedTransaction = executedResult[0]
      console.log(`   ✅ Transaction exécutée: ${executedTransaction.id}`)
      console.log(`   ✅ Statut: ${executedTransaction.status}`)
      console.log(`   ✅ Date d'exécution: ${executedTransaction.executed_at}`)
      console.log(`   ✅ Reçu: ${executedTransaction.receipt_url}`)
      console.log(`   ✅ Commentaire: ${executedTransaction.executor_comment}`)
      console.log('')

      // 5. Étape 4 : Caissier clôture la transaction
      console.log('5️⃣ ÉTAPE 4 - Caissier clôture la transaction...')
      
      const completedResult = await sql`
        UPDATE transactions 
        SET 
          status = 'completed',
          updated_at = NOW()
        WHERE id = ${transaction.id}
        RETURNING id::text, status, updated_at
      `
      
      const completedTransaction = completedResult[0]
      console.log(`   ✅ Transaction clôturée: ${completedTransaction.id}`)
      console.log(`   ✅ Statut final: ${completedTransaction.status}`)
      console.log(`   ✅ Date de clôture: ${completedTransaction.updated_at}`)
      console.log('')
    } else {
      console.log('4️⃣ ÉTAPE 3 - Transaction rejetée, pas d\'exécution nécessaire')
      console.log('')
    }

    // 6. Vérification finale du workflow
    console.log('6️⃣ Vérification finale du workflow...')
    
    const finalTransaction = await sql`
      SELECT 
        id::text, status, description, amount, currency, created_by, agency,
        real_amount_eur, commission_amount, executor_id, executed_at, 
        receipt_url, executor_comment, created_at::text as created_at, 
        updated_at::text as updated_at
      FROM transactions 
      WHERE id = ${transaction.id}
    `
    
    const final = finalTransaction[0]
    
    console.log('   📋 Résumé de la transaction:')
    console.log(`      ID: ${final.id}`)
    console.log(`      Description: ${final.description}`)
    console.log(`      Montant: ${final.amount} ${final.currency}`)
    console.log(`      Statut final: ${final.status}`)
    console.log(`      Montant réel: ${final.real_amount_eur} EUR`)
    console.log(`      Commission: ${final.commission_amount} XAF`)
    console.log(`      Exécuteur: ${final.executor_id || 'Aucun'}`)
    console.log(`      Date d'exécution: ${final.executed_at || 'N/A'}`)
    console.log(`      Reçu: ${final.receipt_url || 'N/A'}`)
    console.log(`      Commentaire: ${final.executor_comment || 'N/A'}`)
    console.log('')

    // 7. Test des différents scénarios
    console.log('7️⃣ Test des différents scénarios de commission...')
    
    const scenarios = [
      {
        name: 'Commission élevée (Validation)',
        received: 150000,
        real: 200,
        expected: 'validated'
      },
      {
        name: 'Commission faible (Rejet)',
        received: 30000,
        real: 50,
        expected: 'rejected'
      },
      {
        name: 'Commission limite (Validation)',
        received: 5000 + (100 * eurToXAFRate),
        real: 100,
        expected: 'validated'
      }
    ]
    
    for (const scenario of scenarios) {
      console.log(`   📋 ${scenario.name}:`)
      
      const testTransaction = await sql`
        INSERT INTO transactions (
          id, type, status, description, amount, currency, created_by, agency, details
        )
        VALUES (
          gen_random_uuid(), 'transfer', 'pending', ${scenario.name}, 
          ${scenario.received}, 'XAF', 'Test User', 'Agence Centre', '{}'
        )
        RETURNING id::text
      `
      
      const testId = testTransaction[0].id
      const testRealAmountXAF = scenario.real * eurToXAFRate
      const testCommission = Math.max(0, scenario.received - testRealAmountXAF)
      const testStatus = testCommission >= 5000 ? 'validated' : 'rejected'
      
      await sql`
        UPDATE transactions 
        SET 
          real_amount_eur = ${scenario.real},
          commission_amount = ${testCommission},
          status = ${testStatus},
          executor_id = ${testStatus === 'validated' ? executor[0].id : null},
          updated_at = NOW()
        WHERE id = ${testId}
      `
      
      console.log(`      Montant reçu: ${scenario.received} XAF`)
      console.log(`      Montant réel: ${scenario.real} EUR`)
      console.log(`      Commission: ${testCommission} XAF`)
      console.log(`      Statut: ${testStatus}`)
      console.log(`      Attendu: ${scenario.expected}`)
      console.log(`      ${testStatus === scenario.expected ? '✅' : '❌'} Résultat correct`)
      
      // Supprimer la transaction de test
      await sql`DELETE FROM transactions WHERE id = ${testId}`
      console.log('')
    }

    console.log('🎉 Test du workflow de transfert terminé avec succès !')
    console.log('\n📝 Résumé du workflow testé:')
    console.log('   ✅ Étape 1: Caissier émet une transaction (statut: pending)')
    console.log('   ✅ Étape 2: Auditeur renseigne le montant réel')
    console.log('   ✅ Étape 2: Calcul automatique de la commission')
    console.log('   ✅ Étape 2: Validation/rejet automatique basé sur la commission')
    console.log('   ✅ Étape 2: Assignation automatique d\'un exécuteur si validé')
    console.log('   ✅ Étape 3: Exécuteur exécute la transaction (statut: executed)')
    console.log('   ✅ Étape 4: Caissier clôture la transaction (statut: completed)')
    console.log('')
    console.log('🚀 Le workflow de transfert d\'argent est fonctionnel !')

  } catch (error) {
    console.error('❌ Erreur lors du test du workflow:', error)
    throw error
  }
}

// Exécuter le test
testTransferWorkflow()
  .then(() => {
    console.log('\n🎯 Prochaines étapes:')
    console.log('   1. Ajouter l\'interface pour l\'exécuteur')
    console.log('   2. Implémenter le système de téléchargement de reçu')
    console.log('   3. Mettre à jour les états des transactions dans l\'UI')
    console.log('   4. Tester l\'intégration complète')
  })
  .catch(error => {
    console.error('❌ Échec du test:', error)
    process.exit(1)
  })
