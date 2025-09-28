import "server-only"
import { TransactionEmailData, DeletionRequestEmailData } from "./email-service"

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
        <span class="detail-label">Créé par:</span>
        <span class="detail-value">${data.createdBy}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Agence:</span>
        <span class="detail-value">${data.agency}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Statut:</span>
        <span class="detail-value">${data.status}</span>
    </div>
    <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${new Date(data.createdAt).toLocaleString('fr-FR')}</span>
    </div>
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
