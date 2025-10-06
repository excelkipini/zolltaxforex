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

async function testExecuteButtonVisibility() {
  console.log('🧪 Test de visibilité du bouton "Exécuter" avec texte...\n')

  try {
    // 1. Vérifier la transaction spécifique
    const transaction = await sql`
      SELECT 
        id, type, status, description, amount, currency,
        real_amount_eur, commission_amount, executor_id,
        created_by, agency, created_at, updated_at
      FROM transactions 
      WHERE id = 'TRX-20251005-1414-527'
    `
    
    console.log('📋 Transaction TRX-20251005-1414-527:')
    console.log(`   - Statut: ${transaction[0].status}`)
    console.log(`   - Exécuteur assigné: ${transaction[0].executor_id}`)
    console.log(`   - Description: ${transaction[0].description}`)
    
    // 2. Vérifier l'utilisateur Stevie
    const stevie = await sql`
      SELECT id, name, email, role, agency
      FROM users 
      WHERE email = 'gs.kibila@gmail.com'
    `
    
    console.log('\n👤 Utilisateur Stevie:')
    console.log(`   - ID: ${stevie[0].id}`)
    console.log(`   - Rôle: ${stevie[0].role}`)
    
    // 3. Vérifier les conditions
    const tx = transaction[0]
    const user = stevie[0]
    
    console.log('\n🔗 Conditions d\'affichage:')
    console.log(`   - transaction.status === 'validated': ${tx.status === 'validated' ? '✅' : '❌'}`)
    console.log(`   - user.role === 'executor': ${user.role === 'executor' ? '✅' : '❌'}`)
    console.log(`   - transaction.executor_id === user.id: ${tx.executor_id === user.id ? '✅' : '❌'}`)
    
    const shouldShow = tx.status === 'validated' && user.role === 'executor' && tx.executor_id === user.id
    console.log(`\n🎯 Bouton "Exécuter" devrait être visible: ${shouldShow ? '✅ OUI' : '❌ NON'}`)
    
    if (shouldShow) {
      console.log('\n📱 Interface attendue dans l\'onglet Opérations:')
      console.log(`   - Transaction: ${tx.id}`)
      console.log(`   - Description: ${tx.description}`)
      console.log(`   - Statut: ${tx.status}`)
      console.log(`   - Actions: [👁️ Détails] [▶️ Exécuter] [🖨️ Imprimer]`)
      console.log(`   - Bouton "Exécuter":`)
      console.log(`     • Icône: Play (▶️)`)
      console.log(`     • Texte: "Exécuter"`)
      console.log(`     • Couleur: Vert (text-green-600)`)
      console.log(`     • Tooltip: "Exécuter la transaction"`)
      console.log(`     • Action: Ouvre le dialog d'upload de fichier`)
    }

    // 4. Instructions pour l'utilisateur
    console.log('\n📋 Instructions pour voir le bouton:')
    console.log('1. 🔄 Rafraîchir la page (Ctrl+F5 ou Cmd+Shift+R)')
    console.log('2. 🔄 Vider le cache du navigateur')
    console.log('3. 🔄 Redémarrer le serveur de développement si nécessaire')
    console.log('4. 👀 Chercher le bouton vert avec l\'icône ▶️ et le texte "Exécuter"')
    console.log('5. 📍 Le bouton devrait être dans la colonne "Actions" de la ligne TRX-20251005-1414-527')

    // 5. Vérifier les autres transactions
    console.log('\n📊 Autres transactions dans la liste:')
    const allTransactions = await sql`
      SELECT id, status, executor_id, description
      FROM transactions 
      WHERE type = 'transfer'
      ORDER BY created_at DESC
      LIMIT 6
    `
    
    allTransactions.forEach(tx => {
      const hasExecutor = tx.executor_id !== null
      const isAssignedToStevie = tx.executor_id === stevie[0].id
      const canExecute = tx.status === 'validated' && hasExecutor && isAssignedToStevie
      
      console.log(`   - ${tx.id}: ${tx.status} ${canExecute ? '✅ [BOUTON EXÉCUTER]' : '❌ [PAS DE BOUTON]'}`)
    })

    console.log('\n🎉 Test terminé!')
    console.log('\n💡 Si le bouton n\'apparaît toujours pas:')
    console.log('   - Vérifiez que le serveur de développement est redémarré')
    console.log('   - Videz le cache du navigateur')
    console.log('   - Vérifiez la console du navigateur pour des erreurs JavaScript')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testExecuteButtonVisibility()
