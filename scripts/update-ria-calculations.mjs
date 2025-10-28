import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { join } from 'path'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function updateRiaCalculations() {
  try {
    console.log('🔄 Mise à jour des calculs RIA...')
    
    // Lire et exécuter le script SQL
    const sqlFile = join(process.cwd(), 'scripts/sql/015_update_ria_calculations.sql')
    const sqlContent = readFileSync(sqlFile, 'utf8')
    
    // Diviser le contenu en commandes individuelles
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'))
    
    console.log(`📝 Exécution de ${commands.length} commandes SQL...`)
    
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      if (command.trim()) {
        try {
          console.log(`   ${i + 1}/${commands.length}: ${command.substring(0, 50)}...`)
          await sql(command)
        } catch (error) {
          console.warn(`   ⚠️  Commande ${i + 1} ignorée: ${error.message}`)
        }
      }
    }
    
    console.log('✅ Mise à jour des calculs RIA terminée!')
    
    // Vérifier les résultats
    console.log('\n📊 Vérification des calculs...')
    const stats = await sql`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN commission_ria > 0 THEN 1 END) as transactions_with_commissions,
        SUM(montant_principal) as total_montant_principal,
        SUM(frais_client) as total_frais_client,
        SUM(montant_brut) as total_montant_brut
      FROM ria_transactions
    `
    
    console.log('Statistiques des calculs:')
    console.log(`  - Total transactions: ${stats[0].total_transactions}`)
    console.log(`  - Transactions avec commissions: ${stats[0].transactions_with_commissions}`)
    console.log(`  - Montant principal total: ${stats[0].total_montant_principal} FCFA`)
    console.log(`  - Frais client total: ${stats[0].total_frais_client} FCFA`)
    console.log(`  - Montant brut total: ${stats[0].total_montant_brut} FCFA`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error)
    process.exit(1)
  }
}

updateRiaCalculations()

