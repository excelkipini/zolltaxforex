#!/usr/bin/env node

/**
 * Script de migration pour ajouter la table uploaded_files
 * Ce script peut être exécuté pour mettre à jour les bases de données existantes
 */

import { sql } from './lib/db.js'

async function migrateUploadedFilesTable() {
  try {
    console.log('🔄 Début de la migration - Ajout de la table uploaded_files...')

    // Vérifier si la table existe déjà
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'uploaded_files'
      )
    `

    if (tableExists[0].exists) {
      console.log('✅ La table uploaded_files existe déjà')
      return
    }

    // Créer la table uploaded_files
    await sql`
      CREATE TABLE uploaded_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    console.log('✅ Table uploaded_files créée avec succès')

    // Créer un index pour améliorer les performances
    await sql`
      CREATE INDEX idx_uploaded_files_created_at ON uploaded_files(created_at)
    `

    console.log('✅ Index créé pour uploaded_files')

    console.log('🎉 Migration terminée avec succès!')

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error)
    process.exit(1)
  }
}

// Exécuter la migration si le script est appelé directement
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateUploadedFilesTable()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}

export { migrateUploadedFilesTable }
