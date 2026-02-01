import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { createReceipt } from "@/lib/receipts-queries"
import { addReceiptCommissionToAccount, updateCashAccountBalance } from "@/lib/cash-queries"
import jsPDF from "jspdf"
import QRCode from "qrcode"

export const dynamic = 'force-dynamic'

// Fonction pour calculer les frais de cartes
function calculateCardFees(amountSent: number): { numberOfCards: number; cardFees: number } {
  const numberOfCards = Math.ceil(amountSent / 800000) // Arrondi supérieur
  const cardFees = numberOfCards * 14000 // 14,000 XAF par carte
  return { numberOfCards, cardFees }
}

// Fonction pour calculer la commission réelle
function calculateRealCommission(amountReceived: number, amountSent: number, cardFees: number): number {
  return amountReceived - (amountSent + cardFees)
}

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
    if (user.role !== "cashier" && user.role !== "accounting" && user.role !== "director" && user.role !== "delegate" && user.role !== "super_admin") {
      return NextResponse.json({ error: "Permission refusée" }, { status: 403 })
    }

    const receiptData: ReceiptData = await request.json()

    // Validation des données
    if (!receiptData.clientName || !receiptData.operationType || !receiptData.amountReceived) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 })
    }

    // Calculer les frais de cartes et la commission réelle
    const { numberOfCards, cardFees } = calculateCardFees(receiptData.amountSent)
    const realCommission = calculateRealCommission(receiptData.amountReceived, receiptData.amountSent, cardFees)
    const totalAmountToAddToCoffre = receiptData.amountSent + cardFees

    console.log(`Calculs pour le reçu ${receiptData.receiptNumber}:`)
    console.log(`- Montant reçu: ${receiptData.amountReceived} XAF`)
    console.log(`- Montant envoyé: ${receiptData.amountSent} XAF`)
    console.log(`- Nombre de cartes: ${numberOfCards}`)
    console.log(`- Frais de cartes: ${cardFees} XAF`)
    console.log(`- Commission réelle: ${realCommission} XAF`)
    console.log(`- Montant total à ajouter au coffre: ${totalAmountToAddToCoffre} XAF`)

    // Créer le PDF
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    
    // Configuration des couleurs
    const primaryColor: [number, number, number] = [0, 51, 102] // Bleu foncé
    const secondaryColor: [number, number, number] = [0, 123, 255] // Bleu
    const textColor: [number, number, number] = [51, 51, 51] // Gris foncé
    const lightGray: [number, number, number] = [240, 240, 240]

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

    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    
    // QR Code à droite des informations client
    const qrCodeSize = 25 // Réduit de 50 à 25
    const qrCodeX = pageWidth - 20 - qrCodeSize // Positionné à droite
    const qrCodeY = currentY - 5 // Aligné avec le début des informations
    
    try {
      // Générer le QR Code avec les informations du reçu
      const qrData = JSON.stringify({
        receiptNumber: receiptData.receiptNumber,
        clientName: receiptData.clientName,
        amountReceived: receiptData.amountReceived,
        amountSent: receiptData.amountSent,
        cardFees: cardFees,
        numberOfCards: numberOfCards,
        totalAmountToCoffre: totalAmountToAddToCoffre,
        realCommission: realCommission,
        currency: receiptData.currency,
        date: new Date().toISOString(),
        operationType: receiptData.operationType
      })

      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: qrCodeSize,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      // Ajouter le QR Code au PDF (à droite)
      doc.addImage(qrCodeDataURL, 'PNG', qrCodeX, qrCodeY, qrCodeSize, qrCodeSize)
      
      // Texte sous le QR Code
      doc.setFontSize(7)
      doc.setTextColor(100, 100, 100)
      doc.text("QR Code", qrCodeX + qrCodeSize / 2, qrCodeY + qrCodeSize + 6, { align: "center" })
    } catch (error) {
      console.error('Erreur lors de la génération du QR Code:', error)
      // Continuer sans QR Code en cas d'erreur
    }
    
    // Redéfinir la taille de police pour les informations client
    doc.setFontSize(12)
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
    currentY += 6

    // Notes dans la section Détails de l'opération
    if (receiptData.notes) {
      currentY += 4
      doc.setFont("helvetica", "bold")
      doc.text("Notes:", 20, currentY)
      currentY += 4
      
      doc.setFont("helvetica", "normal")
      // Diviser les notes en plusieurs lignes si nécessaire
      const notesLines = doc.splitTextToSize(receiptData.notes, pageWidth - 40)
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
    doc.text(`${formatCurrency(receiptData.amountReceived)} ${receiptData.currency}`, pageWidth - 50, currentY, { align: "right" })
    currentY += 6

    // Commission
    doc.setFont("helvetica", "bold")
    doc.text(`Commission (${receiptData.commissionRate}%):`, 20, currentY)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(200, 0, 0) // Rouge
    doc.text(`-${formatCurrency(receiptData.commission)} ${receiptData.currency}`, pageWidth - 50, currentY, { align: "right" })
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
    doc.text(`${formatCurrency(receiptData.amountSent)} ${receiptData.currency}`, pageWidth - 50, currentY, { align: "right" })

    currentY += 20

    // Section des signatures
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text("Signatures", 20, currentY)
    currentY += 8

    // Ligne de séparation pour les signatures
    doc.setDrawColor(200, 200, 200)
    doc.line(20, currentY, pageWidth - 20, currentY)
    currentY += 10

    // Signature du client (à gauche)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.text("Client:", 20, currentY)
    currentY += 12
    
    // Ligne de signature client
    doc.setDrawColor(100, 100, 100)
    doc.line(20, currentY, 120, currentY)
    doc.text(`${receiptData.clientName}`, 20, currentY + 8)

    // Signature du comptable (à droite) - Aligné avec le client
    doc.text("Comptable:", pageWidth - 60, currentY - 12, { align: "right" })
    
    // Ligne de signature comptable - Alignée avec la ligne du client
    doc.line(pageWidth - 120, currentY, pageWidth - 20, currentY)
    doc.text(`${user.name}`, pageWidth - 60, currentY + 8, { align: "right" })

    currentY += 15

    // Pied de page
    doc.setDrawColor(200, 200, 200)
    doc.line(20, pageHeight - 30, pageWidth - 20, pageHeight - 30)
    
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text("Ce reçu a été généré automatiquement par le système ZOLL TAX FOREX", pageWidth / 2, pageHeight - 20, { align: "center" })
    doc.text(`Généré par: ${user.name} (${user.role})`, pageWidth / 2, pageHeight - 15, { align: "center" })
    doc.text(`Date de génération: ${new Date().toLocaleString('fr-FR')}`, pageWidth / 2, pageHeight - 10, { align: "center" })

    // Enregistrer le reçu en base de données et ajouter la commission
    try {
      const qrData = {
        receiptNumber: receiptData.receiptNumber,
        clientName: receiptData.clientName,
        amountReceived: receiptData.amountReceived,
        amountSent: receiptData.amountSent,
        currency: receiptData.currency,
        date: new Date().toISOString(),
        operationType: receiptData.operationType
      }

      // Créer le reçu en base de données
      const savedReceipt = await createReceipt({
        receipt_number: receiptData.receiptNumber,
        client_name: receiptData.clientName,
        client_phone: receiptData.clientPhone || undefined,
        client_email: receiptData.clientEmail || undefined,
        operation_type: receiptData.operationType,
        amount_received: receiptData.amountReceived,
        amount_sent: receiptData.amountSent,
        commission: receiptData.commission,
        commission_rate: receiptData.commissionRate,
        currency: receiptData.currency,
        notes: receiptData.notes || undefined,
        qr_code_data: qrData,
        created_by: user.id,
        card_fees: cardFees,
        number_of_cards: numberOfCards,
        real_commission: realCommission
      })

      console.log(`Reçu ${receiptData.receiptNumber} enregistré en base de données`)

      // 1. Ajouter le montant total au coffre (montant envoyé + frais de cartes)
      try {
        await updateCashAccountBalance(
          'coffre',
          totalAmountToAddToCoffre,
          user.name,
          `Reçu ${receiptData.receiptNumber}: Montant envoyé + frais cartes`
        )
        console.log(`Montant de ${totalAmountToAddToCoffre} XAF ajouté au coffre`)
      } catch (coffreError) {
        console.error('Erreur lors de l\'ajout au coffre:', coffreError)
        // Continuer même en cas d'erreur coffre
      }

      // 2. Ajouter la commission réelle au compte des commissions des reçus si > 0 XAF
      if (realCommission > 0) {
        try {
          await addReceiptCommissionToAccount(
            savedReceipt.id,
            realCommission,
            `Commission reçu: ${receiptData.operationType} - ${receiptData.clientName} (${numberOfCards} cartes)`,
            user.name
          )
          console.log(`Commission réelle de ${realCommission} XAF ajoutée au compte commissions des reçus`)
        } catch (commissionError) {
          console.error('Erreur lors de l\'ajout de la commission des reçus:', commissionError)
          // Continuer même en cas d'erreur de commission
        }
      } else {
        console.log(`Commission réelle de ${realCommission} XAF <= 0 XAF, non ajoutée au compte commissions des reçus`)
      }

    } catch (dbError) {
      console.error('Erreur lors de l\'enregistrement en base de données:', dbError)
      // Continuer même en cas d'erreur de base de données
    }

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
