-- Mise à jour de la table ria_transactions pour inclure les calculs de commissions
-- Ajout des colonnes de calculs dérivés

ALTER TABLE ria_transactions 
ADD COLUMN IF NOT EXISTS commission_ria DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tva_ria DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_uba DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tva_uba DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS commission_ztf DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ca_ztf DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tva_ztf DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cte_calculated DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS ttf_calculated DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS montant_principal DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS frais_client DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS montant_brut DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_remboursement BOOLEAN DEFAULT FALSE;

-- Index pour optimiser les requêtes de calculs
CREATE INDEX IF NOT EXISTS idx_ria_transactions_calculations 
ON ria_transactions(created_at, action, is_remboursement);

-- Fonction pour calculer les commissions d'une transaction
CREATE OR REPLACE FUNCTION calculate_ria_commissions(
  p_sent_amount DECIMAL(15,2),
  p_commission_sa DECIMAL(15,2),
  p_ttf DECIMAL(15,2),
  p_cte DECIMAL(15,2),
  p_tva DECIMAL(15,2)
) RETURNS TABLE(
  commission_ria DECIMAL(15,2),
  tva_ria DECIMAL(15,2),
  commission_uba DECIMAL(15,2),
  tva_uba DECIMAL(15,2),
  commission_ztf DECIMAL(15,2),
  ca_ztf DECIMAL(15,2),
  tva_ztf DECIMAL(15,2),
  cte_calculated DECIMAL(15,2),
  ttf_calculated DECIMAL(15,2),
  montant_principal DECIMAL(15,2),
  frais_client DECIMAL(15,2),
  montant_brut DECIMAL(15,2)
) AS $$
BEGIN
  RETURN QUERY SELECT
    -- Commission RIA = Frais client × 70 / 100
    ROUND(p_commission_sa * 70.0 / 100.0, 2) as commission_ria,
    
    -- TVA RIA = Commission RIA × 18.9 / 100
    ROUND(p_commission_sa * 70.0 / 100.0 * 18.9 / 100.0, 2) as tva_ria,
    
    -- Commission UBA = Frais client × 15 / 100
    ROUND(p_commission_sa * 15.0 / 100.0, 2) as commission_uba,
    
    -- TVA UBA = Commission UBA × 18.9 / 100
    ROUND(p_commission_sa * 15.0 / 100.0 * 18.9 / 100.0, 2) as tva_uba,
    
    -- Commission ZTF = Commission UBA
    ROUND(p_commission_sa * 15.0 / 100.0, 2) as commission_ztf,
    
    -- CA ZTF = TVA UBA × 5 / 100
    ROUND(p_commission_sa * 15.0 / 100.0 * 18.9 / 100.0 * 5.0 / 100.0, 2) as ca_ztf,
    
    -- TVA ZTF = TVA UBA – CA ZTF
    ROUND(p_commission_sa * 15.0 / 100.0 * 18.9 / 100.0 - p_commission_sa * 15.0 / 100.0 * 18.9 / 100.0 * 5.0 / 100.0, 2) as tva_ztf,
    
    -- CTE = Sent Amount × 0.25 / 100
    ROUND(p_sent_amount * 0.25 / 100.0, 2) as cte_calculated,
    
    -- TTF = Sent Amount × 1.5 / 100
    ROUND(p_sent_amount * 1.5 / 100.0, 2) as ttf_calculated,
    
    -- Montant principal = Sent Amount
    p_sent_amount as montant_principal,
    
    -- Frais client = Commission SA
    p_commission_sa as frais_client,
    
    -- Montant brut = Montant principal + Total frais
    p_sent_amount + p_commission_sa as montant_brut;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour mettre à jour les calculs de toutes les transactions
CREATE OR REPLACE FUNCTION update_ria_calculations()
RETURNS void AS $$
DECLARE
  rec RECORD;
  calc RECORD;
BEGIN
  FOR rec IN 
    SELECT id, sent_amount, commission_sa, ttf, cte, tva, action
    FROM ria_transactions
  LOOP
    -- Calculer les commissions
    SELECT * INTO calc FROM calculate_ria_commissions(
      rec.sent_amount, 
      rec.commission_sa, 
      rec.ttf, 
      rec.cte, 
      rec.tva
    );
    
    -- Mettre à jour la transaction
    UPDATE ria_transactions SET
      commission_ria = calc.commission_ria,
      tva_ria = calc.tva_ria,
      commission_uba = calc.commission_uba,
      tva_uba = calc.tva_uba,
      commission_ztf = calc.commission_ztf,
      ca_ztf = calc.ca_ztf,
      tva_ztf = calc.tva_ztf,
      cte_calculated = calc.cte_calculated,
      ttf_calculated = calc.ttf_calculated,
      montant_principal = calc.montant_principal,
      frais_client = calc.frais_client,
      montant_brut = calc.montant_brut,
      is_remboursement = (rec.action IN ('Annulé', 'Remboursé'))
    WHERE id = rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Exécuter la mise à jour des calculs
SELECT update_ria_calculations();

