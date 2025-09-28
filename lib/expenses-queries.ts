import "server-only"
import { sql } from "./db"

export type ExpenseStatus = "pending" | "approved" | "rejected"

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
}


export async function listExpensesForUser(userName: string, canModerateAll: boolean): Promise<Expense[]> {
  if (canModerateAll) {
    const rows = await sql<Expense[]>`
      SELECT id::text, description, amount::bigint as amount, category, status, date::text as date, requested_by, agency, comment, rejection_reason
      FROM expenses
      ORDER BY created_at DESC
      LIMIT 500;
    `
    return rows
  }
  const rows = await sql<Expense[]>`
    SELECT id::text, description, amount::bigint as amount, category, status, date::text as date, requested_by, agency, comment, rejection_reason
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
    RETURNING id::text, description, amount::bigint as amount, category, status, date::text as date, requested_by, agency, comment, rejection_reason;
  `
  return rows[0]
}

export async function setExpenseStatus(id: string, status: ExpenseStatus, rejection_reason?: string): Promise<Expense> {
  const rows = await sql<Expense[]>`
    UPDATE expenses
    SET status = ${status}, rejection_reason = ${rejection_reason || null}, updated_at = NOW()
    WHERE id = ${id}::uuid
    RETURNING id::text, description, amount::bigint as amount, category, status, date::text as date, requested_by, agency, comment, rejection_reason;
  `
  return rows[0]
}


