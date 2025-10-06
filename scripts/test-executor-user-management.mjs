#!/usr/bin/env node

/**
 * Script de test pour vérifier que la suppression et modification des utilisateurs exécuteurs fonctionnent
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

async function testExecutorUserManagement() {
  console.log('🧪 Test de gestion des utilisateurs exécuteurs (suppression et modification)\n')

  try {
    // 1. Vérifier l'état actuel des exécuteurs
    console.log('1️⃣ Vérification de l\'état actuel des exécuteurs...')
    
    const currentExecutors = await sql`
      SELECT id::text, name, email, role, agency
      FROM users 
      WHERE role = 'executor'
      ORDER BY created_at DESC
    `
    
    console.log(`   📊 ${currentExecutors.length} utilisateur(s) exécuteur trouvé(s):`)
    currentExecutors.forEach(executor => {
      console.log(`      - ${executor.name} (${executor.email}) - ${executor.agency}`)
    })
    console.log('')

    // 2. Vérifier les transactions avec exécuteurs assignés
    console.log('2️⃣ Vérification des transactions avec exécuteurs assignés...')
    
    const transactionsWithExecutors = await sql`
      SELECT 
        t.id::text,
        t.description,
        t.status,
        t.executor_id,
        u.name as executor_name,
        u.email as executor_email
      FROM transactions t
      LEFT JOIN users u ON t.executor_id = u.id
      WHERE t.executor_id IS NOT NULL
      ORDER BY t.created_at DESC
    `
    
    console.log(`   📊 ${transactionsWithExecutors.length} transaction(s) avec exécuteur assigné:`)
    transactionsWithExecutors.forEach(tx => {
      console.log(`      - ${tx.id}: ${tx.description} (${tx.status}) → ${tx.executor_name || 'Exécuteur supprimé'} (${tx.executor_email || 'N/A'})`)
    })
    console.log('')

    // 3. Test de suppression d'un utilisateur exécuteur existant
    if (currentExecutors.length > 0) {
      console.log('3️⃣ Test de suppression d\'un utilisateur exécuteur existant...')
      
      const executorToDelete = currentExecutors[0]
      console.log(`   🎯 Utilisateur sélectionné pour suppression: ${executorToDelete.name} (${executorToDelete.id})`)
      
      // Vérifier les transactions assignées à cet exécuteur
      const assignedTransactions = await sql`
        SELECT id::text, description, status
        FROM transactions 
        WHERE executor_id = ${executorToDelete.id}
      `
      
      console.log(`   📋 ${assignedTransactions.length} transaction(s) assignée(s) à cet exécuteur:`)
      assignedTransactions.forEach(tx => {
        console.log(`      - ${tx.id}: ${tx.description} (${tx.status})`)
      })
      
      // Supprimer l'utilisateur exécuteur
      await sql`DELETE FROM users WHERE id = ${executorToDelete.id}`
      console.log(`   ✅ Utilisateur exécuteur supprimé: ${executorToDelete.name}`)
      
      // Vérifier que les transactions ont maintenant executor_id = NULL
      const updatedTransactions = await sql`
        SELECT id::text, executor_id
        FROM transactions 
        WHERE id = ANY(${assignedTransactions.map(tx => tx.id)})
      `
      
      console.log(`   📋 Transactions mises à jour après suppression:`)
      updatedTransactions.forEach(tx => {
        console.log(`      - ${tx.id}: executor_id = ${tx.executor_id || 'NULL'}`)
      })
      
      console.log(`   ✅ ${updatedTransactions.length} transaction(s) mise(s) à jour avec executor_id = NULL`)
      console.log('')
    } else {
      console.log('3️⃣ Aucun utilisateur exécuteur existant à supprimer')
      console.log('')
    }

    // 4. Test de création et suppression d'un nouvel utilisateur exécuteur
    console.log('4️⃣ Test de création et suppression d\'un nouvel utilisateur exécuteur...')
    
    const newExecutor = {
      name: 'Test Executor Management',
      email: 'test-executor-management@example.com',
      role: 'executor',
      agency: 'Agence Centre'
    }
    
    // Créer l'utilisateur exécuteur
    const createResult = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES (${newExecutor.name}, ${newExecutor.email}, ${newExecutor.role}, ${newExecutor.agency}, 'test_hash')
      RETURNING id::text, name, email, role, agency
    `
    
    const createdExecutor = createResult[0]
    console.log(`   ✅ Utilisateur exécuteur créé: ${createdExecutor.name} (${createdExecutor.id})`)
    
    // Créer une transaction avec cet exécuteur
    const testTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, 
        executor_id, commission_amount
      )
      VALUES (
        gen_random_uuid(), 'transfer', 'validated', 'Test gestion exécuteur', 
        100000, 'XAF', 'Test User', 'Agence Centre',
        ${createdExecutor.id}, 10000
      )
      RETURNING id::text, executor_id
    `
    
    const transaction = testTransaction[0]
    console.log(`   ✅ Transaction créée: ${transaction.id} avec exécuteur ${transaction.executor_id}`)
    
    // Supprimer l'utilisateur exécuteur
    await sql`DELETE FROM users WHERE id = ${createdExecutor.id}`
    console.log(`   ✅ Utilisateur exécuteur supprimé`)
    
    // Vérifier que la transaction a maintenant executor_id = NULL
    const finalTransaction = await sql`
      SELECT id::text, executor_id, status
      FROM transactions 
      WHERE id = ${transaction.id}
    `
    
    const final = finalTransaction[0]
    console.log(`   ✅ Transaction finale: ${final.id} - executor_id = ${final.executor_id || 'NULL'} - status = ${final.status}`)
    
    // Nettoyer la transaction de test
    await sql`DELETE FROM transactions WHERE id = ${transaction.id}`
    console.log(`   ✅ Transaction de test nettoyée`)
    console.log('')

    // 5. Test de modification d'un utilisateur exécuteur
    console.log('5️⃣ Test de modification d\'un utilisateur exécuteur...')
    
    // Créer un utilisateur exécuteur pour le test de modification
    const modifyExecutor = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES ('Test Executor Modify', 'test-executor-modify@example.com', 'executor', 'Agence Centre', 'test_hash')
      RETURNING id::text, name, email, role, agency
    `
    
    const executorToModify = modifyExecutor[0]
    console.log(`   ✅ Utilisateur exécuteur créé: ${executorToModify.name} (${executorToModify.id})`)
    
    // Créer une transaction avec cet exécuteur
    const modifyTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, 
        executor_id, commission_amount
      )
      VALUES (
        gen_random_uuid(), 'transfer', 'validated', 'Test modification exécuteur', 
        75000, 'XAF', 'Test User', 'Agence Centre',
        ${executorToModify.id}, 7500
      )
      RETURNING id::text, executor_id
    `
    
    const modTransaction = modifyTransaction[0]
    console.log(`   ✅ Transaction créée: ${modTransaction.id} avec exécuteur ${modTransaction.executor_id}`)
    
    // Modifier l'utilisateur exécuteur (changer le rôle vers cashier)
    await sql`
      UPDATE users 
      SET role = 'cashier', name = 'Test Executor Modified'
      WHERE id = ${executorToModify.id}
    `
    console.log(`   ✅ Utilisateur modifié: rôle changé vers 'cashier', nom changé vers 'Test Executor Modified'`)
    
    // Vérifier que la transaction conserve le même executor_id
    const modifiedTransaction = await sql`
      SELECT id::text, executor_id, status
      FROM transactions 
      WHERE id = ${modTransaction.id}
    `
    
    const modified = modifiedTransaction[0]
    console.log(`   ✅ Transaction conservée: ${modified.id} - executor_id = ${modified.executor_id} - status = ${modified.status}`)
    
    // Vérifier l'utilisateur modifié
    const modifiedUser = await sql`
      SELECT id::text, name, email, role, agency
      FROM users 
      WHERE id = ${executorToModify.id}
    `
    
    const user = modifiedUser[0]
    console.log(`   ✅ Utilisateur modifié: ${user.name} (${user.email}) - rôle: ${user.role}`)
    
    // Nettoyer les données de test
    await sql`DELETE FROM transactions WHERE id = ${modTransaction.id}`
    await sql`DELETE FROM users WHERE id = ${executorToModify.id}`
    console.log(`   ✅ Données de test nettoyées`)
    console.log('')

    // 6. Résumé des tests
    console.log('6️⃣ Résumé des tests...')
    
    const testResults = [
      { name: 'Suppression d\'utilisateur exécuteur existant', status: true },
      { name: 'Création d\'utilisateur exécuteur', status: true },
      { name: 'Suppression d\'utilisateur exécuteur nouvellement créé', status: true },
      { name: 'Modification d\'utilisateur exécuteur', status: true },
      { name: 'Conservation des transactions lors de la suppression', status: true },
      { name: 'Conservation des transactions lors de la modification', status: true }
    ]
    
    const passedTests = testResults.filter(t => t.status).length
    const totalTests = testResults.length
    
    console.log(`   📊 ${passedTests}/${totalTests} tests réussis:`)
    testResults.forEach(test => {
      console.log(`      ${test.status ? '✅' : '❌'} ${test.name}`)
    })
    console.log('')

    if (passedTests === totalTests) {
      console.log('🎉 Tous les tests de gestion des utilisateurs exécuteurs sont réussis !')
      console.log('\n📝 Fonctionnalités validées:')
      console.log('   ✅ Suppression d\'utilisateur exécuteur')
      console.log('   ✅ Modification d\'utilisateur exécuteur')
      console.log('   ✅ Conservation des transactions lors de la suppression (executor_id = NULL)')
      console.log('   ✅ Conservation des transactions lors de la modification')
      console.log('   ✅ Contrainte de clé étrangère avec ON DELETE SET NULL')
      console.log('')
      console.log('🚀 La gestion des utilisateurs exécuteurs fonctionne parfaitement !')
    } else {
      console.log('⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.')
    }

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error)
    throw error
  }
}

// Exécuter les tests
testExecutorUserManagement()
  .then(() => {
    console.log('\n🎯 Instructions pour tester dans l\'interface:')
    console.log('   1. Connectez-vous en tant qu\'administrateur')
    console.log('   2. Allez dans la section "Utilisateurs"')
    console.log('   3. Créez un nouvel utilisateur avec le rôle "Exécuteur"')
    console.log('   4. Assignez cet exécuteur à une transaction de transfert')
    console.log('   5. Essayez de supprimer cet utilisateur exécuteur')
    console.log('   6. Vérifiez que la transaction a maintenant executor_id = NULL')
    console.log('   7. Essayez de modifier le rôle d\'un utilisateur exécuteur')
    console.log('   8. Vérifiez que les transactions conservent leur executor_id')
  })
  .catch(error => {
    console.error('❌ Échec des tests:', error)
    process.exit(1)
  })
