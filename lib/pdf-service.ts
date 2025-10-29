import "server-only"
import { jsPDF } from "jspdf"
import { CashDeclaration } from "./ria-cash-declarations-queries"

/**
 * Générer un PDF pour un arrêté de caisse
 */
export async function generateCashDeclarationPDF(
  declaration: CashDeclaration,
  caissierInfo: { name: string; email: string },
  cashManagerInfo?: { name: string }
): Promise<Buffer> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 50
  let currentY = margin

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, '.') + ' FCFA'
  }

  // En-tête
  doc.setFontSize(20)
  doc.setFont("courier", "bold")
  doc.text('ARRÊTÉ DE CAISSE', pageWidth / 2, currentY, { align: 'center' })
  currentY += 10

  doc.setFontSize(12)
  doc.setFont("courier", "normal")
  doc.text('ZOLL TAX FOREX', pageWidth / 2, currentY, { align: 'center' })
  currentY += 20

  // Informations de l'arrêté
  doc.setFontSize(10)
  doc.setFont("courier", "normal")
  doc.text(`Date de déclaration: ${new Date(declaration.declaration_date).toLocaleDateString('fr-FR')}`, margin, currentY)
  currentY += 7
  doc.text(`Guichetier: ${declaration.guichetier}`, margin, currentY)
  currentY += 7
  // Traduire le statut en français
  const statusTranslations: Record<string, string> = {
    'draft': 'BROUILLON',
    'submitted': 'SOUMIS',
    'validated': 'VALIDÉ',
    'rejected': 'REJETÉ'
  }
  doc.text(`Statut: ${statusTranslations[declaration.status] || declaration.status.toUpperCase()}`, margin, currentY)
  currentY += 15

  // Tableau des montants
  doc.setFontSize(12)
  doc.setFont("courier", "bold")
  doc.text('Détails des Montants', margin, currentY)
  currentY += 10

  const leftColumn = margin
  const rightColumn = pageWidth - margin - 100
  const itemHeight = 10

  // Ligne 1: Montant brut
  doc.setFont("courier", "normal")
  doc.setFontSize(10)
  doc.text('Montant Brut:', leftColumn, currentY)
  doc.setFont("courier", "bold")
  doc.text(formatAmount(Number(declaration.montant_brut)), leftColumn + 80, currentY)
  currentY += itemHeight

  // Ligne 2: Délestage
  doc.setFont("courier", "normal")
  doc.text('Délestage:', leftColumn, currentY)
  doc.setFont("courier", "bold")
  doc.text(formatAmount(Number(declaration.total_delestage)), leftColumn + 80, currentY)
  currentY += itemHeight * 1.5

  // Ligne 3: Net à verser
  const netAmount = Number(declaration.montant_brut) - Number(declaration.total_delestage)
  doc.setDrawColor(0, 0, 0)
  doc.setFillColor(240, 249, 255)
  doc.rect(leftColumn, currentY - 5, pageWidth - margin * 2, itemHeight * 2, 'FD')
  doc.setTextColor(0, 0, 0)
  doc.setFont("courier", "bold")
  doc.setFontSize(14)
  doc.text('MONTANT NET À VERSER:', leftColumn + 5, currentY + 5)
  doc.setFontSize(16)
  // Positionner le montant à l'intérieur du bloc, après le texte
  const netAmountX = leftColumn + 5 + doc.getTextWidth('MONTANT NET À VERSER: ') + 10
  doc.text(formatAmount(netAmount), netAmountX, currentY + 5)
  currentY += itemHeight * 2.5

  // Commentaire sur le délestage
  if (declaration.delestage_comment) {
    currentY += 10
    doc.setFontSize(10)
    doc.setFont("courier", "bold")
    doc.text('Commentaire sur le délestage:', margin, currentY)
    currentY += 7
    doc.setFont("courier", "normal")
    const lines = doc.splitTextToSize(declaration.delestage_comment, pageWidth - margin * 2)
    doc.text(lines, margin + 10, currentY)
    currentY += lines.length * 7
  }

  // Informations de validation
  if (declaration.status === 'validated' && declaration.validated_at) {
    currentY += 10
    doc.setFontSize(10)
    doc.setFont("courier", "normal")
    doc.text(`Validé le: ${new Date(declaration.validated_at).toLocaleString('fr-FR')}`, margin, currentY)
    currentY += 7
    if (cashManagerInfo) {
      doc.text(`Par: ${cashManagerInfo.name}`, margin, currentY)
      currentY += 7
    }
    if (declaration.validation_comment) {
      currentY += 5
      doc.setFont("courier", "bold")
      doc.text('Commentaire de validation:', margin, currentY)
      currentY += 7
      doc.setFont("courier", "normal")
      const lines = doc.splitTextToSize(declaration.validation_comment, pageWidth - margin * 2)
      doc.text(lines, margin + 10, currentY)
      currentY += lines.length * 7
    }
  }

  if (declaration.status === 'rejected' && declaration.rejection_comment) {
    currentY += 10
    doc.setFontSize(10)
    doc.setTextColor(239, 68, 68)
    doc.setFont("courier", "bold")
    doc.text('Raison du rejet:', margin, currentY)
    currentY += 7
    doc.setTextColor(0, 0, 0)
    doc.setFont("courier", "normal")
    const lines = doc.splitTextToSize(declaration.rejection_comment, pageWidth - margin * 2)
    doc.text(lines, margin + 10, currentY)
    currentY += lines.length * 7
  }

  // Pied de page
  const footerY = pageHeight - 30
  doc.setFontSize(8)
  doc.setFont("courier", "normal")
  doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, margin, footerY)
  doc.text(`Caissier: ${caissierInfo.name} (${caissierInfo.email})`, margin, footerY + 10)

  // Convertir en Buffer
  const pdfOutput = doc.output('arraybuffer')
  return Buffer.from(pdfOutput)
}
