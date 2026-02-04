import { sql } from "./db"

export type CashAccount = {
  id: string
  account_type: "uba" | "ecobank" | "coffre" | "commissions" | "receipt_commissions" | "ria_excedents"
  account_name: string
  current_balance: number
  last_updated: string
  updated_by: string
  created_at: string
}

export type CashTransaction = {
  id: string
  account_type: "uba" | "ecobank" | "coffre" | "commissions" | "receipt_commissions" | "ria_excedents"
  transaction_type: "deposit" | "withdrawal" | "transfer" | "expense" | "commission"
  amount: number
  description: string
  reference_id?: string
  created_by: string
  created_at: string
}

// Initialiser les comptes de caisse par défaut
export async function initializeCashAccounts(): Promise<void> {
  try {
    // Créer les tables si elles n'existent pas
    // Assurer le schéma et les contraintes (ajout de ria_excedents)
    await sql`
      CREATE TABLE IF NOT EXISTS cash_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_type TEXT NOT NULL CHECK (account_type IN ('uba', 'ecobank', 'coffre', 'commissions', 'receipt_commissions', 'ria_excedents')),
        account_name TEXT NOT NULL,
        current_balance BIGINT NOT NULL DEFAULT 0,
        last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(account_type)
      )
    `

    await sql`
      CREATE TABLE IF NOT EXISTS cash_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_type TEXT NOT NULL CHECK (account_type IN ('uba', 'ecobank', 'coffre', 'commissions', 'receipt_commissions', 'ria_excedents')),
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'expense', 'commission')),
        amount BIGINT NOT NULL,
        description TEXT NOT NULL,
        reference_id TEXT,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    // Mettre à jour les contraintes si elles existent déjà (ajouter ria_excedents)
    await sql`ALTER TABLE cash_accounts DROP CONSTRAINT IF EXISTS cash_accounts_account_type_check`
    await sql`ALTER TABLE cash_accounts ADD CONSTRAINT cash_accounts_account_type_check CHECK (account_type IN ('uba','ecobank','coffre','commissions','receipt_commissions','ria_excedents'))`
    await sql`ALTER TABLE cash_transactions DROP CONSTRAINT IF EXISTS cash_transactions_account_type_check`
    await sql`ALTER TABLE cash_transactions ADD CONSTRAINT cash_transactions_account_type_check CHECK (account_type IN ('uba','ecobank','coffre','commissions','receipt_commissions','ria_excedents'))`

    // Créer les comptes par défaut
    const defaultAccounts = [
      { account_type: "uba", account_name: "Compte UBA" },
      { account_type: "ecobank", account_name: "Compte Ecobank" },
      { account_type: "coffre", account_name: "Coffre" },
      { account_type: "commissions", account_name: "Commissions Transferts" },
      { account_type: "receipt_commissions", account_name: "Commissions Reçus" },
      { account_type: "ria_excedents", account_name: "Excédents RIA" }
    ]

    for (const account of defaultAccounts) {
      const existing = await sql`
        SELECT id FROM cash_accounts WHERE account_type = ${account.account_type}
      `
      
      if (existing.length === 0) {
        await sql`
          INSERT INTO cash_accounts (account_type, account_name, current_balance, updated_by)
          VALUES (${account.account_type}, ${account.account_name}, 0, 'system')
        `
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation des comptes de caisse:', error)
    throw error
  }
}

// Récupérer tous les comptes de caisse
export async function getCashAccounts(): Promise<CashAccount[]> {
  const rows = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts
    ORDER BY account_type
  `
  return rows
}

// Mettre à jour le solde d'un compte
export async function updateCashAccountBalance(
  accountType: CashAccount["account_type"],
  newBalance: number,
  updatedBy: string,
  description: string
): Promise<CashAccount> {
  // Empêcher la modification manuelle des comptes de commissions
  if (accountType === 'commissions' || accountType === 'receipt_commissions' || accountType === 'ria_excedents') {
    throw new Error("Le solde des commissions ne peut pas être modifié manuellement. Il est calculé automatiquement à partir des transactions.")
  }

  // Mettre à jour le solde du compte
  const updatedAccount = await sql<CashAccount[]>`
    UPDATE cash_accounts 
    SET 
      current_balance = ${newBalance},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = ${accountType}
    RETURNING 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
  `

  if (updatedAccount.length === 0) {
    throw new Error(`Compte ${accountType} non trouvé`)
  }

  // Enregistrer la transaction
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      created_by
    )
    VALUES (
      ${accountType}, 
      'deposit', 
      ${newBalance}, 
      ${description}, 
      ${updatedBy}
    )
  `

  return updatedAccount[0]
}

// Déduire un montant du coffre (pour distributions, etc.)
export async function deductFromCoffre(
  amount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  // Récupérer le solde actuel du coffre
  const coffreAccount = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts 
    WHERE account_type = 'coffre'
  `

  if (coffreAccount.length === 0) {
    throw new Error("Compte coffre non trouvé")
  }

  const currentBalance = coffreAccount[0].current_balance
  const newBalance = Math.max(0, currentBalance - amount) // Empêcher les soldes négatifs

  // Mettre à jour le solde du coffre
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${newBalance},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'coffre'
  `

  // Enregistrer la transaction comme dépense
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      created_by
    )
    VALUES (
      'coffre', 
      'expense', 
      ${amount}, 
      ${description}, 
      ${updatedBy}
    )
  `

  console.log(`Montant de ${amount} XAF déduit du coffre. Nouveau solde: ${newBalance} XAF`)
}

