import "server-only"
import { sql } from "./db"
import { convertExpenseToEmailData, sendExpenseSubmittedNotification, sendExpenseAccountingValidatedNotification, sendExpenseDirectorValidatedNotification } from "./email-notifications"
import { deductExpenseFromCoffre } from "./cash-queries"

export type ExpenseStatus = "pending" | "accounting_approved" | "accounting_rejected" | "director_approved" | "director_rejected"

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
}


export async function listExpensesForUser(userName: string, canModerateAll: boolean): Promise<Expense[]> {
  if (canModerateAll) {
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
      ORDER BY created_at DESC
      LIMIT 500;
    `
    return rows
  }
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
    WHERE requested_by = ${userName}
    ORDER BY created_at DESC
    LIMIT 500;
  `
  return rows
}

export async function createExpense(input: {
  description: string
  amount: number
  category: string
  requested_by: string
  agency: string
  comment?: string
}): Promise<Expense> {
  const rows = await sql<Expense[]>`
    INSERT INTO expenses (description, amount, category, requested_by, agency, comment, rejection_reason)
    VALUES (${input.description}, ${input.amount}, ${input.category}, ${input.requested_by}, ${input.agency}, ${input.comment || null}, null)
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

// Fonction pour validation comptable
export async function validateExpenseByAccounting(
  id: string, 
  approved: boolean, 
  validatedBy: string, 
  rejection_reason?: string
): Promise<Expense> {
  const status = approved ? "accounting_approved" : "accounting_rejected"
  
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
  
  if (rows.length === 0) {
    throw new Error("Dépense non trouvée ou déjà traitée")
  }
  
  const expense = rows[0]

  // Envoyer une notification email pour la validation comptable
  try {
    const emailData = convertExpenseToEmailData(expense)
    await sendExpenseAccountingValidatedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de validation comptable:', error)
  }

  return expense
}

// Fonction pour validation directeur
export async function validateExpenseByDirector(
  id: string, 
  approved: boolean, 
  validatedBy: string, 
  rejection_reason?: string
): Promise<Expense> {
  const status = approved ? "director_approved" : "director_rejected"
  
  const rows = await sql<Expense[]>`
    UPDATE expenses
    SET 
      status = ${status}, 
      rejection_reason = ${rejection_reason || null}, 
      director_validated_by = ${validatedBy},
      director_validated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${id}::uuid AND status = 'accounting_approved'
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
  
  if (rows.length === 0) {
    throw new Error("Dépense non trouvée ou pas encore approuvée par la comptabilité")
  }
  
  const expense = rows[0]

  // Si la dépense est approuvée par le directeur, déduire du coffre
  if (approved) {
    try {
      await deductExpenseFromCoffre(
        expense.id,
        expense.amount,
        `Dépense approuvée: ${expense.description}`,
        validatedBy
      )
    } catch (error) {
      console.error('Erreur lors de la déduction de la dépense du coffre:', error)
      // Ne pas faire échouer la validation si la déduction échoue
    }
  }

  // Envoyer une notification email pour la validation directeur
  try {
    const emailData = convertExpenseToEmailData(expense)
    await sendExpenseDirectorValidatedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de validation directeur:', error)
  }

  return expense
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


