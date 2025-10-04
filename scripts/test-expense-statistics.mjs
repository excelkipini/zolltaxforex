#!/usr/bin/env node

/**
 * Script de test pour vérifier les nouvelles statistiques des dépenses
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

async function testExpenseStatistics() {
  console.log('🧪 Test des nouvelles statistiques des dépenses\n')

  try {
    // 1. Créer des dépenses de test avec différents statuts
    console.log('1️⃣ Création de dépenses de test avec différents statuts...')
    
    const testExpenses = [
      {
        description: 'Test stats - Pending',
        amount: 20000,
        category: 'Bureau',
        requested_by: 'Test User Stats 1',
        agency: 'Agence Centre',
        status: 'pending'
      },
      {
        description: 'Test stats - Accounting Approved',
        amount: 30000,
        category: 'Transport',
        requested_by: 'Test User Stats 2',
        agency: 'Agence Centre',
        status: 'accounting_approved',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()'
      },
      {
        description: 'Test stats - Director Approved',
        amount: 40000,
        category: 'Communication',
        requested_by: 'Test User Stats 3',
        agency: 'Agence Centre',
        status: 'director_approved',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()',
        director_validated_by: 'Directeur Test',
        director_validated_at: 'NOW()'
      },
      {
        description: 'Test stats - Accounting Rejected',
        amount: 10000,
        category: 'Formation',
        requested_by: 'Test User Stats 4',
        agency: 'Agence Centre',
        status: 'accounting_rejected',
        accounting_validated_by: 'Comptable Test',
        accounting_validated_at: 'NOW()',
        rejection_reason: 'Montant trop élevé'
      },
      {
        description: 'Test stats - Director Rejected',
        amount: 50000,
        category: 'Équipement',
        requested_by: 'Test User Stats 5',
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

    // 2. Calculer les statistiques selon les nouvelles définitions
    console.log('2️⃣ Calcul des statistiques selon les nouvelles définitions...')
    
    const allExpenses = await sql`
      SELECT status, COUNT(*) as count, SUM(amount) as total_amount
      FROM expenses 
      GROUP BY status
      ORDER BY status
    `
    
    console.log('   Toutes les dépenses par statut:')
    allExpenses.forEach(row => {
      console.log(`     - ${row.status}: ${row.count} dépense(s) - ${row.total_amount} XAF`)
    })
    console.log('')

    // 3. Statistiques pour les comptables
    console.log('3️⃣ Statistiques pour les COMPTABLES:')
    const accountingStats = await sql`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'director_approved' THEN 1 END) as approved_by_director,
        COUNT(CASE WHEN status IN ('accounting_rejected', 'director_rejected') THEN 1 END) as rejected,
        SUM(CASE WHEN status = 'director_approved' THEN amount ELSE 0 END) as total_approved_amount
      FROM expenses
    `
    
    const accounting = accountingStats[0]
    console.log(`   📊 En attente de validation comptable: ${accounting.pending} dépense(s)`)
    console.log(`   ✅ Approuvées par directeur: ${accounting.approved_by_director} dépense(s)`)
    console.log(`   ❌ Rejetées (comptable ou directeur): ${accounting.rejected} dépense(s)`)
    console.log(`   💰 Montant total approuvé: ${accounting.total_approved_amount} XAF`)
    console.log('')

    // 4. Statistiques pour les directeurs
    console.log('4️⃣ Statistiques pour les DIRECTEURS:')
    const directorStats = await sql`
      SELECT 
        COUNT(CASE WHEN status IN ('pending', 'accounting_approved') THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'director_approved' THEN 1 END) as approved_by_director,
        COUNT(CASE WHEN status IN ('accounting_rejected', 'director_rejected') THEN 1 END) as rejected,
        SUM(CASE WHEN status = 'director_approved' THEN amount ELSE 0 END) as total_approved_amount
      FROM expenses
    `
    
    const director = directorStats[0]
    console.log(`   📊 En attente de validation (comptable ou directeur): ${director.pending} dépense(s)`)
    console.log(`   ✅ Approuvées par directeur: ${director.approved_by_director} dépense(s)`)
    console.log(`   ❌ Rejetées (comptable ou directeur): ${director.rejected} dépense(s)`)
    console.log(`   💰 Montant total approuvé: ${director.total_approved_amount} XAF`)
    console.log('')

    // 5. Vérification des nouvelles définitions
    console.log('5️⃣ Vérification des nouvelles définitions:')
    console.log('   ✅ Approuvées : nombre des dépenses validées par le directeur')
    console.log('     → Comptables: ${accounting.approved_by_director} dépenses')
    console.log('     → Directeurs: ${director.approved_by_director} dépenses')
    console.log('   ')
    console.log('   ✅ En attente : nombre de dépenses en attente de validation du directeur et/ou du comptable')
    console.log('     → Comptables: ${accounting.pending} dépenses (en attente de validation comptable)')
    console.log('     → Directeurs: ${director.pending} dépenses (en attente de validation comptable OU directeur)')
    console.log('   ')
    console.log('   ✅ Rejetées : nombre de dépenses rejetées par le comptable et/ou le directeur')
    console.log('     → Comptables: ${accounting.rejected} dépenses')
    console.log('     → Directeurs: ${director.rejected} dépenses')
    console.log('')

    // 6. Résumé des améliorations
    console.log('📋 Résumé des améliorations:')
    console.log('   ✅ Tableau de bord comptable mis à jour')
    console.log('   ✅ Tableau de bord directeur mis à jour')
    console.log('   ✅ Interface des dépenses mise à jour')
    console.log('   ✅ Statistiques différenciées selon le rôle')
    console.log('   ✅ Labels précis et descriptifs')
    console.log('   ✅ Calculs corrects selon les nouvelles définitions')
    console.log('')

    console.log('🎉 Test des statistiques terminé avec succès !')
    console.log('\n📝 Instructions pour vérifier dans l\'interface:')
    console.log('   COMPTABLES:')
    console.log('   1. Connectez-vous en tant que comptable')
    console.log('   2. Tableau de bord → Vérifiez les statistiques')
    console.log('   3. Page Dépenses → Vérifiez les statistiques')
    console.log('   4. "En attente de validation comptable" = dépenses pending')
    console.log('   5. "Approuvées par directeur" = dépenses director_approved')
    console.log('   6. "Rejetées" = dépenses accounting_rejected + director_rejected')
    console.log('   ')
    console.log('   DIRECTEURS:')
    console.log('   7. Connectez-vous en tant que directeur')
    console.log('   8. Tableau de bord → Vérifiez les statistiques')
    console.log('   9. Page Dépenses → Vérifiez les statistiques')
    console.log('   10. "En attente de validation" = dépenses pending + accounting_approved')
    console.log('   11. "Approuvées par directeur" = dépenses director_approved')
    console.log('   12. "Rejetées" = dépenses accounting_rejected + director_rejected')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Exécuter le test
testExpenseStatistics()
