import "server-only"
import { sendEmail as sendEmailService } from "./email-service"

// Types pour les données d'email
export type TransactionEmailData = any
export type DeletionRequestEmailData = any
export type ExpenseEmailData = any
export type TransferEmailData = any

// Fonction pour envoyer une notification de transaction créée
export async function sendTransactionCreatedNotification(data: TransactionEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transaction created:', data)
  return { success: true }
}

// Fonction pour envoyer une notification de transaction validée
export async function sendTransactionValidatedNotification(data: TransactionEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transaction validated:', data)
  return { success: true }
}

// Fonction pour envoyer une notification de transaction clôturée
export async function sendTransactionCompletedNotification(data: TransactionEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transaction completed:', data)
  return { success: true }
}

// Fonction pour envoyer une notification de demande de suppression
export async function sendDeletionRequestedNotification(data: DeletionRequestEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for deletion requested:', data)
  return { success: true }
}

// Fonction pour envoyer une notification de demande de suppression validée
export async function sendDeletionValidatedNotification(data: DeletionRequestEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for deletion validated:', data)
  return { success: true }
}

// Fonction utilitaire pour convertir les données de transaction en format email
export function convertTransactionToEmailData(transaction: any): TransactionEmailData {
  return {
    transactionId: transaction.id,
    transactionType: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    createdBy: transaction.created_by,
    agency: transaction.agency,
    status: transaction.status,
    createdAt: transaction.created_at
  }
}

// Fonction utilitaire pour convertir les données de demande de suppression en format email
export function convertDeletionRequestToEmailData(transaction: any, requestedBy: string, reason?: string): DeletionRequestEmailData {
  return {
    transactionId: transaction.id,
    transactionType: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    requestedBy: requestedBy,
    agency: transaction.agency,
    reason: reason,
    requestedAt: new Date().toISOString()
  }
}

// Fonction utilitaire pour convertir les données de dépense en format email
export function convertExpenseToEmailData(expense: any): ExpenseEmailData {
  return {
    expenseId: expense.id,
    description: expense.description,
    amount: expense.amount,
    currency: 'XAF',
    category: expense.category,
    requestedBy: expense.requested_by,
    agency: expense.agency,
    status: expense.status,
    createdAt: expense.created_at || expense.date,
    validatedBy: expense.accounting_validated_by || expense.director_validated_by,
    validatedAt: expense.accounting_validated_at || expense.director_validated_at,
    rejectionReason: expense.rejection_reason
  }
}

// Fonctions de notification pour les dépenses

// 1. Notification pour dépense soumise
export async function sendExpenseSubmittedNotification(expenseData: ExpenseEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for expense submitted:', expenseData)
  return { success: true }
}

// 2. Notification pour dépense validée par la comptabilité
export async function sendExpenseAccountingValidatedNotification(expenseData: ExpenseEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for expense accounting validated:', expenseData)
  return { success: true }
}

// 3. Notification pour dépense validée par le directeur
export async function sendExpenseDirectorValidatedNotification(expenseData: ExpenseEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for expense director validated:', expenseData)
  return { success: true }
}

// Fonction utilitaire pour convertir les données de transfert en format email
export function convertTransferToEmailData(transaction: any): TransferEmailData {
  return {
    transactionId: transaction.id,
    transactionType: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    createdBy: transaction.created_by,
    agency: transaction.agency,
    status: transaction.status,
    createdAt: transaction.created_at,
    realAmountEUR: transaction.real_amount_eur,
    commissionAmount: transaction.commission_amount,
    executorId: transaction.executor_id,
    executedAt: transaction.executed_at,
    receiptUrl: transaction.receipt_url,
    executorComment: transaction.executor_comment,
    beneficiaryName: transaction.details?.beneficiary_name,
    destinationCountry: transaction.details?.destination_country,
    transferMethod: transaction.details?.transfer_method,
    withdrawalMode: transaction.details?.withdrawal_mode
  }
}

// 1. Notification pour transfert créé par un caissier
export async function sendTransferCreatedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transfer created:', transferData)
  return { success: true }
}

// 2. Notification pour transfert validé par un auditeur
export async function sendTransferValidatedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transfer validated:', transferData)
  return { success: true }
}

// 2bis. Notification pour transfert rejeté
export async function sendTransferRejectedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transfer rejected:', transferData)
  return { success: true }
}

// 3. Notification pour transfert exécuté par un exécuteur
export async function sendTransferExecutedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transfer executed:', transferData)
  return { success: true }
}

// 4. Notification pour transfert clôturé par un caissier
export async function sendTransferCompletedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  console.log('Email notification would be sent for transfer completed:', transferData)
  return { success: true }
}
