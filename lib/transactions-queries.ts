import "server-only"
import { sql } from "./db"
import { generateTransactionId } from "./transaction-id-generator"

export type Transaction = {
  id: string
  type: "reception" | "exchange" | "transfer" | "card" | "receipt"
  status: "pending" | "validated" | "rejected" | "completed" | "pending_delete"
  description: string
  amount: number
  currency: string
  created_by: string
  agency: string
  details: any
  rejection_reason?: string
  delete_validated_by?: string
  delete_validated_at?: string
  created_at: string
  updated_at: string
}

export type CreateTransactionInput = {
  type: Transaction["type"]
  description: string
  amount: number
  currency?: string
  created_by: string
  agency: string
  details: any
}

export async function listTransactions(): Promise<Transaction[]> {
  const rows = await sql<Transaction[]>`
    SELECT 
      id::text,
      type,
      status,
      description,
      amount::bigint as amount,
      currency,
      created_by,
      agency,
      details,
      rejection_reason,
      delete_validated_by,
      delete_validated_at::text as delete_validated_at,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions
    ORDER BY created_at DESC
  `
  return rows
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const transactionId = generateTransactionId()
  
  // Définir le statut par défaut selon le type
  const defaultStatus = input.type === "receipt" ? "completed" : "pending"
  
  const rows = await sql<Transaction[]>`
    INSERT INTO transactions (id, type, status, description, amount, currency, created_by, agency, details)
    VALUES (${transactionId}, ${input.type}, ${defaultStatus}, ${input.description}, ${input.amount}, ${input.currency || 'XAF'}, ${input.created_by}, ${input.agency}, ${JSON.stringify(input.details)})
    RETURNING 
      id::text,
      type,
      status,
      description,
      amount::bigint as amount,
      currency,
      created_by,
      agency,
      details,
      rejection_reason,
      created_at::text as created_at,
      updated_at::text as updated_at
  `
  return rows[0]
}

export async function updateTransactionStatus(
  id: string, 
  status: Transaction["status"], 
  rejection_reason?: string
): Promise<Transaction> {
  const rows = await sql<Transaction[]>`
    UPDATE transactions
    SET 
      status = ${status},
      rejection_reason = ${rejection_reason || null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING 
      id::text,
      type,
      status,
      description,
      amount::bigint as amount,
      currency,
      created_by,
      agency,
      details,
      rejection_reason,
      created_at::text as created_at,
      updated_at::text as updated_at
  `
  return rows[0]
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const rows = await sql<Transaction[]>`
    SELECT 
      id::text,
      type,
      status,
      description,
      amount::bigint as amount,
      currency,
      created_by,
      agency,
      details,
      rejection_reason,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions
    WHERE id = ${id}
  `
  return rows[0] || null
}

export async function getTransactionsByUser(userName: string): Promise<Transaction[]> {
  const rows = await sql<Transaction[]>`
    SELECT 
      id::text,
      type,
      status,
      description,
      amount::bigint as amount,
      currency,
      created_by,
      agency,
      details,
      rejection_reason,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions
    WHERE created_by = ${userName}
    ORDER BY created_at DESC
  `
  return rows
}

export async function getPendingTransactions(): Promise<Transaction[]> {
  const rows = await sql<Transaction[]>`
    SELECT 
      id::text,
      type,
      status,
      description,
      amount::bigint as amount,
      currency,
      created_by,
      agency,
      details,
      rejection_reason,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions
    WHERE status = 'pending'
    ORDER BY created_at ASC
  `
  return rows
}
