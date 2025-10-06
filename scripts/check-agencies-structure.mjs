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

async function checkAgenciesStructure() {
  try {
    console.log('🔍 Vérification de la structure de la table agencies...\n');

    // Vérifier la structure de la table
    const structure = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'agencies'
      ORDER BY ordinal_position
    `;

    console.log('📋 Structure de la table agencies :');
    structure.forEach(col => {
      console.log(`- ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Lister toutes les agences
    console.log('\n📋 Toutes les agences disponibles :');
    const allAgencies = await sql`
      SELECT *
      FROM agencies 
      ORDER BY name
    `;
    
    allAgencies.forEach(agency => {
      console.log(`- ${agency.name}`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de la vérification :', error);
  }
}

checkAgenciesStructure();
