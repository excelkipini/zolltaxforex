import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function addColumns() {
  try {
    console.log('🔄 Ajout des colonnes de calculs...')
    
    const commands = [
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS commission_ria DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS tva_ria DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS commission_uba DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS tva_uba DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS commission_ztf DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS ca_ztf DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS tva_ztf DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS cte_calculated DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS ttf_calculated DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS montant_principal DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS frais_client_calculated DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS montant_brut DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS is_remboursement BOOLEAN DEFAULT FALSE"
    ]
    
    for (let i = 0; i < commands.length; i++) {
      try {
        console.log(`   ${i + 1}/${commands.length}: ${commands[i].split(' ')[5]}...`)
        await sql(commands[i])
        console.log(`   ✅ ${commands[i].split(' ')[5]} ajoutée`)
      } catch (error) {
        console.log(`   ⚠️  ${commands[i].split(' ')[5]}: ${error.message}`)
      }
    }
    
    console.log('✅ Terminé!')
    
    // Vérifier les colonnes ajoutées
    console.log('\n🔍 Vérification des colonnes...')
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ria_transactions' 
      AND column_name LIKE '%commission%' OR column_name LIKE '%tva%' OR column_name LIKE '%montant%' OR column_name LIKE '%frais%' OR column_name LIKE '%is_remboursement%'
      ORDER BY column_name
    `
    
    console.log('Colonnes trouvées:')
    result.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`))
    
  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

addColumns()

