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

async function debugComponentReload() {
  console.log('🔍 Diagnostic du rechargement du composant TransactionsView...\n')

  try {
    // 1. Vérifier les données de la transaction
    const transaction = await sql`
      SELECT 
        id, type, status, description, amount, currency,
        real_amount_eur, commission_amount, executor_id,
        created_by, agency, created_at, updated_at
      FROM transactions 
      WHERE id = 'TRX-20251005-1414-527'
    `
    
    console.log('📋 Données de la transaction:')
    console.log(`   - ID: ${transaction[0].id}`)
    console.log(`   - Statut: ${transaction[0].status}`)
    console.log(`   - Exécuteur ID: ${transaction[0].executor_id}`)
    
    // 2. Vérifier l'utilisateur
    const stevie = await sql`
      SELECT id, name, email, role, agency
      FROM users 
      WHERE email = 'gs.kibila@gmail.com'
    `
    
    console.log('\n👤 Données de l\'utilisateur:')
    console.log(`   - ID: ${stevie[0].id}`)
    console.log(`   - Rôle: ${stevie[0].role}`)
    console.log(`   - Email: ${stevie[0].email}`)
    
    // 3. Vérifier les conditions
    const tx = transaction[0]
    const user = stevie[0]
    
    console.log('\n🔗 Évaluation des conditions:')
    console.log(`   - transaction.status === "validated": ${tx.status === "validated"}`)
    console.log(`   - user.role === "executor": ${user.role === "executor"}`)
    console.log(`   - transaction.executor_id === user.id: ${tx.executor_id === user.id}`)
    
    const shouldShow = tx.status === "validated" && user.role === "executor" && tx.executor_id === user.id
    console.log(`   - Résultat final: ${shouldShow}`)
    
    // 4. Instructions de débogage
    console.log('\n🛠️ Instructions de débogage:')
    console.log('1. Ouvrez la console du navigateur (F12)')
    console.log('2. Rafraîchissez la page (Ctrl+F5 ou Cmd+Shift+R)')
    console.log('3. Cherchez les messages de console:')
    console.log('   - "🔄 TransactionsView rechargé - User: executor gs.kibila@gmail.com"')
    console.log('   - "🔍 Transaction TRX-20251005-1414-527: status=validated, userRole=executor, executorId=476b0a62-56e2-4d6f-b5d0-87047fd4afc9, userId=476b0a62-56e2-4d6f-b5d0-87047fd4afc9, shouldShow=true"')
    
    if (shouldShow) {
      console.log('\n✅ Le bouton DEVRAIT apparaître!')
      console.log('Si vous ne le voyez pas:')
      console.log('- Vérifiez la console pour les messages de débogage')
      console.log('- Assurez-vous que le serveur de développement est en cours d\'exécution')
      console.log('- Videz le cache du navigateur')
    } else {
      console.log('\n❌ Le bouton ne devrait PAS apparaître')
      console.log('Vérifiez les conditions ci-dessus')
    }

    // 5. Vérifier le fichier modifié
    console.log('\n📁 Vérification du fichier:')
    const fileContent = fs.readFileSync('components/views/transactions-view.tsx', 'utf8')
    const hasConsoleLog = fileContent.includes('console.log(\'🔄 TransactionsView rechargé')
    const hasExecuteButton = fileContent.includes('<span className="ml-1">Exécuter</span>')
    const hasDebugLog = fileContent.includes('console.log(`🔍 Transaction')
    
    console.log(`   - Console.log de rechargement: ${hasConsoleLog ? '✅' : '❌'}`)
    console.log(`   - Bouton avec texte "Exécuter": ${hasExecuteButton ? '✅' : '❌'}`)
    console.log(`   - Console.log de débogage: ${hasDebugLog ? '✅' : '❌'}`)

  } catch (error) {
    console.error('❌ Erreur lors du diagnostic:', error)
  }
}

debugComponentReload()
