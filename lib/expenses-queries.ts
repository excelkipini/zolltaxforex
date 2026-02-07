import "server-only"
import { sql } from "./db"
import { convertExpenseToEmailData, sendExpenseSubmittedNotification, sendExpenseAccountingValidatedNotification, sendExpenseDirectorValidatedNotification } from "./email-notifications"
import { deductExpenseFromAccount, deductExpenseFromReceiptCommissions, deductExpenseFromRiaExcedents, reconcileRiaExcedentsBalance } from "./cash-queries"

export type ExpenseStatus = "pending" | "accounting_approved" | "accounting_rejected" | "director_approved" | "director_rejected"

export type ExpenseDebitAccount = "coffre" | "commissions" | "receipt_commissions" | "ecobank" | "uba"

export type Expense = {
  id: string
  description: string
  amount: number
  category: string
  status: ExpenseStatus
  date: string
  requested_by: string
  agency: string
  comment?: string
  rejection_reason?: string
  accounting_validated_by?: string
  accounting_validated_at?: string
  director_validated_by?: string
  director_validated_at?: string
  debit_account_type?: ExpenseDebitAccount | null
}


const EXPENSES_SELECT = `
  id::text,
  description,
  amount::bigint as amount,
  category,
  status,
  date::text as date,
  requested_by,
  agency,
  comment,
  rejection_reason,
  accounting_validated_by,
  accounting_validated_at::text as accounting_validated_at,
  director_validated_by,
  director_validated_at::text as director_validated_at,
  debit_account_type
`

const EXPENSES_SELECT_WITHOUT_DEBIT = `
  id::text,
  description,
  amount::bigint as amount,
  category,
  status,
  date::text as date,
  requested_by,
  agency,
  comment,
  rejection_reason,
  accounting_validated_by,
  accounting_validated_at::text as accounting_validated_at,
  director_validated_by,
  director_validated_at::text as director_validated_at
`

export async function listExpensesForUser(userName: string, canModerateAll: boolean, limit: number = 500): Promise<Expense[]> {
  const safeLimit = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 500))
  const runAll = async (selectCols: string) => {
    if (canModerateAll) {
      return sql<Expense[]>`SELECT ${sql.unsafe(selectCols)} FROM expenses ORDER BY created_at DESC LIMIT ${safeLimit}`
    }
    return sql<Expense[]>`SELECT ${sql.unsafe(selectCols)} FROM expenses WHERE requested_by = ${userName} ORDER BY created_at DESC LIMIT ${safeLimit}`
  }
  try {
    const rows = await runAll(EXPENSES_SELECT)
    return rows
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (msg.includes("debit_account_type") || msg.includes("column") && msg.includes("does not exist")) {
      const rows = await runAll(EXPENSES_SELECT_WITHOUT_DEBIT)
      return rows.map((r) => ({ ...r, debit_account_type: null }))
    }
    throw err
  }
}

export async function createExpense(input: {
  description: string
  amount: number
  category: string
  requested_by: string
  agency: string
  comment?: string
  deduct_from_excedents?: boolean
  deducted_cashier_id?: string | null
}): Promise<Expense> {
  const rows = await sql<Expense[]>`
    INSERT INTO expenses (
      description, amount, category, requested_by, agency, comment, rejection_reason,
      deduct_from_excedents, deducted_cashier_id
    )
    VALUES (
      ${input.description}, ${input.amount}, ${input.category}, ${input.requested_by}, ${input.agency}, ${input.comment || null}, null,
      ${!!input.deduct_from_excedents}, ${input.deducted_cashier_id || null}
    )
    RETURNING 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at;
  `
  
  const expense = rows[0]

  // Envoyer une notification email pour la nouvelle dépense soumise
  try {
    const emailData = convertExpenseToEmailData(expense)
    await sendExpenseSubmittedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de dépense soumise:', error)
  }

  return expense
}

