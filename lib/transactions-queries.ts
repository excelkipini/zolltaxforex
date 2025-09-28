import "server-only"
import { sql } from "./db"
import { generateTransactionId } from "./transaction-id-generator"
import { 
  sendTransactionCreatedNotification, 
  sendTransactionValidatedNotification, 
  sendTransactionCompletedNotification,
  convertTransactionToEmailData
} from "./email-notifications"

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
  
  const transaction = rows[0]
  
  // Envoyer une notification email si la transaction est créée par un caissier
  if (input.type !== "receipt" && defaultStatus === "pending") {
    try {
      const emailData = convertTransactionToEmailData(transaction)
      await sendTransactionCreatedNotification(emailData)
    } catch (error) {
      console.error('Erreur lors de l\'envoi de la notification de création:', error)
    }
  }
  
  return transaction
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
  
  const transaction = rows[0]
  
  // Envoyer des notifications email selon le statut
  try {
    const emailData = convertTransactionToEmailData(transaction)
    
    if (status === "validated") {
      await sendTransactionValidatedNotification(emailData)
    } else if (status === "completed") {
      await sendTransactionCompletedNotification(emailData)
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de mise à jour:', error)
  }
  
  return transaction
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

export async function deleteAllTransactions(): Promise<{ count: number }> {
  const result = await sql<{ count: number }[]>`
    DELETE FROM transactions
    RETURNING COUNT(*) as count
  `
  return { count: result[0]?.count || 0 }
}

// Fonction pour demander la suppression d'un reçu
export async function requestTransactionDeletion(
  id: string, 
  requestedBy: string, 
  reason?: string
): Promise<Transaction> {
  const rows = await sql<Transaction[]>`
    UPDATE transactions
    SET 
      status = 'pending_delete',
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
  
  const transaction = rows[0]
  
  // Envoyer une notification email pour la demande de suppression
  try {
    const { sendDeletionRequestedNotification, convertDeletionRequestToEmailData } = await import('./email-notifications')
    const emailData = convertDeletionRequestToEmailData(transaction, requestedBy, reason)
    await sendDeletionRequestedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de demande de suppression:', error)
  }
  
  return transaction
}

// Fonction pour valider la suppression d'un reçu
export async function validateTransactionDeletion(
  id: string, 
  validatedBy: string
): Promise<Transaction> {
  const rows = await sql<Transaction[]>`
    UPDATE transactions
    SET 
      status = 'rejected',
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
  
  const transaction = rows[0]
  
  // Envoyer une notification email pour la validation de suppression
  try {
    const { sendDeletionValidatedNotification, convertDeletionRequestToEmailData } = await import('./email-notifications')
    const emailData = convertDeletionRequestToEmailData(transaction, transaction.created_by)
    await sendDeletionValidatedNotification(emailData)
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification de validation de suppression:', error)
  }
  
  return transaction
}
