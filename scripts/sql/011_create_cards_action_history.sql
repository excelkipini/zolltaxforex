-- Table pour l'historique des actions sur les cartes
CREATE TABLE IF NOT EXISTS cards_action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_name VARCHAR(255) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action_type VARCHAR(100) NOT NULL, -- 'create', 'update', 'delete', 'recharge', 'distribute', 'reset_usage', 'import', 'export'
  action_description TEXT NOT NULL,
  target_card_id UUID REFERENCES cards(id) ON DELETE SET NULL, -- NULL pour les actions globales
  target_card_cid VARCHAR(50), -- CID de la carte pour référence même si supprimée
  old_values JSONB, -- Valeurs avant modification
  new_values JSONB, -- Valeurs après modification
  metadata JSONB, -- Informations supplémentaires (montant, pays, etc.)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cards_action_history_user_id ON cards_action_history(user_id);
CREATE INDEX IF NOT EXISTS idx_cards_action_history_action_type ON cards_action_history(action_type);
CREATE INDEX IF NOT EXISTS idx_cards_action_history_target_card_id ON cards_action_history(target_card_id);
CREATE INDEX IF NOT EXISTS idx_cards_action_history_created_at ON cards_action_history(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_action_history_user_role ON cards_action_history(user_role);

-- Commentaires pour la documentation
COMMENT ON TABLE cards_action_history IS 'Historique des actions effectuées sur les cartes par les utilisateurs';
COMMENT ON COLUMN cards_action_history.action_type IS 'Type d''action: create, update, delete, recharge, distribute, reset_usage, import, export';
COMMENT ON COLUMN cards_action_history.action_description IS 'Description lisible de l''action effectuée';
COMMENT ON COLUMN cards_action_history.target_card_id IS 'ID de la carte concernée (NULL pour actions globales)';
COMMENT ON COLUMN cards_action_history.target_card_cid IS 'CID de la carte pour référence même si supprimée';
COMMENT ON COLUMN cards_action_history.old_values IS 'Valeurs avant modification (JSON)';
COMMENT ON COLUMN cards_action_history.new_values IS 'Valeurs après modification (JSON)';
COMMENT ON COLUMN cards_action_history.metadata IS 'Informations supplémentaires (montant, pays, etc.)';
