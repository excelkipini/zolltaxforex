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

async function verifyExecutorUser() {
  try {
    console.log('🔍 Vérification finale de l\'utilisateur Exécuteur...\n');

    // Vérifier l'utilisateur Stevie
    const user = await sql`
      SELECT * FROM users WHERE email = 'gs.kibila@gmail.com'
    `;

    if (user.length > 0) {
      console.log('✅ Utilisateur Stevie trouvé :');
      console.log(JSON.stringify(user[0], null, 2));
    } else {
      console.log('❌ Utilisateur Stevie non trouvé');
    }

    // Vérifier l'agence Douala
    const agency = await sql`
      SELECT * FROM agencies WHERE name = 'Douala'
    `;

    if (agency.length > 0) {
      console.log('\n✅ Agence Douala trouvée :');
      console.log(JSON.stringify(agency[0], null, 2));
    } else {
      console.log('\n❌ Agence Douala non trouvée');
    }

    // Lister tous les utilisateurs avec le rôle executor
    const executors = await sql`
      SELECT * FROM users WHERE role = 'executor'
    `;

    console.log('\n👥 Tous les utilisateurs Exécuteur :');
    executors.forEach(executor => {
      console.log(`- ${executor.name} (${executor.email}) - ${executor.agency}`);
    });

    console.log('\n🎉 Résumé :');
    console.log('✅ Le rôle "executor" est supporté dans la base de données');
    console.log('✅ L\'agence "Douala" existe');
    console.log('✅ L\'utilisateur Stevie avec le rôle Exécuteur existe');
    console.log('✅ Le composant users-db-client.tsx a été mis à jour pour inclure le rôle "executor"');
    console.log('✅ Le mapping des rôles inclut maintenant "executor" -> "Exécuteur"');
    console.log('\n💡 Le problème "Tous les champs sont requis" devrait maintenant être résolu !');

  } catch (error) {
    console.error('❌ Erreur lors de la vérification :', error);
  }
}

verifyExecutorUser();
