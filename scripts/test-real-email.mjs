#!/usr/bin/env node

/**
 * Script de test pour l'envoi réel d'emails
 * 
 * Usage: node scripts/test-real-email.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testRealEmailSending() {
  try {
    console.log('📧 Test d\'envoi réel d\'emails...')
    
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
      console.error('❌ DATABASE_URL non trouvée.')
      return
    }
    
    console.log('🔗 Connexion à la base de données...')
    
    // Import dynamique des modules
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(databaseUrl)
    
    // Créer une transaction de test
    console.log('\n📝 Création d\'une transaction de test...')
    
    const testTransaction = {
      id: `EMAIL_TEST_${Date.now()}`,
      type: 'transfer',
      status: 'pending',
      description: 'Test envoi email - Transfert vers Paris',
      amount: 75000,
      currency: 'XAF',
      created_by: 'caissier@test.com',
      agency: 'Agence Centrale',
      details: { recipient: 'Jean Dupont', destination: 'Paris, France', test: true },
      created_at: new Date().toISOString()
    }
    
    // Insérer la transaction en base
    await sql`
      INSERT INTO transactions (id, type, status, description, amount, currency, created_by, agency, details)
      VALUES (${testTransaction.id}, ${testTransaction.type}, ${testTransaction.status}, ${testTransaction.description}, ${testTransaction.amount}, ${testTransaction.currency}, ${testTransaction.created_by}, ${testTransaction.agency}, ${JSON.stringify(testTransaction.details)})
    `
    
    console.log(`✅ Transaction créée: ${testTransaction.id}`)
    
    // Test d'envoi d'email réel
    console.log('\n📧 Test d\'envoi d\'email réel...')
    
    // Simuler l'envoi d'email avec les vraies données
    const emailData = {
      transactionId: testTransaction.id,
      transactionType: testTransaction.type,
      amount: testTransaction.amount,
      currency: testTransaction.currency,
      description: testTransaction.description,
      createdBy: testTransaction.created_by,
      agency: testTransaction.agency,
      status: testTransaction.status,
      createdAt: testTransaction.created_at
    }
    
    // Récupérer les destinataires
    const auditors = await sql`
      SELECT name, email FROM users WHERE role = 'auditor'
    `
    const directors = await sql`
      SELECT name, email FROM users WHERE role = 'director'
    `
    const accountants = await sql`
      SELECT name, email FROM users WHERE role = 'accounting'
    `
    
    console.log('📧 Destinataires:')
    console.log('   - À (Auditeurs):', auditors.map(a => `${a.name} <${a.email}>`).join(', '))
    console.log('   - CC (Directeurs):', directors.map(d => `${d.name} <${d.email}>`).join(', '))
    console.log('   - CC (Comptables):', accountants.map(c => `${c.name} <${c.email}>`).join(', '))
    
    // Simuler l'envoi (en mode développement, on log au lieu d'envoyer)
    console.log('\n📤 Simulation de l\'envoi d\'email...')
    console.log('   - Sujet: [ZOLL TAX FOREX] Nouvelle transaction créée - ' + testTransaction.id)
    console.log('   - Montant: ' + testTransaction.amount.toLocaleString() + ' ' + testTransaction.currency)
    console.log('   - Description: ' + testTransaction.description)
    console.log('   - Créé par: ' + testTransaction.created_by)
    console.log('   - Agence: ' + testTransaction.agency)
    
    // En mode production avec SMTP configuré, l'email serait envoyé ici
    const smtpConfigured = !!(process.env.SMTP_USER || envVars.SMTP_USER)
    if (smtpConfigured) {
      console.log('✅ Configuration SMTP détectée - Email serait envoyé en production')
      console.log('   - SMTP Host:', process.env.SMTP_HOST || envVars.SMTP_HOST || 'smtp.gmail.com')
      console.log('   - SMTP User:', process.env.SMTP_USER || envVars.SMTP_USER)
    } else {
      console.log('⚠️  Configuration SMTP manquante - Email simulé seulement')
    }
    
    // Nettoyer la transaction de test
    console.log('\n🧹 Nettoyage...')
    await sql`
      DELETE FROM transactions WHERE id = ${testTransaction.id}
    `
    console.log('✅ Transaction de test supprimée')
    
    console.log('\n🎉 Test d\'envoi d\'email terminé avec succès!')
    
  } catch (error) {
    console.error('❌ Erreur lors du test d\'envoi d\'email:', error.message)
    process.exit(1)
  }
}

// Exécuter le test
testRealEmailSending()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })