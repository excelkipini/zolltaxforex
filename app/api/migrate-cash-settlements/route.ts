import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@neondatabase/serverless"

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    // Seuls les super admins peuvent exécuter les migrations
    if (user.role !== "super_admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    console.log('🚀 Exécution de la migration pour les arrêtés de caisse...')
    
    // Créer la table cash_settlements
    await sql`
      CREATE TABLE IF NOT EXISTS cash_settlements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_number VARCHAR(50) UNIQUE NOT NULL,
        cashier_id UUID NOT NULL REFERENCES users(id),
        cashier_name VARCHAR(255) NOT NULL,
        settlement_date DATE NOT NULL,
        total_transactions_amount DECIMAL(15,2) NOT NULL,
        unloading_amount DECIMAL(15,2) DEFAULT 0,
        unloading_reason TEXT,
        final_amount DECIMAL(15,2) NOT NULL,
        received_amount DECIMAL(15,2),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validated', 'rejected', 'exception')),
        validation_notes TEXT,
        exception_reason TEXT,
        rejection_reason TEXT,
        validated_by UUID REFERENCES users(id),
        validated_by_name VARCHAR(255),
        validated_at TIMESTAMP WITH TIME ZONE,
        operation_report_file_path TEXT,
        operation_report_file_name VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    
    // Créer la table cash_unloadings
    await sql`
      CREATE TABLE IF NOT EXISTS cash_unloadings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        settlement_id UUID NOT NULL REFERENCES cash_settlements(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        reason TEXT NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    
    // Créer les index
    await sql`CREATE INDEX IF NOT EXISTS idx_cash_settlements_cashier_id ON cash_settlements(cashier_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cash_settlements_date ON cash_settlements(settlement_date)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cash_settlements_status ON cash_settlements(status)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cash_settlements_settlement_number ON cash_settlements(settlement_number)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cash_unloadings_settlement_id ON cash_unloadings(settlement_id)`
    
    // Créer la fonction pour générer le numéro d'arrêté
    await sql`
      CREATE OR REPLACE FUNCTION generate_settlement_number()
      RETURNS TEXT AS $$
      DECLARE
        today DATE := CURRENT_DATE;
        year_part TEXT := EXTRACT(YEAR FROM today)::TEXT;
        month_part TEXT := LPAD(EXTRACT(MONTH FROM today)::TEXT, 2, '0');
        day_part TEXT := LPAD(EXTRACT(DAY FROM today)::TEXT, 2, '0');
        sequence_part TEXT;
      BEGIN
        SELECT LPAD(COALESCE(MAX(CAST(SUBSTRING(settlement_number FROM 9) AS INTEGER)), 0) + 1::TEXT, 4, '0')
        INTO sequence_part
        FROM cash_settlements
        WHERE settlement_number LIKE year_part || month_part || day_part || '%';
        
        RETURN 'AS' || year_part || month_part || day_part || sequence_part;
      END;
      $$ LANGUAGE plpgsql
    `
    
    // Créer le trigger pour updated_at
    await sql`
      CREATE OR REPLACE FUNCTION update_cash_settlements_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `
    
    await sql`
      CREATE TRIGGER trigger_update_cash_settlements_updated_at
        BEFORE UPDATE ON cash_settlements
        FOR EACH ROW
        EXECUTE FUNCTION update_cash_settlements_updated_at()
    `
    
    console.log('✅ Migration des arrêtés de caisse terminée avec succès!')
    
    return NextResponse.json({ 
      success: true, 
      message: "Migration des arrêtés de caisse terminée avec succès!",
      details: {
        tables: ['cash_settlements', 'cash_unloadings'],
        functions: ['generate_settlement_number()', 'update_cash_settlements_updated_at()']
      }
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la migration:', error)
    return NextResponse.json({ 
      error: error.message || "Erreur lors de la migration",
      details: error.toString()
    }, { status: 500 })
  }
}