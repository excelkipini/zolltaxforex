import "server-only"
import { getUsersByRole, getUsersByRoles, type User } from "./users-queries"

// Configuration email
export interface EmailConfig {
  smtp: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
  from: {
    name: string
    email: string
  }
}

// Types pour les notifications email des transferts d'argent
export interface TransferEmailData {
  transactionId: string
  transactionType: string
  amount: number
  currency: string
  description: string
  createdBy: string
  agency: string
  status: string
  createdAt: string
  realAmountEUR?: number
  commissionAmount?: number
  executorId?: string
  executedAt?: string
  receiptUrl?: string
  executorComment?: string
  beneficiaryName?: string
  destinationCountry?: string
  transferMethod?: string
  withdrawalMode?: string
}

// Types pour les notifications email des dépenses
export interface ExpenseEmailData {
  expenseId: string
  description: string
  amount: number
  currency: string
  category: string
  requestedBy: string
  agency: string
  status: string
  createdAt: string
  validatedBy?: string
  validatedAt?: string
  rejectionReason?: string
}

// Types pour les notifications email
export interface TransactionEmailData {
  transactionId: string
  transactionType: string
  amount: number
  currency: string
  description: string
  createdBy: string
  agency: string
  status: string
  createdAt: string
}

export interface DeletionRequestEmailData {
  transactionId: string
  transactionType: string
  amount: number
  currency: string
  description: string
  requestedBy: string
  agency: string
  reason?: string
  requestedAt: string
}

// Configuration par défaut (à adapter selon votre environnement)
export const DEFAULT_EMAIL_CONFIG: EmailConfig = {
  smtp: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "",
      pass: "",
    },
  },
  from: {
    name: "ZOLL TAX FOREX",
    email: "noreply@zolltaxforex.com",
  },
}

// Fonction pour récupérer la configuration email
export function getEmailConfig(): EmailConfig {
  return {
    smtp: {
      host: process.env.SMTP_HOST || DEFAULT_EMAIL_CONFIG.smtp.host,
      port: parseInt(process.env.SMTP_PORT || DEFAULT_EMAIL_CONFIG.smtp.port.toString()),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER || DEFAULT_EMAIL_CONFIG.smtp.auth.user,
        pass: process.env.SMTP_PASS || DEFAULT_EMAIL_CONFIG.smtp.auth.pass,
      },
    },
    from: {
      name: process.env.FROM_NAME || DEFAULT_EMAIL_CONFIG.from.name,
      email: process.env.FROM_EMAIL || DEFAULT_EMAIL_CONFIG.from.email,
    },
  }
}

// Fonction pour vérifier si l'email est configuré
export function isEmailConfigured(): boolean {
  const config = getEmailConfig()
  return !!(config.smtp.auth.user && config.smtp.auth.pass && config.from.email)
}

