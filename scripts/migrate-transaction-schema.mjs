#!/usr/bin/env node

/**
 * Script de migration pour mettre à jour le schéma des transactions
 * pour supporter le workflow de transfert d'argent avec exécuteur
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

async function migrateTransactionSchema() {
  console.log('🔄 Migration du schéma des transactions pour le workflow de transfert\n')

  try {
    // 1. Ajouter les nouveaux champs pour le workflow de transfert
    console.log('1️⃣ Ajout des nouveaux champs pour le workflow de transfert...')
    
    // Montant réel renseigné par l'auditeur (en EUR)
    await sql`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS real_amount_eur NUMERIC
    `
    console.log('✅ Champ real_amount_eur ajouté')

    // Commission calculée automatiquement
    await sql`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS commission_amount NUMERIC
    `
    console.log('✅ Champ commission_amount ajouté')

    // Exécuteur assigné à la transaction
    await sql`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS executor_id UUID REFERENCES users(id)
    `
    console.log('✅ Champ executor_id ajouté')

    // Date d'exécution
    await sql`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ
    `
    console.log('✅ Champ executed_at ajouté')

    // Reçu de la transaction (URL ou chemin du fichier)
    await sql`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS receipt_url TEXT
    `
    console.log('✅ Champ receipt_url ajouté')

    // Commentaire de l'exécuteur
    await sql`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS executor_comment TEXT
    `
    console.log('✅ Champ executor_comment ajouté')
    console.log('')

    // 2. Mettre à jour la contrainte de statut pour inclure les nouveaux états
    console.log('2️⃣ Mise à jour de la contrainte de statut...')
    
    // Supprimer l'ancienne contrainte
    await sql`
      ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check
    `
    console.log('✅ Ancienne contrainte de statut supprimée')

    // Créer la nouvelle contrainte avec les nouveaux statuts
    await sql`
      ALTER TABLE transactions ADD CONSTRAINT transactions_status_check 
      CHECK (status IN ('pending','validated','rejected','completed','executed'))
    `
    console.log('✅ Nouvelle contrainte de statut créée avec les statuts: pending, validated, rejected, completed, executed')
    console.log('')

    // 3. Ajouter des index pour améliorer les performances
    console.log('3️⃣ Ajout d\'index pour améliorer les performances...')
    
    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_executor_id ON transactions(executor_id)
    `
    console.log('✅ Index sur executor_id créé')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)
    `
    console.log('✅ Index sur status créé')

    await sql`
      CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status)
    `
    console.log('✅ Index composite sur type et status créé')
    console.log('')

    // 4. Vérifier la structure de la table
    console.log('4️⃣ Vérification de la structure de la table...')
    const tableStructure = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      ORDER BY ordinal_position
    `
    
    console.log('   Structure de la table transactions:')
    tableStructure.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`)
    })
    console.log('')

    // 5. Vérifier les contraintes
    console.log('5️⃣ Vérification des contraintes...')
    const constraints = await sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'transactions'::regclass
      AND conname LIKE '%_check'
    `
    
    console.log('   Contraintes de vérification:')
    constraints.forEach(constraint => {
      console.log(`     - ${constraint.conname}: ${constraint.definition}`)
    })
    console.log('')

    // 6. Tester l'insertion d'une transaction de test
    console.log('6️⃣ Test d\'insertion d\'une transaction de test...')
    try {
      const testTransaction = await sql`
        INSERT INTO transactions (
          type, status, description, amount, currency, created_by, agency, 
          real_amount_eur, commission_amount, executor_id
        )
        VALUES (
          'transfer', 'validated', 'Test transfer workflow', 100000, 'XAF', 'Test User', 'Agence Centre',
          150.00, 5000.00, (SELECT id FROM users WHERE role = 'executor' LIMIT 1)
        )
        RETURNING id::text, type, status, commission_amount
      `
      console.log('✅ Test d\'insertion réussi')
      console.log(`   Transaction créée: ${testTransaction[0].id} (${testTransaction[0].type} - ${testTransaction[0].status})`)
      console.log(`   Commission: ${testTransaction[0].commission_amount} XAF`)
      
      // Supprimer la transaction de test
      await sql`DELETE FROM transactions WHERE id = ${testTransaction[0].id}`
      console.log('✅ Transaction de test supprimée')
    } catch (error) {
      console.log('❌ Test d\'insertion échoué:', error.message)
    }
    console.log('')

    console.log('🎉 Migration du schéma des transactions terminée avec succès !')
    console.log('\n📝 Nouveaux champs ajoutés:')
    console.log('   ✅ real_amount_eur: Montant réel renseigné par l\'auditeur (en EUR)')
    console.log('   ✅ commission_amount: Commission calculée automatiquement')
    console.log('   ✅ executor_id: Exécuteur assigné à la transaction')
    console.log('   ✅ executed_at: Date d\'exécution')
    console.log('   ✅ receipt_url: Reçu de la transaction')
    console.log('   ✅ executor_comment: Commentaire de l\'exécuteur')
    console.log('')
    console.log('📝 Nouveaux statuts disponibles:')
    console.log('   ✅ pending: En attente de validation')
    console.log('   ✅ validated: Validée par l\'auditeur')
    console.log('   ✅ rejected: Rejetée')
    console.log('   ✅ completed: Terminée par le caissier')
    console.log('   ✅ executed: Exécutée par l\'exécuteur')
    console.log('')
    console.log('🚀 Le schéma est prêt pour le workflow de transfert d\'argent !')

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    throw error
  }
}

// Exécuter la migration
migrateTransactionSchema()
  .then(() => {
    console.log('\n🎯 Prochaines étapes:')
    console.log('   1. Implémenter la logique de calcul de commission')
    console.log('   2. Créer les fonctions de validation automatique')
    console.log('   3. Ajouter l\'interface pour l\'exécuteur')
    console.log('   4. Implémenter le système de téléchargement de reçu')
    console.log('   5. Tester le workflow complet')
  })
  .catch(error => {
    console.error('❌ Échec de la migration:', error)
    process.exit(1)
  })
