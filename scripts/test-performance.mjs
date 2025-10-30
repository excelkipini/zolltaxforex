import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function testPerformance() {
  try {
    console.log('🚀 Test de performance de la base de données...')
    
    // Test 1: Mesurer le temps de récupération des stats
    console.log('\n📊 Test 1: Récupération des statistiques')
    const startStats = Date.now()
    
    const stats = await sql`
      SELECT
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as total_pending,
        COUNT(CASE WHEN status = 'validated' THEN 1 END) as total_validated,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as total_rejected,
        COALESCE(SUM(total_delestage), 0) as total_delestage,
        COALESCE(SUM(COALESCE(excedents, 0)), 0) as total_excedents
      FROM ria_cash_declarations
    `
    
    const endStats = Date.now()
    console.log(`✅ Stats récupérées en ${endStats - startStats}ms`)
    console.log('📈 Résultats:', stats[0])
    
    // Test 2: Mesurer le temps de récupération des déclarations
    console.log('\n📋 Test 2: Récupération des déclarations')
    const startDeclarations = Date.now()
    
    const declarations = await sql`
      SELECT 
        rcd.*,
        u.name as user_name,
        u.email as user_email,
        validator.name as validator_name
      FROM ria_cash_declarations rcd
      LEFT JOIN users u ON rcd.user_id = u.id
      LEFT JOIN users validator ON rcd.validated_by = validator.id
      ORDER BY rcd.created_at DESC
      LIMIT 50
    `
    
    const endDeclarations = Date.now()
    console.log(`✅ ${declarations.length} déclarations récupérées en ${endDeclarations - startDeclarations}ms`)
    
    // Test 3: Mesurer le temps d'insertion d'une déclaration
    console.log('\n➕ Test 3: Insertion d\'une déclaration de test')
    const startInsert = Date.now()
    
    const testDeclaration = await sql`
      INSERT INTO ria_cash_declarations (
        user_id, guichetier, declaration_date, montant_brut, 
        total_delestage, excedents, delestage_comment, 
        justificatif_files, status, submitted_at
      ) VALUES (
        (SELECT id FROM users WHERE role = 'cashier' LIMIT 1),
        'Test Performance',
        CURRENT_DATE,
        1000000,
        50000,
        25000,
        'Test de performance',
        '[]'::jsonb,
        'submitted',
        NOW()
      )
      RETURNING id
    `
    
    const endInsert = Date.now()
    console.log(`✅ Déclaration insérée en ${endInsert - startInsert}ms`)
    console.log('🆔 ID:', testDeclaration[0].id)
    
    // Nettoyer la déclaration de test
    await sql`DELETE FROM ria_cash_declarations WHERE id = ${testDeclaration[0].id}`
    console.log('🧹 Déclaration de test supprimée')
    
    // Test 4: Mesurer les requêtes en parallèle
    console.log('\n⚡ Test 4: Requêtes en parallèle')
    const startParallel = Date.now()
    
    const [statsResult, declarationsResult, usersResult] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM ria_cash_declarations`,
      sql`SELECT COUNT(*) as count FROM ria_cash_declarations WHERE status = 'submitted'`,
      sql`SELECT COUNT(*) as count FROM users WHERE role = 'cashier'`
    ])
    
    const endParallel = Date.now()
    console.log(`✅ 3 requêtes en parallèle exécutées en ${endParallel - startParallel}ms`)
    console.log('📊 Résultats parallèles:', {
      totalDeclarations: statsResult[0].count,
      submittedDeclarations: declarationsResult[0].count,
      cashiers: usersResult[0].count
    })
    
    console.log('\n🎉 Tests de performance terminés !')
    
  } catch (error) {
    console.error('❌ Erreur lors du test de performance:', error)
  }
}

testPerformance()
