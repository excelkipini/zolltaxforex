import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function executeSqlFile() {
  try {
    console.log('🔄 Exécution du script SQL final...')
    
    // Lire le fichier SQL
    const sqlFile = join(process.cwd(), 'scripts/sql/017_add_calculation_columns_final.sql')
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
          // Utiliser sql.unsafe pour les commandes DDL
          await sql`${sql.unsafe(command)}`
          console.log(`   ✅ Commande ${i + 1} exécutée`)
        } catch (error) {
          console.log(`   ⚠️  Commande ${i + 1} ignorée: ${error.message}`)
        }
      }
    }
    
    console.log('✅ Script SQL exécuté!')
    
    // Vérifier les colonnes ajoutées
    console.log('\n🔍 Vérification des colonnes...')
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ria_transactions' 
      AND (column_name LIKE '%commission%' OR column_name LIKE '%tva%' OR column_name LIKE '%montant%' OR column_name LIKE '%frais%' OR column_name LIKE '%is_remboursement%')
      ORDER BY column_name
    `
    
    console.log('Colonnes de calculs trouvées:')
    result.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`))
    
  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

executeSqlFile()

