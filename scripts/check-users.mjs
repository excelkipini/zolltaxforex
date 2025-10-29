import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function checkUsers() {
  try {
    console.log('👥 Vérification des utilisateurs...')
    
    const users = await sql`SELECT id, name, email, role FROM users ORDER BY name`
    console.log('📊 Utilisateurs disponibles:')
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.role}`)
    })
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

checkUsers()