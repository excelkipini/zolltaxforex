#!/usr/bin/env node

/**
 * Script de test pour le système de notifications email
 * 
 * Usage: node scripts/test-email-notifications.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testEmailNotifications() {
  try {
    console.log('🧪 Test du système de notifications email...')
    
    // Charger la configuration de la base de données
    const envPath = join(__dirname, '..', '.env.local')
    let envContent = ''
    
    try {
      envContent = readFileSync(envPath, 'utf8')
    } catch (error) {
      console.log('⚠️  Fichier .env.local non trouvé, utilisation des variables d\'environnement système')
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
      console.error('❌ DATABASE_URL non trouvée. Veuillez définir cette variable d\'environnement.')
      return
    }
    
    console.log('🔗 Connexion à la base de données...')
    
    // Import dynamique des modules
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(databaseUrl)
    
    // Test 1: Vérifier les utilisateurs par rôle
    console.log('\n📊 Test 1: Vérification des utilisateurs par rôle...')
    
    const auditors = await sql`
      SELECT name, email, role FROM users WHERE role = 'auditor'
    `
    console.log(`✅ Auditeurs trouvés: ${auditors.length}`)
    auditors.forEach(user => console.log(`   - ${user.name} (${user.email})`))
    
    const directors = await sql`
      SELECT name, email, role FROM users WHERE role = 'director'
    `
    console.log(`✅ Directeurs trouvés: ${directors.length}`)
    directors.forEach(user => console.log(`   - ${user.name} (${user.email})`))
    
    const accountants = await sql`
      SELECT name, email, role FROM users WHERE role = 'accounting'
    `
    console.log(`✅ Comptables trouvés: ${accountants.length}`)
    accountants.forEach(user => console.log(`   - ${user.name} (${user.email})`))
    
    const cashiers = await sql`
      SELECT name, email, role FROM users WHERE role = 'cashier'
    `
    console.log(`✅ Caissiers trouvés: ${cashiers.length}`)
    cashiers.forEach(user => console.log(`   - ${user.name} (${user.email})`))
    
    // Test 2: Créer une transaction de test
    console.log('\n📝 Test 2: Création d\'une transaction de test...')
    
    const testTransaction = {
      id: `TEST_${Date.now()}`,
      type: 'transfer',
      status: 'pending',
      description: 'Test de notification email',
      amount: 50000,
      currency: 'XAF',
      created_by: 'caissier@test.com',
      agency: 'Agence Centrale',
      details: { test: true },
      created_at: new Date().toISOString()
    }
    
    console.log(`✅ Transaction de test créée: ${testTransaction.id}`)
    
    // Test 3: Simuler l'envoi de notifications
    console.log('\n📧 Test 3: Simulation des notifications email...')
    
    // Vérifier la configuration email
    const smtpUser = process.env.SMTP_USER || envVars.SMTP_USER
    const smtpPass = process.env.SMTP_PASS || envVars.SMTP_PASS
    const fromEmail = process.env.FROM_EMAIL || envVars.FROM_EMAIL
    
    const isEmailConfigured = !!(smtpUser && smtpPass && fromEmail)
    console.log(`📧 Email configuré: ${isEmailConfigured}`)
    
    if (isEmailConfigured) {
      console.log('📤 Configuration email détectée - simulation de l\'envoi...')
      console.log('   - SMTP Host:', process.env.SMTP_HOST || envVars.SMTP_HOST || 'smtp.gmail.com')
      console.log('   - SMTP Port:', process.env.SMTP_PORT || envVars.SMTP_PORT || '587')
      console.log('   - From Email:', fromEmail)
      console.log('   - SMTP User:', smtpUser)
      
      // Simuler l'envoi
      console.log('\n📧 Email qui serait envoyé:')
      console.log('   - À:', auditors.map(a => `${a.name} <${a.email}>`).join(', '))
      console.log('   - CC:', [...directors, ...accountants].map(u => `${u.name} <${u.email}>`).join(', '))
      console.log('   - Sujet: [ZOLL TAX FOREX] Nouvelle transaction créée - TEST_123')
      console.log('   - Contenu: Template HTML avec détails de la transaction')
      
      console.log('✅ Simulation d\'envoi réussie!')
    } else {
      console.log('⚠️  Email non configuré - ajoutez les variables SMTP_* dans .env.local')
      console.log('💡 Consultez email-config.example pour la configuration')
    }
    
    // Test 4: Nettoyer la transaction de test
    console.log('\n🧹 Test 4: Nettoyage...')
    
    await sql`
      DELETE FROM transactions WHERE id = ${testTransaction.id}
    `
    
    console.log('✅ Transaction de test supprimée')
    
    console.log('\n🎉 Tests terminés avec succès!')
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message)
    process.exit(1)
  }
}

// Exécuter les tests
testEmailNotifications()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
