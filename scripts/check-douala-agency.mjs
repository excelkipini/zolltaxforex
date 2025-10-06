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

async function checkDoualaAgency() {
  try {
    console.log('🔍 Vérification de l\'agence "Douala (Cameroun)"...\n');

    // Vérifier si l'agence existe
    const agencies = await sql`
      SELECT id, name, country, city, address, phone, email, manager_name, created_at
      FROM agencies 
      WHERE name ILIKE '%Douala%' OR city ILIKE '%Douala%'
    `;

    console.log('📋 Agences trouvées avec "Douala" :');
    console.log(JSON.stringify(agencies, null, 2));

    if (agencies.length === 0) {
      console.log('\n❌ Aucune agence "Douala" trouvée');
      
      // Créer l'agence Douala
      console.log('\n🏢 Création de l\'agence "Douala (Cameroun)"...');
      
      const newAgency = await sql`
        INSERT INTO agencies (name, country, city, address, phone, email, manager_name)
        VALUES ('Douala (Cameroun)', 'Cameroun', 'Douala', 'Douala, Cameroun', '+237 123 456 789', 'douala@zolltaxforex.com', 'Manager Douala')
        RETURNING *
      `;
      
      console.log('✅ Agence créée :');
      console.log(JSON.stringify(newAgency[0], null, 2));
    } else {
      console.log('\n✅ Agence "Douala" trouvée');
    }

    // Lister toutes les agences pour référence
    console.log('\n📋 Toutes les agences disponibles :');
    const allAgencies = await sql`
      SELECT id, name, country, city
      FROM agencies 
      ORDER BY name
    `;
    
    allAgencies.forEach(agency => {
      console.log(`- ${agency.name} (${agency.city}, ${agency.country})`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification de l\'agence :', error);
  }
}

checkDoualaAgency();
