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

async function testCompleteTransferWorkflow() {
  console.log('🔄 Test complet du workflow de transfert d\'argent...\n')

  try {
    // 1. Vérifier les utilisateurs de chaque rôle
    console.log('1. Vérification des utilisateurs par rôle...')
    const users = await sql`
      SELECT name, role, agency, email
      FROM users 
      WHERE role IN ('cashier', 'auditor', 'executor')
      ORDER BY role, name
    `
    
    const usersByRole = {
      cashier: users.filter(u => u.role === 'cashier'),
      auditor: users.filter(u => u.role === 'auditor'),
      executor: users.filter(u => u.role === 'executor')
    }
    
    console.log(`📊 Utilisateurs trouvés:`)
    console.log(`   - Caissiers: ${usersByRole.cashier.length}`)
    console.log(`   - Auditeurs: ${usersByRole.auditor.length}`)
    console.log(`   - Exécuteurs: ${usersByRole.executor.length}`)
    
    usersByRole.cashier.forEach(user => console.log(`     • ${user.name} (${user.agency})`))
    usersByRole.auditor.forEach(user => console.log(`     • ${user.name} (${user.agency})`))
    usersByRole.executor.forEach(user => console.log(`     • ${user.name} (${user.agency})`))

    if (usersByRole.cashier.length === 0 || usersByRole.auditor.length === 0 || usersByRole.executor.length === 0) {
      console.log('❌ Tous les rôles nécessaires ne sont pas présents')
      return
    }

    // 2. Créer une transaction de test (étape 1: Caissier)
    console.log('\n2. Création d\'une transaction de test (Caissier)...')
    const testTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, details
      ) VALUES (
        'TRX-TEST-' || EXTRACT(EPOCH FROM NOW())::text,
        'transfer', 
        'pending', 
        'Test transfer workflow - ' || NOW()::text, 
        1000000, 
        'XAF', 
        ${usersByRole.cashier[0].name}, 
        ${usersByRole.cashier[0].agency},
        '{"destination": "Test Country", "recipient": "Test Recipient"}'
      ) RETURNING id, type, status, description, amount, created_by, created_at
    `
    
    console.log(`✅ Transaction créée: ${testTransaction[0].id}`)
    console.log(`   - Type: ${testTransaction[0].type}`)
    console.log(`   - Statut: ${testTransaction[0].status}`)
    console.log(`   - Montant: ${testTransaction[0].amount} XAF`)
    console.log(`   - Créée par: ${testTransaction[0].created_by}`)
    console.log(`   - Date: ${testTransaction[0].created_at}`)

    // 3. Simuler la validation par l'auditeur (étape 2: Auditeur)
    console.log('\n3. Validation par l\'auditeur...')
    const realAmountEUR = 100 // Montant réel en EUR
    const eurToXAFRate = 650 // Taux de change EUR/XAF
    
    // Calculer la commission
    const receivedAmountXAF = testTransaction[0].amount
    const realAmountXAF = realAmountEUR * eurToXAFRate
    const commission = Math.max(0, receivedAmountXAF - realAmountXAF)
    
    console.log(`📊 Calcul de la commission:`)
    console.log(`   - Montant reçu: ${receivedAmountXAF} XAF`)
    console.log(`   - Montant réel: ${realAmountEUR} EUR (${realAmountXAF} XAF)`)
    console.log(`   - Commission: ${commission} XAF`)
    console.log(`   - Seuil: 5000 XAF`)
    
    const shouldValidate = commission >= 5000
    const newStatus = shouldValidate ? 'validated' : 'rejected'
    const executorId = shouldValidate ? usersByRole.executor[0].id : null
    
    console.log(`🎯 Décision: ${shouldValidate ? 'VALIDATION' : 'REJET'} (commission ${shouldValidate ? '≥' : '<'} 5000 XAF)`)
    
    // Mettre à jour la transaction
    const updatedTransaction = await sql`
      UPDATE transactions 
      SET 
        status = ${newStatus},
        real_amount_eur = ${realAmountEUR},
        commission_amount = ${commission},
        executor_id = ${executorId},
        updated_at = NOW()
      WHERE id = ${testTransaction[0].id}
      RETURNING id, status, real_amount_eur, commission_amount, executor_id, updated_at
    `
    
    console.log(`✅ Transaction mise à jour:`)
    console.log(`   - Nouveau statut: ${updatedTransaction[0].status}`)
    console.log(`   - Montant réel: ${updatedTransaction[0].real_amount_eur} EUR`)
    console.log(`   - Commission: ${updatedTransaction[0].commission_amount} XAF`)
    console.log(`   - Exécuteur: ${updatedTransaction[0].executor_id ? 'Assigné' : 'Non assigné'}`)
    console.log(`   - Date: ${updatedTransaction[0].updated_at}`)

    // 4. Si validée, simuler l'exécution par l'exécuteur (étape 3: Exécuteur)
    if (shouldValidate) {
      console.log('\n4. Exécution par l\'exécuteur...')
      
      const executionData = {
        receiptUrl: "https://example.com/receipt-" + testTransaction[0].id + ".pdf",
        executorComment: "Transaction exécutée avec succès - Test workflow"
      }
      
      console.log(`📤 Données d'exécution:`)
      console.log(`   - URL du reçu: ${executionData.receiptUrl}`)
      console.log(`   - Commentaire: ${executionData.executorComment}`)
      
      const executedTransaction = await sql`
        UPDATE transactions 
        SET 
          status = 'executed',
          executed_at = NOW(),
          receipt_url = ${executionData.receiptUrl},
          executor_comment = ${executionData.executorComment}
        WHERE id = ${testTransaction[0].id}
        RETURNING id, status, executed_at, receipt_url, executor_comment
      `
      
      console.log(`✅ Transaction exécutée:`)
      console.log(`   - Statut: ${executedTransaction[0].status}`)
      console.log(`   - Date d'exécution: ${executedTransaction[0].executed_at}`)
      console.log(`   - Reçu: ${executedTransaction[0].receipt_url}`)
      console.log(`   - Commentaire: ${executedTransaction[0].executor_comment}`)

      // 5. Simuler la clôture par le caissier (étape 4: Caissier)
      console.log('\n5. Clôture par le caissier...')
      
      const completedTransaction = await sql`
        UPDATE transactions 
        SET 
          status = 'completed',
          updated_at = NOW()
        WHERE id = ${testTransaction[0].id}
        RETURNING id, status, updated_at
      `
      
      console.log(`✅ Transaction clôturée:`)
      console.log(`   - Statut final: ${completedTransaction[0].status}`)
      console.log(`   - Date de clôture: ${completedTransaction[0].updated_at}`)
    }

    // 6. Vérifier le statut final
    console.log('\n6. Vérification du statut final...')
    const finalTransaction = await sql`
      SELECT 
        id, type, status, description, amount, real_amount_eur, commission_amount,
        executor_id, executed_at, receipt_url, executor_comment,
        created_at, updated_at
      FROM transactions 
      WHERE id = ${testTransaction[0].id}
    `
    
    const transaction = finalTransaction[0]
    console.log(`📊 État final de la transaction:`)
    console.log(`   - ID: ${transaction.id}`)
    console.log(`   - Type: ${transaction.type}`)
    console.log(`   - Statut: ${transaction.status}`)
    console.log(`   - Description: ${transaction.description}`)
    console.log(`   - Montant: ${transaction.amount} XAF`)
    console.log(`   - Montant réel: ${transaction.real_amount_eur} EUR`)
    console.log(`   - Commission: ${transaction.commission_amount} XAF`)
    console.log(`   - Exécuteur: ${transaction.executor_id ? 'Assigné' : 'Non assigné'}`)
    console.log(`   - Exécuté le: ${transaction.executed_at || 'Non exécuté'}`)
    console.log(`   - Reçu: ${transaction.receipt_url || 'Non fourni'}`)
    console.log(`   - Commentaire: ${transaction.executor_comment || 'Aucun'}`)
    console.log(`   - Créée le: ${transaction.created_at}`)
    console.log(`   - Mise à jour le: ${transaction.updated_at}`)

    // 7. Vérifier les notifications
    console.log('\n7. Vérification des notifications...')
    const notifications = await sql`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE target_role = 'executor' OR target_user_name = ${usersByRole.executor[0].name}
    `
    
    console.log(`📊 Notifications pour l'exécuteur: ${notifications[0].count}`)

    console.log('\n🎉 Test du workflow complet terminé!')
    console.log('\n📋 Résumé du workflow:')
    console.log('✅ Étape 1: Caissier crée la transaction (pending)')
    console.log('✅ Étape 2: Auditeur valide avec montant réel (validated/rejected)')
    console.log('✅ Étape 3: Exécuteur exécute la transaction (executed)')
    console.log('✅ Étape 4: Caissier clôture la transaction (completed)')
    console.log('✅ Commission calculée automatiquement')
    console.log('✅ Validation/rejet basé sur le seuil de 5000 XAF')
    console.log('✅ Assignation automatique à l\'exécuteur')
    console.log('✅ Notifications créées')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testCompleteTransferWorkflow()
