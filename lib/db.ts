import { neon } from "@neondatabase/serverless"

// Mode développement : utiliser des données mockées si pas de DATABASE_URL
const isDevelopment = process.env.NODE_ENV === "development"
const hasDatabaseUrl = !!process.env.DATABASE_URL

console.log('🔍 Debug DATABASE_URL:', {
  NODE_ENV: process.env.NODE_ENV,
  hasDatabaseUrl: hasDatabaseUrl,
  DATABASE_URL_length: process.env.DATABASE_URL?.length || 0
})

if (hasDatabaseUrl) {
  console.log('✅ UTILISATION DE LA VRAIE BASE DE DONNÉES')
} else {
  console.log('❌ UTILISATION DES DONNÉES MOCKÉES')
}

// En production, exiger DATABASE_URL
if (!hasDatabaseUrl && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL environment variable is required in production")
}

// En développement, utiliser mock si pas de DATABASE_URL
if (!hasDatabaseUrl && isDevelopment) {
  console.log("🔧 Mode développement: utilisation des données mockées")
  console.log("💡 Pour utiliser une vraie base de données, définissez DATABASE_URL dans .env.local")
}

// Mock SQL pour le développement
const mockSql = (strings: TemplateStringsArray, ...values: any[]) => {
  // Simuler des données de cartes pour le développement
  if (strings[0]?.includes('SELECT') && strings[0]?.includes('cards')) {
    return Promise.resolve([
      {
        id: "card-1",
        cid: "21174132",
        country: "Mali",
        last_recharge_date: "2024-01-15",
        expiration_date: "2025-12-31",
        status: "active",
        monthly_limit: 2400000,
        monthly_used: 500000,
        recharge_limit: 810000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-15T00:00:00Z"
      },
      {
        id: "card-2",
        cid: "21174133",
        country: "RDC",
        last_recharge_date: "2024-01-10",
        expiration_date: "2025-11-30",
        status: "active",
        monthly_limit: 2500000,
        monthly_used: 1200000,
        recharge_limit: 550000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-10T00:00:00Z"
      },
      {
        id: "card-3",
        cid: "21174134",
        country: "France",
        last_recharge_date: null,
        expiration_date: "2025-10-31",
        status: "inactive",
        monthly_limit: 2500000,
        monthly_used: 0,
        recharge_limit: 650000,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z"
      }
    ])
  }
  
  // Simuler des données d'historique de recharge
  if (strings[0]?.includes('SELECT') && strings[0]?.includes('card_recharges')) {
    return Promise.resolve([
      {
        id: "recharge-1",
        card_id: "card-1",
        amount: 100000,
        recharged_by: "Admin User",
        recharge_date: "2024-01-15T10:00:00Z",
        notes: "Recharge initiale",
        created_at: "2024-01-15T10:00:00Z",
        card_cid: "21174132",
        card_country: "Mali"
      },
      {
        id: "recharge-2",
        card_id: "card-2",
        amount: 200000,
        recharged_by: "Admin User",
        recharge_date: "2024-01-10T14:30:00Z",
        notes: "Recharge mensuelle",
        created_at: "2024-01-10T14:30:00Z",
        card_cid: "21174133",
        card_country: "RDC"
      }
    ])
  }
  
  // Pour les autres requêtes, retourner un tableau vide
  return Promise.resolve([])
}

export const sql = hasDatabaseUrl ? neon(process.env.DATABASE_URL) : mockSql

// Test database connection
export async function testConnection() {
  try {
    if (!hasDatabaseUrl) {
      return true
    }
    const result = await sql`SELECT 1 as test`
    return true
  } catch (error) {
    return false
  }
}

