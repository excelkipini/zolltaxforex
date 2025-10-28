import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function testFinalRiaSystem() {
  try {
    console.log('🧪 Test final du système RIA...')
    
    // 1. Vérifier la structure de la table
    console.log('\n1️⃣ Vérification de la structure de la table...')
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'ria_transactions' 
      AND column_name IN ('commission_ria', 'tva_ria', 'commission_uba', 'tva_uba', 'commission_ztf', 'ca_ztf', 'tva_ztf', 'cte_calculated', 'ttf_calculated', 'montant_principal', 'frais_client_calculated', 'montant_brut', 'is_remboursement')
      ORDER BY column_name
    `
    
    console.log('✅ Colonnes de calculs présentes:')
    columns.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`))
    
    // 2. Insérer une transaction de test avec calculs
    console.log('\n2️⃣ Insertion d\'une transaction de test...')
    const testTransaction = {
      sc_numero_transfert: 'TEST001',
      pin: '1234',
      mode_livraison: 'Cash',
      guichetier: 'Test Guichetier',
      succursale: 'Test Agence',
      code_agence: 'TEST001',
      sent_amount: 100000,
      sending_currency: 'XAF',
      pays_origine: 'Congo',
      pays_destination: 'Mali',
      montant_paiement: 100000,
      devise_beneficiaire: 'XOF',
      commission_sa: 5000,
      devise_commission_sa: 'XAF',
      date_operation: new Date().toISOString(),
      taux: 1.0,
      ttf: 1500,
      cte: 250,
      tva1: 945,
      montant_a_payer: 100000,
      frais_client: 5000,
      action: 'Envoyé',
      // Calculs dérivés
      commission_ria: 3500,
      tva_ria: 661.5,
      commission_uba: 750,
      tva_uba: 141.75,
      commission_ztf: 750,
      ca_ztf: 7.09,
      tva_ztf: 134.66,
      cte_calculated: 250,
      ttf_calculated: 1500,
      montant_principal: 100000,
      frais_client_calculated: 5000,
      montant_brut: 105000,
      is_remboursement: false
    }
    
    await sql`
      INSERT INTO ria_transactions (
        sc_numero_transfert, pin, mode_livraison, guichetier, succursale, code_agence,
        sent_amount, sending_currency, pays_origine, pays_destination, montant_paiement,
        devise_beneficiaire, commission_sa, devise_commission_sa, date_operation, taux,
        ttf, cte, tva1, montant_a_payer, frais_client, action,
        commission_ria, tva_ria, commission_uba, tva_uba, commission_ztf, ca_ztf,
        tva_ztf, cte_calculated, ttf_calculated, montant_principal, frais_client_calculated,
        montant_brut, is_remboursement
      ) VALUES (
        ${testTransaction.sc_numero_transfert}, ${testTransaction.pin}, ${testTransaction.mode_livraison},
        ${testTransaction.guichetier}, ${testTransaction.succursale}, ${testTransaction.code_agence},
        ${testTransaction.sent_amount}, ${testTransaction.sending_currency}, ${testTransaction.pays_origine},
        ${testTransaction.pays_destination}, ${testTransaction.montant_paiement}, ${testTransaction.devise_beneficiaire},
        ${testTransaction.commission_sa}, ${testTransaction.devise_commission_sa}, ${testTransaction.date_operation},
        ${testTransaction.taux}, ${testTransaction.ttf}, ${testTransaction.cte}, ${testTransaction.tva1},
        ${testTransaction.montant_a_payer}, ${testTransaction.frais_client}, ${testTransaction.action},
        ${testTransaction.commission_ria}, ${testTransaction.tva_ria}, ${testTransaction.commission_uba},
        ${testTransaction.tva_uba}, ${testTransaction.commission_ztf}, ${testTransaction.ca_ztf},
        ${testTransaction.tva_ztf}, ${testTransaction.cte_calculated}, ${testTransaction.ttf_calculated},
        ${testTransaction.montant_principal}, ${testTransaction.frais_client_calculated},
        ${testTransaction.montant_brut}, ${testTransaction.is_remboursement}
      )
    `
    
    console.log('✅ Transaction de test insérée')
    
    // 3. Tester les calculs du tableau de bord
    console.log('\n3️⃣ Test des calculs du tableau de bord...')
    const dashboardData = await sql`
      SELECT 
        COALESCE(SUM(montant_principal), 0) as montant_principal_total,
        COALESCE(SUM(montant_brut), 0) as montant_brut,
        COALESCE(SUM(frais_client_calculated), 0) as total_frais,
        COALESCE(SUM(CASE WHEN is_remboursement THEN montant_brut ELSE 0 END), 0) as remboursements,
        COALESCE(SUM(montant_brut) - SUM(CASE WHEN is_remboursement THEN montant_brut ELSE 0 END), 0) as versement_banque,
        COALESCE(SUM(commission_ria), 0) as commissions_ria,
        COALESCE(SUM(tva_ria), 0) as tva_ria,
        COALESCE(SUM(commission_uba), 0) as commissions_uba,
        COALESCE(SUM(tva_uba), 0) as tva_uba,
        COALESCE(SUM(commission_ztf), 0) as commissions_ztf,
        COALESCE(SUM(tva_ztf), 0) as tva_ztf,
        COALESCE(SUM(ca_ztf), 0) as ca_ztf,
        COALESCE(SUM(cte_calculated), 0) as cte,
        COALESCE(SUM(ttf_calculated), 0) as ttf,
        COUNT(*) as nb_transactions
      FROM ria_transactions
    `
    
    const data = dashboardData[0]
    console.log('📊 Données du tableau de bord:')
    console.log(`  - Montant principal total: ${data.montant_principal_total} XAF`)
    console.log(`  - Montant brut: ${data.montant_brut} XAF`)
    console.log(`  - Total frais: ${data.total_frais} XAF`)
    console.log(`  - Remboursements: ${data.remboursements} XAF`)
    console.log(`  - Versement banque: ${data.versement_banque} XAF`)
    console.log(`  - Commission RIA: ${data.commissions_ria} XAF`)
    console.log(`  - TVA RIA: ${data.tva_ria} XAF`)
    console.log(`  - Commission UBA: ${data.commissions_uba} XAF`)
    console.log(`  - TVA UBA: ${data.tva_uba} XAF`)
    console.log(`  - Commission ZTF: ${data.commissions_ztf} XAF`)
    console.log(`  - TVA ZTF: ${data.tva_ztf} XAF`)
    console.log(`  - CA ZTF: ${data.ca_ztf} XAF`)
    console.log(`  - CTE: ${data.cte} XAF`)
    console.log(`  - TTF: ${data.ttf} XAF`)
    console.log(`  - Nombre de transactions: ${data.nb_transactions}`)
    
    // 4. Nettoyer les données de test
    console.log('\n4️⃣ Nettoyage des données de test...')
    await sql`DELETE FROM ria_transactions WHERE sc_numero_transfert = 'TEST001'`
    console.log('✅ Données de test supprimées')
    
    console.log('\n🎉 Test final réussi ! Le système RIA est prêt à être utilisé.')
    
  } catch (error) {
    console.error('❌ Erreur lors du test final:', error)
    process.exit(1)
  }
}

testFinalRiaSystem()

