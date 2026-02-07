/**
 * Utilitaire de génération de reçus pour les opérations de change.
 * Utilisé par exchange-view.tsx et exchange-management-view.tsx
 */

// --- Types ---

export type ExchangeReceiptType = "change_achat" | "change_vente" | "achat_devise" | "vente_devise" | "appro_agence"

export interface ExchangeReceiptData {
  type: ExchangeReceiptType
  receiptId: string
  date: string
  agent: string
  // Change (Nouvelle opération de change)
  clientName?: string
  clientPhone?: string
  clientIdType?: string
  clientIdNumber?: string
  operationType?: "Achat devise" | "Vente devise"
  currency?: string
  amountForeign?: number
  amountXaf?: number
  exchangeRate?: number
  commission?: number
  // Achat devise (caisse)
  deviseAchat?: string
  montant?: number
  deviseAchetee?: string
  tauxAchat?: number
  montantDeviseAchetee?: number
  totalDeviseDisponible?: number
  tauxReel?: number
  depTransport?: number
  depBeach?: number
  depEchangeBillets?: number
  // Vente devise (caisse)
  beneficiaire?: string
  deviseVendu?: string
  montantVendu?: number
  deviseRecu?: string
  tauxDuJour?: number
  montantRecu?: number
  lastApproRate?: number | null
  commissionVente?: number
  // Appro agence
  distributions?: {
    agencyName: string
    xaf: number
    usd: number
    eur: number
    gbp: number
  }[]
  totalXaf?: number
  totalUsd?: number
  totalEur?: number
  totalGbp?: number
  resteXaf?: number
  resteUsd?: number
  resteEur?: number
  resteGbp?: number
}

// --- Helpers ---

export function generateReceiptId(prefix: string): string {
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "")
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0")
  return `${prefix}-${dateStr}-${timeStr}-${random}`
}

