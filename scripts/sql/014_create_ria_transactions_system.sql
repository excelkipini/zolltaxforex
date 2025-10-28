-- Script de création du système de transactions RIA
-- Responsable caisse - Importation CSV et tableau de bord

-- Table principale des transactions RIA
CREATE TABLE IF NOT EXISTS ria_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sc_numero_transfert VARCHAR(50) NOT NULL,
    pin VARCHAR(20),
    mode_livraison VARCHAR(10),
    guichetier VARCHAR(255) NOT NULL,
    succursale VARCHAR(255) NOT NULL,
    code_agence VARCHAR(20) NOT NULL,
    sent_amount DECIMAL(15,2) NOT NULL,
    sending_currency VARCHAR(3) NOT NULL DEFAULT 'XAF',
    pays_origine VARCHAR(100),
    pays_destination VARCHAR(100),
    montant_paiement DECIMAL(15,2),
    devise_beneficiaire VARCHAR(3),
    commission_sa DECIMAL(15,2) NOT NULL,
    devise_commission_sa VARCHAR(3) NOT NULL DEFAULT 'XAF',
    date_operation TIMESTAMP WITH TIME ZONE NOT NULL,
    taux DECIMAL(10,6),
    ttf DECIMAL(15,2) NOT NULL,
    cte DECIMAL(15,2) NOT NULL,
    tva1 DECIMAL(15,2) NOT NULL,
    montant_a_payer DECIMAL(15,2),
    frais_client DECIMAL(15,2),
    action VARCHAR(20) NOT NULL CHECK (action IN ('Envoyé', 'Payé', 'Annulé', 'Remboursé', 'En attente')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(sc_numero_transfert)
);

-- Table des paramètres comptables
CREATE TABLE IF NOT EXISTS parametres_comptables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cle VARCHAR(100) NOT NULL UNIQUE,
    valeur DECIMAL(15,6) NOT NULL,
    date_debut DATE NOT NULL DEFAULT CURRENT_DATE,
    date_fin DATE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des indicateurs journaliers
CREATE TABLE IF NOT EXISTS indicateurs_journaliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_calcul DATE NOT NULL,
    agence VARCHAR(255) NOT NULL,
    montant_principal DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_brut DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_frais DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions_ria DECIMAL(15,2) NOT NULL DEFAULT 0,
    tva_ria DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions_uba DECIMAL(15,2) NOT NULL DEFAULT 0,
    tva_uba DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions_ztf DECIMAL(15,2) NOT NULL DEFAULT 0,
    tva_ztf DECIMAL(15,2) NOT NULL DEFAULT 0,
    ca_ztf DECIMAL(15,2) NOT NULL DEFAULT 0,
    cte DECIMAL(15,2) NOT NULL DEFAULT 0,
    ttf DECIMAL(15,2) NOT NULL DEFAULT 0,
    paiements DECIMAL(15,2) NOT NULL DEFAULT 0,
    annulation DECIMAL(15,2) NOT NULL DEFAULT 0,
    remboursement DECIMAL(15,2) NOT NULL DEFAULT 0,
    frais_retenus DECIMAL(15,2) NOT NULL DEFAULT 0,
    operation_attente DECIMAL(15,2) NOT NULL DEFAULT 0,
    versement_banque DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_a_debiter DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_en_coffre DECIMAL(15,2) NOT NULL DEFAULT 0,
    marge_ztf_nette DECIMAL(15,2) NOT NULL DEFAULT 0,
    taux_moyen_jour DECIMAL(10,6),
    nb_transactions INTEGER NOT NULL DEFAULT 0,
    ratio_frais_principal DECIMAL(5,2),
    ratio_remboursement_brut DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date_calcul, agence)
);

-- Table des statistiques par guichetier
CREATE TABLE IF NOT EXISTS stats_guichetiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_calcul DATE NOT NULL,
    guichetier VARCHAR(255) NOT NULL,
    agence VARCHAR(255) NOT NULL,
    nb_transactions INTEGER NOT NULL DEFAULT 0,
    montant_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_moyen DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions_generes DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date_calcul, guichetier, agence)
);

-- Table des statistiques par agence
CREATE TABLE IF NOT EXISTS stats_agences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_calcul DATE NOT NULL,
    agence VARCHAR(255) NOT NULL,
    nb_transactions INTEGER NOT NULL DEFAULT 0,
    montant_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_moyen DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions_generes DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date_calcul, agence)
);