// Déduire une dépense du coffre
export async function deductExpenseFromCoffre(
  expenseId: string,
  amount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  // Récupérer le solde actuel du coffre
  const coffreAccount = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts 
    WHERE account_type = 'coffre'
  `

  if (coffreAccount.length === 0) {
    throw new Error("Compte coffre non trouvé")
  }

  const currentBalance = coffreAccount[0].current_balance
  const newBalance = currentBalance - amount

  if (newBalance < 0) {
    throw new Error("Solde insuffisant dans le coffre")
  }

  // Mettre à jour le solde du coffre
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${newBalance},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'coffre'
  `

  // Enregistrer la transaction de dépense
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      reference_id,
      created_by
    )
    VALUES (
      'coffre', 
      'expense', 
      ${amount}, 
      ${description}, 
      ${expenseId},
      ${updatedBy}
    )
  `
}

// Déduire une dépense du compte commissions des reçus
export async function deductExpenseFromReceiptCommissions(
  expenseId: string,
  amount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  // Récupérer le solde actuel des commissions des reçus
  const receiptCommissionAccount = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts 
    WHERE account_type = 'receipt_commissions'
  `

  if (receiptCommissionAccount.length === 0) {
    throw new Error("Compte commissions des reçus non trouvé")
  }

  const currentBalance = Number(receiptCommissionAccount[0].current_balance)
  const newBalance = Math.max(0, currentBalance - Number(amount)) // Éviter les soldes négatifs

  // Mettre à jour le solde des commissions des reçus
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${newBalance},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'receipt_commissions'
  `

  // Enregistrer la transaction de dépense
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      reference_id,
      created_by
    )
    VALUES (
      'receipt_commissions', 
      'expense', 
      ${Math.round(amount)}, 
      ${description}, 
      ${expenseId},
      ${updatedBy}
    )
  `

  // Réconcilier le solde du compte commissions des reçus
  await reconcileReceiptCommissionsBalance(updatedBy)
}

export type ExpenseDebitAccountType = "coffre" | "commissions" | "receipt_commissions" | "ecobank" | "uba"

/** Déduire une dépense d'une caisse (choisie par le comptable). */
export async function deductExpenseFromAccount(
  accountType: ExpenseDebitAccountType,
  expenseId: string,
  amount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  if (accountType === "receipt_commissions") {
    return deductExpenseFromReceiptCommissions(expenseId, amount, description, updatedBy)
  }
  if (accountType === "coffre") {
    return deductExpenseFromCoffre(expenseId, amount, description, updatedBy)
  }
  // commissions, ecobank, uba : déduction générique
  const account = await sql<CashAccount[]>`
    SELECT id::text, account_type, current_balance::bigint as current_balance
    FROM cash_accounts
    WHERE account_type = ${accountType}
  `
  if (account.length === 0) {
    throw new Error(`Compte ${accountType} non trouvé`)
  }
  const currentBalance = Number(account[0].current_balance)
  const newBalance = currentBalance - Number(amount)
  if (newBalance < 0) {
    throw new Error(`Solde insuffisant dans le compte ${accountType}`)
  }
  await sql`
    UPDATE cash_accounts
    SET current_balance = ${newBalance}, last_updated = NOW(), updated_by = ${updatedBy}
    WHERE account_type = ${accountType}
  `
  await sql`
    INSERT INTO cash_transactions (account_type, transaction_type, amount, description, reference_id, created_by)
    VALUES (${accountType}, 'expense', ${Math.round(amount)}, ${description}, ${expenseId}, ${updatedBy})
  `
}

