import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function executeSqlFile() {
  try {
    console.log('🔄 Exécution du script SQL...')
    
    // Lire le fichier SQL
    const sqlFile = join(process.cwd(), 'scripts/sql/016_add_calculation_columns.sql')
    const sqlContent = readFileSync(sqlFile, 'utf8')
    
    // Diviser en commandes individuelles
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    console.log(`📝 Exécution de ${commands.length} commandes...`)
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      if (command.trim()) {
        try {
          console.log(`   ${i + 1}/${commands.length}: ${command.substring(0, 60)}...`)
          await sql`${sql(command)}`
          console.log(`   ✅ Commande ${i + 1} exécutée`)
        } catch (error) {
          console.log(`   ⚠️  Commande ${i + 1} ignorée: ${error.message}`)
        }
      }
    }
    
    console.log('✅ Script SQL exécuté!')
    
  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

executeSqlFile()

