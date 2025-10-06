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

async function testExecutorTransactions() {
  try {
    console.log('🧪 Test des transactions de l\'exécuteur...\n');

    // 1. Vérifier les exécuteurs disponibles
    console.log('1️⃣ Vérification des exécuteurs...');
    
    const executors = await sql`
      SELECT id, name, role, agency FROM users WHERE role = 'executor'
    `;
    
    console.log('👥 Exécuteurs disponibles:');
    executors.forEach(executor => {
      console.log(`   - ${executor.name} (${executor.id}) - ${executor.agency}`);
    });

    if (executors.length === 0) {
      console.log('❌ Aucun exécuteur trouvé');
      return;
    }

    const executor = executors[0];
    console.log(`\n🎯 Test avec l'exécuteur: ${executor.name} (${executor.id})`);

    // 2. Créer une transaction de test assignée à cet exécuteur
    console.log('\n2️⃣ Création d\'une transaction de test...');
    
    const testTransaction = await sql`
      INSERT INTO transactions (
        id, type, status, description, amount, currency, created_by, agency, details,
        real_amount_eur, commission_amount, executor_id
      ) VALUES (
        'TRX-EXECUTOR-TEST-' || EXTRACT(EPOCH FROM NOW())::text,
        'transfer',
        'validated',
        'Test exécuteur - Transaction assignée',
        1500000,
        'XAF',
        'Stevie',
        'Douala',
        '{"client_name": "Client Test Executor", "destination": "France"}',
        2000,
        200000,
        ${executor.id}
      )
      RETURNING *
    `;

    console.log('✅ Transaction créée et assignée:', testTransaction[0].id);

    // 3. Tester la fonction getTransactionsForExecutor
    console.log('\n3️⃣ Test de getTransactionsForExecutor...');
    
    const executorTransactions = await sql`
      SELECT 
        id::text,
        type,
        status,
        description,
        amount::bigint as amount,
        currency,
        created_by,
        agency,
        details,
        rejection_reason,
        delete_validated_by,
        delete_validated_at,
        real_amount_eur,
        commission_amount,
        executor_id,
        executed_at,
        receipt_url,
        executor_comment,
        created_at::text as created_at,
        updated_at::text as updated_at
      FROM transactions 
      WHERE executor_id = ${executor.id}
      ORDER BY created_at DESC
    `;

    console.log(`📋 Transactions assignées à l'exécuteur: ${executorTransactions.length}`);
    
    if (executorTransactions.length > 0) {
      console.log('✅ Transactions trouvées:');
      executorTransactions.forEach(tx => {
        console.log(`   - ${tx.id} (${tx.status}) - ${tx.description} - ${tx.amount} ${tx.currency}`);
      });
    } else {
      console.log('❌ Aucune transaction assignée trouvée');
    }

    // 4. Tester l'API GET
    console.log('\n4️⃣ Test de l\'API GET...');
    
    try {
      const response = await fetch(`http://localhost:3000/api/transactions/update-real-amount?executorId=${executor.id}`);
      const data = await response.json();
      
      console.log('📡 Réponse API:');
      console.log('Status:', response.status);
      console.log('Data:', JSON.stringify(data, null, 2));
      
      if (response.ok && data.transactions) {
        console.log(`✅ API retourne ${data.transactions.length} transactions`);
      } else {
        console.log('❌ Erreur API:', data.error);
      }
    } catch (error) {
      console.log('❌ Erreur lors de l\'appel API:', error.message);
      console.log('💡 Le serveur n\'est probablement pas démarré');
    }

    // 5. Vérifier les transactions en attente d'exécution
    console.log('\n5️⃣ Vérification des transactions en attente d\'exécution...');
    
    const pendingTransactions = await sql`
      SELECT * FROM transactions 
      WHERE status = 'validated' AND executor_id IS NOT NULL
      ORDER BY created_at DESC
    `;

    console.log(`📋 Transactions en attente d'exécution: ${pendingTransactions.length}`);
    
    if (pendingTransactions.length > 0) {
      console.log('✅ Transactions en attente:');
      pendingTransactions.forEach(tx => {
        console.log(`   - ${tx.id} (${tx.status}) - Exécuteur: ${tx.executor_id}`);
      });
    }

    // Nettoyer la transaction de test
    await sql`DELETE FROM transactions WHERE id = ${testTransaction[0].id}`;
    console.log('\n🧹 Transaction de test supprimée');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
  }
}

testExecutorTransactions();
