#!/usr/bin/env node

/**
 * Script pour supprimer toutes les transactions directement
 * Contourne l'authentification en utilisant directement la base de données
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

async function deleteAllTransactions() {
  try {
    console.log('🗑️  Suppression de toutes les transactions...')
    
    // Charger la configuration de la base de données
    const envPath = join(__dirname, '..', '.env.local')
    let envContent = ''
    
    try {
      envContent = readFileSync(envPath, 'utf8')
    } catch (error) {
      console.log('⚠️  Fichier .env.local non trouvé, utilisation des variables d\'environnement système')
    }
    
    // Parser les variables d'environnement
    const envVars = {}
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=')
      if (key && value) {
        envVars[key.trim()] = value.trim()
      }
    })
    
    // Utiliser les variables d'environnement système ou du fichier .env
    const databaseUrl = process.env.DATABASE_URL || envVars.DATABASE_URL
    
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL non trouvée. Veuillez définir cette variable d\'environnement.')
      console.log('💡 Vous pouvez créer un fichier .env.local avec: DATABASE_URL=votre_url_de_base_de_donnees')
      return
    }
    
    console.log('🔗 Connexion à la base de données...')
    
    // Import dynamique de neon
    const { neon } = await import('@neondatabase/serverless')
    const sql = neon(databaseUrl)
    
    // Compter d'abord le nombre de transactions
    console.log('📊 Vérification du nombre de transactions...')
    const countResult = await sql`
      SELECT COUNT(*) as count FROM transactions
    `
    const transactionCount = countResult[0]?.count || 0
    
    if (transactionCount === 0) {
      console.log('✅ Aucune transaction trouvée dans la base de données.')
      return
    }
    
    console.log(`📊 ${transactionCount} transaction(s) trouvée(s)`)
    console.log('⚠️  ATTENTION: Cette opération supprimera TOUTES les transactions de manière irréversible!')
    
    // Supprimer toutes les transactions
    console.log('🗑️  Suppression en cours...')
    await sql`
      DELETE FROM transactions
    `
    
    console.log(`✅ ${transactionCount} transaction(s) supprimée(s) avec succès!`)
    
  } catch (error) {
    console.error('❌ Erreur lors de la suppression des transactions:', error.message)
    
    if (error.message.includes('DATABASE_URL')) {
      console.log('💡 Assurez-vous que DATABASE_URL est définie dans votre environnement')
    } else if (error.message.includes('connection')) {
      console.log('💡 Vérifiez votre connexion à la base de données')
    }
    
    throw error
  }
}

// Exécuter le script
deleteAllTransactions()
  .then(() => {
    console.log('🎉 Script terminé avec succès!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Erreur fatale:', error)
    process.exit(1)
  })
