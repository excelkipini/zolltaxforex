#!/usr/bin/env node

/**
 * Script pour vérifier et créer l'agence "Administration (France)" si nécessaire
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

async function checkAndCreateAgency() {
  console.log('🏢 Vérification et création de l\'agence "Administration (France)"\n')

  try {
    // 1. Vérifier les agences existantes
    console.log('1️⃣ Vérification des agences existantes...')
    
    const agencies = await sql`
      SELECT id::text, name, country, address, status
      FROM agencies 
      ORDER BY name
    `
    
    console.log(`   📊 ${agencies.length} agence(s) trouvée(s):`)
    agencies.forEach(agency => {
      console.log(`      - ${agency.name} (${agency.country}) - ${agency.status}`)
    })
    console.log('')

    // 2. Vérifier si l'agence "Administration (France)" existe
    console.log('2️⃣ Vérification de l\'agence "Administration (France)"...')
    
    const adminAgency = await sql`
      SELECT id::text, name, country, address, status
      FROM agencies 
      WHERE name = 'Administration (France)'
    `
    
    if (adminAgency.length > 0) {
      const agency = adminAgency[0]
      console.log(`   ✅ Agence trouvée: ${agency.name}`)
      console.log(`      ID: ${agency.id}`)
      console.log(`      Pays: ${agency.country}`)
      console.log(`      Adresse: ${agency.address}`)
      console.log(`      Statut: ${agency.status}`)
    } else {
      console.log('   ⚠️  Agence "Administration (France)" non trouvée')
      console.log('')
      
      // 3. Créer l'agence "Administration (France)"
      console.log('3️⃣ Création de l\'agence "Administration (France)"...')
      
      const newAgency = await sql`
        INSERT INTO agencies (name, country, address, status)
        VALUES ('Administration (France)', 'France', 'Paris, France', 'active')
        RETURNING id::text, name, country, address, status
      `
      
      const agency = newAgency[0]
      console.log(`   ✅ Agence créée avec succès:`)
      console.log(`      ID: ${agency.id}`)
      console.log(`      Nom: ${agency.name}`)
      console.log(`      Pays: ${agency.country}`)
      console.log(`      Adresse: ${agency.address}`)
      console.log(`      Statut: ${agency.status}`)
    }
    console.log('')

    // 4. Vérifier les utilisateurs existants avec cette agence
    console.log('4️⃣ Vérification des utilisateurs avec l\'agence "Administration (France)"...')
    
    const usersInAdminAgency = await sql`
      SELECT id::text, name, email, role, agency
      FROM users 
      WHERE agency = 'Administration (France)'
      ORDER BY created_at DESC
    `
    
    if (usersInAdminAgency.length > 0) {
      console.log(`   📊 ${usersInAdminAgency.length} utilisateur(s) trouvé(s) dans cette agence:`)
      usersInAdminAgency.forEach(user => {
        console.log(`      - ${user.name} (${user.email}) - ${user.role}`)
      })
    } else {
      console.log('   📊 Aucun utilisateur dans cette agence pour le moment')
    }
    console.log('')

    // 5. Test de création d'un utilisateur exécuteur avec cette agence
    console.log('5️⃣ Test de création d\'un utilisateur exécuteur avec l\'agence "Administration (France)"...')
    
    const testUser = {
      name: 'Test Executor Admin',
      email: 'test-executor-admin@example.com',
      role: 'executor',
      agency: 'Administration (France)'
    }
    
    try {
      const createResult = await sql`
        INSERT INTO users (name, email, role, agency, password_hash)
        VALUES (${testUser.name}, ${testUser.email}, ${testUser.role}, ${testUser.agency}, 'test_hash')
        RETURNING id::text, name, email, role, agency
      `
      
      const createdUser = createResult[0]
      console.log(`   ✅ Utilisateur exécuteur créé avec succès:`)
      console.log(`      ID: ${createdUser.id}`)
      console.log(`      Nom: ${createdUser.name}`)
      console.log(`      Email: ${createdUser.email}`)
      console.log(`      Rôle: ${createdUser.role}`)
      console.log(`      Agence: ${createdUser.agency}`)
      
      // Supprimer l'utilisateur de test
      await sql`DELETE FROM users WHERE id = ${createdUser.id}`
      console.log(`   ✅ Utilisateur de test supprimé`)
      
    } catch (error) {
      console.log(`   ❌ Erreur lors de la création: ${error.message}`)
    }
    console.log('')

    // 6. Résumé final
    console.log('6️⃣ Résumé final...')
    
    const finalAgencies = await sql`
      SELECT id::text, name, country, status
      FROM agencies 
      ORDER BY name
    `
    
    console.log(`   📊 ${finalAgencies.length} agence(s) disponible(s):`)
    finalAgencies.forEach(agency => {
      console.log(`      - ${agency.name} (${agency.country}) - ${agency.status}`)
    })
    console.log('')

    console.log('🎉 Vérification et création d\'agence terminée avec succès !')
    console.log('\n📝 L\'agence "Administration (France)" est maintenant disponible pour:')
    console.log('   ✅ Création d\'utilisateurs')
    console.log('   ✅ Attribution du rôle "Exécuteur"')
    console.log('   ✅ Gestion des utilisateurs')

  } catch (error) {
    console.error('❌ Erreur lors de la vérification/création de l\'agence:', error)
    throw error
  }
}

// Exécuter la vérification
checkAndCreateAgency()
  .then(() => {
    console.log('\n🎯 Instructions pour créer l\'utilisateur Stevie:')
    console.log('   1. Connectez-vous en tant qu\'administrateur')
    console.log('   2. Allez dans la section "Utilisateurs"')
    console.log('   3. Cliquez sur "Nouvel utilisateur"')
    console.log('   4. Remplissez le formulaire:')
    console.log('      - Nom: Stevie')
    console.log('      - Email: gs.kibila@gmail.com')
    console.log('      - Rôle: Exécuteur')
    console.log('      - Agence: Administration (France)')
    console.log('      - Mot de passe: [votre mot de passe]')
    console.log('   5. Cliquez sur "Créer"')
  })
  .catch(error => {
    console.error('❌ Échec de la vérification:', error)
    process.exit(1)
  })
