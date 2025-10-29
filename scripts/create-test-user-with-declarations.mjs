import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"
import bcrypt from "bcryptjs"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function createTestUserWithDeclarations() {
  try {
    console.log('👤 Création d\'un utilisateur de test avec des arrêtés...')
    
    // Hash du mot de passe
    const password = 'password123'
    const hashedPassword = await bcrypt.hash(password, 10)
    
    // Créer l'utilisateur de test
    const userResult = await sql`
      INSERT INTO users (id, name, email, role, agency, password_hash)
      VALUES (
        gen_random_uuid(),
        'Test User Files',
        'testfiles2@example.com',
        'cashier',
        'Test Agency',
        ${hashedPassword}
      )
      RETURNING id, name, email, role
    `
    
    console.log('✅ Utilisateur de test créé:', userResult[0])
    
    const userId = userResult[0].id
    
    // Créer des arrêtés de caisse avec des fichiers
    const declarations = [
      {
        guichetier: 'Test User Files',
        declaration_date: '2024-10-29',
        montant_brut: 5000,
        total_delestage: 4000,
        excedents: 250,
        delestage_comment: 'Délestage pour maintenance',
        justificatif_files: JSON.stringify([
          {
            id: 'file1',
            filename: 'justificatif1.pdf',
            url: '/api/files/file1',
            uploaded_at: '2024-10-29T10:00:00Z'
          },
          {
            id: 'file2',
            filename: 'justificatif2.csv',
            url: '/api/files/file2',
            uploaded_at: '2024-10-29T10:05:00Z'
          }
        ]),
        status: 'submitted',
        submitted_at: '2024-10-29T10:30:00Z'
      },
      {
        guichetier: 'Test User Files',
        declaration_date: '2024-10-28',
        montant_brut: 1500000,
        total_delestage: 50000,
        excedents: 25000,
        delestage_comment: 'Délestage pour réparation',
        justificatif_files: JSON.stringify([
          {
            id: 'file3',
            filename: 'rapport.pdf',
            url: '/api/files/file3',
            uploaded_at: '2024-10-28T14:00:00Z'
          }
        ]),
        status: 'validated',
        validation_comment: 'Validé par le responsable',
        validated_by: userId,
        validated_at: '2024-10-28T15:00:00Z',
        submitted_at: '2024-10-28T14:30:00Z'
      }
    ]
    
    for (const declaration of declarations) {
      const result = await sql`
        INSERT INTO ria_cash_declarations (
          user_id, guichetier, declaration_date, montant_brut, total_delestage,
          excedents, delestage_comment, justificatif_files, status,
          validation_comment, validated_by, validated_at, submitted_at
        ) VALUES (
          ${userId}, ${declaration.guichetier}, ${declaration.declaration_date},
          ${declaration.montant_brut}, ${declaration.total_delestage}, ${declaration.excedents},
          ${declaration.delestage_comment}, ${declaration.justificatif_files}::jsonb,
          ${declaration.status}, ${declaration.validation_comment || null},
          ${declaration.validated_by || null}, ${declaration.validated_at || null}, 
          ${declaration.submitted_at || null}
        )
        RETURNING id, guichetier, status
      `
      
      console.log('✅ Arrêté créé:', result[0])
    }
    
    console.log('\n📧 Email: testfiles2@example.com')
    console.log('🔑 Mot de passe: password123')
    console.log('📊 Arrêtés créés avec fichiers joints')
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

createTestUserWithDeclarations()
