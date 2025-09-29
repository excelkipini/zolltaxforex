#!/usr/bin/env node

/**
 * Script de test pour vérifier les traductions dans les emails
 * 
 * Usage: node scripts/test-email-translations.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testEmailTranslations() {
  try {
    console.log('🧪 Test des traductions dans les emails...')
    
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
    
    // Test 1: Vérifier la configuration email
    console.log('\n📧 Test 1: Vérification de la configuration email...')
    
    const smtpUser = process.env.SMTP_USER || envVars.SMTP_USER
    const smtpPass = process.env.SMTP_PASS || envVars.SMTP_PASS
    const fromEmail = process.env.FROM_EMAIL || envVars.FROM_EMAIL
    
    if (!smtpUser || !smtpPass || !fromEmail) {
      console.log('⚠️  Configuration SMTP incomplète - les emails ne seront pas envoyés')
      return
    }
    
    console.log('✅ Configuration SMTP complète')
    
    // Test 2: Créer une transaction de test avec différents types
    console.log('\n📝 Test 2: Création d\'une transaction de test...')
    
    const transactionId = `TRANSLATION_TEST_${Date.now()}`
    const transactionData = {
      id: transactionId,
      type: 'exchange', // Type qui sera traduit
      status: 'pending', // Statut qui sera traduit
      description: 'Test traductions - Change GBP - Achat - John Doe',
      amount: 8000000,
      currency: 'XAF',
      created_by: 'Stevie',
      agency: 'Noura',
      details: JSON.stringify({
        recipient: 'John Doe',
        destination: 'Londres, Royaume-Uni',
        test: true,
        translation_test: true
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
    console.log('   - Type original:', transaction.type)
    console.log('   - Statut original:', transaction.status)
    
    // Test 3: Simuler l'envoi d'email avec traductions
    console.log('\n📧 Test 3: Simulation de l\'envoi d\'email avec traductions...')
    
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
    
    // Fonctions de traduction (copiées du template)
    const translateTransactionType = (type) => {
      const translations = {
        'transfer': 'Transfert d\'argent',
        'exchange': 'Bureau de change',
        'card': 'Gestion de carte',
        'receipt': 'Reçu',
        'reception': 'Réception'
      }
      return translations[type] || type
    }

    const translateTransactionStatus = (status) => {
      const translations = {
        'pending': 'En attente',
        'validated': 'Validée',
        'rejected': 'Rejetée',
        'completed': 'Terminée',
        'pending_delete': 'En attente de suppression'
      }
      return translations[status] || status
    }
    
    // Template HTML avec traductions
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
        .transaction-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1e40af; }
        .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: bold; color: #374151; }
        .detail-value { color: #6b7280; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🔔 Nouvelle Transaction Créée</h2>
        </div>
        <div class="content">
            <p>Bonjour,</p>
            <p class="alert">Une nouvelle transaction a été créée par un caissier et nécessite votre validation.</p>
            <p><strong>Action requise:</strong> Cette transaction est en attente de validation par un auditeur.</p>
            
            <div class="transaction-details">
                <h3>Détails de la Transaction</h3>
                <div class="detail-row">
                    <span class="detail-label">ID Transaction:</span>
                    <span class="detail-value">${transaction.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${translateTransactionType(transaction.type)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Montant:</span>
                    <span class="detail-value">${transaction.amount.toLocaleString()} ${transaction.currency}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description:</span>
                    <span class="detail-value">${transaction.description}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Créé par:</span>
                    <span class="detail-value">${transaction.created_by}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Agence:</span>
                    <span class="detail-value">${transaction.agency}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Statut:</span>
                    <span class="detail-value">${translateTransactionStatus(transaction.status)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value">${new Date(transaction.created_at).toLocaleString('fr-FR')}</span>
                </div>
            </div>
            
            <p><strong>Prochaines étapes:</strong></p>
            <ul>
                <li>Connectez-vous au système ZOLL TAX FOREX</li>
                <li>Accédez à la section "Opérations"</li>
                <li>Validez ou rejetez cette transaction</li>
            </ul>
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
    
    console.log('✅ Email avec traductions envoyé avec succès!')
    console.log('   - Message ID:', info.messageId)
    console.log('   - À:', toEmails.join(', '))
    console.log('   - CC:', ccEmails.join(', '))
    console.log('   - Type traduit:', translateTransactionType(transaction.type))
    console.log('   - Statut traduit:', translateTransactionStatus(transaction.status))
    
    // Test 4: Nettoyer la transaction de test
    console.log('\n🧹 Test 4: Nettoyage...')
    
    await sql`
      DELETE FROM transactions WHERE id = ${transaction.id}
    `
    
    console.log('✅ Transaction de test supprimée')
    
    console.log('\n🎉 Test des traductions terminé avec succès!')
    console.log('📧 Vérifiez les boîtes de réception des auditeurs et directeurs.')
    console.log('   - Léo (reye62742@gmail.com) - Auditeur')
    console.log('   - Michel (michel.nianga@zolltaxforex.com) - Directeur')
    console.log('   - Anne Sophie (anne.ominga@zolltaxforex.com) - Comptable')
    
    console.log('\n💡 Traductions appliquées:')
    console.log('   - Type "exchange" → "Bureau de change"')
    console.log('   - Statut "pending" → "En attente"')
    
  } catch (error) {
    console.error('❌ Erreur lors du test des traductions:', error.message)
    console.error('Stack trace:', error.stack)
    process.exit(1)
  }
}

// Exécuter le test
testEmailTranslations()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
