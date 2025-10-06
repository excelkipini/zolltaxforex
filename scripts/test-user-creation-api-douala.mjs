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

async function testUserCreationAPI() {
  try {
    console.log('🧪 Test de création d\'utilisateur via l\'API...\n');

    // Données de test
    const userData = {
      name: 'Stevie',
      email: 'gs.kibila@gmail.com',
      roleLabel: 'Exécuteur',
      agency: 'Douala',
      password: 'testpassword123'
    };

    console.log('📋 Données utilisateur :');
    console.log(JSON.stringify(userData, null, 2));

    // Simuler l'appel API
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData)
    });

    const result = await response.json();
    
    console.log('\n📡 Réponse API :');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(result, null, 2));

    if (response.ok && result.ok) {
      console.log('\n✅ Utilisateur créé avec succès via l\'API');
    } else {
      console.log('\n❌ Erreur lors de la création via l\'API');
      console.log('Erreur:', result.error);
    }

  } catch (error) {
    console.error('❌ Erreur lors du test API :', error);
  }
}

testUserCreationAPI();
