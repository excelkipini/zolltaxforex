import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function createTestUser() {
  try {
    console.log('👤 Création d\'un utilisateur de test...')
    
    // Hash du mot de passe
    const password = 'password123'
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Créer l'utilisateur de test
    const result = await sql`
      INSERT INTO users (id, name, email, role, agency, password_hash)
      VALUES (
        gen_random_uuid(),
        'Test User',
        'test@example.com',
        'cashier',
        'Test Agency',
        ${hashedPassword}
      )
      RETURNING id, name, email, role
    `
    
    console.log('✅ Utilisateur de test créé:', result[0])
    console.log('📧 Email: test@example.com')
    console.log('🔑 Mot de passe: password123')
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

createTestUser()
