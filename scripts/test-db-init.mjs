import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function testDatabaseInit() {
  try {
    console.log('🔍 Test d\'initialisation de la base de données...')
    
    // Test de connexion
    const result = await sql`SELECT 1 as test`
    console.log('📊 Connexion:', result[0].test === 1 ? '✅ OK' : '❌ Échec')
    
    // Vérifier les tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'ria_cash_declarations', 'agencies')
    `
    console.log('📊 Tables disponibles:', tables.map(t => t.table_name))
    
    // Vérifier les données
    const users = await sql`SELECT COUNT(*) as count FROM users`
    const declarations = await sql`SELECT COUNT(*) as count FROM ria_cash_declarations`
    
    console.log('📊 Utilisateurs:', users[0].count)
    console.log('📊 Arrêtés de caisse:', declarations[0].count)
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

testDatabaseInit()
