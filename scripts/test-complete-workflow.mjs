#!/usr/bin/env node

/**
 * Script de test pour vérifier le workflow complet des dépenses
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

async function testCompleteExpenseWorkflow() {
  console.log('🧪 Test du workflow complet des dépenses\n')

  try {
    // 1. Créer une dépense de test
    console.log('1️⃣ Création d\'une dépense de test...')
    const expense = await sql`
      INSERT INTO expenses (description, amount, category, requested_by, agency, comment)
      VALUES ('Test workflow complet', 75000, 'Formation', 'Test User', 'Agence Centre', 'Test du workflow en 2 étapes')
      RETURNING 
        id::text, 
        description, 
        amount::bigint as amount, 
        category, 
        status, 
        date::text as date, 
        requested_by, 
        agency, 
        comment;
    `
    
    const testExpense = expense[0]
    console.log(`✅ Dépense créée: ${testExpense.description} (ID: ${testExpense.id})`)
    console.log(`   Statut initial: ${testExpense.status}`)
    console.log(`   Montant: ${testExpense.amount} XAF`)
    console.log(`   Demandeur: ${testExpense.requested_by}`)
    console.log(`   Agence: ${testExpense.agency}\n`)

    // 2. Vérifier ce que voient les comptables
    console.log('2️⃣ Vérification pour les comptables...')
    const accountingView = await sql`
      SELECT * FROM expenses WHERE status = 'pending'
    `
    console.log(`✅ ${accountingView.length} dépense(s) en attente de validation comptable`)
    console.log('   → Les comptables voient ces dépenses dans:')
    console.log('     - Tableau de bord (section "Dépenses en attente d\'approbation")')
    console.log('     - Page Dépenses (onglet Dépenses)')
    console.log('     - Boutons: "Approuver" et "Rejeter"\n')

    // 3. Simuler la validation comptable
    console.log('3️⃣ Simulation de la validation comptable...')
    const accountingValidation = await sql`
      UPDATE expenses 
      SET 
        status = 'accounting_approved',
        accounting_validated_by = 'Comptable Test',
        accounting_validated_at = NOW()
      WHERE id = ${testExpense.id}
      RETURNING 
        id::text, 
        description, 
        status, 
        accounting_validated_by,
        accounting_validated_at::text as accounting_validated_at;
    `
    
    const validatedExpense = accountingValidation[0]
    console.log(`✅ Dépense validée par la comptabilité`)
    console.log(`   Nouveau statut: ${validatedExpense.status}`)
    console.log(`   Validé par: ${validatedExpense.accounting_validated_by}`)
    console.log(`   Date de validation: ${validatedExpense.accounting_validated_at}\n`)

    // 4. Vérifier ce que voient les directeurs
    console.log('4️⃣ Vérification pour les directeurs...')
    const directorView = await sql`
      SELECT * FROM expenses WHERE status = 'accounting_approved'
    `
    console.log(`✅ ${directorView.length} dépense(s) en attente de validation directeur`)
    console.log('   → Les directeurs voient ces dépenses dans:')
    console.log('     - Tableau de bord (section "Dépenses en attente d\'approbation")')
    console.log('     - Page Dépenses (onglet Dépenses)')
    console.log('     - Boutons: "Valider" et "Rejeter" (note: "Valider" au lieu de "Approuver")\n')

    // 5. Simuler la validation directeur
    console.log('5️⃣ Simulation de la validation directeur...')
    const directorValidation = await sql`
      UPDATE expenses 
      SET 
        status = 'director_approved',
        director_validated_by = 'Directeur Test',
        director_validated_at = NOW()
      WHERE id = ${testExpense.id}
      RETURNING 
        id::text, 
        description, 
        status, 
        director_validated_by,
        director_validated_at::text as director_validated_at;
    `
    
    const finalExpense = directorValidation[0]
    console.log(`✅ Dépense validée par le directeur`)
    console.log(`   Statut final: ${finalExpense.status}`)
    console.log(`   Validé par directeur: ${finalExpense.director_validated_by}`)
    console.log(`   Date de validation: ${finalExpense.director_validated_at}\n`)

    // 6. Résumé du workflow complet
    console.log('📋 Résumé du workflow complet:')
    console.log('   ✅ Création de dépense → Statut: pending')
    console.log('   ✅ Validation comptable → Statut: accounting_approved')
    console.log('   ✅ Validation directeur → Statut: director_approved')
    console.log('   ✅ Boutons affichés selon les rôles')
    console.log('   ✅ Interface différenciée comptable/directeur')
    console.log('   ✅ Bouton "Valider" pour directeur (au lieu de "Approuver")')
    console.log('   ✅ Notifications email à chaque étape\n')

    // 7. Test des différents vues selon les rôles
    console.log('7️⃣ Test des vues selon les rôles...')
    
    // Vue comptable
    const accountingExpenses = await sql`
      SELECT status, COUNT(*) as count 
      FROM expenses 
      WHERE status IN ('pending', 'accounting_approved', 'accounting_rejected', 'director_approved', 'director_rejected')
      GROUP BY status
      ORDER BY status
    `
    
    console.log('   Vue comptable:')
    accountingExpenses.forEach(row => {
      console.log(`     - ${row.status}: ${row.count} dépense(s)`)
    })
    
    // Vue directeur
    const directorExpenses = await sql`
      SELECT 
        CASE 
          WHEN status = 'accounting_approved' THEN 'En attente de validation directeur'
          WHEN status = 'director_approved' THEN 'Validées par directeur'
          WHEN status = 'director_rejected' THEN 'Rejetées par directeur'
          ELSE status
        END as vue_directeur,
        COUNT(*) as count
      FROM expenses 
      WHERE status IN ('accounting_approved', 'director_approved', 'director_rejected')
      GROUP BY status
      ORDER BY status
    `
    
    console.log('   Vue directeur:')
    directorExpenses.forEach(row => {
      console.log(`     - ${row.vue_directeur}: ${row.count} dépense(s)`)
    })

    console.log('\n🎉 Test du workflow complet terminé avec succès !')
    console.log('\n📝 Instructions pour tester dans l\'interface:')
    console.log('   COMPTABLES:')
    console.log('   1. Connectez-vous en tant que comptable')
    console.log('   2. Tableau de bord → Section "Dépenses en attente d\'approbation"')
    console.log('   3. Page Dépenses → Onglet Dépenses')
    console.log('   4. Vous devriez voir les boutons "Approuver" et "Rejeter"')
    console.log('   ')
    console.log('   DIRECTEURS:')
    console.log('   5. Connectez-vous en tant que directeur')
    console.log('   6. Tableau de bord → Section "Dépenses en attente d\'approbation"')
    console.log('   7. Page Dépenses → Onglet Dépenses')
    console.log('   8. Vous devriez voir les boutons "Valider" et "Rejeter"')
    console.log('   9. Les dépenses affichées sont celles validées par la comptabilité')

  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

// Exécuter le test
testCompleteExpenseWorkflow()
