import { neon } from "@neondatabase/serverless"
import { config } from "dotenv"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function initRiaCashDeclarationsTable() {
  try {
    console.log('🚀 Initialisation de la table ria_cash_declarations...')

    // Créer la table ria_cash_declarations
    await sql`
      CREATE TABLE IF NOT EXISTS ria_cash_declarations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        guichetier TEXT NOT NULL,
        declaration_date DATE NOT NULL,
        montant_brut NUMERIC(15, 2) NOT NULL DEFAULT 0,
        total_delestage NUMERIC(15, 2) NOT NULL DEFAULT 0,
        delestage_comment TEXT,
        justificatif_file_path TEXT,
        status TEXT NOT NULL CHECK (status IN ('submitted', 'validated', 'rejected')) DEFAULT 'submitted',
        rejection_comment TEXT,
        validation_comment TEXT,
        validated_by UUID,
        validated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_at TIMESTAMPTZ
      )
    `

    // Ajouter les colonnes manquantes si elles n'existent pas
    await sql`
      ALTER TABLE ria_cash_declarations 
      ADD COLUMN IF NOT EXISTS excedents NUMERIC(15, 2) DEFAULT 0
    `

    await sql`
      ALTER TABLE ria_cash_declarations 
      ADD COLUMN IF NOT EXISTS justificatif_files JSONB DEFAULT '[]'::jsonb
    `

    console.log('✅ Table ria_cash_declarations créée avec succès')

    // Vérifier d'abord si des utilisateurs existent
    const users = await sql`SELECT id, name, role FROM users LIMIT 5`
    console.log('👥 Utilisateurs disponibles:', users)

    if (users.length === 0) {
      console.log('⚠️ Aucun utilisateur trouvé. Création d\'un utilisateur de test...')
      
      // Créer un utilisateur de test
      await sql`
        INSERT INTO users (id, name, email, role, agency, password_hash)
        VALUES (
          gen_random_uuid(),
          'Test Caissier',
          'test@example.com',
          'cashier',
          'Test Agency',
          'password123'
        )
      `
      
      const newUser = await sql`SELECT id FROM users WHERE email = 'test@example.com'`
      console.log('✅ Utilisateur de test créé:', newUser[0])
    }

    // Récupérer un utilisateur caissier
    const cashier = await sql`SELECT id FROM users WHERE role = 'cashier' LIMIT 1`
    const director = await sql`SELECT id FROM users WHERE role = 'director' LIMIT 1`
    
    if (cashier.length === 0) {
      console.log('❌ Aucun caissier trouvé')
      return
    }

    // Insérer quelques données de test
    const testData = [
      {
        user_id: cashier[0].id,
        guichetier: 'Jean Dupont',
        declaration_date: '2024-01-15',
        montant_brut: 1500000,
        total_delestage: 50000,
        excedents: 25000,
        delestage_comment: 'Délestage pour maintenance',
        justificatif_files: [],
        status: 'validated',
        validation_comment: 'Validé par le responsable',
        validated_by: director.length > 0 ? director[0].id : null,
        validated_at: '2024-01-15T11:00:00Z',
        submitted_at: '2024-01-15T10:30:00Z'
      },
      {
        user_id: cashier[0].id,
        guichetier: 'Marie Martin',
        declaration_date: '2024-01-16',
        montant_brut: 2000000,
        total_delestage: 75000,
        excedents: 30000,
        delestage_comment: 'Délestage pour réparation',
        justificatif_files: [],
        status: 'submitted',
        submitted_at: '2024-01-16T09:30:00Z'
      }
    ]

    for (const data of testData) {
      await sql`
        INSERT INTO ria_cash_declarations (
          user_id, guichetier, declaration_date, montant_brut, total_delestage,
          excedents, delestage_comment, justificatif_files, status,
          validation_comment, validated_by, validated_at, submitted_at
        ) VALUES (
          ${data.user_id}, ${data.guichetier}, ${data.declaration_date},
          ${data.montant_brut}, ${data.total_delestage}, ${data.excedents},
          ${data.delestage_comment}, ${data.justificatif_files}::jsonb,
          ${data.status}, ${data.validation_comment || null},
          ${data.validated_by || null}, ${data.validated_at || null}, 
          ${data.submitted_at || null}
        )
      `
    }

    console.log('✅ Données de test insérées avec succès')

    // Vérifier les données
    const result = await sql`SELECT COUNT(*) as count FROM ria_cash_declarations`
    console.log(`📊 Nombre d'arrêtés de caisse: ${result[0].count}`)

  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error)
    process.exit(1)
  }
}

initRiaCashDeclarationsTable()
