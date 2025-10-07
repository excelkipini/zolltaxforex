import "server-only"
import { getEmailConfig, isEmailConfigured, getEmailRecipients, formatEmailAddresses, createEmailHeaders, type TransactionEmailData, type DeletionRequestEmailData, type ExpenseEmailData, type TransferEmailData } from "./email-service"
import { 
  generateTransactionCreatedEmail, 
  generateTransactionValidatedEmail, 
  generateTransactionCompletedEmail,
  generateDeletionRequestedEmail,
  generateDeletionValidatedEmail,
  generateExpenseSubmittedEmail,
  generateExpenseAccountingValidatedEmail,
  generateExpenseDirectorValidatedEmail,
  generateExpenseDirectorRejectedEmail,
  generateTransferCreatedEmail,
  generateTransferValidatedEmail,
  generateTransferRejectedEmail,
  generateTransferExecutedEmail,
  generateTransferCompletedEmail
} from "./email-templates"
import { getUserByEmail, getUserByName } from "./users-queries"

// Interface pour les options d'envoi
export interface EmailSendOptions {
  to: string[]
  cc?: string[]
  subject: string
  html: string
}

// Fonction principale pour envoyer un email
export async function sendEmail(options: EmailSendOptions): Promise<{ success: boolean; error?: string }> {
  try {
    // Vérifier si l'email est configuré
    if (!isEmailConfigured()) {
      console.warn('Email non configuré - simulation de l\'envoi')
      console.log('Email qui aurait été envoyé:', {
        to: options.to,
        cc: options.cc,
        subject: options.subject,
        html: options.html.substring(0, 200) + '...'
      })
      return { success: true }
    }

    const config = getEmailConfig()
    
    // Utiliser Nodemailer pour l'envoi réel
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.auth
    })
    
    // Vérifier la connexion
    await transporter.verify()
    
    // Envoyer l'email
    const info = await transporter.sendMail({
      from: `${config.from.name} <${config.from.email}>`,
      to: options.to,
      cc: options.cc,
      subject: options.subject,
      html: options.html
    })
    
    console.log('Email envoyé avec succès:', {
      messageId: info.messageId,
      to: options.to,
      cc: options.cc,
      subject: options.subject
    })
    
    return { success: true }
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de l\'email:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour envoyer une notification de transaction créée
export async function sendTransactionCreatedNotification(data: TransactionEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transaction_created')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    const emailTemplate = generateTransactionCreatedEmail(data)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transaction créée:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour envoyer une notification de transaction validée
export async function sendTransactionValidatedNotification(data: TransactionEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transaction_validated')
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    // Trouver l'email du caissier qui a créé la transaction (par nom)
    const { getUserByName } = await import('./users-queries')
    const cashier = await getUserByName(data.createdBy)
    if (!cashier) {
      throw new Error(`Caissier non trouvé: ${data.createdBy}`)
    }
    
    const toEmails = [`${cashier.name} <${cashier.email}>`]
    
    const emailTemplate = generateTransactionValidatedEmail(data, cashier.email)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transaction validée:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour envoyer une notification de transaction clôturée
export async function sendTransactionCompletedNotification(data: TransactionEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transaction_completed')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    const emailTemplate = generateTransactionCompletedEmail(data)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transaction clôturée:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour envoyer une notification de demande de suppression
export async function sendDeletionRequestedNotification(data: DeletionRequestEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('deletion_requested')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    const emailTemplate = generateDeletionRequestedEmail(data)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de demande de suppression:', error)
    return { success: false, error: error.message }
  }
}

// Fonction pour envoyer une notification de demande de suppression validée
export async function sendDeletionValidatedNotification(data: DeletionRequestEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('deletion_validated')
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    // Trouver l'email du caissier qui a demandé la suppression
    const cashier = await getUserByEmail(data.requestedBy)
    if (!cashier) {
      throw new Error('Caissier non trouvé')
    }
    
    const toEmails = [`${cashier.name} <${cashier.email}>`]
    
    const emailTemplate = generateDeletionValidatedEmail(data, cashier.email)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de demande de suppression validée:', error)
    return { success: false, error: error.message }
  }
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
    currency: 'XAF', // Par défaut
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
  try {
    const recipients = await getEmailRecipients('expense_submitted')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)

    const emailTemplate = generateExpenseSubmittedEmail(expenseData)

    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de dépense soumise:', error)
    return { success: false, error: error.message }
  }
}

