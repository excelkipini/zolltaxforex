import { neon } from "@neondatabase/serverless"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required")
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

async function initializeNeonDatabase() {
  console.log("🚀 Starting Neon Database initialization...")
  
  try {
    // Test connection
    console.log("🔄 Testing database connection...")
    await sql`SELECT 1 as test`
    console.log("✅ Database connection successful")
    
    // Create all tables
    console.log("🔄 Creating tables...")
    
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL CHECK (role IN ('super_admin','director','accounting','cashier','auditor','delegate')),
        agency TEXT NOT NULL DEFAULT 'Non assigné',
        password_hash TEXT,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    console.log("✅ Users table created")
    
    // Agencies table
    await sql`
      CREATE TABLE IF NOT EXISTS agencies (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        country TEXT NOT NULL,
        address TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','inactive')),
        users INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `
    console.log("✅ Agencies table created")
    
    // User agencies junction table
    await sql`
      CREATE TABLE IF NOT EXISTS user_agencies (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, agency_id)
      )
    `
    console.log("✅ User agencies table created")
    
    // Agency limits table
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
    console.log("✅ Agency limits table created")
    
    // Settings table
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
    console.log("✅ Settings table created")
    
    // Settings history table
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
    console.log("✅ Settings history table created")
    
    // Expenses table
    await sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        description TEXT NOT NULL,
        amount BIGINT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        requested_by TEXT NOT NULL,
        agency TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    console.log("✅ Expenses table created")

    // Notifications table
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message TEXT NOT NULL,
        target_role TEXT,
        target_user_name TEXT,
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `
    console.log("✅ Notifications table created")

    // Seed initial data
    console.log("🌱 Seeding initial data...")
    
    // Default settings
    await sql`
      INSERT INTO settings (id, usd, eur, gbp, transfer_limit, daily_limit, card_limit, commission)
      VALUES ('global', 1.0, 0.85, 0.75, 10000, 50000, 5000, 0.02)
      ON CONFLICT (id) DO NOTHING
    `
    console.log("✅ Default settings inserted")
    
    // Default agencies
    const agencies = [
      {
        id: 'a1000000-0000-4000-8000-000000000001',
        name: 'Agence Centrale',
        country: 'France',
        address: '123 Rue de la Paix, Paris',
        status: 'active'
      },
      {
        id: 'a1000000-0000-4000-8000-000000000002',
        name: 'Agence Lyon',
        country: 'France',
        address: '456 Avenue de la République, Lyon',
        status: 'active'
      },
      {
        id: 'a1000000-0000-4000-8000-000000000003',
        name: 'Agence Marseille',
        country: 'France',
        address: '789 Boulevard Michelet, Marseille',
        status: 'active'
      },
      {
        id: 'a1000000-0000-4000-8000-000000000004',
        name: 'Agence Toulouse',
        country: 'France',
        address: '321 Place du Capitole, Toulouse',
        status: 'active'
      }
    ]
    
    for (const agency of agencies) {
      await sql`
        INSERT INTO agencies (id, name, country, address, status, users)
        VALUES (${agency.id}::uuid, ${agency.name}, ${agency.country}, ${agency.address}, ${agency.status}, 0)
        ON CONFLICT (name) DO NOTHING
      `
    }
    console.log("✅ Default agencies inserted")
    
    // Test users
    const testUsers = [
      { name: 'Admin Système', email: 'admin@test.com', role: 'super_admin', agency: 'Administration' },
      { name: 'Jean Directeur', email: 'directeur@test.com', role: 'director', agency: 'Direction Générale' },
      { name: 'Marie Comptable', email: 'comptable@test.com', role: 'accounting', agency: 'Service Comptabilité' },
      { name: 'Paul Caissier', email: 'caissier@test.com', role: 'cashier', agency: 'Agence Centrale' },
      { name: 'Marc Auditeur', email: 'auditeur@test.com', role: 'auditor', agency: 'Service Audit' },
      { name: 'Sophie Délégué', email: 'delegue@test.com', role: 'delegate', agency: 'Agence Régionale' }
    ]

    for (const user of testUsers) {
      await sql`
        INSERT INTO users (id, name, email, role, agency, password_hash)
        VALUES (gen_random_uuid(), ${user.name}, ${user.email}, ${user.role}, ${user.agency}, 'password123')
        ON CONFLICT (email) DO NOTHING
      `
    }
    console.log("✅ Test users inserted")

    // Link users to agencies by names/emails
    const emailToAgencyName = [
      { email: 'admin@test.com', agency: 'Agence Centrale' },
      { email: 'directeur@test.com', agency: 'Agence Centrale' },
      { email: 'comptable@test.com', agency: 'Agence Centrale' },
      { email: 'caissier@test.com', agency: 'Agence Centrale' },
      { email: 'auditeur@test.com', agency: 'Agence Lyon' },
      { email: 'delegue@test.com', agency: 'Agence Marseille' }
    ]

    for (const link of emailToAgencyName) {
      const uid = await sql`SELECT id FROM users WHERE email = ${link.email} LIMIT 1;`
      const aid = await sql`SELECT id FROM agencies WHERE name = ${link.agency} LIMIT 1;`
      if (uid[0]?.id && aid[0]?.id) {
        await sql`
          INSERT INTO user_agencies (user_id, agency_id)
          VALUES (${uid[0].id}::uuid, ${aid[0].id}::uuid)
          ON CONFLICT DO NOTHING
        `
      }
    }
    console.log("✅ User-agency links created")
    
    // Verify data
    const userCount = await sql`SELECT COUNT(*) as count FROM users`
    const agencyCount = await sql`SELECT COUNT(*) as count FROM agencies`
    const linkCount = await sql`SELECT COUNT(*) as count FROM user_agencies`
    
    console.log(`📊 Database initialized successfully:`)
    console.log(`   - Users: ${userCount[0].count}`)
    console.log(`   - Agencies: ${agencyCount[0].count}`)
    console.log(`   - User-Agency links: ${linkCount[0].count}`)
    
    console.log("🎉 Neon Database initialization completed!")
    
  } catch (error) {
    console.error("❌ Database initialization failed:", error)
    process.exit(1)
  }
}

// Run initialization
initializeNeonDatabase()
