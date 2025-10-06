import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"

export async function POST(request: NextRequest) {
  const { user } = await requireAuth()
  
  // Seuls les super admins peuvent exécuter les migrations
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ ok: false, error: "Non autorisé - Seuls les super admins peuvent exécuter les migrations" }, { status: 403 })
  }

  try {
    console.log('🔄 Création de la table d\'historique des actions sur les cartes...')

    // Créer la table cards_action_history
    await sql`
      CREATE TABLE IF NOT EXISTS cards_action_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_name VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        action_description TEXT NOT NULL,
        target_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
        target_card_cid VARCHAR(50),
        old_values JSONB,
        new_values JSONB,
        metadata JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `

    // Créer les index
    await sql`CREATE INDEX IF NOT EXISTS idx_cards_action_history_user_id ON cards_action_history(user_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cards_action_history_action_type ON cards_action_history(action_type)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cards_action_history_target_card_id ON cards_action_history(target_card_id)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cards_action_history_created_at ON cards_action_history(created_at)`
    await sql`CREATE INDEX IF NOT EXISTS idx_cards_action_history_user_role ON cards_action_history(user_role)`

    // Ajouter les commentaires
    await sql`COMMENT ON TABLE cards_action_history IS 'Historique des actions effectuées sur les cartes par les utilisateurs'`
    await sql`COMMENT ON COLUMN cards_action_history.action_type IS 'Type d''action: create, update, delete, recharge, distribute, reset_usage, import, export'`
    await sql`COMMENT ON COLUMN cards_action_history.action_description IS 'Description lisible de l''action effectuée'`
    await sql`COMMENT ON COLUMN cards_action_history.target_card_id IS 'ID de la carte concernée (NULL pour actions globales)'`
    await sql`COMMENT ON COLUMN cards_action_history.target_card_cid IS 'CID de la carte pour référence même si supprimée'`
    await sql`COMMENT ON COLUMN cards_action_history.old_values IS 'Valeurs avant modification (JSON)'`
    await sql`COMMENT ON COLUMN cards_action_history.new_values IS 'Valeurs après modification (JSON)'`
    await sql`COMMENT ON COLUMN cards_action_history.metadata IS 'Informations supplémentaires (montant, pays, etc.)'`

    console.log('✅ Table cards_action_history créée avec succès')

    // Vérifier que la table existe
    const result = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'cards_action_history'
    `

    if (result.length === 0) {
      throw new Error('Table cards_action_history non créée')
    }

    return NextResponse.json({ 
      ok: true, 
      message: "Table d'historique des actions sur les cartes créée avec succès",
      data: {
        table_name: 'cards_action_history',
        created_by: user.name,
        created_at: new Date().toISOString()
      }
    })
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la création de la table:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || "Erreur interne du serveur" 
    }, { status: 500 })
  }
}
