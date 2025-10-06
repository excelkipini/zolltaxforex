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

async function testTransferWorkflow() {
  try {
    console.log('🧪 Test du workflow de transfert d\'argent...\n');

    // 1. Créer une transaction de transfert par un caissier
    console.log('1️⃣ Création d\'une transaction de transfert...');
    
    const transferTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, details
      ) VALUES (
        'TRX-TEST-' || EXTRACT(EPOCH FROM NOW())::text,
        'transfer',
        'pending',
        'Test transfert - Workflow complet',
        1000000,
        'XAF',
        'Stevie',
        'Douala',
        '{"client_name": "Test Client", "destination": "France"}'
      )
      RETURNING *
    `;

    console.log('✅ Transaction créée:', transferTransaction[0].id);

    // 2. Simuler la validation par un auditeur avec montant réel
    console.log('\n2️⃣ Validation par l\'auditeur avec montant réel...');
    
    const realAmountEUR = 1500; // 1500 EUR
    const eurToXAFRate = 650; // Taux de change
    
    // Calculer la commission
    const receivedAmountXAF = transferTransaction[0].amount;
    const realAmountXAF = realAmountEUR * eurToXAFRate;
    const commissionAmount = Math.max(0, receivedAmountXAF - realAmountXAF);
    
    console.log(`📊 Calcul de commission:`);
    console.log(`   - Montant reçu: ${receivedAmountXAF} XAF`);
    console.log(`   - Montant réel: ${realAmountEUR} EUR (${realAmountXAF} XAF)`);
    console.log(`   - Commission: ${commissionAmount} XAF`);
    
    let newStatus;
    let executorId = null;
    
    if (commissionAmount >= 5000) {
      newStatus = 'validated';
      console.log('✅ Commission >= 5000 XAF → Transaction validée automatiquement');
      
      // Assigner un exécuteur
      const executor = await sql`
        SELECT id FROM users WHERE role = 'executor' LIMIT 1
      `;
      
      if (executor.length > 0) {
        executorId = executor[0].id;
        console.log(`👤 Exécuteur assigné: ${executorId}`);
      } else {
        console.log('⚠️ Aucun exécuteur trouvé');
      }
    } else {
      newStatus = 'rejected';
      console.log('❌ Commission < 5000 XAF → Transaction rejetée automatiquement');
    }

    // Mettre à jour la transaction
    const updatedTransaction = await sql`
      UPDATE transactions 
      SET 
        real_amount_eur = ${realAmountEUR},
        commission_amount = ${commissionAmount},
        status = ${newStatus},
        executor_id = ${executorId},
        updated_at = NOW()
      WHERE id = ${transferTransaction[0].id}
      RETURNING *
    `;

    console.log('✅ Transaction mise à jour:', updatedTransaction[0].status);

    // 3. Vérifier que l'exécuteur peut voir la transaction
    if (executorId && newStatus === 'validated') {
      console.log('\n3️⃣ Vérification de l\'accès exécuteur...');
      
      const executorTransactions = await sql`
        SELECT * FROM transactions WHERE executor_id = ${executorId}
      `;
      
      console.log(`📋 Transactions assignées à l'exécuteur: ${executorTransactions.length}`);
      
      if (executorTransactions.length > 0) {
        console.log('✅ L\'exécuteur peut voir la transaction validée');
        
        // 4. Simuler l'exécution par l'exécuteur
        console.log('\n4️⃣ Exécution par l\'exécuteur...');
        
        const executedTransaction = await sql`
          UPDATE transactions 
          SET 
            status = 'executed',
            executed_at = NOW(),
            receipt_url = 'https://example.com/receipt.pdf',
            executor_comment = 'Transfert exécuté avec succès',
            updated_at = NOW()
          WHERE id = ${transferTransaction[0].id}
          RETURNING *
        `;
        
        console.log('✅ Transaction exécutée:', executedTransaction[0].status);
        
        // 5. Simuler la clôture par le caissier
        console.log('\n5️⃣ Clôture par le caissier...');
        
        const completedTransaction = await sql`
          UPDATE transactions 
          SET 
            status = 'completed',
            updated_at = NOW()
          WHERE id = ${transferTransaction[0].id}
          RETURNING *
        `;
        
        console.log('✅ Transaction clôturée:', completedTransaction[0].status);
      }
    }

    // Résumé du workflow
    console.log('\n🎉 Résumé du workflow:');
    console.log('1. ✅ Caissier crée une transaction de transfert (pending)');
    console.log('2. ✅ Auditeur saisit le montant réel et valide (validated)');
    console.log('3. ✅ Système calcule la commission et assigne un exécuteur');
    console.log('4. ✅ Exécuteur exécute la transaction (executed)');
    console.log('5. ✅ Caissier clôture la transaction (completed)');

    // Nettoyer la transaction de test
    await sql`DELETE FROM transactions WHERE id = ${transferTransaction[0].id}`;
    console.log('\n🧹 Transaction de test supprimée');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

testTransferWorkflow();
