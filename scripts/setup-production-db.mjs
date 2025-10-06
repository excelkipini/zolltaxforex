#!/usr/bin/env node

import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"
import { initializeDatabase, seedDatabase } from "../lib/db.js"

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

    console.log("🏗️  Initialisation du schéma de base de données...")
    await initializeDatabase()
    
    console.log("🌱 Insertion des données initiales...")
    await seedDatabase()
    
    console.log("")
    console.log("🎉 Configuration terminée avec succès!")
    console.log("")
    console.log("📊 Votre base de données est maintenant prête avec:")
    console.log("   • Tables créées avec les nouvelles colonnes pour les cartes")
    console.log("   • Comptes utilisateurs de test")
    console.log("   • Agences par défaut")
    console.log("   • Paramètres globaux")
    console.log("")
    console.log("🔐 Comptes de test disponibles:")
    console.log("   • admin@test.com (Super Admin)")
    console.log("   • directeur@test.com (Directeur)")
    console.log("   • comptable@test.com (Comptable)")
    console.log("   • caissier@test.com (Caissier)")
    console.log("   • auditeur@test.com (Auditeur)")
    console.log("   • delegue@test.com (Délégué)")
    console.log("")
    console.log("⚠️  IMPORTANT: Changez les mots de passe en production!")
    
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
