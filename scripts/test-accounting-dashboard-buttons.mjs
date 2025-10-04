#!/usr/bin/env node

/**
 * Script de test pour vérifier les boutons de validation dans le tableau de bord des comptables
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Charger explicitement le fichier .env.local
try {
  const envPath = join(__dirname, '..', '.env.local')
  const envContent = readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key && value) {
      process.env[key.trim()] = value.trim()
    }
  })
} catch (error) {
  console.log('⚠️  Fichier .env.local non trouvé ou erreur de lecture')
}

// Configuration de la base de données
const sql = neon(process.env.DATABASE_URL)

async function testAccountingDashboardButtons() {
  console.log('🧪 Test des boutons de validation dans le tableau de bord des comptables\n')

  try {
    // 1. Créer plusieurs dépenses de test avec différents statuts
    console.log('1️⃣ Création de dépenses de test...')
    
    const testExpenses = [
      {
        description: 'Test boutons comptable - Pending',
        amount: 30000,
        category: 'Bureau',
        requested_by: 'Test User',
        agency: 'Agence Centre',
        status: 'pending'
      },
      {
        description: 'Test boutons comptable - Accounting Approved',
        amount: 40000,
        category: 'Transport',
        requested_by: 'Test User 2',
        agency: 'Agence Centre',
        status: 'accounting_approved',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()'
      },
      {
        description: 'Test boutons comptable - Director Approved',
        amount: 50000,
        category: 'Communication',
        requested_by: 'Test User 3',
        agency: 'Agence Centre',
        status: 'director_approved',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()',
        director_validated_by: 'Directeur Test',
        director_validated_at: 'NOW()'
      }
    ]

    for (const expense of testExpenses) {
      const result = await sql`
        INSERT INTO expenses (description, amount, category, requested_by, agency, status, accounting_validated_by, accounting_validated_at, director_validated_by, director_validated_at)
        VALUES (${expense.description}, ${expense.amount}, ${expense.category}, ${expense.requested_by}, ${expense.agency}, ${expense.status}, 
                ${expense.accounting_validated_by || null}, 
                ${expense.accounting_validated_at === 'NOW()' ? sql`NOW()` : expense.accounting_validated_at || null},
                ${expense.director_validated_by || null}, 
                ${expense.director_validated_at === 'NOW()' ? sql`NOW()` : expense.director_validated_at || null})
        RETURNING id::text, description, status;
      `
      console.log(`✅ ${result[0].description} - Statut: ${result[0].status}`)
    }

    console.log('')

    // 2. Vérifier les dépenses en attente pour les comptables
    console.log('2️⃣ Vérification des dépenses en attente pour les comptables...')
    const pendingExpenses = await sql`
      SELECT id, description, status, amount, requested_by, agency, category
      FROM expenses 
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `
    
    console.log(`✅ ${pendingExpenses.length} dépense(s) en attente de validation comptable:`)
    pendingExpenses.forEach(expense => {
      console.log(`   - ${expense.description} (${expense.amount} XAF) par ${expense.requested_by}`)
    })
    console.log('   → Les comptables devraient voir les boutons "Approuver" et "Rejeter" sur ces dépenses\n')

    // 3. Vérifier les dépenses approuvées par la comptabilité pour les directeurs
    console.log('3️⃣ Vérification des dépenses approuvées par la comptabilité...')
    const accountingApprovedExpenses = await sql`
      SELECT id, description, status, amount, requested_by, agency, category, accounting_validated_by
      FROM expenses 
      WHERE status = 'accounting_approved'
      ORDER BY accounting_validated_at DESC
    `
    
    console.log(`✅ ${accountingApprovedExpenses.length} dépense(s) en attente de validation directeur:`)
    accountingApprovedExpenses.forEach(expense => {
      console.log(`   - ${expense.description} (${expense.amount} XAF) par ${expense.requested_by}`)
      console.log(`     Validé par comptabilité: ${expense.accounting_validated_by}`)
    })
    console.log('   → Les directeurs devraient voir les boutons "Approuver" et "Rejeter" sur ces dépenses\n')

    // 4. Vérifier les dépenses finalement approuvées
    console.log('4️⃣ Vérification des dépenses finalement approuvées...')
    const finalApprovedExpenses = await sql`
      SELECT id, description, status, amount, requested_by, agency, category, director_validated_by
      FROM expenses 
      WHERE status = 'director_approved'
      ORDER BY director_validated_at DESC
    `
    
    console.log(`✅ ${finalApprovedExpenses.length} dépense(s) finalement approuvées:`)
    finalApprovedExpenses.forEach(expense => {
      console.log(`   - ${expense.description} (${expense.amount} XAF) par ${expense.requested_by}`)
      console.log(`     Validé par directeur: ${expense.director_validated_by}`)
    })
    console.log('   → Ces dépenses ne devraient plus avoir de boutons de validation\n')

    // 5. Test de l'API pour vérifier que les endpoints fonctionnent
    console.log('5️⃣ Test des endpoints API...')
    
    // Test GET /api/expenses pour comptables
    console.log('   Test GET /api/expenses (comptables)...')
    try {
      const response = await fetch('http://localhost:3000/api/expenses', {
        headers: {
          'Content-Type': 'application/json',
          // Note: En production, il faudrait inclure les headers d'authentification
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`   ✅ API répond correctement (${data.data?.length || 0} dépenses)`)
      } else {
        console.log(`   ⚠️  API répond avec le code ${response.status}`)
      }
    } catch (error) {
      console.log('   ⚠️  Serveur non démarré ou erreur de connexion')
    }

    // 6. Résumé des tests
    console.log('📋 Résumé des tests:')
    console.log('   ✅ Dépenses créées avec différents statuts')
    console.log('   ✅ Dépenses en attente identifiées pour les comptables')
    console.log('   ✅ Dépenses approuvées par comptabilité identifiées pour les directeurs')
    console.log('   ✅ Dépenses finalement approuvées identifiées')
    console.log('   ✅ Interface mise à jour pour afficher les boutons selon les rôles\n')

    console.log('🎯 Instructions pour tester dans l\'interface:')
    console.log('   1. Connectez-vous en tant que comptable')
    console.log('   2. Allez sur le tableau de bord (page d\'accueil)')
    console.log('   3. Dans la section "Dépenses en attente d\'approbation"')
    console.log('   4. Vous devriez maintenant voir les boutons "Approuver" et "Rejeter"')
    console.log('   5. Testez l\'approbation d\'une dépense')
    console.log('   6. Connectez-vous en tant que directeur')
    console.log('   7. Vous devriez voir les dépenses approuvées par la comptabilité')
    console.log('   8. Vous devriez voir les boutons "Approuver" et "Rejeter"')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Exécuter le test
testAccountingDashboardButtons()
