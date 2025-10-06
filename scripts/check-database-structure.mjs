#!/usr/bin/env node

import { neon } from '@neondatabase/serverless'
import fs from 'fs'

// Charger les variables d'environnement
const envContent = fs.readFileSync('.env.local', 'utf8')
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=')
  if (key && value) {
    process.env[key] = value
  }
})

const sql = neon(process.env.DATABASE_URL)

async function checkDatabaseStructure() {
  console.log('🔍 Vérification de la structure de la base de données...\n')

  try {
    // 1. Lister toutes les tables
    console.log('1. Tables existantes dans la base de données:')
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    
    console.log(`📊 Nombre de tables: ${tables.length}`)
    tables.forEach(table => {
      console.log(`   - ${table.table_name}`)
    })

    // 2. Vérifier la structure de la table users
    console.log('\n2. Structure de la table users:')
    const usersColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `
    
    usersColumns.forEach(column => {
      console.log(`   - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`)
    })

    // 3. Vérifier la structure de la table transactions
    console.log('\n3. Structure de la table transactions:')
    const transactionsColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position
    `
    
    transactionsColumns.forEach(column => {
      console.log(`   - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`)
    })

    // 4. Vérifier la structure de la table expenses
    console.log('\n4. Structure de la table expenses:')
    const expensesColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'expenses'
      ORDER BY ordinal_position
    `
    
    expensesColumns.forEach(column => {
      console.log(`   - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`)
    })

    // 5. Vérifier la structure de la table agencies
    console.log('\n5. Structure de la table agencies:')
    const agenciesColumns = await sql`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'agencies'
      ORDER BY ordinal_position
    `
    
    agenciesColumns.forEach(column => {
      console.log(`   - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`)
    })

    // 6. Vérifier s'il y a une table notifications
    console.log('\n6. Vérification de la table notifications:')
    const notificationsExists = tables.some(table => table.table_name === 'notifications')
    
    if (notificationsExists) {
      console.log('✅ Table notifications existe')
      const notificationsColumns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        ORDER BY ordinal_position
      `
      
      notificationsColumns.forEach(column => {
        console.log(`   - ${column.column_name}: ${column.data_type} (nullable: ${column.is_nullable})`)
      })
    } else {
      console.log('❌ Table notifications n\'existe pas')
    }

    // 7. Vérifier les contraintes de la table users
    console.log('\n7. Contraintes de la table users:')
    const usersConstraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'users'
    `
    
    usersConstraints.forEach(constraint => {
      console.log(`   - ${constraint.constraint_name}: ${constraint.constraint_type}`)
    })

    // 8. Vérifier les contraintes de la table transactions
    console.log('\n8. Contraintes de la table transactions:')
    const transactionsConstraints = await sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'transactions'
    `
    
    transactionsConstraints.forEach(constraint => {
      console.log(`   - ${constraint.constraint_name}: ${constraint.constraint_type}`)
    })

    console.log('\n🎉 Vérification de la structure terminée!')

  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error)
  }
}

checkDatabaseStructure()
