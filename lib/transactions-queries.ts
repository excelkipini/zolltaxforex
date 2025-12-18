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
  // Récupérer le taux de change EUR vers XAF
  const settings = await sql`
    SELECT eur FROM settings ORDER BY updated_at DESC LIMIT 1
  `
  const eurToXAFRate = settings[0]?.eur || 650 // Taux par défaut si non trouvé

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

  // Règle de validation :
  // - Si la commission est strictement > 0 XAF → transaction VALIDÉE
  // - Sinon (commission ≤ 0 XAF) → transaction REJETÉE automatiquement
  const hasPositiveCommission = commissionAmount > 0
  const newStatus: Transaction["status"] = hasPositiveCommission ? "validated" : "rejected"

  // Motif standardisé en cas de rejet automatique
  const rejectionReason = hasPositiveCommission
    ? null
    : 'Commission nulle ou négative : montant reçu ≤ montant réel converti en XAF'
  
  // Assigner un exécuteur disponible
  let executorId: string | null = null
  const executorRows = await sql`
    SELECT id::text FROM users 
    WHERE role = 'executor' 
    ORDER BY created_at ASC 
    LIMIT 1
  `
  executorId = executorRows[0]?.id || null
  const assignedExecutorId = hasPositiveCommission ? executorId : null

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

  // Ajouter la commission au compte commissions si la transaction est validée
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