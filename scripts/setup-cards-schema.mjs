#!/usr/bin/env node

import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Charger les variables d'environnement depuis .env.local
config({ path: '.env.local' })

console.log("🚀 Configuration de la base de données Neon...")

// Vérifier si DATABASE_URL est définie
if (!process.env.DATABASE_URL) {
  console.log("❌ DATABASE_URL n'est pas définie dans les variables d'environnement")
  console.log("📝 Veuillez créer un fichier .env.local avec votre DATABASE_URL:")
  console.log("")
  console.log("DATABASE_URL=\"postgresql://username:password@hostname/database?sslmode=require\"")
  console.log("NODE_ENV=\"production\"")
  console.log("NEXTAUTH_SECRET=\"your-nextauth-secret-here\"")
  console.log("JWT_SECRET=\"your-jwt-secret-here\"")
  console.log("")
  console.log("💡 Vous pouvez obtenir votre DATABASE_URL depuis:")
  console.log("   https://console.neon.tech")
  process.exit(1)
}

async function setupDatabase() {
  try {
    console.log("🔗 Test de connexion à la base de données...")
    
    const sql = neon(process.env.DATABASE_URL)
    const result = await sql`SELECT 1 as test`
    
    if (result[0]?.test === 1) {
      console.log("✅ Connexion à la base de données réussie!")
    } else {
      throw new Error("Test de connexion échoué")
    }

    console.log("🏗️  Ajout des nouvelles colonnes à la table cards...")
    
    // Ajouter la colonne country si elle n'existe pas
    try {
      await sql`
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS country TEXT NOT NULL CHECK (country IN ('Mali','RDC','France','Congo')) DEFAULT 'Mali'
      `
      console.log("✅ Colonne 'country' ajoutée")
    } catch (error) {
      console.log("⚠️  Colonne 'country' déjà présente ou erreur:", error.message)
    }

    // Ajouter la colonne recharge_limit si elle n'existe pas
    try {
      await sql`
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS recharge_limit BIGINT NOT NULL DEFAULT 500000
      `
      console.log("✅ Colonne 'recharge_limit' ajoutée")
    } catch (error) {
      console.log("⚠️  Colonne 'recharge_limit' déjà présente ou erreur:", error.message)
    }

    console.log("🏗️  Création de la table card_recharges...")
    
    // Créer la table card_recharges si elle n'existe pas
    try {
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
      console.log("✅ Table 'card_recharges' créée")
    } catch (error) {
      console.log("⚠️  Table 'card_recharges' déjà présente ou erreur:", error.message)
    }

    console.log("🌱 Insertion de données de test pour les cartes...")
    
    // Vérifier s'il y a déjà des cartes
    const existingCards = await sql`SELECT COUNT(*) as count FROM cards`
    
    if (existingCards[0].count === 0) {
      console.log("📝 Insertion de cartes de test...")
      
      await sql`
        INSERT INTO cards (id, cid, country, last_recharge_date, expiration_date, status, monthly_limit, monthly_used, recharge_limit, created_at, updated_at)
        VALUES 
          (gen_random_uuid(), '21174132', 'Mali', '2024-01-15', '2025-12-31', 'active', 2400000, 500000, 810000, NOW(), NOW()),
          (gen_random_uuid(), '21174133', 'RDC', '2024-01-10', '2025-11-30', 'active', 2500000, 1200000, 550000, NOW(), NOW()),
          (gen_random_uuid(), '21174134', 'France', NULL, '2025-10-31', 'inactive', 2500000, 0, 650000, NOW(), NOW()),
          (gen_random_uuid(), '21174135', 'Congo', '2024-01-20', '2025-09-30', 'active', 2000000, 800000, 800000, NOW(), NOW())
      `
      
      console.log("✅ 4 cartes de test insérées")
      
      // Insérer quelques recharges de test
      const cards = await sql`SELECT id FROM cards LIMIT 2`
      if (cards.length > 0) {
        await sql`
          INSERT INTO card_recharges (card_id, amount, recharged_by, recharge_date, notes, created_at)
          VALUES 
            (${cards[0].id}, 100000, 'Admin User', '2024-01-15T10:00:00Z', 'Recharge initiale', NOW()),
            (${cards[1].id}, 200000, 'Admin User', '2024-01-10T14:30:00Z', 'Recharge mensuelle', NOW())
        `
        console.log("✅ Historique de recharge de test inséré")
      }
    } else {
      console.log("ℹ️  Des cartes existent déjà, pas d'insertion de données de test")
    }
    
    console.log("")
    console.log("🎉 Configuration terminée avec succès!")
    console.log("")
    console.log("📊 Votre base de données est maintenant prête avec:")
    console.log("   • Colonnes 'country' et 'recharge_limit' ajoutées à la table cards")
    console.log("   • Table 'card_recharges' créée pour l'historique")
    console.log("   • Données de test insérées (si aucune carte n'existait)")
    console.log("")
    console.log("🔍 Pour vérifier la configuration:")
    console.log("   node scripts/test-db-connection.mjs")
    
  } catch (error) {
    console.error("❌ Erreur lors de la configuration:", error.message)
    console.log("")
    console.log("🔧 Solutions possibles:")
    console.log("   1. Vérifiez que votre DATABASE_URL est correcte")
    console.log("   2. Assurez-vous que votre projet Neon est actif")
    console.log("   3. Vérifiez votre connexion internet")
    console.log("   4. Consultez la documentation: docs/NEON_SETUP.md")
    process.exit(1)
  }
}

setupDatabase()
