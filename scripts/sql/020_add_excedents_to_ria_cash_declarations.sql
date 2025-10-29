-- Ajout du champ excédents et support de plusieurs fichiers justificatifs
-- pour la table ria_cash_declarations

-- Ajouter le champ excédents
ALTER TABLE ria_cash_declarations 
ADD COLUMN IF NOT EXISTS excedents NUMERIC(15, 2) DEFAULT 0;

-- Ajouter le champ pour stocker les fichiers justificatifs multiples (JSON)
ALTER TABLE ria_cash_declarations 
ADD COLUMN IF NOT EXISTS justificatif_files JSONB DEFAULT '[]'::jsonb;

-- Commentaires pour la documentation
COMMENT ON COLUMN ria_cash_declarations.excedents IS 'Montant des excédents en FCFA';
COMMENT ON COLUMN ria_cash_declarations.justificatif_files IS 'Liste des fichiers justificatifs (JSON array)';

-- Index pour améliorer les performances sur les excédents
CREATE INDEX IF NOT EXISTS idx_ria_cash_declarations_excedents ON ria_cash_declarations(excedents);
