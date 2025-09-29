#!/usr/bin/env node

/**
 * Script de test pour vérifier les variables d'environnement dans Next.js
 * 
 * Usage: node scripts/test-nextjs-env.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testNextjsEnv() {
  try {
    console.log('🧪 Test des variables d\'environnement dans Next.js...')
    
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
    
    console.log('Variables d\'environnement dans .env.local:')
    console.log('   - SMTP_HOST:', envVars.SMTP_HOST || 'Non défini')
    console.log('   - SMTP_PORT:', envVars.SMTP_PORT || 'Non défini')
    console.log('   - SMTP_SECURE:', envVars.SMTP_SECURE || 'Non défini')
    console.log('   - SMTP_USER:', envVars.SMTP_USER || 'Non défini')
    console.log('   - SMTP_PASS:', envVars.SMTP_PASS || 'Non défini')
    console.log('   - FROM_EMAIL:', envVars.FROM_EMAIL || 'Non défini')
    console.log('   - FROM_NAME:', envVars.FROM_NAME || 'Non défini')
    
    console.log('\nVariables d\'environnement système:')
    console.log('   - SMTP_HOST:', process.env.SMTP_HOST || 'Non défini')
    console.log('   - SMTP_PORT:', process.env.SMTP_PORT || 'Non défini')
    console.log('   - SMTP_SECURE:', process.env.SMTP_SECURE || 'Non défini')
    console.log('   - SMTP_USER:', process.env.SMTP_USER || 'Non défini')
    console.log('   - SMTP_PASS:', process.env.SMTP_PASS || 'Non défini')
    console.log('   - FROM_EMAIL:', process.env.FROM_EMAIL || 'Non défini')
    console.log('   - FROM_NAME:', process.env.FROM_NAME || 'Non défini')
    
    // Test de la fonction isEmailConfigured
    console.log('\n📧 Test de la fonction isEmailConfigured...')
    
    const smtpUser = process.env.SMTP_USER || envVars.SMTP_USER
    const smtpPass = process.env.SMTP_PASS || envVars.SMTP_PASS
    const fromEmail = process.env.FROM_EMAIL || envVars.FROM_EMAIL
    
    const isConfigured = !!(smtpUser && smtpPass && fromEmail)
    console.log('   - isEmailConfigured():', isConfigured ? '✅ true' : '❌ false')
    
    if (!isConfigured) {
      console.log('⚠️  Configuration email incomplète - les emails ne seront pas envoyés')
      console.log('💡 Vérifiez que toutes les variables SMTP_* sont définies dans .env.local')
    } else {
      console.log('✅ Configuration email complète - les emails peuvent être envoyés')
    }
    
    // Test de l'API Next.js
    console.log('\n🌐 Test de l\'API Next.js...')
    
    try {
      const response = await fetch('http://localhost:3000/api/transactions')
      if (response.status === 401) {
        console.log('✅ API Next.js accessible (authentification requise)')
      } else if (response.ok) {
        console.log('✅ API Next.js accessible')
      } else {
        console.log('⚠️  API Next.js accessible mais avec des erreurs:', response.status)
      }
    } catch (error) {
      console.log('❌ API Next.js non accessible:', error.message)
    }
    
    console.log('\n💡 Pour résoudre le problème d\'envoi d\'emails depuis l\'application:')
    console.log('   1. Vérifiez que le serveur Next.js est démarré avec: npm run dev')
    console.log('   2. Vérifiez que les variables d\'environnement sont dans .env.local')
    console.log('   3. Redémarrez le serveur Next.js après modification de .env.local')
    console.log('   4. Vérifiez les logs du serveur pour les erreurs éventuelles')
    console.log('   5. Testez la création d\'une transaction depuis l\'interface web')
    
  } catch (error) {
    console.error('❌ Erreur lors du test des variables d\'environnement Next.js:', error.message)
    process.exit(1)
  }
}

// Exécuter le test
testNextjsEnv()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
