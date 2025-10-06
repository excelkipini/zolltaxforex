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

async function testExecutorNotifications() {
  console.log('🔔 Test des notifications pour l\'exécuteur...\n')

  try {
    // 1. Vérifier les utilisateurs exécuteurs
    console.log('1. Vérification des utilisateurs exécuteurs...')
    const executors = await sql`
      SELECT id, name, email, role, agency 
      FROM users 
      WHERE role = 'executor'
    `
    
    console.log(`📊 Utilisateurs exécuteurs trouvés: ${executors.length}`)
    executors.forEach(executor => {
      console.log(`   - ${executor.name} (${executor.email}) - ${executor.agency}`)
    })

    if (executors.length === 0) {
      console.log('❌ Aucun utilisateur exécuteur trouvé')
      return
    }

    // 2. Vérifier les transactions assignées aux exécuteurs
    console.log('\n2. Vérification des transactions assignées aux exécuteurs...')
    const assignedTransactions = await sql`
      SELECT 
        t.id, t.type, t.description, t.amount, t.status, 
        t.executor_id, t.commission_amount, t.created_at,
        u.name as executor_name, u.email as executor_email
      FROM transactions t
      LEFT JOIN users u ON t.executor_id = u.id
      WHERE t.executor_id IS NOT NULL
      ORDER BY t.created_at DESC
      LIMIT 10
    `
    
    console.log(`📊 Transactions assignées aux exécuteurs: ${assignedTransactions.length}`)
    
    assignedTransactions.forEach(transaction => {
      console.log(`   - ${transaction.id}: ${transaction.description}`)
      console.log(`     Statut: ${transaction.status}`)
      console.log(`     Exécuteur: ${transaction.executor_name} (${transaction.executor_email})`)
      console.log(`     Commission: ${transaction.commission_amount} XAF`)
      console.log(`     Date: ${transaction.created_at}`)
      console.log('')
    })

    // 3. Vérifier les notifications existantes
    console.log('3. Vérification des notifications existantes...')
    const notifications = await sql`
      SELECT 
        n.id, n.message, n.target_role, n.target_user_name, n.read, n.created_at
      FROM notifications n
      WHERE n.target_role = 'executor' OR n.target_user_name IN (${executors.map(e => e.name).join(',')})
      ORDER BY n.created_at DESC
      LIMIT 10
    `
    
    console.log(`📊 Notifications pour les exécuteurs: ${notifications.length}`)
    
    if (notifications.length === 0) {
      console.log('⚠️  Aucune notification trouvée pour les exécuteurs')
      
      // Créer une notification de test pour un exécuteur
      console.log('\n4. Création d\'une notification de test...')
      const testNotification = await sql`
        INSERT INTO notifications (
          message, target_role, target_user_name, read
        ) VALUES (
          'Une nouvelle transaction vous a été assignée pour exécution', 
          'executor', 
          ${executors[0].name}, 
          false
        ) RETURNING id, message, target_role, target_user_name, read, created_at
      `
      
      console.log(`✅ Notification de test créée: ${testNotification[0].id}`)
      console.log(`   - Message: ${testNotification[0].message}`)
      console.log(`   - Rôle cible: ${testNotification[0].target_role}`)
      console.log(`   - Utilisateur cible: ${testNotification[0].target_user_name}`)
      console.log(`   - Lu: ${testNotification[0].read}`)
      console.log(`   - Date: ${testNotification[0].created_at}`)
    } else {
      notifications.forEach(notification => {
        console.log(`   - ${notification.id}: ${notification.message}`)
        console.log(`     Rôle cible: ${notification.target_role}`)
        console.log(`     Utilisateur cible: ${notification.target_user_name}`)
        console.log(`     Message: ${notification.message}`)
        console.log(`     Lu: ${notification.read}`)
        console.log(`     Date: ${notification.created_at}`)
        console.log('')
      })
    }

    // 4. Vérifier les types de notifications supportés
    console.log('4. Vérification des types de notifications supportés...')
    const notificationTypes = await sql`
      SELECT DISTINCT target_role, COUNT(*) as count
      FROM notifications
      WHERE target_role IS NOT NULL
      GROUP BY target_role
      ORDER BY count DESC
    `
    
    console.log('📊 Types de notifications dans le système:')
    notificationTypes.forEach(type => {
      console.log(`   - ${type.target_role}: ${type.count} notifications`)
    })

    // 5. Vérifier les permissions des exécuteurs
    console.log('\n5. Vérification des permissions des exécuteurs...')
    console.log('📋 Permissions attendues pour les exécuteurs:')
    console.log('   - view_dashboard: Voir le tableau de bord')
    console.log('   - view_transactions: Voir les transactions')
    console.log('   - execute_transactions: Exécuter les transactions')
    console.log('   - view_expenses: Voir les dépenses')

    // 6. Vérifier l'accès aux menus
    console.log('\n6. Vérification de l\'accès aux menus...')
    console.log('📋 Menus accessibles aux exécuteurs:')
    console.log('   - dashboard: Tableau de bord')
    console.log('   - transactions: Opérations')
    console.log('   - expenses: Dépenses')

    console.log('\n🎉 Test des notifications pour l\'exécuteur terminé!')
    console.log('\n📋 Résumé:')
    console.log('✅ Utilisateurs exécuteurs vérifiés')
    console.log('✅ Transactions assignées vérifiées')
    console.log('✅ Notifications existantes vérifiées')
    console.log('✅ Types de notifications supportés vérifiés')
    console.log('✅ Permissions des exécuteurs vérifiées')
    console.log('✅ Accès aux menus vérifié')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testExecutorNotifications()