// Fonction pour validation comptable (tolérante si la colonne debit_account_type n'existe pas)
export async function validateExpenseByAccounting(
  id: string, 
  approved: boolean, 
  validatedBy: string, 
  rejection_reason?: string,
  debit_account_type?: ExpenseDebitAccount | null
): Promise<Expense> {
  const status = approved ? "accounting_approved" : "accounting_rejected"
  const debitAccount = approved && debit_account_type ? debit_account_type : null

  const runWithDebitColumn = async (): Promise<Expense[]> => {
    return sql<Expense[]>`
      UPDATE expenses
      SET 
        status = ${status}, 
        rejection_reason = ${rejection_reason || null}, 
        accounting_validated_by = ${validatedBy},
        accounting_validated_at = NOW(),
        debit_account_type = COALESCE(${debitAccount}, debit_account_type, 'uba'),
        updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'pending'
      RETURNING 
        id::text, description, amount::bigint as amount, category, status, date::text as date,
        requested_by, agency, comment, rejection_reason,
        accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
        director_validated_by, director_validated_at::text as director_validated_at,
        debit_account_type
    `
  }

  const runWithoutDebitColumn = async (): Promise<Expense[]> => {
    const rows = await sql<Expense[]>`
      UPDATE expenses
      SET 
        status = ${status}, 
        rejection_reason = ${rejection_reason || null}, 
        accounting_validated_by = ${validatedBy},
        accounting_validated_at = NOW(),
        updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'pending'
      RETURNING 
        id::text, description, amount::bigint as amount, category, status, date::text as date,
        requested_by, agency, comment, rejection_reason,
        accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
        director_validated_by, director_validated_at::text as director_validated_at
    `
    return rows.map((r) => ({ ...r, debit_account_type: null }))
  }

  let rows: Expense[]
  try {
    rows = await runWithDebitColumn()
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    const code = err?.code
    if (code === "42703" || (msg.includes("debit_account_type") && msg.includes("does not exist"))) {
      rows = await runWithoutDebitColumn()
    } else {
      throw err
    }
  }

  if (rows.length === 0) {
    throw new Error("Dépense non trouvée ou déjà traitée")
  }

  const expense = rows[0]

  try {
    const emailData = convertExpenseToEmailData(expense)
    await sendExpenseAccountingValidatedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de validation comptable:', error)
  }

  return expense
}

// Fonction pour validation directeur (tolérante si debit_account_type n'existe pas)
export async function validateExpenseByDirector(
  id: string, 
  approved: boolean, 
  validatedBy: string, 
  rejection_reason?: string
): Promise<Expense> {
  const status = approved ? "director_approved" : "director_rejected"

  const runWithDebitColumn = async () =>
    sql<Expense[]>`
      UPDATE expenses
      SET status = ${status}, rejection_reason = ${rejection_reason || null},
          director_validated_by = ${validatedBy}, director_validated_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'accounting_approved'
      RETURNING id::text, description, amount::bigint as amount, category, status, date::text as date,
        requested_by, agency, comment, rejection_reason, deduct_from_excedents, deducted_cashier_id,
        debit_account_type, accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
        director_validated_by, director_validated_at::text as director_validated_at
    `

  const runWithoutDebitColumn = async () => {
    const rows = await sql<Expense[]>`
      UPDATE expenses
      SET status = ${status}, rejection_reason = ${rejection_reason || null},
          director_validated_by = ${validatedBy}, director_validated_at = NOW(), updated_at = NOW()
      WHERE id = ${id}::uuid AND status = 'accounting_approved'
      RETURNING id::text, description, amount::bigint as amount, category, status, date::text as date,
        requested_by, agency, comment, rejection_reason, deduct_from_excedents, deducted_cashier_id,
        accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
        director_validated_by, director_validated_at::text as director_validated_at
    `
    return rows.map((r) => ({ ...r, debit_account_type: null }))
  }

  let rows: Expense[]
  try {
    rows = await runWithDebitColumn()
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    const code = err?.code
    if (code === "42703" || (msg.includes("debit_account_type") && msg.includes("does not exist"))) {
      rows = await runWithoutDebitColumn()
    } else {
      throw err
    }
  }

  if (rows.length === 0) {
    throw new Error("Dépense non trouvée ou pas encore approuvée par la comptabilité")
  }

  const expense: any = rows[0]

  if (approved) {
    try {
      if (expense.deduct_from_excedents && expense.deducted_cashier_id) {
        await deductExpenseFromRiaExcedents(
          expense.id,
          expense.amount,
          `Dépense approuvée (excédents): ${expense.description}`,
          validatedBy
        )
      } else {
        const debitAccount = (expense.debit_account_type || "uba") as import("./cash-queries").ExpenseDebitAccountType
        await deductExpenseFromAccount(
          debitAccount,
          expense.id,
          expense.amount,
          `Dépense approuvée: ${expense.description}`,
          validatedBy
        )
      }
      await reconcileRiaExcedentsBalance(validatedBy)
    } catch (error) {
      console.error('Erreur lors de la déduction de la dépense après validation directeur:', error)
    }
  }

  try {
    const emailData = convertExpenseToEmailData(expense)
    await sendExpenseDirectorValidatedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de validation directeur:', error)
  }

  return expense
}