function fmt(n: number | undefined | null, dec = 0): string {
  if (n == null) return "—"
  return n.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function fmtRate(n: number | undefined | null): string {
  if (n == null || n === 0) return "—"
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// --- Styles partagés ---

const RECEIPT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: 'Courier New', monospace;
    margin: 0; padding: 20px;
    background: white; color: #000; line-height: 1.4;
  }
  .receipt { 
    max-width: 420px; margin: 0 auto; 
    border: 2px solid #000; padding: 20px; background: white;
  }
  .header { 
    text-align: center; margin-bottom: 16px;
    border-bottom: 2px dashed #000; padding-bottom: 14px;
  }
  .logo { 
    font-size: 20px; font-weight: bold; margin-bottom: 4px;
    text-transform: uppercase; letter-spacing: 2px;
  }
  .receipt-title { 
    font-size: 13px; font-weight: bold; margin-bottom: 6px;
    text-transform: uppercase; letter-spacing: 1px; color: #333;
  }
  .receipt-number {
    font-size: 12px; font-weight: bold; background: #f0f0f0;
    padding: 4px 8px; border: 1px solid #000; display: inline-block;
  }
  .section { margin: 12px 0; }
  .section-title {
    font-size: 11px; font-weight: bold; text-transform: uppercase;
    border-bottom: 1px solid #ccc; padding-bottom: 3px; margin-bottom: 8px;
    letter-spacing: 1px; color: #555;
  }
  .row { 
    display: flex; justify-content: space-between; 
    margin: 5px 0; padding: 2px 0; font-size: 12px;
  }
  .row .label { color: #444; }
  .row .value { font-weight: bold; text-align: right; max-width: 55%; }
  .row.total {
    border-top: 2px solid #000; border-bottom: 2px solid #000;
    font-weight: bold; margin-top: 10px; padding: 8px 0;
    font-size: 14px;
  }
  .row.subtotal {
    border-top: 1px dashed #000;
    font-weight: bold; margin-top: 6px; padding-top: 6px;
  }
  .qrcode-section { 
    text-align: center; margin: 16px 0;
    border-top: 2px dashed #000; padding-top: 14px;
  }
  .qrcode-container {
    display: inline-block; border: 1px solid #000;
    padding: 8px; background: white;
  }
  .qr-label {
    font-size: 10px; margin-top: 6px; font-style: italic; color: #666;
  }
  .footer { 
    text-align: center; font-size: 10px; color: #666; 
    margin-top: 16px; border-top: 2px dashed #000; padding-top: 12px;
  }
  .footer .company { font-weight: bold; font-size: 12px; color: #000; }
  .timestamp { font-size: 9px; color: #999; margin-top: 6px; }
  .dist-table { width: 100%; font-size: 11px; border-collapse: collapse; margin: 8px 0; }
  .dist-table th, .dist-table td { 
    padding: 3px 4px; text-align: right; border-bottom: 1px solid #ddd; 
  }
  .dist-table th { text-align: center; font-size: 10px; border-bottom: 2px solid #000; }
  .dist-table td:first-child { text-align: left; }
  @media print {
    body { margin: 0; padding: 10px; }
    .receipt { border: 2px solid #000; box-shadow: none; }
  }
`

// --- Fonctions de génération HTML ---

function makeRow(label: string, value: string, cls = ""): string {
  return `<div class="row ${cls}"><span class="label">${label}</span><span class="value">${value}</span></div>`
}

function wrapReceipt(title: string, receiptId: string, content: string, qrCodeDataURL: string, date: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${title} - ${receiptId}</title>
  <style>${RECEIPT_STYLES}</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="logo">ZOLL TAX FOREX</div>
      <div class="receipt-title">${title}</div>
      <div class="receipt-number">${receiptId}</div>
    </div>
    ${content}
    <div class="qrcode-section">
      <div class="qrcode-container">
        ${qrCodeDataURL 
          ? `<img src="${qrCodeDataURL}" alt="QR Code" style="width: 120px; height: 120px;" />`
          : `<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>`
        }
      </div>
      <div class="qr-label">
        Scannez pour vérifier l'authenticité
      </div>
    </div>
    <div class="footer">
      <div>Merci pour votre confiance</div>
      <div class="company">ZOLL TAX FOREX</div>
      <div>&copy; ${new Date().getFullYear()} - Tous droits réservés</div>
      <div class="timestamp">Imprimé le ${date}</div>
    </div>
  </div>
</body>
</html>`
}

// --- Générateurs par type ---

function generateChangeReceiptContent(d: ExchangeReceiptData): { title: string; content: string } {
  const isBuy = d.operationType === "Achat devise"
  const title = `Reçu de Change - ${isBuy ? "Achat" : "Vente"}`
  
  let content = `
    <div class="section">
      <div class="section-title">Informations de la transaction</div>
      ${makeRow("Date", d.date)}
      ${makeRow("Agent", d.agent)}
      ${makeRow("Type", d.operationType || "—")}
      ${makeRow("Devise", d.currency || "—")}
    </div>
    <div class="section">
      <div class="section-title">Informations du client</div>
      ${makeRow("Client", d.clientName || "—")}
      ${d.clientPhone ? makeRow("Téléphone", d.clientPhone) : ""}
      ${makeRow("Pièce d'identité", d.clientIdType || "—")}
      ${makeRow("N° Pièce", d.clientIdNumber || "—")}
    </div>
    <div class="section">
      <div class="section-title">Détails de l'opération</div>
      ${makeRow("Montant " + (d.currency || ""), fmt(d.amountForeign, 2) + " " + (d.currency || ""))}
      ${makeRow("Taux appliqué", "1 " + (d.currency || "") + " = " + fmt(d.exchangeRate) + " XAF")}
      ${makeRow("Commission", fmt(d.commission) + " XAF")}
      ${makeRow("Montant XAF", fmt(d.amountXaf) + " XAF", "total")}
    </div>
  `
  return { title, content }
}

function generateAchatDeviseContent(d: ExchangeReceiptData): { title: string; content: string } {
  const title = "Reçu - Achat Devise"
  const content = `
    <div class="section">
      <div class="section-title">Informations de la transaction</div>
      ${makeRow("Date", d.date)}
      ${makeRow("Agent", d.agent)}
      ${makeRow("Opération", "Achat devise (Caisse)")}
    </div>
    <div class="section">
      <div class="section-title">Détails de l'achat</div>
      ${makeRow("Devise d'achat", d.deviseAchat || "—")}
      ${makeRow("Montant", fmt(d.montant) + " " + (d.deviseAchat || ""))}
      ${makeRow("Devise achetée", d.deviseAchetee || "—")}
      ${makeRow("Taux achat", fmtRate(d.tauxAchat) + " XAF")}
      ${makeRow("Montant devise achetée", fmt(d.montantDeviseAchetee, 2) + " " + (d.deviseAchetee || ""), "subtotal")}
    </div>
    <div class="section">
      <div class="section-title">Dépenses</div>
      ${makeRow("Transport", fmt(d.depTransport, 2) + " " + (d.deviseAchetee || ""))}
      ${makeRow("Beach", fmt(d.depBeach, 2) + " " + (d.deviseAchetee || ""))}
      ${makeRow("Échange billets", fmt(d.depEchangeBillets, 2) + " " + (d.deviseAchetee || ""))}
    </div>
    <div class="section">
      <div class="section-title">Résultat</div>
      ${makeRow("Total devise disponible", fmt(d.totalDeviseDisponible, 2) + " " + (d.deviseAchetee || ""), "subtotal")}
      ${makeRow("Taux réel", fmtRate(d.tauxReel) + " XAF", "total")}
    </div>
  `
  return { title, content }
}

function generateVenteDeviseContent(d: ExchangeReceiptData): { title: string; content: string } {
  const title = "Reçu - Vente Devise"
  const content = `
    <div class="section">
      <div class="section-title">Informations de la transaction</div>
      ${makeRow("Date", d.date)}
      ${makeRow("Agent", d.agent)}
      ${makeRow("Opération", "Vente devise (Caisse)")}
    </div>
    <div class="section">
      <div class="section-title">Bénéficiaire</div>
      ${makeRow("Nom", d.beneficiaire || "—")}
      ${d.clientIdType ? makeRow("Pièce d'identité", d.clientIdType) : ""}
      ${d.clientIdNumber ? makeRow("N° Pièce", d.clientIdNumber) : ""}
    </div>
    <div class="section">
      <div class="section-title">Détails de la vente</div>
      ${makeRow("Devise vendue", d.deviseVendu || "—")}
      ${makeRow("Montant vendu", fmt(d.montantVendu, 2) + " " + (d.deviseVendu || ""))}
      ${makeRow("Devise reçue", d.deviseRecu || "—")}
      ${makeRow("Taux du jour", fmtRate(d.tauxDuJour) + " XAF")}
      ${makeRow("Taux réel appro", fmtRate(d.lastApproRate) + " XAF")}
      ${makeRow("Commission", fmt(d.commissionVente) + " XAF")}
      ${makeRow("Montant reçu", fmt(d.montantRecu) + " " + (d.deviseRecu || ""), "total")}
    </div>
  `
  return { title, content }
}

function generateApproAgenceContent(d: ExchangeReceiptData): { title: string; content: string } {
  const title = "Reçu - Appro Agence"
  
  const distRows = (d.distributions || []).map(dist => `
    <tr>
      <td>${dist.agencyName}</td>
      <td>${fmt(dist.xaf)}</td>
      <td>${fmt(dist.usd)}</td>
      <td>${fmt(dist.eur)}</td>
      <td>${fmt(dist.gbp)}</td>
    </tr>
  `).join("")

  const content = `
    <div class="section">
      <div class="section-title">Informations de la transaction</div>
      ${makeRow("Date", d.date)}
      ${makeRow("Agent", d.agent)}
      ${makeRow("Opération", "Approvisionnement agence")}
      ${makeRow("Nb agences", String(d.distributions?.length || 0))}
    </div>
    <div class="section">
      <div class="section-title">Distribution par agence</div>
      <table class="dist-table">
        <thead>
          <tr><th style="text-align:left">Agence</th><th>XAF</th><th>USD</th><th>EUR</th><th>GBP</th></tr>
        </thead>
        <tbody>
          ${distRows}
        </tbody>
      </table>
    </div>
    <div class="section">
      <div class="section-title">Totaux transférés</div>
      ${makeRow("Total XAF", fmt(d.totalXaf) + " XAF")}
      ${makeRow("Total USD", fmt(d.totalUsd) + " USD")}
      ${makeRow("Total EUR", fmt(d.totalEur) + " EUR")}
      ${makeRow("Total GBP", fmt(d.totalGbp) + " GBP")}
    </div>
    <div class="section">
      <div class="section-title">Reste caisse principale</div>
      ${makeRow("XAF", fmt(d.resteXaf) + " XAF")}
      ${makeRow("USD", fmt(d.resteUsd) + " USD")}
      ${makeRow("EUR", fmt(d.resteEur) + " EUR")}
      ${makeRow("GBP", fmt(d.resteGbp) + " GBP")}
    </div>
  `
  return { title, content }
}

// --- Fonction principale ---

export function generateExchangeReceiptHTML(data: ExchangeReceiptData, qrCodeDataURL: string): string {
  const date = new Date().toLocaleString("fr-FR")
  
  let result: { title: string; content: string }
  
  switch (data.type) {
    case "change_achat":
    case "change_vente":
      result = generateChangeReceiptContent(data)
      break
    case "achat_devise":
      result = generateAchatDeviseContent(data)
      break
    case "vente_devise":
      result = generateVenteDeviseContent(data)
      break
    case "appro_agence":
      result = generateApproAgenceContent(data)
      break
    default:
      result = { title: "Reçu", content: "" }
  }
  
  return wrapReceipt(result.title, data.receiptId, result.content, qrCodeDataURL, date)
}

/** Génère le QR code, crée le HTML et ouvre la fenêtre d'impression */
export async function printExchangeReceipt(data: ExchangeReceiptData): Promise<void> {
  // Générer le QR code via l'API
  let qrCodeDataURL = ""
  try {
    const qrPayload = {
      id: data.receiptId,
      type: data.type,
      date: data.date,
      agent: data.agent,
      ...(data.clientName && { client: data.clientName }),
      ...(data.beneficiaire && { beneficiaire: data.beneficiaire }),
      ...(data.currency && { devise: data.currency }),
      ...(data.amountXaf && { montant_xaf: data.amountXaf }),
      ...(data.amountForeign && { montant_devise: data.amountForeign }),
      ...(data.montantVendu && { montant_vendu: data.montantVendu }),
      ...(data.totalXaf && { total_xaf: data.totalXaf }),
    }
    const response = await fetch("/api/qr-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: JSON.stringify(qrPayload),
        options: { width: 120, height: 120, colorDark: "#000000", colorLight: "#ffffff", errorCorrectionLevel: "M" },
      }),
    })
    if (response.ok) {
      const result = await response.json()
      qrCodeDataURL = result.qrCodeDataURL
    }
  } catch {
    // QR code non disponible
  }

  const html = generateExchangeReceiptHTML(data, qrCodeDataURL)
  const printWindow = window.open("", "_blank", "width=600,height=800")
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  }
}
