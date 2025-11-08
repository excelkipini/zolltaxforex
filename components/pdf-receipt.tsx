"use client"

import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { useRef } from "react"

interface PDFReceiptProps {
  expense: {
    id: string
    description: string
    amount: number
    category: string
    status: string
    date: string
    requested_by: string
    agency: string
    comment?: string
    rejection_reason?: string
  }
  user: {
    role: string
  }
}

export function PDFReceipt({ expense, user }: PDFReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const canDownloadPDF = user.role === "director" || user.role === "delegate" || user.role === "accounting"

  const generatePDF = async () => {
    if (!canDownloadPDF) return

    try {
      // Créer le contenu HTML directement - optimisé pour une page A4
      const receiptHTML = `
        <div style="font-family: Arial, sans-serif; width: 210mm; height: 297mm; margin: 0; padding: 15mm; background: white; box-sizing: border-box; display: flex; flex-direction: column;">
          <!-- En-tête -->
          <div style="text-align: center; margin-bottom: 20mm;">
            <h1 style="font-size: 20px; font-weight: bold; color: #333; margin-bottom: 5px;">
              ZOLL TAX FOREX
            </h1>
            <p style="color: #666; font-size: 14px; margin-bottom: 10px;">Reçu de Sortie de Caisse</p>
            <div style="border-top: 1px solid #ccc; padding-top: 10px;">
              <p style="font-size: 12px; color: #999;">N° ${expense.id}</p>
            </div>
          </div>

          <!-- Informations de la dépense -->
          <div style="margin-bottom: 20mm; flex-grow: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: bold; font-size: 12px;">Date:</span>
              <span style="font-size: 12px;">${new Date(expense.date).toLocaleDateString("fr-FR")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: bold; font-size: 12px;">Libellé:</span>
              <span style="text-align: right; max-width: 120px; font-size: 12px;">${expense.description}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: bold; font-size: 12px;">Catégorie:</span>
              <span style="font-size: 12px;">${expense.category}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span style="font-weight: bold; font-size: 12px;">Demandeur:</span>
              <span style="font-size: 12px;">${expense.requested_by}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
              <span style="font-weight: bold; font-size: 12px;">Agence:</span>
              <span style="font-size: 12px;">${expense.agency}</span>
            </div>
            ${expense.comment ? `
            <div style="margin-bottom: 15px;">
              <span style="font-weight: bold; font-size: 12px;">Commentaire:</span>
              <div style="margin-top: 4px; padding: 8px; background-color: #f5f5f5; border-radius: 4px; font-size: 11px; line-height: 1.4;">
                ${expense.comment.replace(/\n/g, '<br>')}
              </div>
            </div>
            ` : ''}
            ${expense.rejection_reason ? `
            <div style="margin-bottom: 15px;">
              <span style="font-weight: bold; font-size: 12px; color: #dc2626;">Motif du rejet:</span>
              <div style="margin-top: 4px; padding: 8px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; font-size: 11px; line-height: 1.4; color: #dc2626;">
                ${expense.rejection_reason.replace(/\n/g, '<br>')}
              </div>
            </div>
            ` : ''}
            <div style="border-top: 1px solid #ccc; padding-top: 10px; margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: bold;">
                <span>Montant:</span>
                <span style="color: #059669;">${expense.amount.toLocaleString()} XAF</span>
              </div>
            </div>

            <!-- Statut -->
            <div style="text-align: center; margin-bottom: 20px;">
              <div style="display: inline-block; background-color: #dcfce7; color: #166534; padding: 6px 12px; border-radius: 6px;">
                <span style="font-weight: bold; font-size: 12px;">STATUT: APPROUVÉ</span>
              </div>
            </div>

            <!-- Signatures -->
            <div style="display: flex; justify-content: space-between; margin-top: 30px;">
              <div style="text-align: center; width: 45%;">
                <div style="border-top: 1px solid #ccc; padding-top: 5px;">
                  <p style="font-size: 11px; color: #666;">Directeur</p>
                  <p style="font-weight: bold; font-size: 11px;">Signature</p>
                </div>
              </div>
              <div style="text-align: center; width: 45%;">
                <div style="border-top: 1px solid #ccc; padding-top: 5px;">
                  <p style="font-size: 11px; color: #666;">Comptable</p>
                  <p style="font-weight: bold; font-size: 11px;">Signature</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Pied de page -->
          <div style="text-align: center; margin-top: auto; padding-top: 10px; border-top: 1px solid #ccc;">
            <p style="font-size: 10px; color: #999; margin: 0;">
              Ce reçu certifie la sortie de fonds approuvée par la direction
            </p>
            <p style="font-size: 10px; color: #999; margin: 2px 0 0 0;">
              Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}
            </p>
          </div>
        </div>
      `

      // Créer un élément temporaire pour le rendu
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = receiptHTML
      tempDiv.style.position = 'absolute'
      tempDiv.style.left = '-9999px'
      tempDiv.style.top = '-9999px'
      document.body.appendChild(tempDiv)

      const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
        scale: 1.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: 210 * 3.78, // Convertir mm en pixels (1mm = 3.78px)
        height: 297 * 3.78
      })

      document.body.removeChild(tempDiv)

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      
      // Ajouter l'image sur une seule page A4
      pdf.addImage(imgData, "PNG", 0, 0, 210, 297)

      pdf.save(`receipt_${expense.id}_${expense.date}.pdf`)
    } catch (error) {
      alert("Erreur lors de la génération du PDF. Veuillez réessayer.")
    }
  }

  if (!canDownloadPDF || (expense.status !== "approved" && expense.status !== "director_approved")) {
    return null
  }

  return (
    <div>
      <Button
        onClick={generatePDF}
        variant="outline"
        size="sm"
        className="text-blue-600 border-blue-600 hover:bg-blue-50"
      >
        <Download className="h-4 w-4 mr-2" />
        Télécharger PDF
      </Button>

    </div>
  )
}
