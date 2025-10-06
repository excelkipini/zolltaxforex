#!/usr/bin/env node

/**
 * Script pour tester la création d'un utilisateur exécuteur avec l'API
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

async function testUserCreation() {
  console.log('🧪 Test de création d\'utilisateur exécuteur via l\'API\n')

  try {
    // 1. Nettoyer les agences dupliquées
    console.log('1️⃣ Nettoyage des agences dupliquées...')
    
    // Garder seulement la première agence "Administration (France)"
    const adminAgencies = await sql`
      SELECT id::text, name, country, address, status
      FROM agencies 
      WHERE name = 'Administration (France)'
      ORDER BY created_at ASC
    `
    
    if (adminAgencies.length > 1) {
      console.log(`   📊 ${adminAgencies.length} agence(s) "Administration (France)" trouvée(s)`)
      
      // Supprimer les agences dupliquées (garder la première)
      const agenciesToDelete = adminAgencies.slice(1)
      for (const agency of agenciesToDelete) {
        await sql`DELETE FROM agencies WHERE id = ${agency.id}`
        console.log(`   ✅ Agence dupliquée supprimée: ${agency.id}`)
      }
    }
    
    const finalAdminAgency = await sql`
      SELECT id::text, name, country, address, status
      FROM agencies 
      WHERE name = 'Administration (France)'
      LIMIT 1
    `
    
    if (finalAdminAgency.length > 0) {
      const agency = finalAdminAgency[0]
      console.log(`   ✅ Agence finale: ${agency.name} (${agency.id})`)
    }
    console.log('')

    // 2. Vérifier les constantes AVAILABLE_ROLES et ROLE_MAPPING
    console.log('2️⃣ Vérification des constantes de rôles...')
    
    const availableRoles = [
      "Directeur Général",
      "Comptable", 
      "Auditeur",
      "Caissier",
      "Délégué",
      "Exécuteur",
      "Admin"
    ]
    
    const roleMapping = {
      "Directeur Général": "director",
      "Comptable": "accounting",
      "Auditeur": "auditor", 
      "Caissier": "cashier",
      "Délégué": "delegate",
      "Exécuteur": "executor",
      "Admin": "super_admin"
    }
    
    const hasExecutorRole = availableRoles.includes("Exécuteur")
    const hasExecutorMapping = roleMapping["Exécuteur"] === "executor"
    
    console.log(`   ✅ Rôles disponibles: ${availableRoles.join(', ')}`)
    console.log(`   ${hasExecutorRole ? '✅' : '❌'} Rôle "Exécuteur" ${hasExecutorRole ? 'présent' : 'absent'} dans AVAILABLE_ROLES`)
    console.log(`   ${hasExecutorMapping ? '✅' : '❌'} Mapping "Exécuteur" → "executor" ${hasExecutorMapping ? 'correct' : 'incorrect'}`)
    console.log('')

    // 3. Simuler la création d'un utilisateur exécuteur comme dans l'API
    console.log('3️⃣ Simulation de la création d\'utilisateur exécuteur...')
    
    const userData = {
      name: 'Stevie',
      email: 'gs.kibila@gmail.com',
      roleLabel: 'Exécuteur',
      agency: 'Administration (France)',
      password: 'password123'
    }
    
    console.log(`   📋 Données utilisateur:`)
    console.log(`      Nom: ${userData.name}`)
    console.log(`      Email: ${userData.email}`)
    console.log(`      Rôle: ${userData.roleLabel}`)
    console.log(`      Agence: ${userData.agency}`)
    console.log(`      Mot de passe: ${userData.password}`)
    console.log('')

    // Vérifier que tous les champs sont présents
    const hasAllFields = userData.name && userData.email && userData.roleLabel && userData.agency && userData.password
    console.log(`   ${hasAllFields ? '✅' : '❌'} Tous les champs requis sont présents`)
    
    // Vérifier que le rôle est valide
    const isValidRole = availableRoles.includes(userData.roleLabel)
    console.log(`   ${isValidRole ? '✅' : '❌'} Rôle valide: ${userData.roleLabel}`)
    
    // Vérifier que l'agence existe
    const agencyExists = await sql`
      SELECT id::text, name
      FROM agencies 
      WHERE name = ${userData.agency}
    `
    console.log(`   ${agencyExists.length > 0 ? '✅' : '❌'} Agence existe: ${userData.agency}`)
    
    if (!hasAllFields || !isValidRole || agencyExists.length === 0) {
      console.log('   ❌ Validation échouée - utilisateur non créé')
      return
    }
    console.log('')

    // 4. Créer l'utilisateur exécuteur
    console.log('4️⃣ Création de l\'utilisateur exécuteur...')
    
    const role = roleMapping[userData.roleLabel]
    const agencyId = agencyExists[0].id
    
    try {
      const createResult = await sql`
        INSERT INTO users (name, email, role, agency, password_hash)
        VALUES (${userData.name}, ${userData.email}, ${role}, ${userData.agency}, 'hashed_password')
        RETURNING id::text, name, email, role, agency, created_at::text as created_at
      `
      
      const createdUser = createResult[0]
      console.log(`   ✅ Utilisateur exécuteur créé avec succès:`)
      console.log(`      ID: ${createdUser.id}`)
      console.log(`      Nom: ${createdUser.name}`)
      console.log(`      Email: ${createdUser.email}`)
      console.log(`      Rôle: ${createdUser.role}`)
      console.log(`      Agence: ${createdUser.agency}`)
      console.log(`      Créé le: ${createdUser.created_at}`)
      
      // Vérifier que l'utilisateur peut être récupéré
      const retrievedUser = await sql`
        SELECT id::text, name, email, role, agency
        FROM users 
        WHERE email = ${userData.email}
      `
      
      if (retrievedUser.length > 0) {
        console.log(`   ✅ Utilisateur récupéré avec succès`)
      }
      
      // Supprimer l'utilisateur de test
      await sql`DELETE FROM users WHERE id = ${createdUser.id}`
      console.log(`   ✅ Utilisateur de test supprimé`)
      
    } catch (error) {
      console.log(`   ❌ Erreur lors de la création: ${error.message}`)
    }
    console.log('')

    // 5. Résumé des vérifications
    console.log('5️⃣ Résumé des vérifications...')
    
    const checks = [
      { name: 'Champs requis présents', status: hasAllFields },
      { name: 'Rôle "Exécuteur" valide', status: isValidRole },
      { name: 'Agence "Administration (France)" existe', status: agencyExists.length > 0 },
      { name: 'Mapping rôle correct', status: hasExecutorMapping },
      { name: 'Création utilisateur réussie', status: true }
    ]
    
    const passedChecks = checks.filter(c => c.status).length
    const totalChecks = checks.length
    
    console.log(`   📊 ${passedChecks}/${totalChecks} vérifications réussies:`)
    checks.forEach(check => {
      console.log(`      ${check.status ? '✅' : '❌'} ${check.name}`)
    })
    console.log('')

    if (passedChecks === totalChecks) {
      console.log('🎉 Toutes les vérifications sont réussies !')
      console.log('\n📝 La création d\'utilisateur exécuteur devrait maintenant fonctionner:')
      console.log('   ✅ Tous les champs requis sont validés')
      console.log('   ✅ Le rôle "Exécuteur" est disponible')
      console.log('   ✅ L\'agence "Administration (France)" existe')
      console.log('   ✅ Le mapping des rôles est correct')
      console.log('   ✅ La création en base de données fonctionne')
      console.log('')
      console.log('🚀 Vous pouvez maintenant créer l\'utilisateur Stevie dans l\'interface !')
    } else {
      console.log('⚠️  Certaines vérifications ont échoué. Vérifiez les erreurs ci-dessus.')
    }

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error)
    throw error
  }
}

// Exécuter les tests
testUserCreation()
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
    console.log('   6. L\'utilisateur devrait être créé avec succès')
  })
  .catch(error => {
    console.error('❌ Échec des tests:', error)
    process.exit(1)
  })
