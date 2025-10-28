-- Ajout des colonnes manquantes
ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS commission_ria DECIMAL(15,2) DEFAULT 0;
ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS ca_ztf DECIMAL(15,2) DEFAULT 0;
ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS cte_calculated DECIMAL(15,2) DEFAULT 0;
ALTER TABLE ria_transactions ADD COLUMN IF NOT EXISTS ttf_calculated DECIMAL(15,2) DEFAULT 0;

