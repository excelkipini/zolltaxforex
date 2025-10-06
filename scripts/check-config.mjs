#!/usr/bin/env node

import { config } from "dotenv"

// Charger les variables d'environnement depuis .env.local
config({ path: '.env.local' })

console.log("🎯 Vérification de la configuration de la base de données...")
console.log("")

// Vérifier si DATABASE_URL est définie
if (!process.env.DATABASE_URL) {
  console.log("🔧 Mode actuel: DÉVELOPPEMENT avec données mockées")
  console.log("")
  console.log("💡 Pour utiliser une vraie base de données:")
  console.log("   1. Créez un fichier .env.local")
  console.log("   2. Ajoutez votre DATABASE_URL")
  console.log("   3. Exécutez: node scripts/setup-production-db.mjs")
  console.log("")
  console.log("📋 Voir DATABASE_SETUP.md pour les instructions complètes")
  console.log("")
  console.log("✅ L'application fonctionne avec des données de test")
  console.log("   • 4 cartes de différents pays")
  console.log("   • Historique de recharge simulé")
  console.log("   • Statistiques calculées dynamiquement")
} else {
  console.log("🚀 Mode actuel: PRODUCTION avec base de données réelle")
  console.log("")
  console.log("✅ Configuration détectée:")
  console.log(`   • DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 20)}...`)
  console.log(`   • NODE_ENV: ${process.env.NODE_ENV || 'development'}`)
  console.log("")
  console.log("🔍 Pour tester la connexion:")
  console.log("   node scripts/test-db-connection.mjs")
  console.log("")
  console.log("🏗️  Pour initialiser la base de données:")
  console.log("   node scripts/setup-production-db.mjs")
}

console.log("")
console.log("🎉 Configuration terminée!")
console.log("   L'application utilisera automatiquement:")
console.log("   • Base de données réelle si DATABASE_URL est définie")
console.log("   • Données mockées sinon (mode développement)")
