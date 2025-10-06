#!/usr/bin/env node

import { neon } from "@neondatabase/serverless"

const sql = neon(process.env.DATABASE_URL)

async function migrateCardsTable() {
  try {
    console.log("🔄 Migration de la table cards...")

    // Vérifier si la table existe
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'cards'
      )
    `

    if (!tableExists[0].exists) {
      console.log("❌ La table cards n'existe pas")
      return
    }

    // Ajouter les nouvelles colonnes si elles n'existent pas
    console.log("📝 Ajout des colonnes manquantes...")

    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS cid TEXT`
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Mali'`
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_recharge_date DATE`
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS expiration_date DATE`
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS monthly_limit BIGINT DEFAULT 2000000`
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS monthly_used BIGINT DEFAULT 0`
    await sql`ALTER TABLE cards ADD COLUMN IF NOT EXISTS recharge_limit BIGINT DEFAULT 500000`

    // Mettre à jour les contraintes
    console.log("🔧 Mise à jour des contraintes...")
    
    await sql`ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_status_check`
    await sql`ALTER TABLE cards ADD CONSTRAINT cards_status_check CHECK (status IN ('active','inactive'))`

    // Créer la table card_recharges si elle n'existe pas
    console.log("📊 Création de la table card_recharges...")
    
    await sql`
      CREATE TABLE IF NOT EXISTS card_recharges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        amount BIGINT NOT NULL,
        recharged_by TEXT NOT NULL,
        recharge_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Migrer les données existantes si nécessaire
    console.log("🔄 Migration des données existantes...")
    
    // Si des cartes existent avec card_number mais pas de cid, utiliser card_number comme cid
    await sql`
      UPDATE cards 
      SET cid = card_number 
      WHERE cid IS NULL AND card_number IS NOT NULL
    `

    console.log("✅ Migration terminée avec succès!")
    
  } catch (error) {
    console.error("❌ Erreur lors de la migration:", error)
    process.exit(1)
  }
}

// Exécuter la migration
migrateCardsTable()
  .then(() => {
    console.log("🎉 Migration complète!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("💥 Erreur fatale:", error)
    process.exit(1)
  })
