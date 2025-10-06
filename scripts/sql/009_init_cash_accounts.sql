-- Script SQL pour initialiser les comptes de caisse
-- Ce script doit être exécuté dans la base de données PostgreSQL

-- Créer les comptes de caisse par défaut s'ils n'existent pas
INSERT INTO cash_accounts (account_type, account_name, current_balance, updated_by)
VALUES 
  ('uba', 'Compte UBA', 0, 'system'),
  ('ecobank', 'Compte Ecobank', 0, 'system'),
  ('coffre', 'Coffre', 0, 'system'),
  ('commissions', 'Commissions Transferts', 0, 'system')
ON CONFLICT (account_type) DO NOTHING;

-- Vérifier que les comptes ont été créés
SELECT 
  account_type,
  account_name,
  current_balance,
  updated_by,
  created_at
FROM cash_accounts 
ORDER BY account_type;
