-- Table pour les arrêtés de caisse RIA
CREATE TABLE IF NOT EXISTS ria_cash_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  guichetier VARCHAR(255) NOT NULL,
  declaration_date DATE NOT NULL DEFAULT CURRENT_DATE,
  montant_brut NUMERIC(15, 2) NOT NULL,
  total_delestage NUMERIC(15, 2) DEFAULT 0,
  delestage_comment TEXT,
  justificatif_file_path VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'rejected', 'corrected', 'validated')),
  rejection_comment TEXT,
  validation_comment TEXT,
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_ria_cash_declarations_user_id ON ria_cash_declarations(user_id);
CREATE INDEX IF NOT EXISTS idx_ria_cash_declarations_date ON ria_cash_declarations(declaration_date);
CREATE INDEX IF NOT EXISTS idx_ria_cash_declarations_status ON ria_cash_declarations(status);
CREATE INDEX IF NOT EXISTS idx_ria_cash_declarations_guichetier ON ria_cash_declarations(guichetier);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_ria_cash_declarations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ria_cash_declarations_updated_at
  BEFORE UPDATE ON ria_cash_declarations
  FOR EACH ROW
  EXECUTE FUNCTION update_ria_cash_declarations_updated_at();

