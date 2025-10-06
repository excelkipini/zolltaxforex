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

async function testUserCreationWithDouala() {
  try {
    console.log('🧪 Test de création d\'utilisateur avec l\'agence "Douala"...\n');

    // Données de test
    const userData = {
      name: 'Stevie',
      email: 'gs.kibila@gmail.com',
      role: 'executor',
      agency: 'Douala',
      password: 'testpassword123'
    };

    console.log('📋 Données utilisateur :');
    console.log(JSON.stringify(userData, null, 2));

    // Vérifier si l'agence existe
    const agency = await sql`
      SELECT * FROM agencies WHERE name = ${userData.agency}
    `;

    if (agency.length === 0) {
      console.log(`❌ L'agence "${userData.agency}" n'existe pas`);
      return;
    }

    console.log(`✅ Agence trouvée : ${agency[0].name}`);

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await sql`
      SELECT * FROM users WHERE email = ${userData.email}
    `;

    if (existingUser.length > 0) {
      console.log(`⚠️ L'utilisateur avec l'email ${userData.email} existe déjà`);
      console.log('📋 Utilisateur existant :');
      console.log(JSON.stringify(existingUser[0], null, 2));
      return;
    }

    // Créer l'utilisateur
    console.log('\n👤 Création de l\'utilisateur...');
    
    const newUser = await sql`
      INSERT INTO users (name, email, role, agency, password_hash)
      VALUES (${userData.name}, ${userData.email}, ${userData.role}, ${userData.agency}, ${userData.password})
      RETURNING *
    `;

    console.log('✅ Utilisateur créé avec succès :');
    console.log(JSON.stringify(newUser[0], null, 2));

    // Vérifier la création
    const createdUser = await sql`
      SELECT * FROM users WHERE email = ${userData.email}
    `;

    console.log('\n🔍 Vérification de la création :');
    console.log(JSON.stringify(createdUser[0], null, 2));

  } catch (error) {
    console.error('❌ Erreur lors de la création d\'utilisateur :', error);
  }
}

testUserCreationWithDouala();