// Ajouter des commissions au compte commissions (pour les transferts)
export async function addCommissionToAccount(
  transactionId: string,
  commissionAmount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  // Récupérer le solde actuel des commissions
  const commissionAccount = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts 
    WHERE account_type = 'commissions'
  `

  if (commissionAccount.length === 0) {
    throw new Error("Compte commissions non trouvé")
  }

  const currentBalance = Number(commissionAccount[0].current_balance)
  const newBalance = Number(currentBalance) + Number(commissionAmount)

  // Mettre à jour le solde des commissions
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${newBalance},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'commissions'
  `

  // Enregistrer la transaction de commission
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      reference_id,
      created_by
    )
    VALUES (
      'commissions', 
      'commission', 
      ${Math.round(commissionAmount)}, 
      ${description}, 
      ${transactionId},
      ${updatedBy}
    )
  `
}

// Ajouter des commissions au compte commissions des reçus
export async function addReceiptCommissionToAccount(
  receiptId: string,
  commissionAmount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  // Récupérer le solde actuel des commissions des reçus
  const receiptCommissionAccount = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts 
    WHERE account_type = 'receipt_commissions'
  `

  if (receiptCommissionAccount.length === 0) {
    throw new Error("Compte commissions des reçus non trouvé")
  }

  const currentBalance = Number(receiptCommissionAccount[0].current_balance)
  const newBalance = Number(currentBalance) + Number(commissionAmount)

  // Mettre à jour le solde des commissions des reçus
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${newBalance},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'receipt_commissions'
  `

  // Enregistrer la transaction de commission des reçus
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      reference_id,
      created_by
    )
    VALUES (
      'receipt_commissions', 
      'commission', 
      ${Math.round(commissionAmount)}, 
      ${description}, 
      ${receiptId},
      ${updatedBy}
    )
  `
}

// Déduire une dépense du compte Excédents RIA
export async function deductExpenseFromRiaExcedents(
  expenseId: string,
  amount: number,
  description: string,
  updatedBy: string
): Promise<void> {
  // Vérifier existence du compte
  const exAccount = await sql<CashAccount[]>`
    SELECT 
      id::text,
      account_type,
      account_name,
      current_balance::bigint as current_balance,
      last_updated::text as last_updated,
      updated_by,
      created_at::text as created_at
    FROM cash_accounts 
    WHERE account_type = 'ria_excedents'
  `

  if (exAccount.length === 0) {
    // Créer le compte si manquant
    await sql`
      INSERT INTO cash_accounts (account_type, account_name, current_balance, updated_by)
      VALUES ('ria_excedents', 'Excédents RIA', 0, ${updatedBy})
      ON CONFLICT DO NOTHING
    `
  }

  // Enregistrer la transaction de dépense (le solde de ce compte est dérivé des transactions)
  await sql`
    INSERT INTO cash_transactions (
      account_type, 
      transaction_type, 
      amount, 
      description, 
      reference_id,
      created_by
    )
    VALUES (
      'ria_excedents', 
      'expense', 
      ${Math.round(amount)}, 
      ${description}, 
      ${expenseId},
      ${updatedBy}
    )
  `
}

// Total Excédents RIA (= somme (dépôts - dépenses) si à l'avenir on crédite ce compte)
export async function getTotalRiaExcedents(): Promise<number> {
  // Total théorique = Somme des excédents déclarés (tous caissiers) - dépenses approuvées déduites des excédents
  const rows = await sql<{ total: number }[]>`
    WITH declared AS (
      SELECT COALESCE(SUM(COALESCE(excedents,0)),0) AS total_declared
      FROM ria_cash_declarations
    ),
    deducted AS (
      SELECT COALESCE(SUM(amount),0) AS total_deducted
      FROM expenses
      WHERE deduct_from_excedents = true
        AND deducted_cashier_id IS NOT NULL
        AND status IN ('accounting_approved','director_approved')
    )
    SELECT (COALESCE(d.total_declared,0) - COALESCE(x.total_deducted,0))::bigint AS total
    FROM declared d, deducted x
  `
  return Number(rows[0]?.total || 0)
}

export async function reconcileRiaExcedentsBalance(updatedBy: string = 'system'): Promise<number> {
  const total = await getTotalRiaExcedents()
  await sql`
    INSERT INTO cash_accounts (account_type, account_name, current_balance, updated_by)
    VALUES ('ria_excedents', 'Excédents RIA', ${total}, ${updatedBy})
    ON CONFLICT (account_type) DO UPDATE SET
      current_balance = EXCLUDED.current_balance,
      last_updated = NOW(),
      updated_by = EXCLUDED.updated_by
  `
  return total
}

