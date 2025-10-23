"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Receipt, Download, QrCode, History, Search, FileText, Eye } from "lucide-react"
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

interface ReceiptHistoryItem {
  id: string
  receipt_number: string
  client_name: string
  client_phone?: string
  client_email?: string
  operation_type: string
  amount_received: number
  amount_sent: number
  commission: number
  commission_rate: number
  currency: string
  notes?: string
  created_by_name?: string
  created_at: string
  card_fees?: number
  number_of_cards?: number
  real_commission?: number
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
    commissionRate: 3.775,
    currency: "XAF",
    notes: "",
    receiptNumber: ""
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)

  // Générer un numéro de reçu automatique
  const generateReceiptNumber = () => {
    const now = new Date()
    const timestamp = now.getTime().toString().slice(-6)
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `RC${timestamp}${random}`
  }

  // Calculer automatiquement les montants
  const calculateAmounts = (received: number) => {
    const commission = Math.ceil((received * receiptData.commissionRate) / 100)
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

  // Charger l'historique des reçus
  const loadReceiptHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch(`/api/receipts?search=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      
      if (data.ok) {
        setReceiptHistory(data.receipts)
      } else {
        toast.error("Erreur lors du chargement de l'historique")
      }
    } catch (error) {
      console.error('Erreur:', error)
      toast.error("Erreur lors du chargement de l'historique")
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Télécharger un reçu PDF
  const downloadReceiptPDF = async (receiptId: string, receiptNumber: string) => {
    try {
      const response = await fetch(`/api/receipts/${receiptId}/download`)
      
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt_${receiptNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Reçu téléchargé avec succès")
    } catch (error) {
      console.error('Erreur:', error)
      toast.error("Erreur lors du téléchargement du reçu")
    }
  }

  // Charger l'historique au montage du composant
  useEffect(() => {
    if (showHistory) {
      loadReceiptHistory()
    }
  }, [showHistory, searchQuery])

  const handleGenerateReceipt = async () => {
    if (!receiptData.clientName || !receiptData.operationType || !receiptData.amountReceived) {
      toast.error("Veuillez remplir tous les champs obligatoires")
      return
    }

    setIsGenerating(true)
    
    try {
      const finalReceiptData = {
        ...receiptData,
        receiptNumber: generateReceiptNumber()
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
      
      // Recharger l'historique si affiché
      if (showHistory) {
        loadReceiptHistory()
      }
      
      // Réinitialiser le formulaire
      setReceiptData({
        clientName: "",
        clientPhone: "",
        clientEmail: "",
        operationType: "",
        amountReceived: 0,
        amountSent: 0,
        commission: 0,
        commissionRate: 3.775,
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
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Receipt className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Transfert International</h1>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center space-x-2"
        >
          <History className="h-4 w-4" />
          <span>{showHistory ? "Masquer l'historique" : "Historique des reçus"}</span>
        </Button>
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
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="amountReceived">Montant reçu *</Label>
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
                    <SelectItem value="XAF">XAF</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                  <span className="font-mono">{receiptData.receiptNumber || generateReceiptNumber()}</span>
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

      {/* Historique des reçus */}
      {showHistory && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>Historique des reçus</span>
            </CardTitle>
            <CardDescription>
              Liste de tous les reçus générés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Barre de recherche */}
            <div className="flex items-center space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher par numéro, client, téléphone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                onClick={loadReceiptHistory}
                disabled={isLoadingHistory}
                variant="outline"
              >
                {isLoadingHistory ? "Chargement..." : "Rechercher"}
              </Button>
            </div>

            {/* Tableau des reçus */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numéro</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Opération</TableHead>
                    <TableHead>Montant reçu</TableHead>
                    <TableHead>Montant envoyé</TableHead>
                    <TableHead>Créé par</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHistory ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex items-center justify-center space-x-2">
                          <QrCode className="h-4 w-4 animate-spin" />
                          <span>Chargement...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : receiptHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Aucun reçu trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    receiptHistory.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell className="font-mono text-sm">
                          {receipt.receipt_number}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{receipt.client_name}</div>
                            {receipt.client_phone && (
                              <div className="text-sm text-gray-500">{receipt.client_phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {receipt.operation_type === "transfer" && "Transfert"}
                            {receipt.operation_type === "exchange" && "Bureau de change"}
                            {receipt.operation_type === "card_recharge" && "Recharge carte"}
                            {receipt.operation_type === "cash_deposit" && "Dépôt espèces"}
                            {receipt.operation_type === "cash_withdrawal" && "Retrait espèces"}
                            {receipt.operation_type === "other" && "Autre"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {receipt.amount_received.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {receipt.currency}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {receipt.amount_sent.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {receipt.currency}
                        </TableCell>
                        <TableCell>
                          {receipt.created_by_name || "Système"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(receipt.created_at).toLocaleDateString('fr-FR')}
                          <br />
                          {new Date(receipt.created_at).toLocaleTimeString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex items-center space-x-1"
                                >
                                  <Eye className="h-3 w-3" />
                                  <span>Détails</span>
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Détails du reçu {receipt.receipt_number}</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  {/* Informations client */}
                                  <div>
                                    <h4 className="font-semibold mb-2">Informations client</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium">Nom:</span> {receipt.client_name}
                                      </div>
                                      {receipt.client_phone && (
                                        <div>
                                          <span className="font-medium">Téléphone:</span> {receipt.client_phone}
                                        </div>
                                      )}
                                      {receipt.client_email && (
                                        <div>
                                          <span className="font-medium">Email:</span> {receipt.client_email}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <Separator />

                                  {/* Détails financiers */}
                                  <div>
                                    <h4 className="font-semibold mb-2">Détails financiers</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium">Montant reçu:</span> {receipt.amount_received.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {receipt.currency}
                                      </div>
                                      <div>
                                        <span className="font-medium">Commission ({receipt.commission_rate}%):</span> -{receipt.commission.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {receipt.currency}
                                      </div>
                                      <div>
                                        <span className="font-medium">Montant envoyé:</span> {receipt.amount_sent.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {receipt.currency}
                                      </div>
                                      <div>
                                        <span className="font-medium">Frais cartes:</span> {receipt.card_fees ? `${receipt.card_fees.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${receipt.currency} (${receipt.number_of_cards || 0} cartes)` : '0 XAF (0 cartes)'}
                                      </div>
                                      <div>
                                        <span className="font-medium">Commission réelle:</span> 
                                        <span className={`ml-1 ${receipt.real_commission && receipt.real_commission > 0 ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                          {receipt.real_commission ? `${receipt.real_commission.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${receipt.currency}` : '0 XAF'}
                                          {receipt.real_commission && receipt.real_commission > 0 && ' ✓ Ajouté'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <Separator />

                                  {/* Informations système */}
                                  <div>
                                    <h4 className="font-semibold mb-2">Informations système</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <span className="font-medium">Type d'opération:</span> 
                                        <Badge variant="outline" className="ml-2">
                                          {receipt.operation_type === "transfer" && "Transfert"}
                                          {receipt.operation_type === "exchange" && "Bureau de change"}
                                          {receipt.operation_type === "card_recharge" && "Recharge carte"}
                                          {receipt.operation_type === "cash_deposit" && "Dépôt espèces"}
                                          {receipt.operation_type === "cash_withdrawal" && "Retrait espèces"}
                                          {receipt.operation_type === "other" && "Autre"}
                                        </Badge>
                                      </div>
                                      <div>
                                        <span className="font-medium">Créé par:</span> {receipt.created_by_name || "Système"}
                                      </div>
                                      <div>
                                        <span className="font-medium">Date de création:</span> {new Date(receipt.created_at).toLocaleString('fr-FR')}
                                      </div>
                                    </div>
                                  </div>

                                  {receipt.notes && (
                                    <>
                                      <Separator />
                                      <div>
                                        <h4 className="font-semibold mb-2">Notes</h4>
                                        <p className="text-sm text-gray-600">{receipt.notes}</p>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadReceiptPDF(receipt.id, receipt.receipt_number)}
                              className="flex items-center space-x-1"
                            >
                              <FileText className="h-3 w-3" />
                              <span>PDF</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
