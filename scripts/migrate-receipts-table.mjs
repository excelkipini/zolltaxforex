import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sql = neon(process.env.DATABASE_URL);

async function createReceiptsTable() {
  try {
    console.log('Création de la table receipts...');
    
    const sqlContent = readFileSync(join(__dirname, 'sql', '011_create_receipts_table.sql'), 'utf8');
    await sql(sqlContent);
    
    console.log('✅ Table receipts créée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la création de la table:', error);
    process.exit(1);
  }
}

createReceiptsTable();
