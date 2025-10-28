import { config } from 'dotenv'

// Charger les variables d'environnement depuis .env.local
config({ path: '.env.local' })

async function testUsersAPI() {
  try {
    console.log('🧪 Test de l\'API /api/users...')

    // Test de l'API GET
    const response = await fetch('http://localhost:3000/api/users', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    console.log('Status:', response.status)
    console.log('OK:', response.ok)

    if (response.ok) {
      const data = await response.json()
      console.log('Data:', JSON.stringify(data, null, 2))
    } else {
      const text = await response.text()
      console.log('Error response:', text)
    }

  } catch (error) {
    console.error('❌ Erreur lors du test:', error.message)
  }
}

testUsersAPI()
