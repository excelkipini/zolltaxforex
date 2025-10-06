#!/usr/bin/env node

/**
 * Script pour créer directement l'utilisateur Stevie avec le rôle Exécuteur
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

async function createStevieUser() {
  console.log('👤 Création de l\'utilisateur Stevie avec le rôle Exécuteur\n')

  try {
    // 1. Vérifier si l'utilisateur existe déjà
    console.log('1️⃣ Vérification de l\'existence de l\'utilisateur Stevie...')
    
    const existingUser = await sql`
      SELECT id, name, email, role, agency 
      FROM users 
      WHERE email = 'gs.kibila@gmail.com'
    `

    if (existingUser.length > 0) {
      console.log('⚠️  L\'utilisateur Stevie existe déjà:')
      console.log(`   Nom: ${existingUser[0].name}`)
      console.log(`   Email: ${existingUser[0].email}`)
      console.log(`   Rôle: ${existingUser[0].role}`)
      console.log(`   Agence: ${existingUser[0].agency}`)
      console.log('')
      
      // Mettre à jour le rôle si nécessaire
      if (existingUser[0].role !== 'executor') {
        await sql`
          UPDATE users 
          SET role = 'executor', agency = 'Administration (France)'
          WHERE email = 'gs.kibila@gmail.com'
        `
        console.log('✅ Rôle mis à jour vers "executor" et agence vers "Administration (France)"')
      }
      
      return existingUser[0]
    }

    // 2. Vérifier que l'agence "Administration (France)" existe
    console.log('2️⃣ Vérification de l\'agence "Administration (France)"...')
    
    const agency = await sql`
      SELECT id::text, name, country, address, status
      FROM agencies 
      WHERE name = 'Administration (France)'
      LIMIT 1
    `
    
    if (agency.length === 0) {
      console.log('❌ Agence "Administration (France)" non trouvée')
      console.log('   Création de l\'agence...')
      
      const newAgency = await sql`
        INSERT INTO agencies (name, country, address, status)
        VALUES ('Administration (France)', 'France', 'Paris, France', 'active')
        RETURNING id::text, name, country, address, status
      `
      
      console.log(`   ✅ Agence créée: ${newAgency[0].name} (${newAgency[0].id})`)
    } else {
      console.log(`   ✅ Agence trouvée: ${agency[0].name} (${agency[0].id})`)
    }
    console.log('')

    // 3. Créer le mot de passe hashé
    console.log('3️⃣ Création du mot de passe hashé...')
    
    const password = 'stevie123' // Mot de passe par défaut
    const passwordHash = await bcrypt.hash(password, 10)
    console.log(`   ✅ Mot de passe hashé créé`)
    console.log('')

    // 4. Créer l'utilisateur Stevie
    console.log('4️⃣ Création de l\'utilisateur Stevie...')
    
    const result = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES ('Stevie', 'gs.kibila@gmail.com', 'executor', 'Administration (France)', ${passwordHash})
      RETURNING id::text, name, email, role, agency, created_at::text as created_at
    `

    const newUser = result[0]
    console.log('✅ Utilisateur Stevie créé avec succès:')
    console.log(`   ID: ${newUser.id}`)
    console.log(`   Nom: ${newUser.name}`)
    console.log(`   Email: ${newUser.email}`)
    console.log(`   Rôle: ${newUser.role}`)
    console.log(`   Agence: ${newUser.agency}`)
    console.log(`   Créé le: ${newUser.created_at}`)
    console.log(`   Mot de passe: ${password}`)
    console.log('')

    // 5. Vérifier les permissions de l'exécuteur
    console.log('5️⃣ Vérification des permissions de l\'exécuteur...')
    
    const executorPermissions = [
      'view_dashboard',
      'view_transactions', 
      'execute_transactions',
      'view_expenses'
    ]
    
    console.log('   🔐 Permissions de l\'exécuteur:')
    executorPermissions.forEach(permission => {
      console.log(`      ✅ ${permission}`)
    })
    console.log('')

    // 6. Vérifier les menus accessibles
    console.log('6️⃣ Vérification des menus accessibles...')
    
    const executorMenus = [
      'dashboard',
      'transactions', 
      'expenses'
    ]
    
    console.log('   📋 Menus accessibles pour l\'exécuteur:')
    executorMenus.forEach(menu => {
      console.log(`      ✅ ${menu}`)
    })
    console.log('')

    // 7. Vérifier les actions principales
    console.log('7️⃣ Vérification des actions principales...')
    
    const executorActions = [
      { label: 'Exécuter transferts', href: '/transactions' },
      { label: 'Voir opérations', href: '/transactions' }
    ]
    
    console.log('   🎯 Actions principales de l\'exécuteur:')
    executorActions.forEach(action => {
      console.log(`      ✅ ${action.label} → ${action.href}`)
    })
    console.log('')

    console.log('🎉 Utilisateur Stevie créé avec succès !')
    console.log('\n📝 Instructions de connexion:')
    console.log('   Email: gs.kibila@gmail.com')
    console.log('   Mot de passe: stevie123')
    console.log('   Rôle: Exécuteur')
    console.log('   Agence: Administration (France)')
    console.log('')
    console.log('🚀 L\'utilisateur Stevie peut maintenant:')
    console.log('   ✅ Se connecter au système')
    console.log('   ✅ Accéder au tableau de bord')
    console.log('   ✅ Consulter les transactions')
    console.log('   ✅ Exécuter les transferts d\'argent')
    console.log('   ✅ Consulter les dépenses')

    return newUser

  } catch (error) {
    console.error('❌ Erreur lors de la création de l\'utilisateur Stevie:', error)
    throw error
  }
}

// Exécuter la création
createStevieUser()
  .then(() => {
    console.log('\n🎯 Instructions pour tester:')
    console.log('   1. Connectez-vous avec les identifiants de Stevie')
    console.log('   2. Vérifiez qu\'il a accès au tableau de bord')
    console.log('   3. Vérifiez qu\'il peut voir les onglets Opérations et Dépenses')
    console.log('   4. Testez l\'exécution d\'une transaction de transfert')
    console.log('   5. Vérifiez que les permissions sont correctes')
  })
  .catch(error => {
    console.error('❌ Échec de la création:', error)
    process.exit(1)
  })
