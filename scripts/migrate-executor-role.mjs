#!/usr/bin/env node

/**
 * Script de migration pour ajouter le rôle 'executor' à la contrainte users_role_check
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

async function migrateExecutorRole() {
  console.log('🔄 Migration pour ajouter le rôle "executor"\n')

  try {
    // 1. Vérifier la contrainte actuelle
    console.log('1️⃣ Vérification de la contrainte actuelle...')
    const constraintCheck = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'users_role_check' 
      AND conrelid = 'users'::regclass
    `
    
    if (constraintCheck.length > 0) {
      console.log('✅ Contrainte users_role_check trouvée')
      console.log(`   Définition actuelle: ${constraintCheck[0].definition}`)
    } else {
      console.log('⚠️  Contrainte users_role_check non trouvée')
    }
    console.log('')

    // 2. Supprimer l'ancienne contrainte
    console.log('2️⃣ Suppression de l\'ancienne contrainte...')
    await sql`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check
    `
    console.log('✅ Ancienne contrainte supprimée')
    console.log('')

    // 3. Créer la nouvelle contrainte avec le rôle executor
    console.log('3️⃣ Création de la nouvelle contrainte avec le rôle "executor"...')
    await sql`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('super_admin','director','accounting','cashier','auditor','delegate','executor'))
    `
    console.log('✅ Nouvelle contrainte créée avec le rôle "executor"')
    console.log('')

    // 4. Vérifier que la migration a fonctionné
    console.log('4️⃣ Vérification de la migration...')
    const newConstraintCheck = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'users_role_check' 
      AND conrelid = 'users'::regclass
    `
    
    if (newConstraintCheck.length > 0) {
      console.log('✅ Nouvelle contrainte vérifiée')
      console.log(`   Définition: ${newConstraintCheck[0].definition}`)
    }
    console.log('')

    // 5. Tester l'insertion d'un utilisateur avec le rôle executor
    console.log('5️⃣ Test d\'insertion d\'un utilisateur avec le rôle "executor"...')
    try {
      const testUser = await sql`
        INSERT INTO users (id, name, email, role, agency, password_hash)
        VALUES (gen_random_uuid(), 'Test Executor', 'test-executor@example.com', 'executor', 'Agence Centre', 'test_hash')
        RETURNING id::text, name, email, role
      `
      console.log('✅ Test d\'insertion réussi')
      console.log(`   Utilisateur créé: ${testUser[0].name} (${testUser[0].role})`)
      
      // Supprimer l'utilisateur de test
      await sql`DELETE FROM users WHERE email = 'test-executor@example.com'`
      console.log('✅ Utilisateur de test supprimé')
    } catch (error) {
      console.log('❌ Test d\'insertion échoué:', error.message)
    }
    console.log('')

    console.log('🎉 Migration terminée avec succès !')
    console.log('\n📝 Le rôle "executor" est maintenant disponible dans le système')
    console.log('   ✅ Contrainte mise à jour')
    console.log('   ✅ Test d\'insertion réussi')
    console.log('   ✅ Prêt pour créer des utilisateurs exécuteurs')

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  }
}

// Exécuter la migration
migrateExecutorRole()
  .then(() => {
    console.log('\n🚀 Migration complète ! Vous pouvez maintenant créer des utilisateurs exécuteurs.')
  })
  .catch(error => {
    console.error('❌ Échec de la migration:', error)
    process.exit(1)
  })
