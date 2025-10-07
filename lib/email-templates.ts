import "server-only"
import { TransactionEmailData, DeletionRequestEmailData, ExpenseEmailData, TransferEmailData } from "./email-service"

// Fonctions de traduction
const translateTransactionType = (type: string): string => {
  const translations: Record<string, string> = {
    'transfer': 'Transfert d\'argent',
    'exchange': 'Bureau de change',
    'card': 'Gestion de carte',
    'receipt': 'Reçu',
    'reception': 'Réception'
  }
  return translations[type] || type
}

const translateTransactionStatus = (status: string): string => {
  const translations: Record<string, string> = {
    'pending': 'En attente',
    'validated': 'Validée',
    'rejected': 'Rejetée',
    'completed': 'Terminée',
    'executed': 'Exécutée',
    'pending_delete': 'En attente de suppression'
  }
  return translations[status] || status
}

const translateExpenseStatus = (status: string): string => {
  const translations: Record<string, string> = {
    'pending': 'En attente',
    'accounting_approved': 'Approuvée par la comptabilité',
    'accounting_rejected': 'Rejetée par la comptabilité',
    'director_approved': 'Approuvée par le directeur',
    'director_rejected': 'Rejetée par le directeur'
  }
  return translations[status] || status
}

// Template de base pour tous les emails
const BASE_TEMPLATE = (content: string, title: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background-color: #1e40af;
            color: white;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .content {
            background-color: #f8fafc;
            padding: 30px;
            border-radius: 0 0 8px 8px;
        }
        .transaction-details {
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #1e40af;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-label {
            font-weight: bold;
            color: #374151;
        }
        .detail-value {
            color: #6b7280;
        }
        .amount {
            font-size: 1.2em;
            font-weight: bold;
            color: #059669;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 0.9em;
            color: #6b7280;
            text-align: center;
        }
        .alert {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .success {
            background-color: #d1fae5;
            border: 1px solid #10b981;
            color: #065f46;
        }
        .warning {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            color: #92400e;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>ZOLL TAX FOREX</h1>
        <p>Système de Gestion Financière</p>
    </div>
    <div class="content">
        ${content}
        <div class="footer">
            <p>Cet email a été généré automatiquement par le système ZOLL TAX FOREX.</p>
            <p>© 2025 ZOLL TAX FOREX - Tous droits réservés</p>
        </div>
    </div>
</body>
</html>
`

// Template pour les détails de transaction
const TRANSACTION_DETAILS_TEMPLATE = (data: TransactionEmailData) => `
<div class="transaction-details">
    <h3>Détails de la Transaction</h3>
    <div class="detail-row">
        <span class="detail-label">ID Transaction:</span>
        <span class="detail-value">${data.transactionId}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Type:</span>
        <span class="detail-value">${translateTransactionType(data.transactionType)}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Montant:</span>
        <span class="detail-value amount">${data.amount.toLocaleString()} ${data.currency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">${data.description}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Créé par:</span>
        <span class="detail-value">${data.createdBy}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Agence:</span>
        <span class="detail-value">${data.agency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Statut:</span>
        <span class="detail-value">${translateTransactionStatus(data.status)}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${new Date(data.createdAt).toLocaleString('fr-FR')}</span>
    </div>
</div>
`

// Template pour les détails de transfert d'argent
const TRANSFER_DETAILS_TEMPLATE = (data: TransferEmailData) => `
<div class="transaction-details">
    <h3>Détails du Transfert d'Argent</h3>
    <div class="detail-row">
        <span class="detail-label">ID Transaction:</span>
        <span class="detail-value">${data.transactionId}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Type:</span>
        <span class="detail-value">${translateTransactionType(data.transactionType)}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Montant:</span>
        <span class="detail-value amount">${data.amount.toLocaleString()} ${data.currency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">${data.description}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Créé par:</span>
        <span class="detail-value">${data.createdBy}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Agence:</span>
        <span class="detail-value">${data.agency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Statut:</span>
        <span class="detail-value">${translateTransactionStatus(data.status)}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${new Date(data.createdAt).toLocaleString('fr-FR')}</span>
    </div>
    ${data.beneficiaryName ? `
    <div class="detail-row">
        <span class="detail-label">Bénéficiaire:</span>
        <span class="detail-value">${data.beneficiaryName}</span>
    </div>
    ` : ''}
    ${data.destinationCountry ? `
    <div class="detail-row">
        <span class="detail-label">Destination:</span>
        <span class="detail-value">${data.destinationCountry}</span>
    </div>
    ` : ''}
    ${data.transferMethod ? `
    <div class="detail-row">
        <span class="detail-label">Moyen de transfert:</span>
        <span class="detail-value">${data.transferMethod}</span>
    </div>
    ` : ''}
    ${data.withdrawalMode ? `
    <div class="detail-row">
        <span class="detail-label">Mode de retrait:</span>
        <span class="detail-value">${data.withdrawalMode === 'cash' ? 'Espèces' : 'Virement bancaire'}</span>
    </div>
    ` : ''}
    ${data.realAmountEUR ? `
    <div class="detail-row">
        <span class="detail-label">Montant réel envoyé:</span>
        <span class="detail-value amount">${data.realAmountEUR.toLocaleString()} EUR</span>
    </div>
    ` : ''}
    ${data.commissionAmount ? `
    <div class="detail-row">
        <span class="detail-label">Commission:</span>
        <span class="detail-value amount">${data.commissionAmount.toLocaleString()} XAF</span>
    </div>
    ` : ''}
    ${data.executedAt ? `
    <div class="detail-row">
        <span class="detail-label">Exécuté le:</span>
        <span class="detail-value">${new Date(data.executedAt).toLocaleString('fr-FR')}</span>
    </div>
    ` : ''}
    ${data.executorComment ? `
    <div class="detail-row">
        <span class="detail-label">Commentaire exécuteur:</span>
        <span class="detail-value">${data.executorComment}</span>
    </div>
    ` : ''}
</div>
`

// Template pour les détails de demande de suppression
const DELETION_DETAILS_TEMPLATE = (data: DeletionRequestEmailData) => `
<div class="transaction-details">
    <h3>Détails de la Demande de Suppression</h3>
    <div class="detail-row">
        <span class="detail-label">ID Transaction:</span>
        <span class="detail-value">${data.transactionId}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Type:</span>
        <span class="detail-value">${data.transactionType}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Montant:</span>
        <span class="detail-value amount">${data.amount.toLocaleString()} ${data.currency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">${data.description}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Demandé par:</span>
        <span class="detail-value">${data.requestedBy}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Agence:</span>
        <span class="detail-value">${data.agency}</span>
    </div>
    ${data.reason ? `
    <div class="detail-row">
        <span class="detail-label">Raison:</span>
        <span class="detail-value">${data.reason}</span>
    </div>
    ` : ''}
    <div class="detail-row">
        <span class="detail-label">Date de demande:</span>
        <span class="detail-value">${new Date(data.requestedAt).toLocaleString('fr-FR')}</span>
    </div>
</div>
`

// 1. Template pour transaction créée par un caissier
export function generateTransactionCreatedEmail(data: TransactionEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Nouvelle transaction créée - ${data.transactionId}`
  
  const content = `
    <h2>🔔 Nouvelle Transaction Créée</h2>
    <p>Une nouvelle transaction a été créée par un caissier et nécessite votre validation.</p>
    
    <div class="alert warning">
        <strong>Action requise:</strong> Cette transaction est en attente de validation par un auditeur.
    </div>
    
    ${TRANSACTION_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Opérations"</li>
        <li>Validez ou rejetez cette transaction</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Nouvelle Transaction Créée")
  }
}

// 2. Template pour transaction validée par un auditeur
export function generateTransactionValidatedEmail(data: TransactionEmailData, cashierEmail: string): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Transaction validée - ${data.transactionId}`
  
  const content = `
    <h2>✅ Transaction Validée</h2>
    <p>La transaction que vous avez créée a été validée par un auditeur.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Transaction validée et prête pour clôture.
    </div>
    
    ${TRANSACTION_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Opérations"</li>
        <li>Clôturez cette transaction</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Transaction Validée")
  }
}

// 3. Template pour transaction clôturée par un caissier
export function generateTransactionCompletedEmail(data: TransactionEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Transaction clôturée - ${data.transactionId}`
  
  const content = `
    <h2>🏁 Transaction Clôturée</h2>
    <p>Une transaction a été clôturée par un caissier.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Transaction terminée avec succès.
    </div>
    
    ${TRANSACTION_DETAILS_TEMPLATE(data)}
    
    <p><strong>Information:</strong> Cette transaction est maintenant terminée et archivée dans le système.</p>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Transaction Clôturée")
  }
}

// 4. Template pour demande de suppression de reçu
export function generateDeletionRequestedEmail(data: DeletionRequestEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Demande de suppression de reçu - ${data.transactionId}`
  
  const content = `
    <h2>🗑️ Demande de Suppression de Reçu</h2>
    <p>Une demande de suppression de reçu a été soumise par un caissier.</p>
    
    <div class="alert warning">
        <strong>Action requise:</strong> Cette demande nécessite votre validation en tant que comptable.
    </div>
    
    ${DELETION_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Dépenses" ou "Opérations"</li>
        <li>Validez ou rejetez cette demande de suppression</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Demande de Suppression de Reçu")
  }
}

// Template pour les détails de dépense
const EXPENSE_DETAILS_TEMPLATE = (data: ExpenseEmailData) => `
<div class="transaction-details">
    <h3>Détails de la Dépense</h3>
    <div class="detail-row">
        <span class="detail-label">ID Dépense:</span>
        <span class="detail-value">${data.expenseId}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">${data.description}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Montant:</span>
        <span class="detail-value amount">${data.amount.toLocaleString()} ${data.currency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Catégorie:</span>
        <span class="detail-value">${data.category}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Demandé par:</span>
        <span class="detail-value">${data.requestedBy}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Agence:</span>
        <span class="detail-value">${data.agency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Statut:</span>
        <span class="detail-value">${translateExpenseStatus(data.status)}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${new Date(data.createdAt).toLocaleString('fr-FR')}</span>
    </div>
    ${data.validatedBy ? `
    <div class="detail-row">
        <span class="detail-label">Validé par:</span>
        <span class="detail-value">${data.validatedBy}</span>
    </div>
    ` : ''}
    ${data.validatedAt ? `
    <div class="detail-row">
        <span class="detail-label">Date de validation:</span>
        <span class="detail-value">${new Date(data.validatedAt).toLocaleString('fr-FR')}</span>
    </div>
    ` : ''}
    ${data.rejectionReason ? `
    <div class="detail-row">
        <span class="detail-label">Motif de rejet:</span>
        <span class="detail-value">${data.rejectionReason}</span>
    </div>
    ` : ''}
</div>
`

// 6. Template pour dépense soumise
export function generateExpenseSubmittedEmail(data: ExpenseEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Nouvelle dépense soumise - ${data.expenseId}`
  
  const content = `
    <h2>💰 Nouvelle Dépense Soumise</h2>
    <p>Une nouvelle dépense a été soumise et nécessite votre validation.</p>
    
    <div class="alert warning">
        <strong>Action requise:</strong> Cette dépense est en attente de validation par la comptabilité.
    </div>
    
    ${EXPENSE_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Dépenses"</li>
        <li>Validez ou rejetez cette dépense</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Nouvelle Dépense Soumise")
  }
}

// 7. Template pour dépense validée par la comptabilité
export function generateExpenseAccountingValidatedEmail(data: ExpenseEmailData, requesterEmail: string): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Dépense validée par la comptabilité - ${data.expenseId}`
  
  const content = `
    <h2>✅ Dépense Validée par la Comptabilité</h2>
    <p>Votre demande de dépense a été validée par la comptabilité.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Dépense approuvée par la comptabilité, en attente de validation du directeur.
    </div>
    
    ${EXPENSE_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>La dépense sera transmise au directeur pour validation finale</li>
        <li>Vous recevrez une notification une fois la validation finale effectuée</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Dépense Validée par la Comptabilité")
  }
}

// 8. Template pour dépense validée par le directeur
export function generateExpenseDirectorValidatedEmail(data: ExpenseEmailData, requesterEmail: string): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Dépense validée par le directeur - ${data.expenseId}`
  
  const content = `
    <h2>🎉 Dépense Validée par le Directeur</h2>
    <p>Votre demande de dépense a été validée par le directeur.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Dépense approuvée et autorisée.
    </div>
    
    ${EXPENSE_DETAILS_TEMPLATE(data)}
    
    <p><strong>Information:</strong> Votre dépense est maintenant autorisée et peut être traitée.</p>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Dépense Validée par le Directeur")
  }
}

// 8bis. Template pour dépense rejetée par le directeur
export function generateExpenseDirectorRejectedEmail(data: ExpenseEmailData, requesterEmail: string): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Dépense rejetée par le directeur - ${data.expenseId}`

  const content = `
    <h2>❌ Dépense Rejetée par le Directeur</h2>
    <p>Votre demande de dépense a été rejetée par le directeur.</p>
    
    <div class="alert error">
        <strong>Statut:</strong> Dépense rejetée par le directeur.
    </div>
    
    ${EXPENSE_DETAILS_TEMPLATE(data)}
    
    ${data.rejectionReason ? `
    <div class="detail-row">
        <span class="detail-label">Motif de rejet:</span>
        <span class="detail-value">${data.rejectionReason}</span>
    </div>
    ` : ''}
  `

  return {
    subject,
    html: BASE_TEMPLATE(content, "Dépense Rejetée par le Directeur")
  }
}

// 5. Template pour demande de suppression validée
export function generateDeletionValidatedEmail(data: DeletionRequestEmailData, cashierEmail: string): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Demande de suppression validée - ${data.transactionId}`
  
  const content = `
    <h2>✅ Demande de Suppression Validée</h2>
    <p>Votre demande de suppression de reçu a été validée par un comptable.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Demande de suppression approuvée.
    </div>
    
    ${DELETION_DETAILS_TEMPLATE(data)}
    
    <p><strong>Information:</strong> Le reçu a été supprimé du système conformément à votre demande.</p>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Demande de Suppression Validée")
  }
}

// NOUVEAUX TEMPLATES POUR LES TRANSFERTS D'ARGENT

// 1. Template pour transfert créé par un caissier
export function generateTransferCreatedEmail(data: TransferEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Nouveau transfert d'argent créé - ${data.transactionId}`
  
  const content = `
    <h2>💸 Nouveau Transfert d'Argent Créé</h2>
    <p>Un nouveau transfert d'argent a été créé par un caissier et nécessite votre validation.</p>
    
    <div class="alert warning">
        <strong>Action requise:</strong> Ce transfert est en attente de validation par un auditeur.
    </div>
    
    ${TRANSFER_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Opérations"</li>
        <li>Saisissez le montant réel envoyé en EUR</li>
        <li>Le système calculera automatiquement la commission</li>
        <li>Validez ou rejetez selon le seuil de 5000 XAF</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Nouveau Transfert d'Argent Créé")
  }
}

// 2. Template pour transfert validé par un auditeur
export function generateTransferValidatedEmail(data: TransferEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Transfert validé - ${data.transactionId}`
  
  const content = `
    <h2>✅ Transfert Validé par l'Auditeur</h2>
    <p>Un transfert d'argent a été validé par un auditeur et est prêt pour exécution.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Transfert validé et prêt pour exécution.
    </div>
    
    ${TRANSFER_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Opérations" ou votre tableau de bord</li>
        <li>Exécutez ce transfert en uploadant le reçu</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Transfert Validé par l'Auditeur")
  }
}

// 2bis. Template pour transfert rejeté (commission insuffisante ou autre raison)
export function generateTransferRejectedEmail(data: TransferEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Transfert rejeté - ${data.transactionId}`

  const content = `
    <h2>❌ Transfert Rejeté</h2>
    <p>Un transfert d'argent a été rejeté.</p>
    
    <div class="alert error">
        <strong>Statut:</strong> Transfert rejeté.
    </div>
    
    ${TRANSFER_DETAILS_TEMPLATE(data)}
    
    <p><strong>Information:</strong> Ce rejet peut provenir d'une commission insuffisante ou d'une validation négative.</p>
  `

  return {
    subject,
    html: BASE_TEMPLATE(content, "Transfert Rejeté")
  }
}

// 3. Template pour transfert exécuté par un exécuteur
export function generateTransferExecutedEmail(data: TransferEmailData, cashierEmail: string): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Transfert exécuté - ${data.transactionId}`
  
  const content = `
    <h2>🚀 Transfert Exécuté</h2>
    <p>Le transfert d'argent que vous avez créé a été exécuté par un exécuteur.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Transfert exécuté et prêt pour clôture.
    </div>
    
    ${TRANSFER_DETAILS_TEMPLATE(data)}
    
    <p><strong>Prochaines étapes:</strong></p>
    <ul>
        <li>Connectez-vous au système ZOLL TAX FOREX</li>
        <li>Accédez à la section "Opérations"</li>
        <li>Clôturez ce transfert</li>
    </ul>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Transfert Exécuté")
  }
}

// 4. Template pour transfert clôturé par un caissier
export function generateTransferCompletedEmail(data: TransferEmailData): { subject: string; html: string } {
  const subject = `[ZOLL TAX FOREX] Transfert clôturé - ${data.transactionId}`
  
  const content = `
    <h2>🏁 Transfert Clôturé</h2>
    <p>Un transfert d'argent a été clôturé par un caissier.</p>
    
    <div class="alert success">
        <strong>Statut:</strong> Transfert terminé avec succès.
    </div>
    
    ${TRANSFER_DETAILS_TEMPLATE(data)}
    
    <p><strong>Information:</strong> Ce transfert est maintenant terminé et archivé dans le système.</p>
  `
  
  return {
    subject,
    html: BASE_TEMPLATE(content, "Transfert Clôturé")
  }
}
