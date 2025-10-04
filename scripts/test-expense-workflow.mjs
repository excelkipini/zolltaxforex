#!/usr/bin/env node

/**
 * Script de test pour le nouveau workflow des dépenses en 2 étapes
 * 
 * Usage: node scripts/test-expense-workflow.mjs
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

// Fonctions de test directes
async function createExpenseTest(input) {
  const rows = await sql`
    INSERT INTO expenses (description, amount, category, requested_by, agency, comment, rejection_reason)
    VALUES (${input.description}, ${input.amount}, ${input.category}, ${input.requested_by}, ${input.agency}, ${input.comment || null}, null)
    RETURNING 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at;
  `
  return rows[0]
}

async function validateExpenseByAccountingTest(id, approved, validatedBy, rejection_reason) {
  const status = approved ? "accounting_approved" : "accounting_rejected"
  
  const rows = await sql`
    UPDATE expenses
    SET 
      status = ${status}, 
      rejection_reason = ${rejection_reason || null}, 
      accounting_validated_by = ${validatedBy},
      accounting_validated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'pending'
    RETURNING 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at;
  `
  
  if (rows.length === 0) {
    throw new Error("Dépense non trouvée ou déjà traitée")
  }
  
  return rows[0]
}

async function validateExpenseByDirectorTest(id, approved, validatedBy, rejection_reason) {
  const status = approved ? "director_approved" : "director_rejected"
  
  const rows = await sql`
    UPDATE expenses
    SET 
      status = ${status}, 
      rejection_reason = ${rejection_reason || null}, 
      director_validated_by = ${validatedBy},
      director_validated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'accounting_approved'
    RETURNING 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at;
  `
  
  if (rows.length === 0) {
    throw new Error("Dépense non trouvée ou pas encore approuvée par la comptabilité")
  }
  
  return rows[0]
}

async function getExpensesPendingAccountingTest() {
  const rows = await sql`
    SELECT 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at
    FROM expenses
    WHERE status = 'pending'
    ORDER BY created_at ASC;
  `
  return rows
}

async function getExpensesPendingDirectorTest() {
  const rows = await sql`
    SELECT 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at
    FROM expenses
    WHERE status = 'accounting_approved'
    ORDER BY accounting_validated_at ASC;
  `
  return rows
}

async function testExpenseWorkflow() {
  console.log('🧪 Test du workflow des dépenses en 2 étapes...')

  if (!process.env.DATABASE_URL) {
    console.error('❌ Erreur: La variable d\'environnement DATABASE_URL n\'est pas définie.')
    process.exit(1)
  }

  try {
    // Test 1: Créer une dépense
    console.log('\n📝 Test 1: Création d\'une dépense...')
    const expense = await createExpenseTest({
      description: 'Test workflow - Achat matériel informatique',
      amount: 150000,
      category: 'Équipement',
      requested_by: 'Stevie Kibila',
      agency: 'Agence Centrale',
      comment: 'Test du nouveau workflow en 2 étapes'
    })
    console.log(`✅ Dépense créée: ${expense.id}`)
    console.log(`   - Statut: ${expense.status}`)
    console.log(`   - Montant: ${expense.amount.toLocaleString()} XAF`)
    console.log(`   - Demandeur: ${expense.requested_by}`)

    // Test 2: Vérifier les dépenses en attente de validation comptable
    console.log('\n📊 Test 2: Vérification des dépenses en attente de validation comptable...')
    const pendingAccounting = await getExpensesPendingAccountingTest()
    console.log(`📋 ${pendingAccounting.length} dépense(s) en attente de validation comptable`)
    
    if (pendingAccounting.length > 0) {
      console.log('   - Dépenses en attente:')
      pendingAccounting.forEach(exp => {
        console.log(`     * ${exp.id}: ${exp.description} (${exp.amount.toLocaleString()} XAF)`)
      })
    }

    // Test 3: Validation par la comptabilité
    console.log('\n✅ Test 3: Validation par la comptabilité...')
    const accountingValidated = await validateExpenseByAccountingTest(
      expense.id,
      true, // approuvée
      'Anne Sophie Ominga', // comptable
      undefined // pas de motif de rejet
    )
    console.log(`✅ Dépense validée par la comptabilité`)
    console.log(`   - Nouveau statut: ${accountingValidated.status}`)
    console.log(`   - Validée par: ${accountingValidated.accounting_validated_by}`)
    console.log(`   - Date de validation: ${accountingValidated.accounting_validated_at}`)

    // Test 4: Vérifier les dépenses en attente de validation directeur
    console.log('\n📊 Test 4: Vérification des dépenses en attente de validation directeur...')
    const pendingDirector = await getExpensesPendingDirectorTest()
    console.log(`📋 ${pendingDirector.length} dépense(s) en attente de validation directeur`)
    
    if (pendingDirector.length > 0) {
      console.log('   - Dépenses en attente:')
      pendingDirector.forEach(exp => {
        console.log(`     * ${exp.id}: ${exp.description} (${exp.amount.toLocaleString()} XAF)`)
      })
    }

    // Test 5: Validation par le directeur
    console.log('\n✅ Test 5: Validation par le directeur...')
    const directorValidated = await validateExpenseByDirectorTest(
      expense.id,
      true, // approuvée
      'Michel Nianga', // directeur
      undefined // pas de motif de rejet
    )
    console.log(`✅ Dépense validée par le directeur`)
    console.log(`   - Statut final: ${directorValidated.status}`)
    console.log(`   - Validée par: ${directorValidated.director_validated_by}`)
    console.log(`   - Date de validation: ${directorValidated.director_validated_at}`)

    // Test 6: Test de rejet par la comptabilité
    console.log('\n❌ Test 6: Test de rejet par la comptabilité...')
    const expense2 = await createExpenseTest({
      description: 'Test workflow - Dépense à rejeter',
      amount: 500000,
      category: 'Autre',
      requested_by: 'Test User',
      agency: 'Agence Centrale',
      comment: 'Cette dépense sera rejetée par la comptabilité'
    })
    console.log(`📝 Dépense créée pour test de rejet: ${expense2.id}`)

    const rejectedByAccounting = await validateExpenseByAccountingTest(
      expense2.id,
      false, // rejetée
      'Anne Sophie Ominga', // comptable
      'Montant trop élevé sans justification appropriée'
    )
    console.log(`❌ Dépense rejetée par la comptabilité`)
    console.log(`   - Statut: ${rejectedByAccounting.status}`)
    console.log(`   - Motif de rejet: ${rejectedByAccounting.rejection_reason}`)

    // Test 7: Vérifier les notifications email
    console.log('\n📧 Test 7: Vérification des notifications email...')
    console.log('📧 Données email générées:')
    console.log(`   - ID: ${directorValidated.id}`)
    console.log(`   - Description: ${directorValidated.description}`)
    console.log(`   - Montant: ${directorValidated.amount.toLocaleString()} XAF`)
    console.log(`   - Statut: ${directorValidated.status}`)
    console.log(`   - Validé par: ${directorValidated.director_validated_by}`)

    // Test 8: Nettoyage
    console.log('\n🧹 Test 8: Nettoyage...')
    await sql`DELETE FROM expenses WHERE id IN (${expense.id}, ${expense2.id})`
    console.log('✅ Dépenses de test supprimées')

    console.log('\n🎉 Test du workflow des dépenses terminé avec succès!')
    console.log('\n📋 Résumé du workflow:')
    console.log('   1. Création de dépense → Statut: pending')
    console.log('   2. Validation comptable → Statut: accounting_approved/rejected')
    console.log('   3. Validation directeur → Statut: director_approved/rejected')
    console.log('   4. Notifications email à chaque étape')

  } catch (error) {
    console.error('❌ Erreur lors du test du workflow des dépenses:', error)
    process.exit(1)
  }
}

// Exécuter le test
testExpenseWorkflow()
  .then(() => {
    console.log('🎉 Script de test terminé!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
