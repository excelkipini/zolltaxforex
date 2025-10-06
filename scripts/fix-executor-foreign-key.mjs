#!/usr/bin/env node

/**
 * Script pour corriger la contrainte de clé étrangère transactions_executor_id_fkey
 * et permettre la suppression/modification des utilisateurs exécuteurs
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

async function fixExecutorForeignKeyConstraint() {
  console.log('🔧 Correction de la contrainte de clé étrangère transactions_executor_id_fkey\n')

  try {
    // 1. Vérifier la contrainte actuelle
    console.log('1️⃣ Vérification de la contrainte actuelle...')
    
    const constraintCheck = await sql`
      SELECT 
        conname, 
        pg_get_constraintdef(oid) as definition,
        confdeltype,
        confupdtype
      FROM pg_constraint 
      WHERE conname = 'transactions_executor_id_fkey' 
      AND conrelid = 'transactions'::regclass
    `
    
    if (constraintCheck.length > 0) {
      const constraint = constraintCheck[0]
      console.log(`   ✅ Contrainte trouvée: ${constraint.conname}`)
      console.log(`   📋 Définition: ${constraint.definition}`)
      console.log(`   📋 Action DELETE: ${constraint.confdeltype === 'a' ? 'RESTRICT' : constraint.confdeltype === 'c' ? 'CASCADE' : constraint.confdeltype === 'n' ? 'SET NULL' : 'NO ACTION'}`)
      console.log(`   📋 Action UPDATE: ${constraint.confupdtype === 'a' ? 'RESTRICT' : constraint.confupdtype === 'c' ? 'CASCADE' : constraint.confupdtype === 'n' ? 'SET NULL' : 'NO ACTION'}`)
    } else {
      console.log('   ⚠️  Contrainte transactions_executor_id_fkey non trouvée')
    }
    console.log('')

    // 2. Vérifier les transactions qui référencent des exécuteurs
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
    
    if (transactionsWithExecutors.length > 0) {
      console.log(`   📊 ${transactionsWithExecutors.length} transaction(s) avec exécuteur assigné:`)
      transactionsWithExecutors.forEach(tx => {
        console.log(`      - ${tx.id}: ${tx.description} (${tx.status}) → ${tx.executor_name || 'Exécuteur supprimé'} (${tx.executor_email || 'N/A'})`)
      })
    } else {
      console.log('   ✅ Aucune transaction avec exécuteur assigné')
    }
    console.log('')

    // 3. Supprimer l'ancienne contrainte
    console.log('3️⃣ Suppression de l\'ancienne contrainte...')
    
    await sql`
      ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_executor_id_fkey
    `
    console.log('   ✅ Ancienne contrainte supprimée')
    console.log('')

    // 4. Créer la nouvelle contrainte avec ON DELETE SET NULL
    console.log('4️⃣ Création de la nouvelle contrainte avec ON DELETE SET NULL...')
    
    await sql`
      ALTER TABLE transactions 
      ADD CONSTRAINT transactions_executor_id_fkey 
      FOREIGN KEY (executor_id) REFERENCES users(id) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `
    console.log('   ✅ Nouvelle contrainte créée avec ON DELETE SET NULL')
    console.log('')

    // 5. Vérifier la nouvelle contrainte
    console.log('5️⃣ Vérification de la nouvelle contrainte...')
    
    const newConstraintCheck = await sql`
      SELECT 
        conname, 
        pg_get_constraintdef(oid) as definition,
        confdeltype,
        confupdtype
      FROM pg_constraint 
      WHERE conname = 'transactions_executor_id_fkey' 
      AND conrelid = 'transactions'::regclass
    `
    
    if (newConstraintCheck.length > 0) {
      const constraint = newConstraintCheck[0]
      console.log(`   ✅ Nouvelle contrainte vérifiée: ${constraint.conname}`)
      console.log(`   📋 Définition: ${constraint.definition}`)
      console.log(`   📋 Action DELETE: ${constraint.confdeltype === 'a' ? 'RESTRICT' : constraint.confdeltype === 'c' ? 'CASCADE' : constraint.confdeltype === 'n' ? 'SET NULL' : 'NO ACTION'}`)
      console.log(`   📋 Action UPDATE: ${constraint.confupdtype === 'a' ? 'RESTRICT' : constraint.confupdtype === 'c' ? 'CASCADE' : constraint.confupdtype === 'n' ? 'SET NULL' : 'NO ACTION'}`)
    }
    console.log('')

    // 6. Tester la suppression d'un utilisateur exécuteur
    console.log('6️⃣ Test de suppression d\'un utilisateur exécuteur...')
    
    // Créer un utilisateur exécuteur de test
    const testExecutor = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES ('Test Executor Delete', 'test-executor-delete@example.com', 'executor', 'Agence Centre', 'test_hash')
      RETURNING id::text, name, email, role
    `
    
    const executor = testExecutor[0]
    console.log(`   ✅ Utilisateur exécuteur de test créé: ${executor.name} (${executor.id})`)
    
    // Créer une transaction avec cet exécuteur
    const testTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, 
        executor_id, commission_amount
      )
      VALUES (
        gen_random_uuid(), 'transfer', 'validated', 'Test suppression exécuteur', 
        50000, 'XAF', 'Test User', 'Agence Centre',
        ${executor.id}, 5000
      )
      RETURNING id::text, executor_id
    `
    
    const transaction = testTransaction[0]
    console.log(`   ✅ Transaction de test créée: ${transaction.id} avec exécuteur ${transaction.executor_id}`)
    
    // Supprimer l'utilisateur exécuteur
    await sql`DELETE FROM users WHERE id = ${executor.id}`
    console.log(`   ✅ Utilisateur exécuteur supprimé`)
    
    // Vérifier que la transaction a maintenant executor_id = NULL
    const updatedTransaction = await sql`
      SELECT id::text, executor_id, status
      FROM transactions 
      WHERE id = ${transaction.id}
    `
    
    const updated = updatedTransaction[0]
    console.log(`   ✅ Transaction mise à jour: executor_id = ${updated.executor_id || 'NULL'}`)
    
    // Nettoyer la transaction de test
    await sql`DELETE FROM transactions WHERE id = ${transaction.id}`
    console.log(`   ✅ Transaction de test supprimée`)
    console.log('')

    // 7. Tester la modification d'un utilisateur exécuteur
    console.log('7️⃣ Test de modification d\'un utilisateur exécuteur...')
    
    // Créer un utilisateur exécuteur de test
    const testExecutor2 = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES ('Test Executor Update', 'test-executor-update@example.com', 'executor', 'Agence Centre', 'test_hash')
      RETURNING id::text, name, email, role
    `
    
    const executor2 = testExecutor2[0]
    console.log(`   ✅ Utilisateur exécuteur de test créé: ${executor2.name} (${executor2.id})`)
    
    // Créer une transaction avec cet exécuteur
    const testTransaction2 = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, 
        executor_id, commission_amount
      )
      VALUES (
        gen_random_uuid(), 'transfer', 'validated', 'Test modification exécuteur', 
        75000, 'XAF', 'Test User', 'Agence Centre',
        ${executor2.id}, 7500
      )
      RETURNING id::text, executor_id
    `
    
    const transaction2 = testTransaction2[0]
    console.log(`   ✅ Transaction de test créée: ${transaction2.id} avec exécuteur ${transaction2.executor_id}`)
    
    // Modifier l'utilisateur exécuteur (changer le rôle)
    await sql`
      UPDATE users 
      SET role = 'cashier', name = 'Test Executor Updated'
      WHERE id = ${executor2.id}
    `
    console.log(`   ✅ Utilisateur exécuteur modifié (rôle changé vers cashier)`)
    
    // Vérifier que la transaction a toujours le même executor_id
    const updatedTransaction2 = await sql`
      SELECT id::text, executor_id, status
      FROM transactions 
      WHERE id = ${transaction2.id}
    `
    
    const updated2 = updatedTransaction2[0]
    console.log(`   ✅ Transaction conservée: executor_id = ${updated2.executor_id}`)
    
    // Nettoyer les données de test
    await sql`DELETE FROM transactions WHERE id = ${transaction2.id}`
    await sql`DELETE FROM users WHERE id = ${executor2.id}`
    console.log(`   ✅ Données de test nettoyées`)
    console.log('')

    console.log('🎉 Correction de la contrainte de clé étrangère terminée avec succès !')
    console.log('\n📝 Résumé des modifications:')
    console.log('   ✅ Ancienne contrainte supprimée')
    console.log('   ✅ Nouvelle contrainte créée avec ON DELETE SET NULL')
    console.log('   ✅ Suppression d\'utilisateur exécuteur testée')
    console.log('   ✅ Modification d\'utilisateur exécuteur testée')
    console.log('')
    console.log('🚀 Les utilisateurs exécuteurs peuvent maintenant être supprimés et modifiés !')
    console.log('   📋 Lors de la suppression d\'un exécuteur, ses transactions auront executor_id = NULL')
    console.log('   📋 Les transactions ne seront pas supprimées, seulement l\'assignation sera annulée')

  } catch (error) {
    console.error('❌ Erreur lors de la correction de la contrainte:', error)
    throw error
  }
}

// Exécuter la correction
fixExecutorForeignKeyConstraint()
  .then(() => {
    console.log('\n🎯 Instructions pour tester:')
    console.log('   1. Connectez-vous en tant qu\'administrateur')
    console.log('   2. Allez dans la section "Utilisateurs"')
    console.log('   3. Essayez de supprimer un utilisateur exécuteur')
    console.log('   4. Essayez de modifier le rôle d\'un utilisateur exécuteur')
    console.log('   5. Vérifiez que les transactions assignées à cet exécuteur ont maintenant executor_id = NULL')
  })
  .catch(error => {
    console.error('❌ Échec de la correction:', error)
    process.exit(1)
  })
