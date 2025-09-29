#!/usr/bin/env node

/**
 * Script de test pour vérifier l'intégration email dans l'application Next.js
 * 
 * Usage: node scripts/test-nextjs-integration.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testNextjsIntegration() {
  try {
    console.log('🧪 Test de l\'intégration email dans l\'application Next.js...')
    
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
    
    // Test 1: Vérifier que le serveur Next.js est démarré
    console.log('\n🌐 Test 1: Vérification du serveur Next.js...')
    
    try {
      const response = await fetch('http://localhost:3000')
      if (response.ok) {
        console.log('✅ Serveur Next.js démarré et accessible')
      } else {
        console.log('⚠️  Serveur Next.js accessible mais avec des erreurs:', response.status)
      }
    } catch (error) {
      console.log('❌ Serveur Next.js non accessible:', error.message)
      console.log('💡 Démarrez le serveur avec: npm run dev')
      return
    }
    
    // Test 2: Vérifier la configuration email
    console.log('\n📧 Test 2: Vérification de la configuration email...')
    
    const smtpUser = process.env.SMTP_USER || envVars.SMTP_USER
    const smtpPass = process.env.SMTP_PASS || envVars.SMTP_PASS
    const fromEmail = process.env.FROM_EMAIL || envVars.FROM_EMAIL
    
    if (!smtpUser || !smtpPass || !fromEmail) {
      console.log('⚠️  Configuration SMTP incomplète - les emails ne seront pas envoyés')
      return
    }
    
    console.log('✅ Configuration SMTP complète')
    
    // Test 3: Créer une transaction directement en base (simulant l'application)
    console.log('\n📝 Test 3: Création d\'une transaction...')
    
    const transactionId = `NEXTJS_TEST_${Date.now()}`
    const transactionData = {
      id: transactionId,
      type: 'transfer',
      status: 'pending',
      description: 'Test intégration Next.js - Transfert vers Abidjan',
      amount: 500000,
      currency: 'XAF',
      created_by: 'Stevie Kibila', // Utilisateur caissier
      agency: 'Agence Centrale',
      details: JSON.stringify({
        recipient: 'Kouassi Yao',
        destination: 'Abidjan, Côte d\'Ivoire',
        test: true,
        nextjs_integration_test: true
      })
    }
    
    console.log('📤 Création de la transaction...')
    const result = await sql`
      INSERT INTO transactions (id, type, status, description, amount, currency, created_by, agency, details)
      VALUES (${transactionData.id}, ${transactionData.type}, ${transactionData.status}, ${transactionData.description}, ${transactionData.amount}, ${transactionData.currency}, ${transactionData.created_by}, ${transactionData.agency}, ${transactionData.details})
      RETURNING 
        id::text,
        type,
        status,
        description,
        amount::bigint as amount,
        currency,
        created_by,
        agency,
        details,
        rejection_reason,
        created_at::text as created_at,
        updated_at::text as updated_at
    `
    
    const transaction = result[0]
    console.log('✅ Transaction créée avec succès:', transaction.id)
    
    // Test 4: Simuler l'envoi d'email comme le ferait l'application
    console.log('\n📧 Test 4: Simulation de l\'envoi d\'email...')
    
    // Import de nodemailer
    const nodemailer = await import('nodemailer')
    
    // Configuration SMTP
    const smtpConfig = {
      host: process.env.SMTP_HOST || envVars.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || envVars.SMTP_PORT || '587', 10),
      secure: (process.env.SMTP_SECURE || envVars.SMTP_SECURE) === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      from: fromEmail,
      fromName: process.env.FROM_NAME || envVars.FROM_NAME || "ZOLL TAX FOREX",
    }
    
    // Créer le transporteur
    const transporter = nodemailer.createTransport(smtpConfig)
    
    // Vérifier la connexion
    await transporter.verify()
    console.log('✅ Connexion SMTP réussie!')
    
    // Récupérer les destinataires
    const auditors = await sql`SELECT name, email FROM users WHERE role = 'auditor' AND email IS NOT NULL`
    const directors = await sql`SELECT name, email FROM users WHERE role = 'director' AND email IS NOT NULL`
    const accountants = await sql`SELECT name, email FROM users WHERE role = 'accounting' AND email IS NOT NULL`
    
    const toEmails = auditors.map(u => u.email)
    const ccEmails = [...directors, ...accountants].map(u => u.email)
    
    // Template HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nouvelle Transaction - ZOLL TAX FOREX</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        .header { background-color: #f4f4f4; padding: 10px; text-align: center; border-bottom: 1px solid #ddd; }
        .content { padding: 20px 0; }
        .footer { text-align: center; font-size: 0.8em; color: #777; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 20px; }
        .button { display: inline-block; background-color: #007bff; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        .alert { background-color: #fff3cd; border-left: 5px solid #ffeeba; padding: 10px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Notification ZOLL TAX FOREX</h2>
        </div>
        <div class="content">
            <p>Bonjour,</p>
            <p class="alert">Une nouvelle transaction a été créée et est en attente de validation.</p>
            <h3>Détails de la transaction :</h3>
            <ul>
                <li><strong>ID Transaction :</strong> ${transaction.id}</li>
                <li><strong>Type :</strong> ${transaction.type}</li>
                <li><strong>Statut :</strong> ${transaction.status}</li>
                <li><strong>Montant :</strong> ${transaction.amount.toLocaleString()} ${transaction.currency}</li>
                <li><strong>Description :</strong> ${transaction.description}</li>
                <li><strong>Créé par :</strong> ${transaction.created_by} (${transaction.agency})</li>
                <li><strong>Date :</strong> ${new Date(transaction.created_at).toLocaleString()}</li>
            </ul>
            <p>Veuillez vous connecter à l'application pour examiner et valider cette transaction.</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/transactions" class="button">Voir la transaction</a></p>
        </div>
        <div class="footer">
            <p>${smtpConfig.fromName} &copy; ${new Date().getFullYear()}</p>
        </div>
    </div>
</body>
</html>`
    
    // Envoyer l'email
    const info = await transporter.sendMail({
      from: `"${smtpConfig.fromName}" <${smtpConfig.from}>`,
      to: toEmails.join(', '),
      cc: ccEmails.join(', '),
      subject: `[ZOLL TAX FOREX] Nouvelle transaction créée - ${transaction.id}`,
      html: htmlContent
    })
    
    console.log('✅ Email envoyé avec succès!')
    console.log('   - Message ID:', info.messageId)
    console.log('   - À:', toEmails.join(', '))
    console.log('   - CC:', ccEmails.join(', '))
    
    // Test 5: Nettoyer la transaction de test
    console.log('\n🧹 Test 5: Nettoyage...')
    
    await sql`
      DELETE FROM transactions WHERE id = ${transaction.id}
    `
    
    console.log('✅ Transaction de test supprimée')
    
    console.log('\n🎉 Test d\'intégration Next.js terminé avec succès!')
    console.log('📧 Vérifiez les boîtes de réception des auditeurs et directeurs.')
    console.log('   - Léo (reye62742@gmail.com) - Auditeur')
    console.log('   - Michel (michel.nianga@zolltaxforex.com) - Directeur')
    console.log('   - Anne Sophie (anne.ominga@zolltaxforex.com) - Comptable')
    
    console.log('\n💡 Pour tester depuis l\'application:')
    console.log('   1. Connectez-vous en tant que caissier (Stevie)')
    console.log('   2. Créez une nouvelle transaction')
    console.log('   3. Vérifiez que l\'email est envoyé automatiquement')
    console.log('   4. Vérifiez les logs du serveur pour les erreurs éventuelles')
    
  } catch (error) {
    console.error('❌ Erreur lors du test d\'intégration Next.js:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Exécuter le test
testNextjsIntegration()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
