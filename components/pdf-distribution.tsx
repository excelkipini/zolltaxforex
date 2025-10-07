"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, FileText } from "lucide-react"
import jsPDF from "jspdf"

interface DistributionCard {
  id: string
  cid: string
  country: string
  amount: number
  new_balance: number
}

interface DistributionData {
  total_distributed: number
  remaining_amount: number
  cards_used: number
  distributions: DistributionCard[]
  country: string
  distributedBy: string
  distributedAt: string
}

interface PDFDistributionProps {
  distributionData: DistributionData
  onClose: () => void
}

export function PDFDistribution({ distributionData, onClose }: PDFDistributionProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace(/\s/g, '.')
  }

  const generatePDF = () => {
    const doc = new jsPDF()
    
    // Configuration de la page
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const contentWidth = pageWidth - (margin * 2)
    
    let yPosition = margin
    
    // En-tête avec logo et titre
    doc.setFontSize(20)
    doc.setFont("helvetica", "bold")
    doc.text("ZOLL TAX FOREX", margin, yPosition)
    
    yPosition += 10
    doc.setFontSize(16)
    doc.setFont("helvetica", "normal")
    doc.text("Distribution en Masse de Cartes", margin, yPosition)
    
    yPosition += 15
    
    // Informations générales
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Informations de la Distribution", margin, yPosition)
    
    yPosition += 8
    doc.setFont("helvetica", "normal")
    
    const infoData = [
      [`Pays:`, distributionData.country || 'Non spécifié'],
      [`Montant total distribué:`, `${formatCurrency(distributionData.total_distributed || 0)} XAF`],
      [`Nombre de cartes:`, `${distributionData.cards_used}`],
      [`Montant restant:`, `${formatCurrency(distributionData.remaining_amount || 0)} XAF`],
      [`Distribué par:`, distributionData.distributedBy || 'Non spécifié'],
      [`Date de distribution:`, distributionData.distributedAt ? new Date(distributionData.distributedAt).toLocaleString('fr-FR') : 'Non disponible']
    ]
    
    infoData.forEach(([label, value]) => {
      doc.setFont("helvetica", "bold")
      doc.text(String(label || ''), margin, yPosition)
      doc.setFont("helvetica", "normal")
      doc.text(String(value || ''), margin + 60, yPosition)
      yPosition += 6
    })
    
    yPosition += 10
    
    // Tableau des cartes
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Détail des Cartes Distribuées", margin, yPosition)
    
    yPosition += 15
    
    // En-têtes du tableau
    const tableHeaders = ["N° Carte", "Pays", "Montant Reçu", "Nouveau Solde"]
    const columnWidths = [40, 30, 50, 50]
    const tableStartX = margin
    
    // Dessiner les en-têtes
    doc.setFontSize(10)
    doc.setFont("helvetica", "bold")
    let xPosition = tableStartX
    tableHeaders.forEach((header, index) => {
      doc.rect(xPosition, yPosition - 5, columnWidths[index], 8)
      doc.text(String(header || ''), xPosition + 2, yPosition + 2)
      xPosition += columnWidths[index]
    })
    
    yPosition += 8
    
    // Données du tableau
    doc.setFont("helvetica", "normal")
    distributionData.distributions.forEach((card) => {
      // Vérifier si on a besoin d'une nouvelle page
      if (yPosition > pageHeight - 30) {
        doc.addPage()
        yPosition = margin
      }
      
      xPosition = tableStartX
      const rowData = [
        card.cid || 'N/A',
        card.country || 'N/A',
        `${formatCurrency(card.amount || 0)} XAF`,
        `${formatCurrency(card.new_balance || 0)} XAF`
      ]
      
      rowData.forEach((data, index) => {
        doc.rect(xPosition, yPosition - 5, columnWidths[index], 8)
        doc.text(String(data || ''), xPosition + 2, yPosition + 2)
        xPosition += columnWidths[index]
      })
      
      yPosition += 8
    })
    
    // Pied de page
    const footerY = pageHeight - 20
    doc.setFontSize(8)
    doc.setFont("helvetica", "normal")
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, margin, footerY)
    doc.text(`Page 1`, pageWidth - margin - 20, footerY)
    
    // Sauvegarder le PDF
    const fileName = `distribution_masse_${distributionData.country}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(fileName)
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Distribution en Masse - Rapport PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Résumé de la distribution */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Résumé de la Distribution</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Pays:</span> {distributionData.country || 'Non spécifié'}
            </div>
            <div>
              <span className="font-medium">Montant total:</span> {formatCurrency(distributionData.total_distributed || 0)} XAF
            </div>
            <div>
              <span className="font-medium">Nombre de cartes:</span> {distributionData.cards_used}
            </div>
            <div>
              <span className="font-medium">Montant restant:</span> {formatCurrency(distributionData.remaining_amount || 0)} XAF
            </div>
            <div>
              <span className="font-medium">Distribué par:</span> {distributionData.distributedBy || 'Non spécifié'}
            </div>
            <div>
              <span className="font-medium">Date:</span> {distributionData.distributedAt ? new Date(distributionData.distributedAt).toLocaleString('fr-FR') : 'Non disponible'}
            </div>
          </div>
        </div>

        {/* Liste des cartes */}
        <div>
          <h3 className="font-semibold mb-3">Cartes Distribuées ({distributionData.distributions.length})</h3>
          <div className="max-h-60 overflow-y-auto border rounded-lg">
            <div className="grid grid-cols-5 gap-2 p-3 bg-gray-50 font-medium text-sm">
              <div>N° Carte</div>
              <div>Pays</div>
              <div>Montant Reçu</div>
              <div>Nouveau Solde</div>
              <div>Statut</div>
            </div>
            {distributionData.distributions.map((card, index) => (
              <div key={card.id} className="grid grid-cols-5 gap-2 p-3 border-t text-sm">
                <div className="font-mono">{card.cid || 'N/A'}</div>
                <div>{card.country || 'N/A'}</div>
                <div className="text-green-600 font-medium">{formatCurrency(card.amount || 0)} XAF</div>
                <div className="text-blue-600">{formatCurrency(card.new_balance || 0)} XAF</div>
                <div className="text-green-600">✓ Distribué</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={generatePDF} className="bg-red-600 hover:bg-red-700">
            <Download className="h-4 w-4 mr-2" />
            Télécharger PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
