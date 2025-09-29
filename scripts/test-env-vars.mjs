#!/usr/bin/env node

/**
 * Script de test pour vérifier les variables d'environnement dans l'application
 * 
 * Usage: node scripts/test-env-vars.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testEnvVars() {
  try {
    console.log('🧪 Test des variables d\'environnement...')
    
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
    
    console.log('Variables d\'environnement:')
    console.log('   - SMTP_HOST:', process.env.SMTP_HOST || envVars.SMTP_HOST || 'Non défini')
    console.log('   - SMTP_PORT:', process.env.SMTP_PORT || envVars.SMTP_PORT || 'Non défini')
    console.log('   - SMTP_SECURE:', process.env.SMTP_SECURE || envVars.SMTP_SECURE || 'Non défini')
    console.log('   - SMTP_USER:', process.env.SMTP_USER || envVars.SMTP_USER || 'Non défini')
    console.log('   - SMTP_PASS:', process.env.SMTP_PASS || envVars.SMTP_PASS || 'Non défini')
    console.log('   - FROM_EMAIL:', process.env.FROM_EMAIL || envVars.FROM_EMAIL || 'Non défini')
    console.log('   - FROM_NAME:', process.env.FROM_NAME || envVars.FROM_NAME || 'Non défini')
    
    // Test de la fonction isEmailConfigured
    console.log('\n📧 Test de la fonction isEmailConfigured...')
    
    // Simuler la fonction isEmailConfigured
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
    
  } catch (error) {
    console.error('❌ Erreur lors du test des variables d\'environnement:', error.message)
    process.exit(1)
  }
}

// Exécuter le test
testEnvVars()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