-- Table des statistiques par pays de destination
CREATE TABLE IF NOT EXISTS stats_pays_destination (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date_calcul DATE NOT NULL,
    pays_destination VARCHAR(100) NOT NULL,
    nb_transactions INTEGER NOT NULL DEFAULT 0,
    montant_total DECIMAL(15,2) NOT NULL DEFAULT 0,
    montant_moyen DECIMAL(15,2) NOT NULL DEFAULT 0,
    commissions_generes DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date_calcul, pays_destination)
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_ria_transactions_date ON ria_transactions(date_operation);
CREATE INDEX IF NOT EXISTS idx_ria_transactions_guichetier ON ria_transactions(guichetier);
CREATE INDEX IF NOT EXISTS idx_ria_transactions_succursale ON ria_transactions(succursale);
CREATE INDEX IF NOT EXISTS idx_ria_transactions_action ON ria_transactions(action);
CREATE INDEX IF NOT EXISTS idx_ria_transactions_pays_destination ON ria_transactions(pays_destination);

-- Fonction pour calculer les commissions et taxes
CREATE OR REPLACE FUNCTION calculate_ria_commissions(
    p_total_frais DECIMAL,
    p_montant_principal DECIMAL
)
RETURNS TABLE (
    commissions_ria DECIMAL,
    tva_ria DECIMAL,
    commissions_uba DECIMAL,
    tva_uba DECIMAL,
    commissions_ztf DECIMAL,
    ca_ztf DECIMAL,
    tva_ztf DECIMAL,
    cte DECIMAL,
    ttf DECIMAL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_commissions_ria DECIMAL;
    v_tva_ria DECIMAL;
    v_commissions_uba DECIMAL;
    v_tva_uba DECIMAL;
    v_commissions_ztf DECIMAL;
    v_ca_ztf DECIMAL;
    v_tva_ztf DECIMAL;
    v_cte DECIMAL;
    v_ttf DECIMAL;
BEGIN
    -- Calculs selon les spécifications
    v_commissions_ria := p_total_frais * 0.70;
    v_tva_ria := v_commissions_ria * 0.189;
    v_commissions_uba := p_total_frais * 0.15;
    v_tva_uba := v_commissions_uba * 0.189;
    v_commissions_ztf := v_commissions_uba; -- Égale à UBA
    v_ca_ztf := v_tva_uba * 0.05;
    v_tva_ztf := v_tva_uba - v_ca_ztf;
    v_cte := p_montant_principal * 0.0025; -- 0.25%
    v_ttf := p_montant_principal * 0.015; -- 1.5%

    RETURN QUERY SELECT 
        v_commissions_ria, v_tva_ria, v_commissions_uba, v_tva_uba,
        v_commissions_ztf, v_ca_ztf, v_tva_ztf, v_cte, v_ttf;
END;
$$;

-- Fonction pour calculer les indicateurs journaliers
CREATE OR REPLACE FUNCTION calculate_daily_indicators(
    p_date DATE,
    p_agence VARCHAR(255)
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_montant_principal DECIMAL := 0;
    v_total_frais DECIMAL := 0;
    v_paiements DECIMAL := 0;
    v_annulation DECIMAL := 0;
    v_remboursement DECIMAL := 0;
    v_operation_attente DECIMAL := 0;
    v_montant_brut DECIMAL := 0;
    v_versement_banque DECIMAL := 0;
    v_montant_a_debiter DECIMAL := 0;
    v_montant_en_coffre DECIMAL := 0;
    v_marge_ztf_nette DECIMAL := 0;
    v_nb_transactions INTEGER := 0;
    v_taux_moyen DECIMAL := 0;
    v_ratio_frais_principal DECIMAL := 0;
    v_ratio_remboursement_brut DECIMAL := 0;
    
    -- Variables pour les calculs de commissions
    v_commissions_ria DECIMAL;
    v_tva_ria DECIMAL;
    v_commissions_uba DECIMAL;
    v_tva_uba DECIMAL;
    v_commissions_ztf DECIMAL;
    v_ca_ztf DECIMAL;
    v_tva_ztf DECIMAL;
    v_cte DECIMAL;
    v_ttf DECIMAL;
BEGIN
    -- Calculer les montants de base
    SELECT 
        COALESCE(SUM(CASE WHEN action = 'Envoyé' THEN sent_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'Envoyé' THEN commission_sa ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'Payé' THEN COALESCE(montant_paiement, 0) ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'Annulé' THEN sent_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'Remboursé' THEN sent_amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN action = 'En attente' THEN sent_amount ELSE 0 END), 0),
        COUNT(*),
        COALESCE(AVG(taux), 0)
    INTO 
        v_montant_principal, v_total_frais, v_paiements, v_annulation, 
        v_remboursement, v_operation_attente, v_nb_transactions, v_taux_moyen
    FROM ria_transactions
    WHERE DATE(date_operation) = p_date 
    AND (p_agence = 'Toutes' OR succursale = p_agence);

    v_montant_brut := v_montant_principal + v_total_frais;
    v_versement_banque := v_montant_brut - (v_remboursement + v_annulation + v_paiements);

    -- Calculer les commissions et taxes
    SELECT *
    INTO v_commissions_ria, v_tva_ria, v_commissions_uba, v_tva_uba,
         v_commissions_ztf, v_ca_ztf, v_tva_ztf, v_cte, v_ttf
    FROM calculate_ria_commissions(v_total_frais, v_montant_principal);

    v_montant_a_debiter := v_versement_banque - (v_commissions_ztf + v_tva_ztf + v_ca_ztf + v_cte);
    v_montant_en_coffre := v_versement_banque - v_montant_a_debiter;
    v_marge_ztf_nette := v_commissions_ztf + v_tva_ztf + v_ca_ztf;

    -- Calculer les ratios
    IF v_montant_principal > 0 THEN
        v_ratio_frais_principal := (v_total_frais / v_montant_principal) * 100;
    END IF;
    
    IF v_montant_brut > 0 THEN
        v_ratio_remboursement_brut := (v_remboursement / v_montant_brut) * 100;
    END IF;

    -- Insérer ou mettre à jour les indicateurs
    INSERT INTO indicateurs_journaliers (
        date_calcul, agence, montant_principal, montant_brut, total_frais,
        commissions_ria, tva_ria, commissions_uba, tva_uba, commissions_ztf, 
        tva_ztf, ca_ztf, cte, ttf, paiements, annulation, remboursement,
        operation_attente, versement_banque, montant_a_debiter, montant_en_coffre,
        marge_ztf_nette, taux_moyen_jour, nb_transactions, ratio_frais_principal,
        ratio_remboursement_brut
    ) VALUES (
        p_date, p_agence, v_montant_principal, v_montant_brut, v_total_frais,
        v_commissions_ria, v_tva_ria, v_commissions_uba, v_tva_uba, v_commissions_ztf,
        v_tva_ztf, v_ca_ztf, v_cte, v_ttf, v_paiements, v_annulation, v_remboursement,
        v_operation_attente, v_versement_banque, v_montant_a_debiter, v_montant_en_coffre,
        v_marge_ztf_nette, v_taux_moyen, v_nb_transactions, v_ratio_frais_principal,
        v_ratio_remboursement_brut
    )
    ON CONFLICT (date_calcul, agence) DO UPDATE SET
        montant_principal = EXCLUDED.montant_principal,
        montant_brut = EXCLUDED.montant_brut,
        total_frais = EXCLUDED.total_frais,
        commissions_ria = EXCLUDED.commissions_ria,
        tva_ria = EXCLUDED.tva_ria,
        commissions_uba = EXCLUDED.commissions_uba,
        tva_uba = EXCLUDED.tva_uba,
        commissions_ztf = EXCLUDED.commissions_ztf,
        tva_ztf = EXCLUDED.tva_ztf,
        ca_ztf = EXCLUDED.ca_ztf,
        cte = EXCLUDED.cte,
        ttf = EXCLUDED.ttf,
        paiements = EXCLUDED.paiements,
        annulation = EXCLUDED.annulation,
        remboursement = EXCLUDED.remboursement,
        operation_attente = EXCLUDED.operation_attente,
        versement_banque = EXCLUDED.versement_banque,
        montant_a_debiter = EXCLUDED.montant_a_debiter,
        montant_en_coffre = EXCLUDED.montant_en_coffre,
        marge_ztf_nette = EXCLUDED.marge_ztf_nette,
        taux_moyen_jour = EXCLUDED.taux_moyen_jour,
        nb_transactions = EXCLUDED.nb_transactions,
        ratio_frais_principal = EXCLUDED.ratio_frais_principal,
        ratio_remboursement_brut = EXCLUDED.ratio_remboursement_brut,
        updated_at = NOW();
END;
$$;

-- Trigger pour recalculer automatiquement les indicateurs
CREATE OR REPLACE FUNCTION trigger_update_daily_indicators()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Recalculer pour la date de l'opération
    PERFORM calculate_daily_indicators(DATE(NEW.date_operation), NEW.succursale);
    
    -- Recalculer pour "Toutes" les agences
    PERFORM calculate_daily_indicators(DATE(NEW.date_operation), 'Toutes');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_ria_transactions_update_indicators
    AFTER INSERT OR UPDATE OR DELETE ON ria_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_daily_indicators();

-- Insérer les paramètres comptables par défaut
INSERT INTO parametres_comptables (cle, valeur, description) VALUES
('taux_commission_ria', 0.70, 'Taux de commission RIA (70%)'),
('taux_tva', 0.189, 'Taux de TVA (18.9%)'),
('taux_commission_uba', 0.15, 'Taux de commission UBA (15%)'),
('taux_ca_ztf', 0.05, 'Taux CA ZTF sur TVA UBA (5%)'),
('taux_cte', 0.0025, 'Taux CTE (0.25%)'),
('taux_ttf', 0.015, 'Taux TTF (1.5%)')
ON CONFLICT (cle) DO NOTHING;
