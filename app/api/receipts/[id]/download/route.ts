import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { getReceiptById } from "@/lib/receipts-queries"
import jsPDF from "jspdf"
import QRCode from "qrcode"

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await requireAuth()
    
    // Vérifier les permissions
    if (!hasPermission(user, "view_receipts")) {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    const receipt = await getReceiptById(params.id)
    if (!receipt) {
      return NextResponse.json({ error: "Reçu non trouvé" }, { status: 404 })
    }

    // Créer le PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Configuration des couleurs
    const primaryColor = [0, 51, 102] // Bleu foncé
    const secondaryColor = [0, 123, 255] // Bleu
    const textColor = [51, 51, 51] // Gris foncé
    const lightGray = [240, 240, 240]

    // En-tête
    doc.setFillColor(...primaryColor)
    doc.rect(0, 0, pageWidth, 30, 'F')
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text("ZOLL TAX FOREX", pageWidth / 2, 15, { align: "center" })
    
    doc.setFontSize(12)
    doc.setFont("helvetica", "normal")
    doc.text("Reçu de transaction", pageWidth / 2, 22, { align: "center" })

    // Informations du reçu
    doc.setTextColor(...textColor)
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    
    const startY = 45
    let currentY = startY

    // Numéro de reçu et date
    doc.setFont("helvetica", "bold")
    doc.text("Numéro de reçu:", 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.text(receipt.receipt_number, 70, currentY)
    
    doc.text("Date:", pageWidth - 60, currentY)
    doc.text(new Date(receipt.created_at).toLocaleDateString('fr-FR'), pageWidth - 25, currentY)
    
    currentY += 8
    doc.text("Heure:", pageWidth - 60, currentY)
    doc.text(new Date(receipt.created_at).toLocaleTimeString('fr-FR'), pageWidth - 25, currentY)

    currentY += 15

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200)
    doc.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Informations client
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Informations du client", 20, currentY)
    currentY += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    
    doc.setFont("helvetica", "bold")
    doc.text("Nom:", 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.text(receipt.client_name, 40, currentY)
    currentY += 6

    if (receipt.client_phone) {
      doc.setFont("helvetica", "bold")
      doc.text("Téléphone:", 20, currentY)
      doc.setFont("helvetica", "normal")
      doc.text(receipt.client_phone, 60, currentY)
      currentY += 6
    }

    if (receipt.client_email) {
      doc.setFont("helvetica", "bold")
      doc.text("Email:", 20, currentY)
      doc.setFont("helvetica", "normal")
      doc.text(receipt.client_email, 40, currentY)
      currentY += 6
    }

    currentY += 10

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200)
    doc.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Type d'opération
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Détails de l'opération", 20, currentY)
    currentY += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    
    doc.setFont("helvetica", "bold")
    doc.text("Type d'opération:", 20, currentY)
    doc.setFont("helvetica", "normal")
    
    const operationTypes = {
      transfer: "Transfert d'argent",
      exchange: "Bureau de change",
      card_recharge: "Recharge de carte",
      cash_deposit: "Dépôt d'espèces",
      cash_withdrawal: "Retrait d'espèces",
      other: "Autre"
    }
    
    doc.text(operationTypes[receipt.operation_type as keyof typeof operationTypes] || "Non spécifié", 80, currentY)
    currentY += 6

    // Notes dans la section Détails de l'opération
    if (receipt.notes) {
      currentY += 4
      doc.setFont("helvetica", "bold")
      doc.text("Notes:", 20, currentY)
      currentY += 4
      
      doc.setFont("helvetica", "normal")
      // Diviser les notes en plusieurs lignes si nécessaire
      const notesLines = doc.splitTextToSize(receipt.notes, pageWidth - 40)
      doc.text(notesLines, 20, currentY)
      currentY += notesLines.length * 5 + 4
    }

    currentY += 9

    // Ligne de séparation
    doc.setDrawColor(200, 200, 200)
    doc.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Montants
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.text("Détail des montants", 20, currentY)
    currentY += 8

    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")

    // Fonction pour formater les nombres avec des points comme séparateurs de milliers
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(amount).replace(/\s/g, '.')
    }

    // Montant reçu
    doc.setFont("helvetica", "bold")
    doc.text("Montant reçu:", 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.text(`${formatCurrency(receipt.amount_received)} ${receipt.currency}`, pageWidth - 50, currentY, { align: "right" })
    currentY += 6

    // Commission
    doc.setFont("helvetica", "bold")
    doc.text(`Commission (${receipt.commission_rate}%):`, 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(200, 0, 0) // Rouge
    doc.text(`-${formatCurrency(receipt.commission)} ${receipt.currency}`, pageWidth - 50, currentY, { align: "right" })
    doc.setTextColor(...textColor) // Retour à la couleur normale
    currentY += 6

    // Ligne de séparation avant total
    doc.setDrawColor(200, 200, 200)
    doc.line(20, currentY, pageWidth - 20, currentY)
    currentY += 6

    // Montant envoyé (total)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(11)
    doc.text("Montant envoyé:", 20, currentY)
    doc.text(`${formatCurrency(receipt.amount_sent)} ${receipt.currency}`, pageWidth - 50, currentY, { align: "right" })

    currentY += 15

    // QR Code - Positionnement à 15px au-dessus du pied de page
    const qrCodeSize = 50
    const footerStartY = pageHeight - 30 // Pied de page commence à 30px du bas
    const qrCodeY = footerStartY - 15 - qrCodeSize // 15px au-dessus du pied de page
    const qrCodeX = (pageWidth - qrCodeSize) / 2 // Centré horizontalement
    
    try {
      // Utiliser les données QR Code sauvegardées ou générer à partir des données du reçu
      const qrData = receipt.qr_code_data || {
        receiptNumber: receipt.receipt_number,
        clientName: receipt.client_name,
        amountReceived: receipt.amount_received,
        amountSent: receipt.amount_sent,
        currency: receipt.currency,
        date: receipt.created_at,
        operationType: receipt.operation_type
      }

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
        width: qrCodeSize,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      // Ajouter le QR Code au PDF (centré)
      doc.addImage(qrCodeDataURL, 'PNG', qrCodeX, qrCodeY, qrCodeSize, qrCodeSize)
      
      // Texte sous le QR Code (centré)
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text("QR Code du reçu", pageWidth / 2, qrCodeY + qrCodeSize + 8, { align: "center" })
    } catch (error) {
      console.error('Erreur lors de la génération du QR Code:', error)
      // Continuer sans QR Code en cas d'erreur
    }

    // Pied de page
    doc.setDrawColor(200, 200, 200)
    doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30)
    
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text("Ce reçu a été généré automatiquement par le système ZOLL TAX FOREX", pageWidth / 2, pageHeight - 20, { align: "center" })
    doc.text(`Généré par: ${receipt.created_by_name || 'Système'}`, pageWidth / 2, pageHeight - 15, { align: "center" })
    doc.text(`Date de génération: ${new Date(receipt.created_at).toLocaleString('fr-FR')}`, pageWidth / 2, pageHeight - 10, { align: "center" })

    // Générer le PDF
    const pdfBuffer = doc.output('arraybuffer')
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt_${receipt.receipt_number}.pdf"`,
      },
    })

  } catch (error: any) {
    console.error('Erreur lors de la génération du reçu:', error)
    return NextResponse.json(
      { error: error.message || "Erreur lors de la génération du reçu" },
      { status: 500 }
    )
  }
}