/** Statistiques agrégées pour le tableau de bord (une requête légère). */
export async function getExpensesStats(
  userName: string,
  canViewAll: boolean,
  role: string
): Promise<{
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  totalPendingAmount: number
  totalApprovedAmount: number
}> {
  const base = canViewAll
    ? sql`SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(amount), 0)::bigint AS total FROM expenses GROUP BY status`
    : sql`SELECT status, COUNT(*)::int AS cnt, COALESCE(SUM(amount), 0)::bigint AS total FROM expenses WHERE requested_by = ${userName} GROUP BY status`
  const rows = await sql<{ status: string; cnt: number | string; total: number | string }[]>`${base}`
  const byStatus: Record<string, { count: number; total: number }> = {}
  rows.forEach((r) => {
    byStatus[r.status] = { count: Number(r.cnt), total: Number(r.total) }
  })
  const isDirectorDelegate = role === "director" || role === "delegate"
  const pendingCount = isDirectorDelegate
    ? (byStatus["pending"]?.count ?? 0) + (byStatus["accounting_approved"]?.count ?? 0)
    : (byStatus["pending"]?.count ?? 0)
  const approvedCount = byStatus["director_approved"]?.count ?? 0
  const rejectedCount = (byStatus["accounting_rejected"]?.count ?? 0) + (byStatus["director_rejected"]?.count ?? 0)
  const totalPendingAmount = isDirectorDelegate
    ? (byStatus["pending"]?.total ?? 0) + (byStatus["accounting_approved"]?.total ?? 0)
    : (byStatus["pending"]?.total ?? 0)
  const totalApprovedAmount = byStatus["director_approved"]?.total ?? 0
  return {
    pendingCount,
    approvedCount,
    rejectedCount,
    totalPendingAmount,
    totalApprovedAmount,
  }
}

const DASHBOARD_SELECT = `
  id::text, description, amount::bigint as amount, category, status, date::text as date,
  requested_by, agency, comment, rejection_reason,
  accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
  director_validated_by, director_validated_at::text as director_validated_at,
  debit_account_type
`
const DASHBOARD_SELECT_NO_DEBIT = `
  id::text, description, amount::bigint as amount, category, status, date::text as date,
  requested_by, agency, comment, rejection_reason,
  accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
  director_validated_by, director_validated_at::text as director_validated_at
`

async function runDashboardPendingQuery(selectCols: string, whereClause: ReturnType<typeof sql>): Promise<Expense[]> {
  try {
    const rows = await sql<Expense[]>`SELECT ${sql.unsafe(selectCols)} FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT 500`
    return rows
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if ((msg.includes("debit_account_type") || msg.includes("column")) && msg.includes("does not exist")) {
      const rows = await sql<Expense[]>`SELECT ${sql.unsafe(DASHBOARD_SELECT_NO_DEBIT)} FROM expenses ${whereClause} ORDER BY created_at DESC LIMIT 500`
      return rows.map((r) => ({ ...r, debit_account_type: null }))
    }
    throw err
  }
}

