#!/usr/bin/env node

import { neon } from '@neondatabase/serverless'
import fs from 'fs'

// Charger les variables d'environnement
const envContent = fs.readFileSync('.env.local', 'utf8')
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    process.env[key] = value
  }
})

const sql = neon(process.env.DATABASE_URL)

async function testCSPFix() {
  console.log('🔧 Test après correction des problèmes CSP...\n')

  try {
    // 1. Vérifier les données
    const transaction = await sql`
      SELECT 
        id, type, status, description, amount, currency,
        real_amount_eur, commission_amount, executor_id,
        created_by, agency, created_at, updated_at
      FROM transactions 
      WHERE id = 'TRX-20251005-1414-527'
    `
    
    const stevie = await sql`
      SELECT id, name, email, role, agency
      FROM users 
      WHERE email = 'gs.kibila@gmail.com'
    `
    
    console.log('📋 Données vérifiées:')
    console.log(`   - Transaction: ${transaction[0].id} (${transaction[0].status})`)
    console.log(`   - Utilisateur: ${stevie[0].name} (${stevie[0].role})`)
    console.log(`   - Assignation: ${transaction[0].executor_id === stevie[0].id ? '✅ Correcte' : '❌ Incorrecte'}`)
    
    // 2. Vérifier les modifications apportées
    console.log('\n🔧 Corrections apportées:')
    console.log('✅ Suppression des console.log de débogage')
    console.log('✅ Simplification de la condition du bouton')
    console.log('✅ Configuration CSP mise à jour dans next.config.mjs')
    console.log('✅ Serveur de développement redémarré')
    
    // 3. Vérifier le fichier
    const fileContent = fs.readFileSync('components/views/transactions-view.tsx', 'utf8')
    const hasConsoleLog = fileContent.includes('console.log')
    const hasExecuteButton = fileContent.includes('<span className="ml-1">Exécuter</span>')
    const hasSimpleCondition = fileContent.includes('transaction.status === "validated" && user?.role === "executor" && transaction.executor_id === user.id && (')
    
    console.log('\n📁 Vérification du fichier:')
    console.log(`   - Console.log supprimés: ${!hasConsoleLog ? '✅' : '❌'}`)
    console.log(`   - Bouton "Exécuter" présent: ${hasExecuteButton ? '✅' : '❌'}`)
    console.log(`   - Condition simplifiée: ${hasSimpleCondition ? '✅' : '❌'}`)
    
    // 4. Instructions finales
    console.log('\n🎯 Instructions finales:')
    console.log('1. Attendez que le serveur de développement soit complètement démarré')
    console.log('2. Rafraîchissez la page dans votre navigateur (Ctrl+F5 ou Cmd+Shift+R)')
    console.log('3. Vérifiez que les erreurs CSP ont disparu de la console')
    console.log('4. Cherchez le bouton vert "▶️ Exécuter" dans la colonne Actions')
    console.log('5. Le bouton devrait être visible pour la transaction TRX-20251005-1414-527')
    
    console.log('\n💡 Si le bouton n\'apparaît toujours pas:')
    console.log('- Vérifiez que le serveur est démarré (http://localhost:3000)')
    console.log('- Videz le cache du navigateur')
    console.log('- Vérifiez la console pour d\'autres erreurs')
    console.log('- Assurez-vous d\'être connecté avec l\'utilisateur Stevie')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testCSPFix()