// Initialize database with all required tables
export async function initializeDatabase() {
  try {
    if (!hasDatabaseUrl) {
      return true
    }

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('super_admin','director','accounting','cashier','auditor','delegate','executor')),
        agency TEXT NOT NULL DEFAULT 'Non assigné',
        password_hash TEXT,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Create agencies table
    await sql`
      CREATE TABLE IF NOT EXISTS agencies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        country TEXT NOT NULL,
        address TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','inactive')),
        users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Create user_agencies junction table
    await sql`
      CREATE TABLE IF NOT EXISTS user_agencies (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, agency_id)
      )
    `

    // Create agency_limits table
    await sql`
      CREATE TABLE IF NOT EXISTS agency_limits (
        agency_id UUID PRIMARY KEY REFERENCES agencies(id) ON DELETE CASCADE,
        daily_limit BIGINT,
        transfer_limit BIGINT,
        card_limit BIGINT,
        commission NUMERIC,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create settings table
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY DEFAULT 'global',
        usd NUMERIC NOT NULL DEFAULT 1.0,
        eur NUMERIC NOT NULL DEFAULT 0.85,
        gbp NUMERIC NOT NULL DEFAULT 0.75,
        transfer_limit BIGINT NOT NULL DEFAULT 10000,
        daily_limit BIGINT NOT NULL DEFAULT 50000,
        card_limit BIGINT NOT NULL DEFAULT 5000,
        commission NUMERIC NOT NULL DEFAULT 0.02,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create settings_history table
    await sql`
      CREATE TABLE IF NOT EXISTS settings_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        usd NUMERIC NOT NULL,
        eur NUMERIC NOT NULL,
        gbp NUMERIC NOT NULL,
        transfer_limit BIGINT NOT NULL,
        daily_limit BIGINT NOT NULL,
        card_limit BIGINT NOT NULL,
        commission NUMERIC NOT NULL,
        changed_by TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create expenses table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        description TEXT NOT NULL,
        amount BIGINT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','accounting_approved','accounting_rejected','director_approved','director_rejected')) DEFAULT 'pending',
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        requested_by TEXT NOT NULL,
        agency TEXT NOT NULL,
        comment TEXT,
        rejection_reason TEXT,
        accounting_validated_by TEXT,
        accounting_validated_at TIMESTAMPTZ,
        director_validated_by TEXT,
        director_validated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create cards table
    await sql`
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cid TEXT NOT NULL UNIQUE,
        country TEXT NOT NULL CHECK (country IN ('Mali','RDC','France','Congo')) DEFAULT 'Mali',
        last_recharge_date DATE,
        expiration_date DATE,
        status TEXT NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
        monthly_limit BIGINT NOT NULL DEFAULT 2000000,
        monthly_used BIGINT NOT NULL DEFAULT 0,
        recharge_limit BIGINT NOT NULL DEFAULT 500000,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Migration: Ajouter les nouveaux champs si ils n'existent pas
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS country TEXT CHECK (country IN ('Mali','RDC','France','Congo')) DEFAULT 'Mali'
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS recharge_limit BIGINT DEFAULT 500000
    `

    // Add comment column if it doesn't exist (migration)
    await sql`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS comment TEXT
    `

    // Insert sample cards if none exist
    const existingCards = await sql`SELECT COUNT(*) as count FROM cards`
    if (existingCards[0].count === '0') {
      await sql`
        INSERT INTO cards (cid, last_recharge_date, expiration_date, status, monthly_limit, monthly_used) VALUES
        ('21174132', '2024-01-15', '2025-12-31', 'active', 2000000, 500000),
        ('21174133', '2024-01-10', '2025-12-31', 'active', 2000000, 1200000),
        ('21174134', '2024-01-20', '2025-12-31', 'active', 2000000, 800000),
        ('21174135', '2024-01-05', '2025-12-31', 'inactive', 2000000, 0),
        ('21174136', '2024-01-12', '2025-12-31', 'active', 2000000, 1500000)
      `
    }

    // Add rejection_reason column if it doesn't exist (migration)
    await sql`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `

    // Add validation columns to expenses table if they don't exist
    await sql`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accounting_validated_by TEXT
    `
    await sql`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS accounting_validated_at TIMESTAMPTZ
    `
    await sql`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS director_validated_by TEXT
    `
    await sql`
      ALTER TABLE expenses ADD COLUMN IF NOT EXISTS director_validated_at TIMESTAMPTZ
    `

    // Update expenses status constraint to include new statuses
    await sql`
      ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_status_check
    `
    await sql`
      ALTER TABLE expenses ADD CONSTRAINT expenses_status_check 
      CHECK (status IN ('pending','accounting_approved','accounting_rejected','director_approved','director_rejected'))
    `

    // Create transactions table for all transaction types
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type TEXT NOT NULL CHECK (type IN ('reception','exchange','transfer','card')),
        status TEXT NOT NULL CHECK (status IN ('pending','validated','rejected','completed')) DEFAULT 'pending',
        description TEXT NOT NULL,
        amount BIGINT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'XAF',
        created_by TEXT NOT NULL,
        agency TEXT NOT NULL,
        details JSONB,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create cards table
    await sql`
      CREATE TABLE IF NOT EXISTS cards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cid TEXT NOT NULL UNIQUE,
        country TEXT NOT NULL CHECK (country IN ('Mali','RDC','France','Congo')) DEFAULT 'Mali',
        last_recharge_date DATE,
        expiration_date DATE,
        status TEXT NOT NULL CHECK (status IN ('active','inactive')) DEFAULT 'active',
        monthly_limit BIGINT NOT NULL DEFAULT 2000000,
        monthly_used BIGINT NOT NULL DEFAULT 0,
        recharge_limit BIGINT NOT NULL DEFAULT 500000,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Migration: Add new columns to existing cards table if they don't exist
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS cid TEXT
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Mali'
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS last_recharge_date DATE
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS expiration_date DATE
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS monthly_limit BIGINT DEFAULT 2000000
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS monthly_used BIGINT DEFAULT 0
    `
    await sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS recharge_limit BIGINT DEFAULT 500000
    `

    // Update constraints for cards table
    await sql`
      ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_status_check
    `
    await sql`
      ALTER TABLE cards ADD CONSTRAINT cards_status_check 
      CHECK (status IN ('active','inactive'))
    `

    // Create card_recharges table for recharge history
    await sql`
      CREATE TABLE IF NOT EXISTS card_recharges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        amount BIGINT NOT NULL,
        recharged_by TEXT NOT NULL,
        recharge_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create uploaded_files table for storing file uploads
    await sql`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        filename TEXT NOT NULL,
        content_type TEXT NOT NULL,
        file_data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create cash_accounts table for managing cash balances
    await sql`
      CREATE TABLE IF NOT EXISTS cash_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_type TEXT NOT NULL CHECK (account_type IN ('uba', 'ecobank', 'coffre', 'commissions')),
        account_name TEXT NOT NULL,
        current_balance BIGINT NOT NULL DEFAULT 0,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create cash_transactions table for tracking cash movements
    await sql`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_type TEXT NOT NULL CHECK (account_type IN ('uba', 'ecobank', 'coffre', 'commissions')),
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'expense', 'commission')),
        amount BIGINT NOT NULL,
        description TEXT NOT NULL,
        reference_id TEXT, -- Reference to expense or transaction
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Create card_recharges table for recharge history
    await sql`
      CREATE TABLE IF NOT EXISTS card_recharges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        amount BIGINT NOT NULL,
        recharged_by TEXT NOT NULL,
        recharge_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    return true
  } catch (error) {
    return false
  }
}

// Seed initial data
export async function seedDatabase() {
  try {
    if (!hasDatabaseUrl) {
      return true
    }

    // Insert default settings if not exists
    await sql`
      INSERT INTO settings (id, usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission)
      VALUES ('global', 1.0, 0.85, 0.75, 10000, 50000, 5000, 0.02)
      ON CONFLICT (id) DO NOTHING
    `

    // Insert default agencies
    const agencies = [
      {
        id: "a1000000-0000-4000-8000-000000000001",
        name: "Agence Centrale",
        country: "France",
        address: "123 Rue de la Paix, Paris",
        status: "active",
        users: 0,
      },
      {
        id: "a1000000-0000-4000-8000-000000000002",
        name: "Agence Lyon",
        country: "France",
        address: "456 Avenue de la République, Lyon",
        status: "active",
        users: 0,
      },
      {
        id: "a1000000-0000-4000-8000-000000000003",
        name: "Agence Marseille",
        country: "France",
        address: "789 Boulevard Michelet, Marseille",
        status: "active",
        users: 0,
      },
    ]

    for (const agency of agencies) {
      await sql`
        INSERT INTO agencies (id, name, country, address, status, users)
        VALUES (${agency.id}::uuid, ${agency.name}, ${agency.country}, ${agency.address}, ${agency.status}, ${agency.users})
        ON CONFLICT (name) DO NOTHING
      `
    }

    // Insert test users
    const testUsers = [
      {
        id: "u1000000-0000-4000-8000-000000000001",
        name: "Admin Système",
        email: "admin@test.com",
        role: "super_admin",
        agency: "Administration",
        password_hash: "password123",
      },
      {
        id: "u1000000-0000-4000-8000-000000000002",
        name: "Jean Directeur",
        email: "directeur@test.com",
        role: "director",
        agency: "Direction Générale",
        password_hash: "password123",
      },
      {
        id: "u1000000-0000-4000-8000-000000000003",
        name: "Marie Comptable",
        email: "comptable@test.com",
        role: "accounting",
        agency: "Service Comptabilité",
        password_hash: "password123",
      },
      {
        id: "u1000000-0000-4000-8000-000000000004",
        name: "Paul Caissier",
        email: "caissier@test.com",
        role: "cashier",
        agency: "Agence Centrale",
        password_hash: "password123",
      },
      {
        id: "u1000000-0000-4000-8000-000000000005",
        name: "Marc Auditeur",
        email: "auditeur@test.com",
        role: "auditor",
        agency: "Service Audit",
        password_hash: "password123",
      },
      {
        id: "u1000000-0000-4000-8000-000000000006",
        name: "Sophie Délégué",
        email: "delegue@test.com",
        role: "delegate",
        agency: "Agence Régionale",
        password_hash: "password123",
      },
    ]

    for (const user of testUsers) {
      await sql`
        INSERT INTO users (id, name, email, role, agency, password_hash)
        VALUES (${user.id}::uuid, ${user.name}, ${user.email}, ${user.role}, ${user.agency}, ${user.password_hash})
        ON CONFLICT (email) DO NOTHING
      `
    }

    // Link users to agencies
    const userAgencyLinks = [
      { userId: "u1000000-0000-4000-8000-000000000001", agencyId: "a1000000-0000-4000-8000-000000000001" },
      { userId: "u1000000-0000-4000-8000-000000000002", agencyId: "a1000000-0000-4000-8000-000000000001" },
      { userId: "u1000000-0000-4000-8000-000000000003", agencyId: "a1000000-0000-4000-8000-000000000001" },
      { userId: "u1000000-0000-4000-8000-000000000004", agencyId: "a1000000-0000-4000-8000-000000000001" },
      { userId: "u1000000-0000-4000-8000-000000000005", agencyId: "a1000000-0000-4000-8000-000000000002" },
      { userId: "u1000000-0000-4000-8000-000000000006", agencyId: "a1000000-0000-4000-8000-000000000003" },
    ]

    for (const link of userAgencyLinks) {
      await sql`
        INSERT INTO user_agencies (user_id, agency_id)
        VALUES (${link.userId}::uuid, ${link.agencyId}::uuid)
        ON CONFLICT DO NOTHING
      `
    }

    return true
  } catch (error) {
    return false
  }
}
