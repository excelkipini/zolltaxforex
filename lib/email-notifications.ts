import "server-only"
import { getEmailConfig, isEmailConfigured, getEmailRecipients, formatEmailAddresses, createEmailHeaders, type TransactionEmailData, type DeletionRequestEmailData } from "./email-service"
import { 
  generateTransactionCreatedEmail, 
  generateTransactionValidatedEmail, 
  generateTransactionCompletedEmail,
  generateDeletionRequestedEmail,
  generateDeletionValidatedEmail
} from "./email-templates"
import { getUserByEmail } from "./users-queries"

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