// Fonction pour récupérer les destinataires selon le type de notification
export async function getEmailRecipients(type: 'transaction_created' | 'transaction_validated' | 'transaction_completed' | 'deletion_requested' | 'deletion_validated' | 'expense_submitted' | 'expense_accounting_validated' | 'expense_director_validated' | 'transfer_created' | 'transfer_validated' | 'transfer_executed' | 'transfer_completed' | 'transfer_rejected'): Promise<{
  to: User[]
  cc: User[]
}> {
  switch (type) {
    case 'transaction_created':
      // Transaction émise par un caissier : auditeurs en TO, directeur et comptables en CC
      return {
        to: await getUsersByRole('auditor'),
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'transaction_validated':
      // Transaction validée par un auditeur : caissier en TO, directeur et comptables en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'transaction_completed':
      // Transaction clôturée par un caissier : auditeurs en TO, directeur et comptables en CC
      return {
        to: await getUsersByRole('auditor'),
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'deletion_requested':
      // Demande de suppression : comptables en TO, directeur en CC
      return {
        to: await getUsersByRole('accounting'),
        cc: await getUsersByRole('director'),
      }
    
    case 'deletion_validated':
      // Demande de suppression validée : caissier en TO, directeur en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRole('director'),
      }
    
    case 'expense_submitted':
      // Dépense soumise : comptables en TO, directeur en CC
      return {
        to: await getUsersByRole('accounting'),
        cc: await getUsersByRole('director'),
      }
    
    case 'expense_accounting_validated':
      // Dépense validée par comptable : demandeur en TO, directeur en CC
      return {
        to: [], // Le demandeur sera ajouté dynamiquement
        cc: await getUsersByRole('director'),
      }
    
    case 'expense_director_validated':
      // Dépense validée par directeur : demandeur et comptables en TO
      return {
        to: [], // Le demandeur sera ajouté dynamiquement
        cc: await getUsersByRole('accounting'),
      }
    
    case 'transfer_created':
      // Transfert créé par un caissier : auditeurs en TO, directeur et comptables en CC
      return {
        to: await getUsersByRole('auditor'),
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'transfer_validated':
      // Transfert validé par un auditeur : exécuteurs en TO, caissier et directeur en CC
      return {
        to: await getUsersByRole('executor'),
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'transfer_executed':
      // Transfert exécuté par un exécuteur : caissier en TO, directeur et comptables en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'transfer_completed':
      // Transfert clôturé par un caissier : auditeurs et exécuteurs en TO, directeur et comptables en CC
      return {
        to: await getUsersByRoles(['auditor', 'executor']),
        cc: await getUsersByRoles(['director', 'accounting']),
      }
    
    case 'transfer_rejected':
      // Transfert rejeté (commission insuffisante ou décision): caissier en TO, directeur et comptables en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRoles(['director', 'accounting']),
      }

    default:
      return { to: [], cc: [] }
  }
}

// Fonction pour formater les adresses email
export function formatEmailAddresses(users: User[]): string[] {
  return users.map(user => `${user.name} <${user.email}>`)
}

// Fonction pour créer les en-têtes email
export function createEmailHeaders(config: EmailConfig, to: string[], cc: string[] = []): Record<string, string> {
  const headers: Record<string, string> = {
    'From': `${config.from.name} <${config.from.email}>`,
    'To': to.join(', '),
    'Content-Type': 'text/html; charset=utf-8',
  }
  
  if (cc.length > 0) {
    headers['Cc'] = cc.join(', ')
  }
  
  return headers
}

// Fonctions pour les arrêtés de caisse

// Fonction pour obtenir les destinataires des emails d'arrêtés de caisse
export async function getSettlementEmailRecipients(type: 'settlement_rejected' | 'settlement_exception' | 'settlement_validated'): Promise<{ to: User[]; cc: User[] }> {
  switch (type) {
    case 'settlement_rejected':
      // Arrêté rejeté : caissier en TO, directeur, comptables et auditeurs en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRoles(['director', 'accounting', 'auditor']),
      }
    
    case 'settlement_exception':
      // Arrêté avec exception : caissier en TO, directeur, comptables et auditeurs en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRoles(['director', 'accounting', 'auditor']),
      }
    
    case 'settlement_validated':
      // Arrêté validé : caissier en TO, directeur et comptables en CC
      return {
        to: [], // Le caissier sera ajouté dynamiquement
        cc: await getUsersByRoles(['director', 'accounting']),
      }

    default:
      return { to: [], cc: [] }
  }
}

// Fonction pour envoyer un email d'arrêté de caisse
export async function sendSettlementEmail(
  type: 'settlement_rejected' | 'settlement_exception' | 'settlement_validated',
  data: CashSettlementEmailData,
  cashierEmail?: string
): Promise<void> {
  try {
    const config = getEmailConfig()
    const recipients = await getSettlementEmailRecipients(type)
    
    // Ajouter le caissier aux destinataires si son email est fourni
    const to = [...recipients.to]
    if (cashierEmail) {
      to.push({ email: cashierEmail, name: data.cashierName } as User)
    }
    
    const toAddresses = formatEmailAddresses(to)
    const ccAddresses = formatEmailAddresses(recipients.cc)
    
    const headers = createEmailHeaders(config, toAddresses, ccAddresses)
    
    // Générer le contenu email selon le type
    let emailContent: { subject: string; html: string }
    
    switch (type) {
      case 'settlement_rejected':
        emailContent = generateSettlementRejectedEmail(data)
        break
      case 'settlement_exception':
        emailContent = generateSettlementExceptionEmail(data)
        break
      case 'settlement_validated':
        emailContent = generateSettlementValidatedEmail(data)
        break
      default:
        throw new Error(`Type d'email d'arrêté non supporté: ${type}`)
    }
    
    // Ici, vous intégreriez votre service d'envoi d'email (SendGrid, Nodemailer, etc.)
    console.log('📧 Email d\'arrêté de caisse à envoyer:', {
      type,
      to: toAddresses,
      cc: ccAddresses,
      subject: emailContent.subject,
      settlementNumber: data.settlementNumber
    })
    
    // Pour l'instant, on log juste l'email
    // Dans un environnement de production, vous remplaceriez ceci par l'envoi réel
    
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email d\'arrêté:', error)
    throw error
  }
}
