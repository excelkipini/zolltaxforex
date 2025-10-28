import "server-only"
import PDFDocument from "pdfkit"
import { CashDeclaration } from "./ria-cash-declarations-queries"

/**
 * Générer un PDF pour un arrêté de caisse
 */
export async function generateCashDeclarationPDF(
  declaration: CashDeclaration,
  caissierInfo: { name: string; email: string },
  cashManagerInfo?: { name: string }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
      })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // En-tête
      doc.fontSize(20).font('Helvetica-Bold').text('ARRÊTÉ DE CAISSE', { align: 'center' })
      doc.moveDown(0.5)
      doc.fontSize(12).font('Helvetica').text('ZOLL TAX FOREX', { align: 'center' })
      doc.moveDown()

      // Informations de l'arrêté
      doc.fontSize(10)
      doc.text(`Date de déclaration: ${new Date(declaration.declaration_date).toLocaleDateString('fr-FR')}`)
      doc.text(`Guichetier: ${declaration.guichetier}`)
      doc.text(`Statut: ${declaration.status.toUpperCase()}`)
      doc.moveDown()

      // Tableau des montants
      doc.fontSize(12).font('Helvetica-Bold').text('Détails des Montants')
      doc.moveDown(0.3)

      const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA'
      }

      // Tableau
      const tableTop = doc.y
      const itemHeight = 30
      const leftColumn = 50
      const rightColumn = 350

      // Ligne 1: Montant brut
      doc.font('Helvetica')
        .text('Montant Brut:', leftColumn, tableTop)
        .font('Helvetica-Bold')
        .text(formatAmount(declaration.montant_brut), rightColumn, tableTop, { align: 'right', width: 200 })

      // Ligne 2: Délestage
      doc.font('Helvetica')
        .text('Délestage:', leftColumn, tableTop + itemHeight)
        .font('Helvetica-Bold')
        .text(formatAmount(declaration.total_delestage), rightColumn, tableTop + itemHeight, { align: 'right', width: 200 })

      // Ligne 3: Net à verser
      const netAmount = declaration.montant_brut - declaration.total_delestage
      doc.fillColor('#000000')
        .font('Helvetica-Bold')
        .fontSize(14)
        .rect(leftColumn, tableTop + itemHeight * 2.5, 500, itemHeight)
        .fillAndStroke('#F0F9FF')
        .fillColor('#000000')
        .text('MONTANT NET À VERSER:', leftColumn + 10, tableTop + itemHeight * 2.8)
        .fontSize(16)
        .text(formatAmount(netAmount), rightColumn, tableTop + itemHeight * 2.8, { align: 'right', width: 200 })

      doc.moveDown(2)

      // Commentaire sur le délestage
      if (declaration.delestage_comment) {
        doc.fontSize(10).font('Helvetica')
        doc.font('Helvetica-Bold').text('Commentaire sur le délestage:')
        doc.font('Helvetica').text(declaration.delestage_comment, {
          indent: 20,
        })
        doc.moveDown()
      }

      // Informations de validation
      if (declaration.status === 'validated' && declaration.validated_at) {
        doc.fontSize(10).font('Helvetica')
        doc.text(`Validé le: ${new Date(declaration.validated_at).toLocaleString('fr-FR')}`)
        if (cashManagerInfo) {
          doc.text(`Par: ${cashManagerInfo.name}`)
        }
        if (declaration.validation_comment) {
          doc.moveDown(0.5)
          doc.font('Helvetica-Bold').text('Commentaire de validation:')
          doc.font('Helvetica').text(declaration.validation_comment, { indent: 20 })
        }
        doc.moveDown()
      }

      if (declaration.status === 'rejected' && declaration.rejection_comment) {
        doc.fontSize(10).font('Helvetica')
        doc.fillColor('#EF4444')
          .font('Helvetica-Bold')
          .text('Raison du rejet:')
        doc.fillColor('#000000')
          .font('Helvetica')
          .text(declaration.rejection_comment, { indent: 20 })
        doc.moveDown()
      }

      // Pied de page
      doc.fontSize(8).font('Helvetica')
      doc.text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 50, 750, { align: 'left' })
      doc.text(`Caissier: ${caissierInfo.name} (${caissierInfo.email})`, 50, 760, { align: 'left' })

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

