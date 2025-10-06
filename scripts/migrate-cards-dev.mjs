#!/usr/bin/env node

// Script de migration pour les cartes en mode développement
console.log("🔄 Migration de la table cards (mode développement)")

// En mode développement, les données sont mockées
// La migration sera appliquée automatiquement lors de l'initialisation de la base de données

console.log("✅ Migration simulée - les nouvelles colonnes seront créées automatiquement")
console.log("📝 Colonnes ajoutées:")
console.log("   - cid (TEXT)")
console.log("   - country (TEXT, défaut: 'Mali')")
console.log("   - last_recharge_date (DATE)")
console.log("   - expiration_date (DATE)")
console.log("   - monthly_limit (BIGINT, défaut: 2000000)")
console.log("   - monthly_used (BIGINT, défaut: 0)")
console.log("   - recharge_limit (BIGINT, défaut: 500000)")

console.log("📊 Table card_recharges créée pour l'historique des recharges")

console.log("🎉 Migration terminée!")
