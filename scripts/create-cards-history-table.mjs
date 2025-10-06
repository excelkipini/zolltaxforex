#!/usr/bin/env node

import { config } from 'dotenv'
config({ path: '.env.local' })
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import postgres from 'postgres'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Configuration de la base de données
const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL non définie')
  process.exit(1)
}

const sql = postgres(DATABASE_URL)

console.log('🔄 Création de la table d\'historique des actions sur les cartes...')

console.log('🔄 Création de la table d\'historique des actions sur les cartes...')

async function createCardsActionHistoryTable() {
  try {
    // Lire le fichier SQL
    const sqlFile = join(__dirname, 'sql', '011_create_cards_action_history.sql')
    const sqlContent = readFileSync(sqlFile, 'utf8')
    
    // Exécuter le SQL
    await sql.unsafe(sqlContent)
    
    console.log('✅ Table cards_action_history créée avec succès')
    console.log('📊 Index créés pour optimiser les performances')
    console.log('📝 Commentaires ajoutés pour la documentation')
    
    // Vérifier que la table existe
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'cards_action_history'
    `
    
    if (result.length > 0) {
      console.log('✅ Vérification: Table cards_action_history existe')
    } else {
      console.log('❌ Erreur: Table cards_action_history non trouvée')
    }
    
    // Afficher la structure de la table
    const columns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'cards_action_history'
      ORDER BY ordinal_position
    `
    
    console.log('\n📋 Structure de la table:')
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : ''}`)
    })
    
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table:', error.message)
    process.exit(1)
  }
}

// Exécuter la migration
createCardsActionHistoryTable()
