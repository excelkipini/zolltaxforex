import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import jsPDF from "jspdf"
import QRCode from "qrcode"

export const dynamic = 'force-dynamic'

interface ReceiptData {
  clientName: string
  clientPhone: string
  clientEmail: string
  operationType: string
  amountReceived: number
  amountSent: number
  commission: number
  commissionRate: number
  currency: string
  notes: string
  receiptNumber: string
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuth()
    
    // Vérifier les permissions
    if (user.role !== "cashier" && user.role !== "accounting" && user.role !== "director" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    const receiptData: ReceiptData = await request.json()

    // Validation des données
    if (!receiptData.clientName || !receiptData.operationType || !receiptData.amountReceived) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 })
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
    doc.text(receiptData.receiptNumber, 70, currentY)
    
    doc.text("Date:", pageWidth - 60, currentY)
    doc.text(new Date().toLocaleDateString('fr-FR'), pageWidth - 25, currentY)
    
    currentY += 8
    doc.text("Heure:", pageWidth - 60, currentY)
    doc.text(new Date().toLocaleTimeString('fr-FR'), pageWidth - 25, currentY)

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
    doc.text(receiptData.clientName, 40, currentY)
    currentY += 6

    if (receiptData.clientPhone) {
      doc.setFont("helvetica", "bold")
      doc.text("Téléphone:", 20, currentY)
      doc.setFont("helvetica", "normal")
      doc.text(receiptData.clientPhone, 60, currentY)
      currentY += 6
    }

    if (receiptData.clientEmail) {
      doc.setFont("helvetica", "bold")
      doc.text("Email:", 20, currentY)
      doc.setFont("helvetica", "normal")
      doc.text(receiptData.clientEmail, 40, currentY)
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
    
    doc.text(operationTypes[receiptData.operationType as keyof typeof operationTypes] || "Non spécifié", 80, currentY)
    currentY += 15

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

    // Montant reçu
    doc.setFont("helvetica", "bold")
    doc.text("Montant reçu:", 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.text(`${receiptData.amountReceived.toLocaleString('fr-FR')} ${receiptData.currency}`, pageWidth - 50, currentY, { align: "right" })
    currentY += 6

    // Commission
    doc.setFont("helvetica", "bold")
    doc.text(`Commission (${receiptData.commissionRate}%):`, 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(200, 0, 0) // Rouge
    doc.text(`-${receiptData.commission.toLocaleString('fr-FR')} ${receiptData.currency}`, pageWidth - 50, currentY, { align: "right" })
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
    doc.text(`${receiptData.amountSent.toLocaleString('fr-FR')} ${receiptData.currency}`, pageWidth - 50, currentY, { align: "right" })

    currentY += 15

    // Notes si présentes
    if (receiptData.notes) {
      doc.setDrawColor(200, 200, 200)
      doc.line(20, currentY, pageWidth - 20, currentY)
      currentY += 10

      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      doc.text("Notes", 20, currentY)
      currentY += 8

      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      
      // Diviser les notes en plusieurs lignes si nécessaire
      const notesLines = doc.splitTextToSize(receiptData.notes, pageWidth - 40)
      doc.text(notesLines, 20, currentY)
      currentY += notesLines.length * 5 + 10
    }

    // QR Code
    const qrCodeY = Math.max(currentY + 20, pageHeight - 80)
    
    try {
      // Générer le QR Code avec les informations du reçu
      const qrData = JSON.stringify({
        receiptNumber: receiptData.receiptNumber,
        clientName: receiptData.clientName,
        amountReceived: receiptData.amountReceived,
        amountSent: receiptData.amountSent,
        currency: receiptData.currency,
        date: new Date().toISOString(),
        operationType: receiptData.operationType
      })

      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 60,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      // Ajouter le QR Code au PDF
      doc.addImage(qrCodeDataURL, 'PNG', pageWidth - 80, qrCodeY, 60, 60)
      
      // Texte sous le QR Code
      doc.setFontSize(8)
      doc.setTextColor(100, 100, 100)
      doc.text("QR Code du reçu", pageWidth - 50, qrCodeY + 70, { align: "center" })
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
    doc.text(`Généré par: ${user.name} (${user.role})`, pageWidth / 2, pageHeight - 15, { align: "center" })
    doc.text(`Date de génération: ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, pageHeight - 10, { align: "center" })

    // Générer le PDF
    const pdfBuffer = doc.output('arraybuffer')
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt_${receiptData.receiptNumber}.pdf"`,
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
