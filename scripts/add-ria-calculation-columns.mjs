import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function addCalculationColumns() {
  try {
    console.log('🔄 Ajout des colonnes de calculs RIA...')
    
    const columns = [
      { name: 'commission_ria', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'tva_ria', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'commission_uba', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'tva_uba', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'commission_ztf', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'ca_ztf', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'tva_ztf', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'cte_calculated', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'ttf_calculated', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'montant_principal', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'frais_client_calculated', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'montant_brut', type: 'DECIMAL(15,2) DEFAULT 0' },
      { name: 'is_remboursement', type: 'BOOLEAN DEFAULT FALSE' }
    ]
    
    for (const column of columns) {
      try {
        console.log(`   Ajout de la colonne: ${column.name}`)
        await sql`ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS ${sql(column.name)} ${sql(column.type)}`
        console.log(`   ✅ ${column.name} ajoutée`)
      } catch (error) {
        console.log(`   ⚠️  ${column.name} déjà existante ou erreur: ${error.message}`)
      }
    }
    
    console.log('✅ Toutes les colonnes ont été ajoutées!')
    
    // Vérifier la structure
    console.log('\n📊 Vérification de la structure...')
    const result = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ria_transactions' 
      AND column_name LIKE '%commission%' OR column_name LIKE '%tva%' OR column_name LIKE '%montant%' OR column_name LIKE '%frais%' OR column_name LIKE '%is_remboursement%'
      ORDER BY column_name
    `
    
    console.log('Nouvelles colonnes:')
    result.forEach(col => console.log(`  ${col.column_name}: ${col.data_type}`))
    
  } catch (error) {
    console.error('❌ Erreur:', error)
    process.exit(1)
  }
}

addCalculationColumns()

