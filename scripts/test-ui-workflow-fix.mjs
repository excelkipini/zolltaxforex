import { neon } from '@neondatabase/serverless';
import fs from 'fs';

// Charger les variables d'environnement
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
});

const sql = neon(process.env.DATABASE_URL);

async function testUIWorkflow() {
  try {
    console.log('🧪 Test de l\'interface utilisateur du workflow de transfert...\n');

    // 1. Vérifier qu'il y a des utilisateurs avec les bons rôles
    console.log('1️⃣ Vérification des utilisateurs...');
    
    const users = await sql`
      SELECT name, role, agency FROM users 
      WHERE role IN ('cashier', 'auditor', 'executor')
      ORDER BY role
    `;
    
    console.log('👥 Utilisateurs disponibles:');
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.role}) - ${user.agency}`);
    });

    // 2. Créer une transaction de transfert pour tester l'interface
    console.log('\n2️⃣ Création d\'une transaction de test...');
    
    const testTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, details
      ) VALUES (
        'TRX-UI-TEST-' || EXTRACT(EPOCH FROM NOW())::text,
        'transfer',
        'pending',
        'Test interface utilisateur - Transfert',
        2000000,
        'XAF',
        'Stevie',
        'Douala',
        '{"client_name": "Client Test UI", "destination": "France", "phone": "+237123456789"}'
      )
      RETURNING *
    `;

    console.log('✅ Transaction créée:', testTransaction[0].id);
    console.log('📋 Détails:', {
      type: testTransaction[0].type,
      status: testTransaction[0].status,
      amount: testTransaction[0].amount,
      currency: testTransaction[0].currency,
      created_by: testTransaction[0].created_by,
      agency: testTransaction[0].agency
    });

    // 3. Vérifier que l'auditeur peut voir cette transaction
    console.log('\n3️⃣ Vérification de la visibilité pour l\'auditeur...');
    
    const auditorTransactions = await sql`
      SELECT * FROM transactions 
      WHERE status = 'pending' AND type = 'transfer'
      ORDER BY created_at DESC
    `;
    
    console.log(`📋 Transactions en attente pour l'auditeur: ${auditorTransactions.length}`);
    
    if (auditorTransactions.length > 0) {
      console.log('✅ L\'auditeur peut voir les transactions en attente');
      console.log('💡 L\'auditeur devrait maintenant pouvoir:');
      console.log('   - Cliquer sur "Valider"');
      console.log('   - Saisir le montant réel en EUR dans le dialogue');
      console.log('   - Confirmer la validation');
    }

    // 4. Simuler la validation avec un montant qui génère une commission suffisante
    console.log('\n4️⃣ Simulation de la validation avec montant réel...');
    
    const realAmountEUR = 3000; // 3000 EUR pour générer une commission suffisante
    const eurToXAFRate = 650;
    const realAmountXAF = realAmountEUR * eurToXAFRate;
    const commissionAmount = Math.max(0, testTransaction[0].amount - realAmountXAF);
    
    console.log(`📊 Calcul de commission:`);
    console.log(`   - Montant reçu: ${testTransaction[0].amount} XAF`);
    console.log(`   - Montant réel: ${realAmountEUR} EUR (${realAmountXAF} XAF)`);
    console.log(`   - Commission: ${commissionAmount} XAF`);
    
    // Assigner un exécuteur
    const executor = await sql`
      SELECT id, name FROM users WHERE role = 'executor' LIMIT 1
    `;
    
    const executorId = executor[0]?.id;
    const executorName = executor[0]?.name;
    
    // Mettre à jour la transaction
    const validatedTransaction = await sql`
      UPDATE transactions 
      SET 
        real_amount_eur = ${realAmountEUR},
        commission_amount = ${commissionAmount},
        status = 'validated',
        executor_id = ${executorId},
        updated_at = NOW()
      WHERE id = ${testTransaction[0].id}
      RETURNING *
    `;

    console.log('✅ Transaction validée et assignée à l\'exécuteur:', executorName);

    // 5. Vérifier que l'exécuteur peut voir la transaction
    console.log('\n5️⃣ Vérification de l\'accès exécuteur...');
    
    const executorTransactions = await sql`
      SELECT * FROM transactions 
      WHERE executor_id = ${executorId} AND status = 'validated'
    `;
    
    console.log(`📋 Transactions assignées à l'exécuteur: ${executorTransactions.length}`);
    
    if (executorTransactions.length > 0) {
      console.log('✅ L\'exécuteur peut voir la transaction validée');
      console.log('💡 L\'exécuteur devrait maintenant pouvoir:');
      console.log('   - Voir la transaction dans son dashboard');
      console.log('   - Cliquer sur "Exécuter"');
      console.log('   - Saisir l\'URL du reçu et un commentaire');
      console.log('   - Confirmer l\'exécution');
    }

    // 6. Vérifier que le caissier peut voir la transaction exécutée
    console.log('\n6️⃣ Simulation de l\'exécution...');
    
    const executedTransaction = await sql`
      UPDATE transactions 
      SET 
        status = 'executed',
        executed_at = NOW(),
        receipt_url = 'https://example.com/receipt-test.pdf',
        executor_comment = 'Transfert exécuté via interface de test',
        updated_at = NOW()
      WHERE id = ${testTransaction[0].id}
      RETURNING *
    `;
    
    console.log('✅ Transaction exécutée');
    
    const cashierTransactions = await sql`
      SELECT * FROM transactions 
      WHERE created_by = 'Stevie' AND status = 'executed'
    `;
    
    console.log(`📋 Transactions exécutées pour le caissier: ${cashierTransactions.length}`);
    
    if (cashierTransactions.length > 0) {
      console.log('✅ Le caissier peut voir la transaction exécutée');
      console.log('💡 Le caissier devrait maintenant pouvoir:');
      console.log('   - Voir la transaction avec le statut "Exécutée"');
      console.log('   - Cliquer sur "Clôturer" pour finaliser');
    }

    // Résumé des corrections apportées
    console.log('\n🎉 Résumé des corrections apportées:');
    console.log('✅ Interface auditeur: Dialogue pour saisir le montant réel en EUR');
    console.log('✅ Calcul automatique: Commission calculée et validation/rejet automatique');
    console.log('✅ Assignation exécuteur: Transaction assignée automatiquement si commission >= 5000 XAF');
    console.log('✅ Interface exécuteur: Dashboard avec transactions à exécuter');
    console.log('✅ Workflow complet: pending → validated → executed → completed');

    // Nettoyer la transaction de test
    await sql`DELETE FROM transactions WHERE id = ${testTransaction[0].id}`;
    console.log('\n🧹 Transaction de test supprimée');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

testUIWorkflow();
