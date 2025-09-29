#!/usr/bin/env node

/**
 * Script de test pour l'envoi réel d'emails avec Nodemailer
 * 
 * Usage: node scripts/test-nodemailer.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function testRealEmailSending() {
  try {
    console.log('📧 Test d\'envoi réel d\'emails avec Nodemailer...')
    
    // Charger la configuration
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
    
    // Configuration SMTP
    const smtpConfig = {
      host: process.env.SMTP_HOST || envVars.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || envVars.SMTP_PORT || '587'),
      secure: (process.env.SMTP_SECURE || envVars.SMTP_SECURE) === 'true',
      auth: {
        user: process.env.SMTP_USER || envVars.SMTP_USER,
        pass: process.env.SMTP_PASS || envVars.SMTP_PASS,
      },
    }
    
    const fromEmail = process.env.FROM_EMAIL || envVars.FROM_EMAIL || 'noreply@zolltaxforex.com'
    const fromName = process.env.FROM_NAME || envVars.FROM_NAME || 'ZOLL TAX FOREX'
    
    console.log('📧 Configuration SMTP:')
    console.log('   - Host:', smtpConfig.host)
    console.log('   - Port:', smtpConfig.port)
    console.log('   - Secure:', smtpConfig.secure)
    console.log('   - User:', smtpConfig.auth.user)
    console.log('   - From:', `${fromName} <${fromEmail}>`)
    
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.log('❌ Configuration SMTP incomplète - test simulé seulement')
      console.log('💡 Ajoutez SMTP_USER et SMTP_PASS dans .env.local')
      return
    }
    
    // Créer le transporteur
    console.log('\n🔧 Création du transporteur SMTP...')
    const transporter = nodemailer.createTransport(smtpConfig)
    
    // Vérifier la connexion
    console.log('🔍 Vérification de la connexion SMTP...')
    try {
      await transporter.verify()
      console.log('✅ Connexion SMTP réussie!')
    } catch (error) {
      console.error('❌ Erreur de connexion SMTP:', error.message)
      return
    }
    
    // Données de test
    const testTransaction = {
      id: `EMAIL_TEST_${Date.now()}`,
      type: 'transfer',
      amount: 125000,
      currency: 'XAF',
      description: 'Test envoi email - Transfert vers Paris',
      createdBy: 'caissier@test.com',
      agency: 'Agence Centrale',
      status: 'pending',
      createdAt: new Date().toISOString()
    }
    
    // Destinataires de test
    const recipients = {
      to: ['paul@zolltaxforex.com'], // Auditeur
      cc: ['michel.nianga@zolltaxforex.com', 'anne.ominga@zolltaxforex.com'] // Directeur + Comptable
    }
    
    // Template HTML
    const htmlContent = `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Nouvelle Transaction Créée</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #1e40af;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background-color: #f8fafc;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .transaction-details {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #1e40af;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-label {
            font-weight: bold;
            color: #374151;
        }
        .detail-value {
            color: #6b7280;
        }
        .amount {
            font-size: 1.2em;
            font-weight: bold;
            color: #059669;
        }
        .alert {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 0.9em;
            color: #6b7280;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ZOLL TAX FOREX</h1>
        <p>Système de Gestion Financière</p>
    </div>
    <div class="content">
        <h2>🔔 Nouvelle Transaction Créée</h2>
        <p>Une nouvelle transaction a été créée par un caissier et nécessite votre validation.</p>
        
        <div class="alert">
            <strong>Action requise:</strong> Cette transaction est en attente de validation par un auditeur.
        </div>
        
        <div class="transaction-details">
            <h3>Détails de la Transaction</h3>
            <div class="detail-row">
                <span class="detail-label">ID Transaction:</span>
                <span class="detail-value">${testTransaction.id}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="detail-value">${testTransaction.type}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Montant:</span>
                <span class="detail-value amount">${testTransaction.amount.toLocaleString()} ${testTransaction.currency}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${testTransaction.description}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Créé par:</span>
                <span class="detail-value">${testTransaction.createdBy}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Agence:</span>
                <span class="detail-value">${testTransaction.agency}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Statut:</span>
                <span class="detail-value">${testTransaction.status}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${new Date(testTransaction.createdAt).toLocaleString('fr-FR')}</span>
            </div>
        </div>
        
        <p><strong>Prochaines étapes:</strong></p>
        <ul>
            <li>Connectez-vous au système ZOLL TAX FOREX</li>
            <li>Accédez à la section "Opérations"</li>
            <li>Validez ou rejetez cette transaction</li>
        </ul>
        
        <div class="footer">
            <p>Cet email a été généré automatiquement par le système ZOLL TAX FOREX.</p>
            <p>© 2025 ZOLL TAX FOREX - Tous droits réservés</p>
        </div>
    </div>
</body>
</html>
    `
    
    // Options de l'email
    const mailOptions = {
      from: `${fromName} <${fromEmail}>`,
      to: recipients.to.join(', '),
      cc: recipients.cc.join(', '),
      subject: `[ZOLL TAX FOREX] Nouvelle transaction créée - ${testTransaction.id}`,
      html: htmlContent,
      text: `
Nouvelle Transaction Créée - ZOLL TAX FOREX

ID Transaction: ${testTransaction.id}
Type: ${testTransaction.type}
Montant: ${testTransaction.amount.toLocaleString()} ${testTransaction.currency}
Description: ${testTransaction.description}
Créé par: ${testTransaction.createdBy}
Agence: ${testTransaction.agency}
Statut: ${testTransaction.status}
Date: ${new Date(testTransaction.createdAt).toLocaleString('fr-FR')}

Action requise: Cette transaction est en attente de validation par un auditeur.

Prochaines étapes:
1. Connectez-vous au système ZOLL TAX FOREX
2. Accédez à la section "Opérations"
3. Validez ou rejetez cette transaction

© 2025 ZOLL TAX FOREX - Tous droits réservés
      `
    }
    
    // Envoyer l'email
    console.log('\n📤 Envoi de l\'email...')
    console.log('   - À:', recipients.to.join(', '))
    console.log('   - CC:', recipients.cc.join(', '))
    console.log('   - Sujet:', mailOptions.subject)
    
    const info = await transporter.sendMail(mailOptions)
    
    console.log('✅ Email envoyé avec succès!')
    console.log('   - Message ID:', info.messageId)
    console.log('   - Response:', info.response)
    
    console.log('\n🎉 Test d\'envoi d\'email terminé avec succès!')
    console.log('📧 Vérifiez les boîtes de réception des destinataires.')
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error.message)
    if (error.code) {
      console.error('   - Code d\'erreur:', error.code)
    }
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
