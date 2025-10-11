-- Création de la table des reçus
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_phone VARCHAR(50),
    client_email VARCHAR(255),
    operation_type VARCHAR(50) NOT NULL,
    amount_received DECIMAL(15,2) NOT NULL,
    amount_sent DECIMAL(15,2) NOT NULL,
    commission DECIMAL(15,2) NOT NULL,
    commission_rate DECIMAL(5,3) NOT NULL DEFAULT 3.775,
    currency VARCHAR(10) NOT NULL DEFAULT 'XAF',
    notes TEXT,
    qr_code_data JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_receipts_client_name ON receipts(client_name);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_created_by ON receipts(created_by);

-- Commentaires sur la table
COMMENT ON TABLE receipts IS 'Table des reçus générés par le système';
COMMENT ON COLUMN receipts.receipt_number IS 'Numéro unique du reçu';
COMMENT ON COLUMN receipts.client_name IS 'Nom du client';
COMMENT ON COLUMN receipts.client_phone IS 'Téléphone du client';
COMMENT ON COLUMN receipts.client_email IS 'Email du client';
COMMENT ON COLUMN receipts.operation_type IS 'Type d''opération (transfer, exchange, etc.)';
COMMENT ON COLUMN receipts.amount_received IS 'Montant reçu du client';
COMMENT ON COLUMN receipts.amount_sent IS 'Montant envoyé après commission';
COMMENT ON COLUMN receipts.commission IS 'Montant de la commission';
COMMENT ON COLUMN receipts.commission_rate IS 'Taux de commission en pourcentage';
COMMENT ON COLUMN receipts.currency IS 'Devise utilisée';
COMMENT ON COLUMN receipts.notes IS 'Notes additionnelles';
COMMENT ON COLUMN receipts.qr_code_data IS 'Données du QR Code en JSON';
COMMENT ON COLUMN receipts.created_by IS 'Utilisateur qui a créé le reçu';
COMMENT ON COLUMN receipts.created_at IS 'Date de création du reçu';
COMMENT ON COLUMN receipts.updated_at IS 'Date de dernière modification';
