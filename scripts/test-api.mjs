import { config } from "dotenv"

// Charger les variables d'environnement
config({ path: '.env.local' })

async function testAPI() {
  try {
    console.log('🔍 Test de l\'API...')
    
    // Test avec fetch
    const response = await fetch('http://localhost:3000/api/ria-cash-declarations?type=stats', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    
    console.log('📊 Status:', response.status)
    console.log('📊 Headers:', Object.fromEntries(response.headers.entries()))
    
    const data = await response.text()
    console.log('📊 Response:', data)
    
  } catch (error) {
    console.error('❌ Erreur API:', error)
  }
}

testAPI()
