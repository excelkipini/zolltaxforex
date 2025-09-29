#!/usr/bin/env node

/**
 * Script pour vérifier les utilisateurs dans la base de données
 * 
 * Usage: node scripts/check-users.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function checkUsers() {
  try {
    console.log('👥 Vérification des utilisateurs dans la base de données...')
    
    // Charger la configuration de la base de données
    const envPath = join(__dirname, '..', '.env.local')
    let envContent = ''
    
    try {
      envContent = readFileSync(envPath, 'utf8')
    } catch (error) {
      console.log('⚠️  Fichier .env.local non trouvé')
    }
    
    // Parser les variables d'environnement
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        envVars[key.trim()] = value.trim()
      }
    })
    
    // Utiliser les variables d'environnement système ou du fichier .env
    const databaseUrl = process.env.DATABASE_URL || envVars.DATABASE_URL
    
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL non trouvée.')
      return
    }
    
    console.log('🔗 Connexion à la base de données...')
    
    // Import dynamique des modules
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(databaseUrl)
    
    // Récupérer tous les utilisateurs
    console.log('\n📋 Liste de tous les utilisateurs:')
    const allUsers = await sql`SELECT name, email, role, agency FROM users ORDER BY role, name`
    
    console.log('Total:', allUsers.length, 'utilisateurs')
    console.log('')
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`)
      console.log(`   - Email: ${user.email}`)
      console.log(`   - Rôle: ${user.role}`)
      console.log(`   - Agence: ${user.agency}`)
      console.log('')
    })
    
    // Vérifier les caissiers
    console.log('💰 Caissiers:')
    const cashiers = await sql`SELECT name, email FROM users WHERE role = 'cashier'`
    cashiers.forEach(cashier => {
      console.log(`   - ${cashier.name} (${cashier.email})`)
    })
    
    // Vérifier les auditeurs
    console.log('\n🔍 Auditeurs:')
    const auditors = await sql`SELECT name, email FROM users WHERE role = 'auditor'`
    auditors.forEach(auditor => {
      console.log(`   - ${auditor.name} (${auditor.email})`)
    })
    
    // Vérifier les directeurs
    console.log('\n👔 Directeurs:')
    const directors = await sql`SELECT name, email FROM users WHERE role = 'director'`
    directors.forEach(director => {
      console.log(`   - ${director.name} (${director.email})`)
    })
    
    // Vérifier les comptables
    console.log('\n📊 Comptables:')
    const accountants = await sql`SELECT name, email FROM users WHERE role = 'accounting'`
    accountants.forEach(accountant => {
      console.log(`   - ${accountant.name} (${accountant.email})`)
    })
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification des utilisateurs:', error.message)
    process.exit(1)
  }
}

// Exécuter le test
checkUsers()
  .then(() => {
    console.log('🎉 Script terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
