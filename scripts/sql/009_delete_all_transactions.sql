-- Script SQL pour supprimer toutes les transactions
-- ATTENTION: Cette opération est irréversible !

-- Compter d'abord le nombre de transactions
SELECT COUNT(*) as transaction_count FROM transactions;

-- Supprimer toutes les transactions
DELETE FROM transactions;

-- Vérifier que toutes les transactions ont été supprimées
SELECT COUNT(*) as remaining_transactions FROM transactions;
