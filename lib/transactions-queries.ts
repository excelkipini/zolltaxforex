import "server-only"
import { sql } from "./db"
import { generateTransactionId } from "./transaction-id-generator"
import { 
  sendTransactionCreatedNotification, 
  sendTransactionValidatedNotification, 
  sendTransactionCompletedNotification,
  convertTransactionToEmailData,
  sendTransferCreatedNotification,
  sendTransferValidatedNotification,
  sendTransferExecutedNotification,
  sendTransferCompletedNotification,
  convertTransferToEmailData
} from "./email-notifications"
import { addCommissionToAccount } from "./cash-queries"
import { getSettings } from "./settings-queries"

export type Transaction = {
  id: string
  type: "reception" | "exchange" | "transfer" | "card" | "receipt" | "settlement"
  status: "pending" | "validated" | "rejected" | "completed" | "executed" | "pending_delete" | "exception"
  description: string
  amount: number
  currency: string
  created_by: string
  agency: string
  details: any
  rejection_reason?: string
  delete_validated_by?: string
  delete_validated_at?: string
  real_amount_eur?: number
  commission_amount?: number
  executor_id?: string
  executed_at?: string
  receipt_url?: string
  executor_comment?: string
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
      real_amount_eur,
      commission_amount,
      executor_id::text as executor_id,
      executed_at::text as executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions
    ORDER BY created_at DESC
  `

  return rows
}

export type ListTransactionsFilters = {
  type?: string
  fromDate?: string
  toDate?: string
  status?: string
  createdBy?: string
  transferMethod?: string
  search?: string
  limit?: number
  offset?: number
}

export async function listTransactionsFiltered(filters?: ListTransactionsFilters): Promise<Transaction[]> {
  const typeParam = (filters?.type?.trim() || null) as string | null
  const fromParam = (filters?.fromDate?.trim() || null) as string | null
  const toParam = (filters?.toDate?.trim() || null) as string | null
  const statusParam = (filters?.status?.trim() || null) as string | null
  const createdByParam = (filters?.createdBy?.trim() || null) as string | null
  const transferMethodParam = (filters?.transferMethod?.trim() || null) as string | null
  const searchParam = (filters?.search?.trim() || null) as string | null
  const searchPattern = searchParam ? `%${searchParam}%` : null
  const limitParam = filters?.limit ?? null
  const offsetParam = filters?.offset ?? null

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
      real_amount_eur,
      commission_amount,
      executor_id::text as executor_id,
      executed_at::text as executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions
    WHERE
      (${typeParam}::text IS NULL OR type = ${typeParam})
      AND (${fromParam}::text IS NULL OR created_at::date >= (${fromParam})::date)
      AND (${toParam}::text IS NULL OR created_at::date <= (${toParam})::date)
      AND (${statusParam}::text IS NULL OR status = ${statusParam})
      AND (${createdByParam}::text IS NULL OR created_by = ${createdByParam})
      AND (${transferMethodParam}::text IS NULL OR details->>'transfer_method' = ${transferMethodParam})
      AND (${searchPattern}::text IS NULL OR id ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR created_by ILIKE ${searchPattern} OR details->>'beneficiary_name' ILIKE ${searchPattern})
    ORDER BY created_at DESC
    ${limitParam != null ? sql`LIMIT ${limitParam}` : sql``}
    ${offsetParam != null ? sql`OFFSET ${offsetParam}` : sql``}
  `

  return rows
}

/** Comptage approximatif rapide (pg_class) pour la pagination sans filtre. */
async function getTransactionsApproximateCount(): Promise<number | null> {
  try {
    const rows = await sql<{ reltuples: number | string }[]>`
      SELECT reltuples::bigint as reltuples
      FROM pg_class
      WHERE relname = 'transactions'
    `
    const raw = rows[0]?.reltuples
    const n = typeof raw === "string" ? parseInt(raw, 10) : Number(raw)
    if (Number.isNaN(n) || n < 0) return null
    return n
  } catch {
    return null
  }
}

