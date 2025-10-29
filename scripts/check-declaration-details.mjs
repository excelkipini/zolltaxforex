import { config } from "dotenv"
import { neon } from "@neondatabase/serverless"

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function checkDeclarationDetails() {
  try {
    console.log('🔍 Vérification des détails des arrêtés de caisse...')
    
    // Récupérer tous les arrêtés avec leurs détails
    const declarations = await sql`
      SELECT 
        id, guichetier, declaration_date, montant_brut, total_delestage, 
        excedents, justificatif_files, status, delestage_comment,
        created_at, submitted_at
      FROM ria_cash_declarations 
      ORDER BY created_at DESC
    `
    
    console.log('📊 Arrêtés de caisse trouvés:', declarations.length)
    
    declarations.forEach((declaration, index) => {
      console.log(`\n📋 Arrêté ${index + 1}:`)
      console.log(`  - ID: ${declaration.id}`)
      console.log(`  - Guichetier: ${declaration.guichetier}`)
      console.log(`  - Date: ${declaration.declaration_date}`)
      console.log(`  - Montant Brut: ${declaration.montant_brut} FCFA`)
      console.log(`  - Délestage: ${declaration.total_delestage} FCFA`)
      console.log(`  - Excédents: ${declaration.excedents} FCFA`)
      console.log(`  - Statut: ${declaration.status}`)
      console.log(`  - Fichiers: ${JSON.stringify(declaration.justificatif_files)}`)
      console.log(`  - Commentaire: ${declaration.delestage_comment}`)
    })
    
  } catch (error) {
    console.error('❌ Erreur:', error)
  }
}

checkDeclarationDetails()