// Récupérer l'historique des transactions de caisse
export async function getCashTransactions(
  accountType?: CashAccount["account_type"],
  limit: number = 50
): Promise<CashTransaction[]> {
  let query = sql<CashTransaction[]>`
    SELECT 
      id::text,
      account_type,
      transaction_type,
      amount::bigint as amount,
      description,
      reference_id,
      created_by,
      created_at::text as created_at
    FROM cash_transactions
  `

  if (accountType) {
    query = sql<CashTransaction[]>`
      SELECT 
        id::text,
        account_type,
        transaction_type,
        amount::bigint as amount,
        description,
        reference_id,
        created_by,
        created_at::text as created_at
      FROM cash_transactions
      WHERE account_type = ${accountType}
    `
  }

  const rows = await sql`
    ${query}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  return rows
}

// Synchroniser les commissions existantes avec le compte commissions
export async function syncExistingCommissions(): Promise<{ totalAdded: number; transactionsProcessed: number }> {
  try {
    // Récupérer toutes les transactions de transfert validées avec des commissions
    const transactions = await sql`
      SELECT 
        id,
        description,
        commission_amount,
        created_by
      FROM transactions 
      WHERE type = 'transfer' 
      AND status IN ('validated', 'executed', 'completed')
      AND commission_amount > 0
    `

    let totalAdded = 0
    let transactionsProcessed = 0

    // Pour chaque transaction, vérifier si elle a déjà été ajoutée au compte commissions
    for (const transaction of transactions) {
      const existingCommission = await sql`
        SELECT id FROM cash_transactions 
        WHERE transaction_type = 'commission' 
        AND account_type = 'commissions'
        AND reference_id = ${transaction.id}
      `

      // Si la commission n'a pas encore été ajoutée, l'ajouter
      if (existingCommission.length === 0) {
        await addCommissionToAccount(
          transaction.id,
          transaction.commission_amount,
          `Commission transfert (sync): ${transaction.description}`,
          'system'
        )
        totalAdded += Number(transaction.commission_amount)
        transactionsProcessed++
      }
    }

    return { totalAdded, transactionsProcessed }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des commissions:', error)
    throw error
  }
}

// Synchroniser les commissions des reçus existants avec le compte commissions des reçus
export async function syncExistingReceiptCommissions(): Promise<{ totalAdded: number; receiptsProcessed: number }> {
  try {
    // Récupérer tous les reçus avec des commissions > 0 XAF
    const receipts = await sql`
      SELECT 
        id,
        receipt_number,
        client_name,
        operation_type,
        commission,
        created_by
      FROM receipts 
      WHERE commission > 0
    `

    let totalAdded = 0
    let receiptsProcessed = 0

    // Pour chaque reçu, vérifier si sa commission a déjà été ajoutée au compte commissions des reçus
    for (const receipt of receipts) {
      const existingCommission = await sql`
        SELECT id FROM cash_transactions 
        WHERE transaction_type = 'commission' 
        AND account_type = 'receipt_commissions'
        AND reference_id = ${receipt.id}
      `

      // Si la commission n'a pas encore été ajoutée, l'ajouter
      if (existingCommission.length === 0) {
        await addReceiptCommissionToAccount(
          receipt.id,
          receipt.commission,
          `Commission reçu (sync): ${receipt.operation_type} - ${receipt.client_name}`,
          'system'
        )
        totalAdded += Number(receipt.commission)
        receiptsProcessed++
      }
    }

    return { totalAdded, receiptsProcessed }
  } catch (error) {
    console.error('Erreur lors de la synchronisation des commissions des reçus:', error)
    throw error
  }
}

// Calculer le total des commissions générées (transferts uniquement)
export async function getTotalCommissions(): Promise<number> {
  const result = await sql<{ total: number }[]>`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM cash_transactions
    WHERE transaction_type = 'commission' 
    AND account_type = 'commissions'
  `
  
  return result[0]?.total || 0
}

// Calculer le total des commissions des reçus (commissions + dépenses)
export async function getTotalReceiptCommissions(): Promise<number> {
  const result = await sql<{ total: number }[]>`
    SELECT COALESCE(SUM(
      CASE 
        WHEN transaction_type = 'commission' THEN amount
        WHEN transaction_type = 'deposit' THEN amount
        WHEN transaction_type = 'withdrawal' THEN -amount
        WHEN transaction_type = 'expense' THEN -amount
        ELSE 0
      END
    ), 0) as total
    FROM cash_transactions
    WHERE account_type = 'receipt_commissions'
  `
  
  return result[0]?.total || 0
}

// Réconcilier le solde du compte commissions avec la somme réelle des transactions de commission
export async function reconcileCommissionsBalance(updatedBy: string = 'system'): Promise<number> {
  // Calculer la somme réelle des transactions de type commission (transferts uniquement)
  const total = await getTotalCommissions()

  // Mettre à jour le solde du compte commissions pour refléter exactement cette somme
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${total},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'commissions'
  `

  return total
}

// Réconcilier le solde du compte commissions des reçus
export async function reconcileReceiptCommissionsBalance(updatedBy: string = 'system'): Promise<number> {
  // Calculer la somme réelle des transactions de type commission des reçus
  const total = await getTotalReceiptCommissions()

  // Mettre à jour le solde du compte commissions des reçus pour refléter exactement cette somme
  await sql`
    UPDATE cash_accounts 
    SET 
      current_balance = ${total},
      last_updated = NOW(),
      updated_by = ${updatedBy}
    WHERE account_type = 'receipt_commissions'
  `

  return total
}
