#!/usr/bin/env node

/**
 * Script pour créer un utilisateur exécuteur de test
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import bcrypt from 'bcryptjs'

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

async function createExecutorUser() {
  console.log('👤 Création d\'un utilisateur exécuteur de test\n')

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await sql`
      SELECT id, name, email, role 
      FROM users 
      WHERE email = 'executor@zolltaxforex.com'
    `

    if (existingUser.length > 0) {
      console.log('⚠️  L\'utilisateur exécuteur existe déjà:')
      console.log(`   Nom: ${existingUser[0].name}`)
      console.log(`   Email: ${existingUser[0].email}`)
      console.log(`   Rôle: ${existingUser[0].role}`)
      console.log('')
      
      // Mettre à jour le rôle si nécessaire
      if (existingUser[0].role !== 'executor') {
        await sql`
          UPDATE users 
          SET role = 'executor' 
          WHERE email = 'executor@zolltaxforex.com'
        `
        console.log('✅ Rôle mis à jour vers "executor"')
      }
      
      return existingUser[0]
    }

    // Créer le mot de passe hashé
    const password = 'executor123'
    const passwordHash = await bcrypt.hash(password, 10)

    // Créer l'utilisateur exécuteur
    const result = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES ('Exécuteur Test', 'executor@zolltaxforex.com', 'executor', 'Agence Centre', ${passwordHash})
      RETURNING id::text, name, email, role, agency
    `

    const newUser = result[0]
    console.log('✅ Utilisateur exécuteur créé avec succès:')
    console.log(`   ID: ${newUser.id}`)
    console.log(`   Nom: ${newUser.name}`)
    console.log(`   Email: ${newUser.email}`)
    console.log(`   Rôle: ${newUser.role}`)
    console.log(`   Agence: ${newUser.agency}`)
    console.log(`   Mot de passe: ${password}`)
    console.log('')

    // Vérifier les permissions de l'exécuteur
    console.log('🔐 Permissions de l\'exécuteur:')
    console.log('   ✅ Accès au tableau de bord')
    console.log('   ✅ Consultation des transactions')
    console.log('   ✅ Exécution des transactions validées')
    console.log('   ✅ Consultation des dépenses')
    console.log('   ✅ Accès aux onglets Opérations et Dépenses')
    console.log('')

    return newUser

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur exécuteur:', error)
    throw error
  }
}

// Exécuter la création
createExecutorUser()
  .then(() => {
    console.log('🎉 Utilisateur exécuteur prêt pour les tests !')
    console.log('\n📝 Instructions de connexion:')
    console.log('   Email: executor@zolltaxforex.com')
    console.log('   Mot de passe: executor123')
    console.log('   Rôle: Exécuteur')
  })
  .catch(error => {
    console.error('❌ Échec de la création:', error)
    process.exit(1)
  })
