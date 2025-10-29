import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function testDatabaseConnection() {
  try {
    console.log('🔍 Test de connexion à la base de données...')
    
    // Test de connexion basique
    const result = await sql`SELECT 1 as test`
    console.log('✅ Connexion réussie:', result)
    
    // Test de la table ria_cash_declarations
    const declarations = await sql`SELECT COUNT(*) as count FROM ria_cash_declarations`
    console.log('📊 Nombre d\'arrêtés de caisse:', declarations[0].count)
    
    // Test des statistiques
    const stats = await sql`
      SELECT
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'validated' THEN 1 END) as total_validated,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as total_rejected,
        COALESCE(SUM(total_delestage), 0) as total_delestage,
        COALESCE(SUM(COALESCE(excedents, 0)), 0) as total_excedents
      FROM ria_cash_declarations
    `
    console.log('📈 Statistiques:', stats[0])
    
    // Test des utilisateurs
    const users = await sql`SELECT id, name, role FROM users WHERE role IN ('cashier', 'cash_manager') LIMIT 5`
    console.log('👥 Utilisateurs autorisés:', users)
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error)
  }
}

testDatabaseConnection()