export async function listTransactionsCount(filters?: Omit<ListTransactionsFilters, "limit" | "offset">): Promise<number> {
  const typeParam = (filters?.type?.trim() || null) as string | null
  const fromParam = (filters?.fromDate?.trim() || null) as string | null
  const toParam = (filters?.toDate?.trim() || null) as string | null
  const statusParam = (filters?.status?.trim() || null) as string | null
  const createdByParam = (filters?.createdBy?.trim() || null) as string | null
  const transferMethodParam = (filters?.transferMethod?.trim() || null) as string | null
  const searchParam = (filters?.search?.trim() || null) as string | null
  const searchPattern = searchParam ? `%${searchParam}%` : null

  const hasFilters = typeParam != null || fromParam != null || toParam != null || statusParam != null || createdByParam != null || transferMethodParam != null || searchPattern != null

  if (!hasFilters) {
    const approx = await getTransactionsApproximateCount()
    if (approx != null) return approx
  }

  const result = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text as count
    FROM transactions
    WHERE
      (${typeParam}::text IS NULL OR type = ${typeParam})
      AND (${fromParam}::text IS NULL OR created_at::date >= (${fromParam})::date)
      AND (${toParam}::text IS NULL OR created_at::date <= (${toParam})::date)
      AND (${statusParam}::text IS NULL OR status = ${statusParam})
      AND (${createdByParam}::text IS NULL OR created_by = ${createdByParam})
      AND (${transferMethodParam}::text IS NULL OR details->>'transfer_method' = ${transferMethodParam})
      AND (${searchPattern}::text IS NULL OR id ILIKE ${searchPattern} OR description ILIKE ${searchPattern} OR created_by ILIKE ${searchPattern} OR details->>'beneficiary_name' ILIKE ${searchPattern})
  `
  return parseInt(result[0]?.count ?? "0", 10)
}

export async function listTransactionFilterOptions(status: "validated" | "executed"): Promise<{ cashiers: string[] }> {
  const rows = await sql<{ created_by: string }[]>`
    SELECT DISTINCT created_by
    FROM transactions
    WHERE status = ${status}
    ORDER BY created_by
  `
  return { cashiers: rows.map((r) => r.created_by).filter(Boolean) }
}

export type TransactionStats = {
  pending: number
  validated: number
  completed: number
  rejected: number
  executed: number
  totalPendingAmount: number
  totalExecutedAmount: number
}

const statsWhereClause = (filters?: Omit<ListTransactionsFilters, "limit" | "offset">) => {
  const typeParam = (filters?.type?.trim() || null) as string | null
  const fromParam = (filters?.fromDate?.trim() || null) as string | null
  const toParam = (filters?.toDate?.trim() || null) as string | null
  const statusParam = (filters?.status?.trim() || null) as string | null
  const createdByParam = (filters?.createdBy?.trim() || null) as string | null
  const transferMethodParam = (filters?.transferMethod?.trim() || null) as string | null
  const searchParam = (filters?.search?.trim() || null) as string | null
  const searchPattern = searchParam ? `%${searchParam}%` : null
  return {
    typeParam,
    fromParam,
    toParam,
    statusParam,
    createdByParam,
    transferMethodParam,
    searchPattern,
  }
}

export async function getTransactionStats(filters?: Omit<ListTransactionsFilters, "limit" | "offset">): Promise<TransactionStats> {
  const hasFilters =
    filters?.fromDate?.trim() ||
    filters?.toDate?.trim() ||
    (filters?.createdBy?.trim() && filters.createdBy !== "all") ||
    (filters?.transferMethod?.trim() && filters.transferMethod !== "all") ||
    filters?.search?.trim()
  if (!hasFilters) {
    return getTransactionStatsUnfiltered()
  }
  const w = statsWhereClause(filters)
  const baseWhere = sql`
    (${w.typeParam}::text IS NULL OR type = ${w.typeParam})
    AND (${w.fromParam}::text IS NULL OR created_at::date >= (${w.fromParam})::date)
    AND (${w.toParam}::text IS NULL OR created_at::date <= (${w.toParam})::date)
    AND (${w.createdByParam}::text IS NULL OR created_by = ${w.createdByParam})
    AND (${w.transferMethodParam}::text IS NULL OR details->>'transfer_method' = ${w.transferMethodParam})
    AND (${w.searchPattern}::text IS NULL OR id ILIKE ${w.searchPattern} OR description ILIKE ${w.searchPattern} OR created_by ILIKE ${w.searchPattern} OR details->>'beneficiary_name' ILIKE ${w.searchPattern})
  `
  const rows = await sql<{ status: string; count: string }[]>`
    SELECT status, COUNT(*)::text as count
    FROM transactions
    WHERE status IN ('pending', 'validated', 'completed', 'rejected', 'executed')
    AND ${baseWhere}
    GROUP BY status
  `
  const [pendingAmountRow, executedAmountRow] = await Promise.all([
    sql<{ total: string }[]>`
      SELECT COALESCE(SUM(amount)::text, '0') as total FROM transactions
      WHERE status = 'pending' AND ${baseWhere}
    `,
    sql<{ total: string }[]>`
      SELECT COALESCE(SUM(amount)::text, '0') as total FROM transactions
      WHERE status = 'executed' AND ${baseWhere}
    `,
  ])
  const byStatus: Record<string, number> = { pending: 0, validated: 0, completed: 0, rejected: 0, executed: 0 }
  for (const row of rows) {
    byStatus[row.status] = parseInt(row.count, 10)
  }
  const totalPendingAmount = parseInt(pendingAmountRow[0]?.total ?? "0", 10)
  const totalExecutedAmount = parseInt(executedAmountRow[0]?.total ?? "0", 10)
  return {
    pending: byStatus.pending ?? 0,
    validated: byStatus.validated ?? 0,
    completed: byStatus.completed ?? 0,
    rejected: byStatus.rejected ?? 0,
    executed: byStatus.executed ?? 0,
    totalPendingAmount,
    totalExecutedAmount,
  }
}

async function getTransactionStatsUnfiltered(): Promise<TransactionStats> {
  const rows = await sql<{ status: string; count: string }[]>`
    SELECT status, COUNT(*)::text as count
    FROM transactions
    WHERE status IN ('pending', 'validated', 'completed', 'rejected', 'executed')
    GROUP BY status
  `
  const [pendingAmountRow, executedAmountRow] = await Promise.all([
    sql<{ total: string }[]>`SELECT COALESCE(SUM(amount)::text, '0') as total FROM transactions WHERE status = 'pending'`,
    sql<{ total: string }[]>`SELECT COALESCE(SUM(amount)::text, '0') as total FROM transactions WHERE status = 'executed'`,
  ])
  const byStatus: Record<string, number> = { pending: 0, validated: 0, completed: 0, rejected: 0, executed: 0 }
  for (const row of rows) {
    byStatus[row.status] = parseInt(row.count, 10)
  }
  const totalPendingAmount = parseInt(pendingAmountRow[0]?.total ?? "0", 10)
  const totalExecutedAmount = parseInt(executedAmountRow[0]?.total ?? "0", 10)
  return {
    pending: byStatus.pending ?? 0,
    validated: byStatus.validated ?? 0,
    completed: byStatus.completed ?? 0,
    rejected: byStatus.rejected ?? 0,
    executed: byStatus.executed ?? 0,
    totalPendingAmount,
    totalExecutedAmount,
  }
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
  
  // Envoyer une notification email selon le type de transaction
  if (input.type !== "receipt" && defaultStatus === "pending") {
    try {
      if (input.type === "transfer") {
        // Pour les transferts d'argent, utiliser les nouvelles notifications
        const transferData = convertTransferToEmailData(transaction)
        await sendTransferCreatedNotification(transferData)
      } else {
        // Pour les autres transactions, utiliser les anciennes notifications
        const emailData = convertTransactionToEmailData(transaction)
        await sendTransactionCreatedNotification(emailData)
      }
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
  
  // Envoyer des notifications email selon le statut et le type
  try {
    if (transaction.type === "transfer") {
      // Utiliser les nouvelles notifications pour les transferts
      const transferData = convertTransferToEmailData(transaction)
      
      if (status === "validated") {
        await sendTransferValidatedNotification(transferData)
      } else if (status === "completed") {
        await sendTransferCompletedNotification(transferData)
      }
    } else {
      // Pour les autres transactions, utiliser les anciennes notifications
      const emailData = convertTransactionToEmailData(transaction)
      
      if (status === "validated") {
        await sendTransactionValidatedNotification(emailData)
      } else if (status === "completed") {
        await sendTransactionCompletedNotification(emailData)
      }
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

/**
 * Calcule la commission pour une transaction de transfert
 * Commission = montant reçu par la caissière converti en XAF - montant réel renseigné par l'auditeur converti en XAF
 */
export async function calculateCommission(
  receivedAmountXAF: number,
  realAmountEUR: number,
  eurToXAFRate: number
): Promise<number> {
  const realAmountXAF = realAmountEUR * eurToXAFRate
  const commission = receivedAmountXAF - realAmountXAF
  return Math.max(0, commission) // La commission ne peut pas être négative
}

/**
 * Met à jour le montant réel et calcule automatiquement la commission pour une transaction
 */
export async function updateTransactionRealAmount(
  transactionId: string,
  realAmountEUR: number,
  validatedBy: string
): Promise<Transaction> {
  const s = await getSettings()
  const eurToXAFRate = s.eur || 650
  const commissionMinXaf = s.transfer_commission_min_xaf ?? 0

  // Récupérer la transaction
  const transactionRows = await sql`
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
      delete_validated_at,
      real_amount_eur,
      commission_amount,
      executor_id,
      executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions 
    WHERE id = ${transactionId}
  `

  if (transactionRows.length === 0) {
    throw new Error('Transaction non trouvée')
  }

  const transaction = transactionRows[0]

  // Calculer la commission
  const commissionAmount = await calculateCommission(
    transaction.amount,
    realAmountEUR,
    eurToXAFRate
  )

  // Règle de validation : commission >= seuil minimum (Taux & Plafonds)
  const hasSufficientCommission = commissionAmount >= commissionMinXaf
  const newStatus: Transaction["status"] = hasSufficientCommission ? "validated" : "rejected"

  const rejectionReason = hasSufficientCommission
    ? null
    : commissionMinXaf > 0
      ? `Commission (${commissionAmount.toLocaleString("fr-FR")} XAF) inférieure au minimum requis (${commissionMinXaf.toLocaleString("fr-FR")} XAF)`
      : "Commission nulle ou négative : montant reçu ≤ montant réel converti en XAF"
  
  // Assigner un exécuteur disponible
  let executorId: string | null = null
    const executorRows = await sql`
      SELECT id::text FROM users 
      WHERE role = 'executor' 
      ORDER BY created_at ASC 
      LIMIT 1
    `
    executorId = executorRows[0]?.id || null
  const assignedExecutorId = hasSufficientCommission ? executorId : null

  // Mettre à jour la transaction
  const updatedRows = await sql`
    UPDATE transactions 
    SET 
      real_amount_eur = ${realAmountEUR},
      commission_amount = ${commissionAmount},
      status = ${newStatus},
      executor_id = ${assignedExecutorId},
      rejection_reason = ${rejectionReason},
      updated_at = NOW()
    WHERE id = ${transactionId}
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
      delete_validated_by,
      delete_validated_at,
      real_amount_eur,
      commission_amount,
      executor_id,
      executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
  `

  const updatedTransaction = updatedRows[0]

  if (newStatus === "validated" && commissionAmount > 0) {
    try {
      await addCommissionToAccount(
        updatedTransaction.id,
        commissionAmount,
        `Commission transfert: ${updatedTransaction.description}`,
        validatedBy
      )
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la commission au compte:', error)
      // Ne pas faire échouer la validation si l'ajout de commission échoue
    }
  }

  // Envoyer une notification email selon le résultat
  try {
    if (newStatus === "validated") {
      // Utiliser les nouvelles notifications pour les transferts
      if (updatedTransaction.type === "transfer") {
        const transferData = convertTransferToEmailData(updatedTransaction)
        await sendTransferValidatedNotification(transferData)
      } else {
        await sendTransactionValidatedNotification(convertTransactionToEmailData(updatedTransaction))
      }
    } else if (newStatus === "rejected") {
      // Notification standardisée de rejet de transfert
      if (updatedTransaction.type === "transfer") {
        const { sendTransferRejectedNotification } = await import('./email-notifications')
        const transferData = convertTransferToEmailData(updatedTransaction)
        await sendTransferRejectedNotification(transferData)
      } else {
        const { sendEmail, getEmailRecipients } = await import('./email-notifications')
        const recipients = await getEmailRecipients('transaction_validated')
        await sendEmail({
          to: recipients.to.map(u => u.email).join(', '),
          cc: recipients.cc.map(u => u.email).join(', '),
          subject: `Transaction rejetée`,
          html: `
            <h2>Transaction Rejetée</h2>
            <p>La transaction <strong>${updatedTransaction.id}</strong> a été rejetée.</p>
          `
        })
      }
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification:', error)
  }

  return updatedTransaction
}

/**
 * Exécute une transaction (par un exécuteur ou un auditeur)
 */
export async function executeTransaction(
  transactionId: string,
  executorId: string,
  receiptUrl: string,
  executorComment?: string,
  isAuditor: boolean = false
): Promise<Transaction> {
  // Si c'est un auditeur, on ne vérifie pas executor_id
  const updatedRows = isAuditor
    ? await sql`
        UPDATE transactions 
        SET 
          status = 'executed',
          executed_at = NOW(),
          receipt_url = ${receiptUrl},
          executor_comment = ${executorComment || null},
          updated_at = NOW()
        WHERE id = ${transactionId} AND status = 'validated'
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
          delete_validated_by,
          delete_validated_at,
          real_amount_eur,
          commission_amount,
          executor_id,
          executed_at,
          receipt_url,
          executor_comment,
          created_at::text as created_at,
          updated_at::text as updated_at
      `
    : await sql`
    UPDATE transactions 
    SET 
      status = 'executed',
      executed_at = NOW(),
      receipt_url = ${receiptUrl},
      executor_comment = ${executorComment || null},
      updated_at = NOW()
    WHERE id = ${transactionId} AND executor_id = ${executorId}
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
      delete_validated_by,
      delete_validated_at,
      real_amount_eur,
      commission_amount,
      executor_id,
      executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
  `

  if (updatedRows.length === 0) {
    throw new Error(
      isAuditor 
        ? 'Transaction non trouvée ou non validée' 
        : 'Transaction non trouvée ou non assignée à cet exécuteur'
    )
  }

  const executedTransaction = updatedRows[0]

  // Envoyer une notification email pour l'exécution
  try {
    if (executedTransaction.type === "transfer") {
      // Utiliser les nouvelles notifications pour les transferts
      const transferData = convertTransferToEmailData(executedTransaction)
      await sendTransferExecutedNotification(transferData)
    } else {
      // Pour les autres transactions, utiliser l'ancienne logique
      const { sendEmail, getEmailRecipients } = await import('./email-notifications')
      const recipients = await getEmailRecipients('transaction_validated')
      
      await sendEmail({
      to: recipients.to.map(u => u.email).join(', '),
      cc: recipients.cc.map(u => u.email).join(', '),
      subject: `Transaction exécutée - ${executedTransaction.id}`,
      html: `
        <h2>Transaction Exécutée</h2>
        <p>La transaction <strong>${executedTransaction.id}</strong> a été exécutée avec succès.</p>
        <h3>Détails de la Transaction</h3>
        <ul>
          <li><strong>ID:</strong> ${executedTransaction.id}</li>
          <li><strong>Type:</strong> ${executedTransaction.type}</li>
          <li><strong>Description:</strong> ${executedTransaction.description}</li>
          <li><strong>Montant:</strong> ${executedTransaction.amount} ${executedTransaction.currency}</li>
          <li><strong>Commission:</strong> ${executedTransaction.commission_amount} XAF</li>
          <li><strong>Exécuté par:</strong> ${executorId}</li>
          <li><strong>Date d'exécution:</strong> ${executedTransaction.executed_at}</li>
          ${executorComment ? `<li><strong>Commentaire:</strong> ${executorComment}</li>` : ''}
        </ul>
        <p><strong>Reçu:</strong> <a href="${receiptUrl}">Télécharger le reçu</a></p>
      `
    })
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la notification d\'exécution:', error)
  }

  return executedTransaction
}

/**
 * Récupère les transactions assignées à un exécuteur
 */
export async function getTransactionsForExecutor(executorId: string): Promise<Transaction[]> {
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
      delete_validated_at,
      real_amount_eur,
      commission_amount,
      executor_id,
      executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions 
    WHERE executor_id = ${executorId}
    ORDER BY created_at DESC
  `
  return rows
}

/**
 * Récupère les transactions en attente d'exécution
 */
export async function getTransactionsPendingExecution(): Promise<Transaction[]> {
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
      delete_validated_at,
      real_amount_eur,
      commission_amount,
      executor_id,
      executed_at,
      receipt_url,
      executor_comment,
      created_at::text as created_at,
      updated_at::text as updated_at
    FROM transactions 
    WHERE status = 'validated' AND executor_id IS NOT NULL
    ORDER BY created_at ASC
  `
  return rows
}