// 2. Notification pour dépense validée par la comptabilité
export async function sendExpenseAccountingValidatedNotification(expenseData: ExpenseEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('expense_accounting_validated')
    const ccEmails = formatEmailAddresses(recipients.cc)

    // Trouver l'email du demandeur
    const requester = await getUserByName(expenseData.requestedBy)
    if (!requester) {
      throw new Error(`Demandeur non trouvé: ${expenseData.requestedBy}`)
    }

    const toEmails = [`${requester.name} <${requester.email}>`]

    const emailTemplate = generateExpenseAccountingValidatedEmail(expenseData, requester.email)

    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de dépense validée par comptabilité:', error)
    return { success: false, error: error.message }
  }
}

// 3. Notification pour dépense validée par le directeur
export async function sendExpenseDirectorValidatedNotification(expenseData: ExpenseEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('expense_director_validated')
    const ccEmails = formatEmailAddresses(recipients.cc)

    // Trouver l'email du demandeur
    const requester = await getUserByName(expenseData.requestedBy)
    if (!requester) {
      throw new Error(`Demandeur non trouvé: ${expenseData.requestedBy}`)
    }

    const toEmails = [`${requester.name} <${requester.email}>`]

    // Choisir le template selon le statut réel
    const emailTemplate = expenseData.status === 'director_rejected'
      ? generateExpenseDirectorRejectedEmail(expenseData, requester.email)
      : generateExpenseDirectorValidatedEmail(expenseData, requester.email)

    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de dépense validée par directeur:', error)
    return { success: false, error: error.message }
  }
}

// NOUVELLES FONCTIONS DE NOTIFICATION POUR LES TRANSFERTS D'ARGENT

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
  try {
    const recipients = await getEmailRecipients('transfer_created')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    const emailTemplate = generateTransferCreatedEmail(transferData)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transfert créé:', error)
    return { success: false, error: error.message }
  }
}

// 2. Notification pour transfert validé par un auditeur
export async function sendTransferValidatedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transfer_validated')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    const emailTemplate = generateTransferValidatedEmail(transferData)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transfert validé:', error)
    return { success: false, error: error.message }
  }
}

// 2bis. Notification pour transfert rejeté
export async function sendTransferRejectedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transfer_validated')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)

    const emailTemplate = generateTransferRejectedEmail(transferData)

    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transfert rejeté:', error)
    return { success: false, error: error.message }
  }
}

// 3. Notification pour transfert exécuté par un exécuteur
export async function sendTransferExecutedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transfer_executed')
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    // Trouver l'email du caissier qui a créé le transfert
    const cashier = await getUserByName(transferData.createdBy)
    if (!cashier) {
      throw new Error(`Caissier non trouvé: ${transferData.createdBy}`)
    }
    
    const toEmails = [`${cashier.name} <${cashier.email}>`]
    
    const emailTemplate = generateTransferExecutedEmail(transferData, cashier.email)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transfert exécuté:', error)
    return { success: false, error: error.message }
  }
}

// 4. Notification pour transfert clôturé par un caissier
export async function sendTransferCompletedNotification(transferData: TransferEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const recipients = await getEmailRecipients('transfer_completed')
    const toEmails = formatEmailAddresses(recipients.to)
    const ccEmails = formatEmailAddresses(recipients.cc)
    
    const emailTemplate = generateTransferCompletedEmail(transferData)
    
    return await sendEmail({
      to: toEmails,
      cc: ccEmails,
      subject: emailTemplate.subject,
      html: emailTemplate.html
    })
  } catch (error: any) {
    console.error('Erreur lors de l\'envoi de la notification de transfert clôturé:', error)
    return { success: false, error: error.message }
  }
}
