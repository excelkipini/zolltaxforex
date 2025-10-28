import "server-only"
import nodemailer from "nodemailer"

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // true pour 465, false pour les autres ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
  },
})

export type EmailOptions = {
  to: string
  subject: string
  html: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: string | Buffer
    contentType?: string
  }>
}

/**
 * Envoyer un email
 */
export async function sendEmail(options: EmailOptions) {
  try {
    // Vérifier si la configuration SMTP est complète
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || (!process.env.SMTP_PASS && !process.env.SMTP_PASSWORD)) {
      console.warn("⚠️ Configuration SMTP incomplète. Les emails ne seront pas envoyés.")
      console.warn("Variables requises: SMTP_HOST, SMTP_USER, SMTP_PASS")
      return { success: false, error: "Configuration SMTP manquante" }
    }

    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@zolltaxforex.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    })

    console.log("✅ Email envoyé avec succès:", info.messageId)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email:", error)
    return { success: false, error }
  }
}

/**
 * Envoyer une notification pour un nouvel arrêté de caisse soumis
 */
export async function sendCashDeclarationSubmittedEmail(
  cashManagerEmail: string,
  caissierName: string,
  declaration: {
    guichetier: string
    declaration_date: string
    montant_brut: number
    total_delestage: number
    delestage_comment?: string
  }
) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #F9FAFB; padding: 30px; border-radius: 0 0 8px 8px; }
        .info-box { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
        .amount-box { background: #10B981; color: white; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🪙 Nouvel Arrêté de Caisse Soumis</h1>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          <p>Un nouvel arrêté de caisse a été soumis par <strong>${caissierName}</strong> et nécessite votre validation.</p>
          
          <div class="info-box">
            <h3>📋 Détails de l'arrêté</h3>
            <ul>
              <li><strong>Guichetier:</strong> ${declaration.guichetier}</li>
              <li><strong>Date:</strong> ${new Date(declaration.declaration_date).toLocaleDateString('fr-FR')}</li>
              <li><strong>Montant brut:</strong> ${formatAmount(declaration.montant_brut)}</li>
              <li><strong>Délestage:</strong> ${formatAmount(declaration.total_delestage)}</li>
            </ul>
          </div>

          ${declaration.delestage_comment ? `
          <div class="info-box">
            <h4>💬 Commentaire sur le délestage:</h4>
            <p>${declaration.delestage_comment}</p>
          </div>
          ` : ''}

          <div class="amount-box">
            <h3>Montant à verser</h3>
            <h2>${formatAmount(declaration.montant_brut - declaration.total_delestage)}</h2>
          </div>

          <p>Veuillez connecter à votre espace pour valider ou rejeter cet arrêté.</p>
          
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/ria?tab=cash-closure" class="button">Voir l'arrêté</a>
          </div>

          <div class="footer">
            <p>Cet email a été envoyé automatiquement par le système de gestion RIA.</p>
            <p>Merci de ne pas répondre à cet email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail({
    to: cashManagerEmail,
    subject: `Nouvel arrêté de caisse soumis - ${declaration.guichetier}`,
    html,
  })
}

/**
 * Envoyer une notification pour un arrêté validé
 */
export async function sendCashDeclarationValidatedEmail(
  caissierEmail: string,
  cashManagerName: string,
  declaration: {
    guichetier: string
    declaration_date: string
    montant_brut: number
    total_delestage: number
    validation_comment?: string
  }
) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #F9FAFB; padding: 30px; border-radius: 0 0 8px 8px; }
        .success-box { background: #D1FAE5; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #10B981; text-align: center; }
        .amount-box { background: #10B981; color: white; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Arrêté de Caisse Validé</h1>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          <div class="success-box">
            <h2>✅ Votre arrêté de caisse a été validé</h2>
            <p>Par ${cashManagerName}</p>
          </div>

          <p><strong>Détails de l'arrêté:</strong></p>
          <ul>
            <li><strong>Guichetier:</strong> ${declaration.guichetier}</li>
            <li><strong>Date:</strong> ${new Date(declaration.declaration_date).toLocaleDateString('fr-FR')}</li>
            <li><strong>Montant brut:</strong> ${formatAmount(declaration.montant_brut)}</li>
            <li><strong>Délestage:</strong> ${formatAmount(declaration.total_delestage)}</li>
          </ul>

          <div class="amount-box">
            <h3>Montant versé</h3>
            <h2>${formatAmount(declaration.montant_brut - declaration.total_delestage)}</h2>
          </div>

          ${declaration.validation_comment ? `
          <p><strong>Commentaire du responsable:</strong></p>
          <p style="background: white; padding: 15px; border-radius: 5px;">${declaration.validation_comment}</p>
          ` : ''}

          <div class="footer">
            <p>Cet email a été envoyé automatiquement par le système de gestion RIA.</p>
            <p>Merci de ne pas répondre à cet email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail({
    to: caissierEmail,
    subject: `Arrêté de caisse validé - ${declaration.guichetier}`,
    html,
  })
}

/**
 * Envoyer une notification pour un arrêté rejeté ou demandant correction
 */
export async function sendCashDeclarationActionEmail(
  caissierEmail: string,
  cashManagerName: string,
  action: 'rejected' | 'correction',
  declaration: {
    guichetier: string
    declaration_date: string
    montant_brut: number
    total_delestage: number
    comment: string
  }
) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
  }

  const isRejected = action === 'rejected'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${isRejected ? '#EF4444' : '#F59E0B'}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #F9FAFB; padding: 30px; border-radius: 0 0 8px 8px; }
        .alert-box { background: ${isRejected ? '#FEE2E2' : '#FEF3C7'}; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid ${isRejected ? '#EF4444' : '#F59E0B'}; }
        .comment-box { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; border: 1px solid #E5E7EB; }
        .footer { text-align: center; margin-top: 30px; color: #6B7280; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background: ${isRejected ? '#EF4444' : '#F59E0B'}; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${isRejected ? '❌ Arrêté de Caisse Rejeté' : '⚠️ Correction Demandée'}</h1>
        </div>
        <div class="content">
          <p>Bonjour,</p>
          <div class="alert-box">
            <h2>${isRejected ? '❌ Votre arrêté de caisse a été rejeté' : '⚠️ Des corrections sont nécessaires pour votre arrêté de caisse'}</h2>
            <p>Par ${cashManagerName}</p>
          </div>

          <p><strong>Détails de l'arrêté:</strong></p>
          <ul>
            <li><strong>Guichetier:</strong> ${declaration.guichetier}</li>
            <li><strong>Date:</strong> ${new Date(declaration.declaration_date).toLocaleDateString('fr-FR')}</li>
            <li><strong>Montant brut:</strong> ${formatAmount(declaration.montant_brut)}</li>
            <li><strong>Délestage:</strong> ${formatAmount(declaration.total_delestage)}</li>
          </ul>

          <div class="comment-box">
            <h4>${isRejected ? 'Raison du rejet' : 'Commentaires sur les corrections'}:</h4>
            <p>${declaration.comment}</p>
          </div>

          ${!isRejected ? `
          <p>Veuillez corriger votre arrêté selon les commentaires ci-dessus.</p>
          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/ria?tab=cash-closure" class="button">Corriger l'arrêté</a>
          </div>
          ` : ''}

          <div class="footer">
            <p>Cet email a été envoyé automatiquement par le système de gestion RIA.</p>
            <p>Merci de ne pas répondre à cet email.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `

  return await sendEmail({
    to: caissierEmail,
    subject: isRejected 
      ? `Arrêté de caisse rejeté - ${declaration.guichetier}`
      : `Correction demandée pour l'arrêté de caisse - ${declaration.guichetier}`,
    html,
  })
}
