import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function testRiaCalculations() {
  try {
    console.log('🧪 Test des calculs RIA...')
    
    // Test avec des données d'exemple
    const testData = {
      sent_amount: 100000, // 100,000 XAF
      commission_sa: 5000,  // 5,000 XAF
      ttf: 1500,           // 1,500 XAF
      cte: 250,            // 250 XAF
      tva: 945             // 945 XAF
    }
    
    console.log('📊 Données de test:')
    console.log(`  - Sent Amount: ${testData.sent_amount} XAF`)
    console.log(`  - Commission SA: ${testData.commission_sa} XAF`)
    console.log(`  - TTF: ${testData.ttf} XAF`)
    console.log(`  - CTE: ${testData.cte} XAF`)
    console.log(`  - TVA: ${testData.tva} XAF`)
    
    // Calculs selon les formules
    const commissionRia = Math.round(testData.commission_sa * 70.0 / 100.0 * 100) / 100
    const tvaRia = Math.round(commissionRia * 18.9 / 100.0 * 100) / 100
    const commissionUba = Math.round(testData.commission_sa * 15.0 / 100.0 * 100) / 100
    const tvaUba = Math.round(commissionUba * 18.9 / 100.0 * 100) / 100
    const commissionZtf = commissionUba
    const caZtf = Math.round(tvaUba * 5.0 / 100.0 * 100) / 100
    const tvaZtf = Math.round((tvaUba - caZtf) * 100) / 100
    const cteCalculated = Math.round(testData.sent_amount * 0.25 / 100.0 * 100) / 100
    const ttfCalculated = Math.round(testData.sent_amount * 1.5 / 100.0 * 100) / 100
    const montantPrincipal = testData.sent_amount
    const fraisClientCalculated = testData.commission_sa
    const montantBrut = testData.sent_amount + testData.commission_sa
    
    console.log('\n💰 Calculs des commissions:')
    console.log(`  - Commission RIA: ${commissionRia} XAF (Frais client × 70 / 100)`)
    console.log(`  - TVA RIA: ${tvaRia} XAF (Commission RIA × 18.9 / 100)`)
    console.log(`  - Commission UBA: ${commissionUba} XAF (Frais client × 15 / 100)`)
    console.log(`  - TVA UBA: ${tvaUba} XAF (Commission UBA × 18.9 / 100)`)
    console.log(`  - Commission ZTF: ${commissionZtf} XAF (Commission UBA)`)
    console.log(`  - CA ZTF: ${caZtf} XAF (TVA UBA × 5 / 100)`)
    console.log(`  - TVA ZTF: ${tvaZtf} XAF (TVA UBA – CA ZTF)`)
    console.log(`  - CTE calculé: ${cteCalculated} XAF (Sent Amount × 0.25 / 100)`)
    console.log(`  - TTF calculé: ${ttfCalculated} XAF (Sent Amount × 1.5 / 100)`)
    
    console.log('\n📈 Indicateurs primaires:')
    console.log(`  - Montant principal: ${montantPrincipal} XAF`)
    console.log(`  - Frais client: ${fraisClientCalculated} XAF`)
    console.log(`  - Montant brut: ${montantBrut} XAF`)
    
    // Vérifier si la table existe et a les bonnes colonnes
    console.log('\n🔍 Vérification de la structure de la table...')
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ria_transactions' 
      AND column_name IN ('commission_ria', 'tva_ria', 'commission_uba', 'tva_uba', 'commission_ztf', 'ca_ztf', 'tva_ztf', 'cte_calculated', 'ttf_calculated', 'montant_principal', 'frais_client_calculated', 'montant_brut', 'is_remboursement')
      ORDER BY column_name
    `
    
    if (columns.length > 0) {
      console.log('✅ Colonnes de calculs trouvées:')
      columns.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`))
    } else {
      console.log('⚠️  Colonnes de calculs non trouvées. Elles doivent être ajoutées à la table.')
    }
    
    // Vérifier s'il y a des données dans la table
    const count = await sql`SELECT COUNT(*) as count FROM ria_transactions`
    console.log(`\n📊 Nombre de transactions dans la table: ${count[0].count}`)
    
    if (count[0].count > 0) {
      // Vérifier les calculs sur les données existantes
      const sampleData = await sql`
        SELECT 
          sent_amount, commission_sa, 
          commission_ria, tva_ria, commission_uba, tva_uba,
          commission_ztf, ca_ztf, tva_ztf, cte_calculated, ttf_calculated,
          montant_principal, frais_client_calculated, montant_brut
        FROM ria_transactions 
        LIMIT 1
      `
      
      if (sampleData.length > 0) {
        const sample = sampleData[0]
        console.log('\n🔍 Vérification des calculs sur les données existantes:')
        console.log(`  - Sent Amount: ${sample.sent_amount}`)
        console.log(`  - Commission SA: ${sample.commission_sa}`)
        console.log(`  - Commission RIA calculée: ${sample.commission_ria}`)
        console.log(`  - TVA RIA calculée: ${sample.tva_ria}`)
        console.log(`  - Montant principal: ${sample.montant_principal}`)
        console.log(`  - Montant brut: ${sample.montant_brut}`)
      }
    }
    
    console.log('\n✅ Test terminé!')
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
    process.exit(1)
  }
}

testRiaCalculations()

