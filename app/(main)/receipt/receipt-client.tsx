"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Receipt, Download, QrCode } from "lucide-react"
import { toast } from "sonner"

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

export default function ReceiptClient() {
  const [receiptData, setReceiptData] = useState<ReceiptData>({
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    operationType: "",
    amountReceived: 0,
    amountSent: 0,
    commission: 0,
    commissionRate: 3.6,
    currency: "XAF",
    notes: "",
    receiptNumber: ""
  })

  const [isGenerating, setIsGenerating] = useState(false)

  // Générer un numéro de reçu automatique
  const generateReceiptNumber = () => {
    const now = new Date()
    const timestamp = now.getTime().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `RC${timestamp}${random}`
  }

  // Calculer automatiquement les montants
  const calculateAmounts = (received: number) => {
    const commission = (received * receiptData.commissionRate) / 100
    const sent = received - commission
    
    setReceiptData(prev => ({
      ...prev,
      amountReceived: received,
      amountSent: sent,
      commission: commission
    }))
  }

  const handleAmountReceivedChange = (value: string) => {
    const amount = parseFloat(value) || 0
    calculateAmounts(amount)
  }

  const handleGenerateReceipt = async () => {
    if (!receiptData.clientName || !receiptData.operationType || !receiptData.amountReceived) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    setIsGenerating(true)
    
    try {
      const finalReceiptData = {
        ...receiptData,
        receiptNumber: receiptData.receiptNumber || generateReceiptNumber()
      }

      const response = await fetch('/api/receipt/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalReceiptData),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du reçu')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt_${finalReceiptData.receiptNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Reçu généré avec succès")
      
      // Réinitialiser le formulaire
      setReceiptData({
        clientName: "",
        clientPhone: "",
        clientEmail: "",
        operationType: "",
        amountReceived: 0,
        amountSent: 0,
        commission: 0,
        commissionRate: 3.6,
        currency: "XAF",
        notes: "",
        receiptNumber: ""
      })
    } catch (error) {
      console.error('Erreur:', error)
      toast.error("Erreur lors de la génération du reçu")
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Receipt className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Emettre un reçu</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du reçu</CardTitle>
            <CardDescription>
              Remplissez les informations nécessaires pour générer le reçu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Informations client */}
            <div className="space-y-2">
              <Label htmlFor="clientName">Nom du client *</Label>
              <Input
                id="clientName"
                value={receiptData.clientName}
                onChange={(e) => setReceiptData(prev => ({ ...prev, clientName: e.target.value }))}
                placeholder="Nom complet du client"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientPhone">Téléphone</Label>
                <Input
                  id="clientPhone"
                  value={receiptData.clientPhone}
                  onChange={(e) => setReceiptData(prev => ({ ...prev, clientPhone: e.target.value }))}
                  placeholder="+237 6XX XXX XXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientEmail">Email</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={receiptData.clientEmail}
                  onChange={(e) => setReceiptData(prev => ({ ...prev, clientEmail: e.target.value }))}
                  placeholder="client@example.com"
                />
              </div>
            </div>

            <Separator />

            {/* Type d'opération */}
            <div className="space-y-2">
              <Label htmlFor="operationType">Type d'opération *</Label>
              <Select
                value={receiptData.operationType}
                onValueChange={(value) => setReceiptData(prev => ({ ...prev, operationType: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner le type d'opération" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transfer">Transfert d'argent</SelectItem>
                  <SelectItem value="exchange">Bureau de change</SelectItem>
                  <SelectItem value="card_recharge">Recharge de carte</SelectItem>
                  <SelectItem value="cash_deposit">Dépôt d'espèces</SelectItem>
                  <SelectItem value="cash_withdrawal">Retrait d'espèces</SelectItem>
                  <SelectItem value="other">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Montants */}
            <div className="space-y-2">
              <Label htmlFor="amountReceived">Montant reçu ({receiptData.currency}) *</Label>
              <Input
                id="amountReceived"
                type="number"
                value={receiptData.amountReceived || ""}
                onChange={(e) => handleAmountReceivedChange(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commission">Commission ({receiptData.commissionRate}%)</Label>
                <Input
                  id="commission"
                  value={receiptData.commission.toFixed(2)}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountSent">Montant envoyé</Label>
                <Input
                  id="amountSent"
                  value={receiptData.amountSent.toFixed(2)}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
            </div>

            <Separator />

            {/* Devise */}
            <div className="space-y-2">
              <Label htmlFor="currency">Devise</Label>
              <Select
                value={receiptData.currency}
                onValueChange={(value) => setReceiptData(prev => ({ ...prev, currency: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF (Franc CFA)</SelectItem>
                  <SelectItem value="USD">USD (Dollar américain)</SelectItem>
                  <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  <SelectItem value="GBP">GBP (Livre sterling)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Numéro de reçu */}
            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Numéro de reçu</Label>
              <Input
                id="receiptNumber"
                value={receiptData.receiptNumber}
                onChange={(e) => setReceiptData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                placeholder="Laissé vide pour génération automatique"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={receiptData.notes}
                onChange={(e) => setReceiptData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Notes additionnelles (optionnel)"
                rows={3}
              />
            </div>

            <Button 
              onClick={handleGenerateReceipt} 
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <QrCode className="mr-2 h-4 w-4 animate-spin" />
                  Génération en cours...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Générer le reçu PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Aperçu */}
        <Card>
          <CardHeader>
            <CardTitle>Aperçu du reçu</CardTitle>
            <CardDescription>
              Prévisualisation des informations du reçu
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="text-center mb-4">
                <h3 className="font-bold text-lg">ZOLL TAX FOREX</h3>
                <p className="text-sm text-gray-600">Reçu de transaction</p>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Numéro:</span>
                  <span className="font-mono">{receiptData.receiptNumber || "RC------"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Heure:</span>
                  <span>{new Date().toLocaleTimeString('fr-FR')}</span>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Client:</span>
                  <p className="text-gray-600">{receiptData.clientName || "Non spécifié"}</p>
                </div>
                {receiptData.clientPhone && (
                  <div>
                    <span className="font-medium">Téléphone:</span>
                    <p className="text-gray-600">{receiptData.clientPhone}</p>
                  </div>
                )}
                {receiptData.clientEmail && (
                  <div>
                    <span className="font-medium">Email:</span>
                    <p className="text-gray-600">{receiptData.clientEmail}</p>
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Opération:</span>
                  <p className="text-gray-600">
                    {receiptData.operationType === "transfer" && "Transfert d'argent"}
                    {receiptData.operationType === "exchange" && "Bureau de change"}
                    {receiptData.operationType === "card_recharge" && "Recharge de carte"}
                    {receiptData.operationType === "cash_deposit" && "Dépôt d'espèces"}
                    {receiptData.operationType === "cash_withdrawal" && "Retrait d'espèces"}
                    {receiptData.operationType === "other" && "Autre"}
                    {!receiptData.operationType && "Non spécifié"}
                  </p>
                </div>
              </div>

              <Separator className="my-3" />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Montant reçu:</span>
                  <span className="font-medium">
                    {receiptData.amountReceived.toLocaleString('fr-FR')} {receiptData.currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Commission ({receiptData.commissionRate}%):</span>
                  <span className="text-red-600">
                    -{receiptData.commission.toLocaleString('fr-FR')} {receiptData.currency}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Montant envoyé:</span>
                  <span>
                    {receiptData.amountSent.toLocaleString('fr-FR')} {receiptData.currency}
                  </span>
                </div>
              </div>

              {receiptData.notes && (
                <>
                  <Separator className="my-3" />
                  <div className="text-sm">
                    <span className="font-medium">Notes:</span>
                    <p className="text-gray-600 mt-1">{receiptData.notes}</p>
                  </div>
                </>
              )}

              <div className="text-center mt-4">
                <div className="inline-block p-2 border rounded bg-white">
                  <QrCode className="h-16 w-16 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500 mt-2">QR Code du reçu</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
