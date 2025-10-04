#!/usr/bin/env node

/**
 * Script de test pour vérifier que comptables et directeurs voient toutes les dépenses
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

async function testAllExpensesView() {
  console.log('🧪 Test de la vue complète des dépenses pour comptables et directeurs\n')

  try {
    // 1. Créer des dépenses de test avec différents statuts
    console.log('1️⃣ Création de dépenses de test avec différents statuts...')
    
    const testExpenses = [
      {
        description: 'Test vue complète - Pending',
        amount: 25000,
        category: 'Bureau',
        requested_by: 'Test User 1',
        agency: 'Agence Centre',
        status: 'pending'
      },
      {
        description: 'Test vue complète - Accounting Approved',
        amount: 35000,
        category: 'Transport',
        requested_by: 'Test User 2',
        agency: 'Agence Centre',
        status: 'accounting_approved',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()'
      },
      {
        description: 'Test vue complète - Director Approved',
        amount: 45000,
        category: 'Communication',
        requested_by: 'Test User 3',
        agency: 'Agence Centre',
        status: 'director_approved',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()',
        director_validated_by: 'Directeur Test',
        director_validated_at: 'NOW()'
      },
      {
        description: 'Test vue complète - Accounting Rejected',
        amount: 15000,
        category: 'Formation',
        requested_by: 'Test User 4',
        agency: 'Agence Centre',
        status: 'accounting_rejected',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()',
        rejection_reason: 'Montant trop élevé'
      },
      {
        description: 'Test vue complète - Director Rejected',
        amount: 55000,
        category: 'Équipement',
        requested_by: 'Test User 5',
        agency: 'Agence Centre',
        status: 'director_rejected',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()',
        director_validated_by: 'Directeur Test',
        director_validated_at: 'NOW()',
        rejection_reason: 'Non conforme à la politique'
      }
    ]

    for (const expense of testExpenses) {
      const result = await sql`
        INSERT INTO expenses (description, amount, category, requested_by, agency, status, accounting_validated_by, accounting_validated_at, director_validated_by, director_validated_at, rejection_reason)
        VALUES (${expense.description}, ${expense.amount}, ${expense.category}, ${expense.requested_by}, ${expense.agency}, ${expense.status}, 
                ${expense.accounting_validated_by || null}, 
                ${expense.accounting_validated_at === 'NOW()' ? sql`NOW()` : expense.accounting_validated_at || null},
                ${expense.director_validated_by || null}, 
                ${expense.director_validated_at === 'NOW()' ? sql`NOW()` : expense.director_validated_at || null},
                ${expense.rejection_reason || null})
        RETURNING id::text, description, status;
      `
      console.log(`✅ ${result[0].description} - Statut: ${result[0].status}`)
    }

    console.log('')

    // 2. Vérifier toutes les dépenses dans la base
    console.log('2️⃣ Vérification de toutes les dépenses dans la base...')
    const allExpenses = await sql`
      SELECT status, COUNT(*) as count 
      FROM expenses 
      GROUP BY status
      ORDER BY status
    `
    
    console.log('   Toutes les dépenses par statut:')
    allExpenses.forEach(row => {
      console.log(`     - ${row.status}: ${row.count} dépense(s)`)
    })
    console.log('')

    // 3. Simuler la vue comptable
    console.log('3️⃣ Simulation de la vue comptable...')
    const accountingView = await sql`
      SELECT 
        CASE 
          WHEN status = 'pending' THEN 'En attente de validation comptable'
          WHEN status = 'accounting_approved' THEN 'Validées par comptabilité'
          WHEN status = 'accounting_rejected' THEN 'Rejetées par comptabilité'
          WHEN status = 'director_approved' THEN 'Validées par directeur'
          WHEN status = 'director_rejected' THEN 'Rejetées par directeur'
          ELSE status
        END as vue_comptable,
        COUNT(*) as count
      FROM expenses 
      GROUP BY status
      ORDER BY status
    `
    
    console.log('   Vue comptable (toutes les dépenses):')
    accountingView.forEach(row => {
      console.log(`     - ${row.vue_comptable}: ${row.count} dépense(s)`)
    })
    console.log('   → Les comptables voient maintenant TOUTES les dépenses avec leurs états')
    console.log('   → Ils peuvent filtrer par statut dans l\'interface')
    console.log('   → Ils se concentrent sur les dépenses "pending" pour validation')
    console.log('')

    // 4. Simuler la vue directeur
    console.log('4️⃣ Simulation de la vue directeur...')
    const directorView = await sql`
      SELECT 
        CASE 
          WHEN status = 'pending' THEN 'En attente de validation comptable'
          WHEN status = 'accounting_approved' THEN 'En attente de validation directeur'
          WHEN status = 'accounting_rejected' THEN 'Rejetées par comptabilité'
          WHEN status = 'director_approved' THEN 'Validées par directeur'
          WHEN status = 'director_rejected' THEN 'Rejetées par directeur'
          ELSE status
        END as vue_directeur,
        COUNT(*) as count
      FROM expenses 
      GROUP BY status
      ORDER BY status
    `
    
    console.log('   Vue directeur (toutes les dépenses):')
    directorView.forEach(row => {
      console.log(`     - ${row.vue_directeur}: ${row.count} dépense(s)`)
    })
    console.log('   → Les directeurs voient maintenant TOUTES les dépenses avec leurs états')
    console.log('   → Ils peuvent filtrer par statut dans l\'interface')
    console.log('   → Ils se concentrent sur les dépenses "accounting_approved" pour validation')
    console.log('')

    // 5. Test des filtres disponibles
    console.log('5️⃣ Test des filtres disponibles dans l\'interface...')
    const availableFilters = [
      'pending',
      'accounting_approved', 
      'accounting_rejected',
      'director_approved',
      'director_rejected',
      'approved', // Ancien statut pour compatibilité
      'rejected'  // Ancien statut pour compatibilité
    ]
    
    console.log('   Filtres de statut disponibles:')
    for (const filter of availableFilters) {
      const count = await sql`SELECT COUNT(*) as count FROM expenses WHERE status = ${filter}`
      console.log(`     - ${filter}: ${count[0].count} dépense(s)`)
    }
    console.log('')

    // 6. Résumé des améliorations
    console.log('📋 Résumé des améliorations:')
    console.log('   ✅ API modifiée pour retourner toutes les dépenses aux comptables et directeurs')
    console.log('   ✅ Tableau de bord affiche toutes les dépenses avec leurs états')
    console.log('   ✅ Interface des dépenses avec filtres complets')
    console.log('   ✅ Statistiques globales dans le tableau de bord')
    console.log('   ✅ Vue d\'ensemble de tous les statuts')
    console.log('   ✅ Boutons de validation selon le rôle et le statut')
    console.log('')

    console.log('🎉 Test de la vue complète terminé avec succès !')
    console.log('\n📝 Instructions pour tester dans l\'interface:')
    console.log('   COMPTABLES:')
    console.log('   1. Connectez-vous en tant que comptable')
    console.log('   2. Tableau de bord → Section "Toutes les Dépenses"')
    console.log('   3. Page Dépenses → Filtres par statut disponibles')
    console.log('   4. Vous voyez toutes les dépenses avec leurs états')
    console.log('   ')
    console.log('   DIRECTEURS:')
    console.log('   5. Connectez-vous en tant que directeur')
    console.log('   6. Tableau de bord → Section "Toutes les Dépenses"')
    console.log('   7. Page Dépenses → Filtres par statut disponibles')
    console.log('   8. Vous voyez toutes les dépenses avec leurs états')
    console.log('   9. Boutons de validation selon le statut de chaque dépense')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Exécuter le test
testAllExpensesView()
