import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { hasPermission } from '../lib/rbac.js'

// Charger les variables d'environnement
config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL)

async function testCashManagerPermissions() {
  try {
    console.log('🧪 Test des permissions du rôle cash_manager...')
    
    // Récupérer l'utilisateur RC
    const users = await sql`
      SELECT id, name, email, role
      FROM users 
      WHERE email = 'rc@zolltaxforex.com'
    `
    
    if (users.length === 0) {
      console.log('❌ Utilisateur RC non trouvé')
      return
    }
    
    const user = users[0]
    console.log(`👤 Utilisateur trouvé: ${user.name} (${user.email}) - Rôle: ${user.role}`)
    
    // Tester les permissions RIA
    const permissions = [
      'view_ria_dashboard',
      'import_ria_csv', 
      'view_ria_transactions'
    ]
    
    console.log('\n🔐 Test des permissions:')
    permissions.forEach(permission => {
      const hasAccess = hasPermission(user, permission)
      console.log(`  - ${permission}: ${hasAccess ? '✅' : '❌'}`)
    })
    
    // Tester avec le rôle directement
    console.log('\n🔐 Test avec le rôle directement:')
    permissions.forEach(permission => {
      const hasAccess = hasPermission('cash_manager', permission)
      console.log(`  - ${permission}: ${hasAccess ? '✅' : '❌'}`)
    })
    
    // Vérifier les permissions définies pour cash_manager
    console.log('\n📋 Permissions définies pour cash_manager:')
    const { getRolePermissions } = await import('../lib/rbac.js')
    const rolePermissions = getRolePermissions('cash_manager')
    console.log(rolePermissions)
    
  } catch (error) {
    console.error('❌ Erreur lors du test:', error)
  }
}

testCashManagerPermissions()