/** Liste des dépenses en attente pour le tableau de bord (limitée, rapide). */
export async function getExpensesPendingForDashboard(
  userName: string,
  canViewAll: boolean,
  role: string
): Promise<Expense[]> {
  const isDirectorDelegate = role === "director" || role === "delegate"
  if (canViewAll && isDirectorDelegate) {
    return runDashboardPendingQuery(DASHBOARD_SELECT, sql`WHERE status IN ('pending', 'accounting_approved')`)
  }
  if (canViewAll && role === "accounting") {
    return runDashboardPendingQuery(DASHBOARD_SELECT, sql`WHERE status = 'pending'`)
  }
  return runDashboardPendingQuery(DASHBOARD_SELECT, sql`WHERE requested_by = ${userName} AND status IN ('pending', 'accounting_approved')`)
}

// Fonction pour obtenir les dépenses en attente de validation comptable
export async function getExpensesPendingAccounting(): Promise<Expense[]> {
  const rows = await sql<Expense[]>`
    SELECT 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at
    FROM expenses
    WHERE status = 'pending'
    ORDER BY created_at ASC;
  `
  return rows
}

// Fonction pour obtenir les dépenses en attente de validation directeur
export async function getExpensesPendingDirector(): Promise<Expense[]> {
  const rows = await sql<Expense[]>`
    SELECT 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at
    FROM expenses
    WHERE status = 'accounting_approved'
    ORDER BY accounting_validated_at ASC;
  `
  return rows
}

// Fonction legacy pour compatibilité
export async function setExpenseStatus(id: string, status: ExpenseStatus, rejection_reason?: string): Promise<Expense> {
  const rows = await sql<Expense[]>`
    UPDATE expenses
    SET status = ${status}, rejection_reason = ${rejection_reason || null}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING 
      id::text, 
      description, 
      amount::bigint as amount, 
      category, 
      status, 
      date::text as date, 
      requested_by, 
      agency, 
      comment, 
      rejection_reason,
      accounting_validated_by,
      accounting_validated_at::text as accounting_validated_at,
      director_validated_by,
      director_validated_at::text as director_validated_at;
  `
  return rows[0]
}

/** Vérifie qu'une dépense existe et n'est pas validée par le directeur (pour modification/suppression). */
async function assertExpenseEditable(id: string): Promise<{ status: string }> {
  const checkRows = await sql<{ status: string }[]>`
    SELECT status FROM expenses WHERE id = ${id}::uuid
  `
  if (checkRows.length === 0) throw new Error("Dépense non trouvée")
  const expense = checkRows[0]
  if (expense.status === "director_approved" || expense.status === "approved") {
    throw new Error("Impossible de modifier ou supprimer une dépense déjà validée par le directeur")
  }
  return expense
}

/** Met à jour une dépense (description, amount, category, agency, comment). Refusé si déjà validée par le directeur. */
export async function updateExpense(
  id: string,
  patch: { description: string; amount: number; category: string; agency: string; comment?: string }
): Promise<Expense> {
  await assertExpenseEditable(id)
  const rows = await sql<Expense[]>`
    UPDATE expenses
    SET
      description = ${patch.description},
      amount = ${patch.amount}::bigint,
      category = ${patch.category},
      agency = ${patch.agency},
      comment = ${patch.comment ?? null},
      updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id::text, description, amount::bigint as amount, category, status, date::text as date,
      requested_by, agency, comment, rejection_reason,
      accounting_validated_by, accounting_validated_at::text as accounting_validated_at,
      director_validated_by, director_validated_at::text as director_validated_at
  `
  if (rows.length === 0) throw new Error("Dépense non trouvée")
  const out = rows[0]
  try {
    const withDebit = await sql<Expense[]>`SELECT ${sql.unsafe("id::text, description, amount::bigint as amount, category, status, date::text as date, requested_by, agency, comment, rejection_reason, accounting_validated_by, accounting_validated_at::text as accounting_validated_at, director_validated_by, director_validated_at::text as director_validated_at, debit_account_type")} FROM expenses WHERE id = ${id}::uuid`
    if (withDebit.length > 0) return { ...out, debit_account_type: (withDebit[0] as any).debit_account_type ?? null }
  } catch {
    // colonne debit_account_type absente
  }
  return { ...out, debit_account_type: null }
}

/** Supprime une dépense. Refusé si déjà validée par le directeur. */
export async function deleteExpense(id: string): Promise<void> {
  await assertExpenseEditable(id)
  await sql`DELETE FROM expenses WHERE id = ${id}::uuid`
}
