"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeSVG } from "qrcode.react"
import { receptionSchema, zodToFieldErrors, type FieldErrors } from "@/lib/validation"
import { Printer, Eye, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DailyOperations } from "./daily-operations"
import { CashierPendingTransactionsByType } from "./cashier-pending-transactions-by-type"
import { getSessionClient, SessionUser } from "@/lib/auth-client"

export function ReceptionView({
  commissionPercent = 3.78,
  transferLimit,
}: {
  commissionPercent?: number
  transferLimit?: number
}) {
  const { toast } = useToast()
  
  // État du formulaire de reçu
  const [date, setDate] = React.useState("")
  const [agent, setAgent] = React.useState("")
  const [client, setClient] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [operationType, setOperationType] = React.useState<"transfer" | "exchange" | "card_recharge">("transfer")
  
  // Champs dynamiques selon le type d'opération
  const [transferAmount, setTransferAmount] = React.useState<number | "">("")
  const [transferCurrency, setTransferCurrency] = React.useState<"XAF" | "USD" | "EUR">("XAF")
  const [beneficiaryName, setBeneficiaryName] = React.useState("")
  const [beneficiaryCountry, setBeneficiaryCountry] = React.useState("")
  const [exchangeFromAmount, setExchangeFromAmount] = React.useState<number | "">("")
  const [exchangeFromCurrency, setExchangeFromCurrency] = React.useState<"XAF" | "USD" | "EUR">("XAF")
  const [exchangeToAmount, setExchangeToAmount] = React.useState<number | "">("")
  const [exchangeToCurrency, setExchangeToCurrency] = React.useState<"XAF" | "USD" | "EUR">("USD")
  const [cardNumber, setCardNumber] = React.useState("")
  const [cardAmount, setCardAmount] = React.useState<number | "">("")
  
  const [receiptNumber, setReceiptNumber] = React.useState("TRX-XXXX-XXX")
  const [receiptDate, setReceiptDate] = React.useState("")
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [qrCodeError, setQrCodeError] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)
  
  // Récupérer l'utilisateur connecté
  const [user, setUser] = React.useState<SessionUser | null>(null)
  
  React.useEffect(() => {
    const sessionUser = getSessionClient()
    if (sessionUser) {
      setUser(sessionUser)
      setAgent(sessionUser.name)
    }
    
    // Initialiser la date actuelle
    const now = new Date()
    setDate(now.toISOString().split('T')[0])
  }, [])

  const feeRate = Math.max(0, Number(commissionPercent)) / 100

  // Generate a more robust receipt number
  const generateReceiptNumber = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, "0")
    return `TRX-${year}${month}${day}-${hours}${minutes}-${random}`
  }

  // Create QR code data with transaction details
  const createQRData = () => {
    const getOperationDetails = () => {
      switch (operationType) {
        case "transfer":
          return {
            type: "Transfert d'argent",
            amount: `${format(transferAmount)} ${transferCurrency}`,
            details: `Montant: ${format(transferAmount)} ${transferCurrency} | Bénéficiaire: ${beneficiaryName} | Pays: ${beneficiaryCountry}`
          }
        case "exchange":
          return {
            type: "Échange de devise",
            amount: `${format(exchangeFromAmount)} ${exchangeFromCurrency} → ${format(exchangeToAmount)} ${exchangeToCurrency}`,
            details: `De: ${format(exchangeFromAmount)} ${exchangeFromCurrency} vers: ${format(exchangeToAmount)} ${exchangeToCurrency}`
          }
        case "card_recharge":
          return {
            type: "Recharge de carte",
            amount: `${format(cardAmount)} XAF`,
            details: `Carte: ${cardNumber}, Montant: ${format(cardAmount)} XAF`
          }
        default:
          return { type: "Opération", amount: "N/A", details: "N/A" }
      }
    }

    const operationDetails = getOperationDetails()
    
    const qrData = {
      receiptNumber,
      date: receiptDate,
      type: operationDetails.type,
      client: client || "N/A",
      phone: phone || "N/A",
      agent: agent || "N/A",
      amount: operationDetails.amount,
      details: operationDetails.details,
      timestamp: new Date().toISOString(),
      company: "ZOLL TAX FOREX",
    }
    return JSON.stringify(qrData)
  }

  function validateOrSetErrors() {
    setErrors({})
    
    // Validation basique des champs obligatoires
    if (!date) {
      setErrors({ date: "La date est obligatoire" })
      return { ok: false as const }
    }
    if (!agent) {
      setErrors({ agent: "L'agent est obligatoire" })
      return { ok: false as const }
    }
    if (!client) {
      setErrors({ client: "Le client est obligatoire" })
      return { ok: false as const }
    }
    if (!phone) {
      setErrors({ phone: "Le téléphone est obligatoire" })
      return { ok: false as const }
    }
    
    // Validation selon le type d'opération
    switch (operationType) {
      case "transfer":
        if (!transferAmount || transferAmount <= 0) {
          setErrors({ transferAmount: "Le montant du transfert est obligatoire" })
          return { ok: false as const }
        }
        if (!beneficiaryName) {
          setErrors({ beneficiaryName: "Le nom du bénéficiaire est obligatoire" })
          return { ok: false as const }
        }
        if (!beneficiaryCountry) {
          setErrors({ beneficiaryCountry: "Le pays du bénéficiaire est obligatoire" })
          return { ok: false as const }
        }
        break
      case "exchange":
        if (!exchangeFromAmount || exchangeFromAmount <= 0) {
          setErrors({ exchangeFromAmount: "Le montant à échanger est obligatoire" })
          return { ok: false as const }
        }
        if (!exchangeToAmount || exchangeToAmount <= 0) {
          setErrors({ exchangeToAmount: "Le montant reçu est obligatoire" })
          return { ok: false as const }
        }
        break
      case "card_recharge":
        if (!cardNumber) {
          setErrors({ cardNumber: "Le numéro de carte est obligatoire" })
          return { ok: false as const }
        }
        if (!cardAmount || cardAmount <= 0) {
          setErrors({ cardAmount: "Le montant de recharge est obligatoire" })
          return { ok: false as const }
        }
        break
    }
    
    return { ok: true as const }
  }

  const compute = () => {
    const res = validateOrSetErrors()
    if (!res.ok) return

    const now = new Date()
    const newReceiptNumber = generateReceiptNumber()
    setReceiptNumber(newReceiptNumber)
    setReceiptDate(now.toLocaleDateString("fr-FR") + " " + now.toLocaleTimeString("fr-FR"))
    setQrCodeError(false) // Reset QR code error state
  }

  const save = async () => {
    const res = validateOrSetErrors()
    if (!res.ok) return

    try {
      // Génération d'un ID de transaction
      const newTransactionId = `REC-${Date.now().toString().slice(-8)}`
      
      // Créer l'objet transaction pour le stockage
      const getTransactionDetails = () => {
        switch (operationType) {
          case "transfer":
            return {
              type: "receipt",
              description: `Reçu - Transfert d'argent - ${client}`,
              amount: transferAmount,
              currency: transferCurrency,
              details: {
                operation_type: "transfer",
                client_name: client,
                client_phone: phone,
                amount: transferAmount,
                currency: transferCurrency,
                beneficiary_name: beneficiaryName,
                beneficiary_country: beneficiaryCountry,
                receipt_number: receiptNumber,
                receipt_type: "operation_receipt"
              }
            }
          case "exchange":
            return {
              type: "receipt",
              description: `Reçu - Échange de devise - ${client}`,
              amount: exchangeFromAmount,
              currency: exchangeFromCurrency,
              details: {
                operation_type: "exchange",
                client_name: client,
                client_phone: phone,
                from_amount: exchangeFromAmount,
                from_currency: exchangeFromCurrency,
                to_amount: exchangeToAmount,
                to_currency: exchangeToCurrency,
                receipt_number: receiptNumber,
                receipt_type: "operation_receipt"
              }
            }
          case "card_recharge":
            return {
              type: "receipt",
              description: `Reçu - Recharge de carte - ${client}`,
              amount: cardAmount,
              currency: "XAF",
              details: {
                operation_type: "card_recharge",
                client_name: client,
                client_phone: phone,
                card_number: cardNumber,
                amount: cardAmount,
                currency: "XAF",
                receipt_number: receiptNumber,
                receipt_type: "operation_receipt"
              }
            }
          default:
            return null
        }
      }

      const transactionDetails = getTransactionDetails()
      if (!transactionDetails) return

      // Sauvegarder dans la base de données via l'API
      try {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: transactionDetails.type,
            description: transactionDetails.description,
            amount: transactionDetails.amount,
            currency: transactionDetails.currency,
            details: transactionDetails.details
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erreur lors de la sauvegarde')
        }

        const result = await response.json()
        const savedTransaction = result.data
        
        // Déclencher un événement personnalisé pour notifier les autres composants
        window.dispatchEvent(new CustomEvent('receiptCreated', { detail: savedTransaction }))
        
    } catch (error) {
        toast({
          title: "Erreur",
          description: `Erreur lors de la sauvegarde: ${error.message}`,
          variant: "destructive"
        })
        return
      }
      
      toast({
        title: "Reçu créé avec succès",
        description: `Le reçu ${receiptNumber} a été créé et enregistré`,
      })

      // Reset form
      resetForm()
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement du reçu",
        variant: "destructive"
      })
    }
  }

  const resetForm = () => {
    setClient("")
    setPhone("")
    setTransferAmount("")
    setBeneficiaryName("")
    setBeneficiaryCountry("")
    setExchangeFromAmount("")
    setExchangeToAmount("")
    setCardNumber("")
    setCardAmount("")
    setReceiptNumber("TRX-XXXX-XXX")
    setReceiptDate("")
    setQrCodeError(false)
  }

  const getOperationDisplayName = () => {
    switch (operationType) {
      case "transfer":
        return "Transfert d'argent"
      case "exchange":
        return "Échange de devise"
      case "card_recharge":
        return "Recharge de carte"
      default:
        return "-"
    }
  }

  const getOperationDetails = () => {
    switch (operationType) {
      case "transfer":
        return (
          <>
            <Row label="Montant" value={`${format(transferAmount)} ${transferCurrency}`} />
            <Row label="Bénéficiaire" value={beneficiaryName || "-"} />
            <Row label="Pays" value={beneficiaryCountry || "-"} />
          </>
        )
      case "exchange":
        return (
          <>
            <Row label="De" value={`${format(exchangeFromAmount)} ${exchangeFromCurrency}`} />
            <Row label="Vers" value={`${format(exchangeToAmount)} ${exchangeToCurrency}`} />
          </>
        )
      case "card_recharge":
        return (
          <>
            <Row label="Carte" value={cardNumber || "-"} />
            <Row label="Montant" value={`${format(cardAmount)} XAF`} />
          </>
        )
      default:
        return null
    }
  }


  const previewReceipt = async () => {
    if (!receiptDate) {
      alert("Veuillez d'abord calculer la transaction")
      return
    }

    const qrData = createQRData()
    
    // Générer le QR code côté serveur AVANT de créer le HTML
    let qrCodeDataURL = ''
    try {
      const response = await fetch('/api/qr-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          text: qrData,
          options: {
            width: 120,
            height: 120,
            colorDark: '#000000',
            colorLight: '#ffffff',
            errorCorrectionLevel: 'M'
          }
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        qrCodeDataURL = data.qrCodeDataURL
      }
    } catch (error) {
      console.error('Erreur lors de la génération du QR code:', error)
    }
    
    const content = generateReceiptHTML(qrCodeDataURL, false) // false = preview mode

    const w = window.open("", "", "width=600,height=800,scrollbars=yes")
    if (!w) {
      alert("Impossible d'ouvrir la fenêtre de prévisualisation. Vérifiez que les popups ne sont pas bloqués.")
      return
    }
    w.document.write(content)
    w.document.close()
  }

  const printReceipt = async () => {
    if (!receiptDate) {
      alert("Veuillez d'abord calculer la transaction")
      return
    }

    setIsPrinting(true)

    try {
      const qrData = createQRData()
      
      // Générer le QR code côté serveur AVANT de créer le HTML
      let qrCodeDataURL = ''
      try {
        const response = await fetch('/api/qr-code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            text: qrData,
            options: {
              width: 120,
              height: 120,
              colorDark: '#000000',
              colorLight: '#ffffff',
              errorCorrectionLevel: 'M'
            }
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          qrCodeDataURL = data.qrCodeDataURL
        }
      } catch (error) {
        console.error('Erreur lors de la génération du QR code:', error)
      }
      
      const content = generateReceiptHTML(qrCodeDataURL, true) // true = print mode

      const w = window.open("", "", "width=600,height=800")
      if (!w) {
        alert("Impossible d'ouvrir la fenêtre d'impression. Vérifiez que les popups ne sont pas bloqués.")
        return
      }

      w.document.write(content)
      w.document.close()

      // Attendre que le contenu soit chargé avant d'imprimer
      w.onload = () => {
        setTimeout(() => {
          w.print()
          // Fermer la fenêtre après impression (optionnel)
          w.onafterprint = () => {
            setTimeout(() => w.close(), 1000)
          }
        }, 1000) // Délai pour s'assurer que le QR code est rendu
      }
    } catch (error) {
      alert("Erreur lors de l'impression du reçu")
    } finally {
      setIsPrinting(false)
    }
  }

  const getOperationDetailsHTML = () => {
    switch (operationType) {
      case "transfer":
        return `
          <div class="row">
            <span>Montant:</span>
            <span>${format(transferAmount)} ${transferCurrency}</span>
          </div>
          <div class="row">
            <span>Bénéficiaire:</span>
            <span>${beneficiaryName || "-"}</span>
          </div>
          <div class="row">
            <span>Pays:</span>
            <span>${beneficiaryCountry || "-"}</span>
          </div>
        `
      case "exchange":
        return `
          <div class="row">
            <span>De:</span>
            <span>${format(exchangeFromAmount)} ${exchangeFromCurrency}</span>
          </div>
          <div class="row">
            <span>Vers:</span>
            <span>${format(exchangeToAmount)} ${exchangeToCurrency}</span>
          </div>
        `
      case "card_recharge":
        return `
          <div class="row">
            <span>Carte:</span>
            <span>${cardNumber || "-"}</span>
          </div>
          <div class="row">
            <span>Montant:</span>
            <span>${format(cardAmount)} XAF</span>
          </div>
        `
      default:
        return ""
    }
  }

  const generateReceiptHTML = (qrCodeDataURL: string, isPrintMode: boolean) => {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Reçu de Transaction - ${receiptNumber}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body { 
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
              background: white;
              color: #000;
              line-height: 1.4;
            }
            
            .receipt { 
              max-width: 400px; 
              margin: 0 auto; 
              border: 2px solid #000; 
              padding: 20px;
              background: white;
            }
            
            .header { 
              text-align: center; 
              margin-bottom: 20px;
              border-bottom: 1px dashed #000;
              padding-bottom: 15px;
            }
            
            .logo { 
              font-size: 18px; 
              font-weight: bold; 
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            
            .receipt-title {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            
            .receipt-number {
              font-size: 14px;
              font-weight: bold;
              background: #f0f0f0;
              padding: 5px;
              border: 1px solid #000;
            }
            
            .row { 
              display: flex; 
              justify-content: space-between; 
              margin: 8px 0;
              padding: 2px 0;
            }
            
            .row.total {
              border-top: 1px solid #000;
              border-bottom: 1px solid #000;
              font-weight: bold;
              margin-top: 10px;
              padding: 8px 0;
            }
            
            .qrcode-section { 
              text-align: center; 
              margin: 20px 0;
              border-top: 1px dashed #000;
              padding-top: 15px;
            }
            
            .qrcode-container {
              display: inline-block;
              border: 1px solid #000;
              padding: 10px;
              background: white;
            }
            
            .qr-fallback {
              width: 120px;
              height: 120px;
              border: 2px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              text-align: center;
              background: #f9f9f9;
              flex-direction: column;
            }
            
            .qr-fallback {
              width: 120px;
              height: 120px;
              border: 2px solid #000;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              text-align: center;
              background: #f9f9f9;
            }
            
            .qr-instructions {
              font-size: 11px;
              margin-top: 8px;
              font-style: italic;
            }
            
            .footer { 
              text-align: center; 
              font-size: 11px; 
              color: #666; 
              margin-top: 20px;
              border-top: 1px dashed #000;
              padding-top: 15px;
            }
            
            .timestamp {
              font-size: 10px;
              color: #888;
              margin-top: 10px;
            }
            
            /* Styles d'impression */
            @media print {
              body {
                margin: 0;
                padding: 10px;
              }
              
              .receipt {
                border: 2px solid #000;
                box-shadow: none;
              }
              
              .no-print {
                display: none !important;
              }
            }
            
            /* Styles pour la prévisualisation */
            ${
              !isPrintMode
                ? `
              body {
                background: #f5f5f5;
                padding: 40px 20px;
              }
              
              .receipt {
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              }
              
              .preview-controls {
                text-align: center;
                margin: 20px 0;
              }
              
              .btn {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                margin: 0 10px;
                cursor: pointer;
                border-radius: 4px;
              }
              
              .btn:hover {
                background: #0056b3;
              }
            `
                : ""
            }
          </style>
        </head>
        <body>
          ${
            !isPrintMode
              ? `
            <div class="preview-controls no-print">
              <button class="btn" onclick="window.print()">🖨️ Imprimer</button>
              <button class="btn" onclick="window.close()">❌ Fermer</button>
            </div>
          `
              : ""
          }
          
          <div class="receipt">
            <div class="header">
              <div class="logo">ZOLL TAX FOREX</div>
              <div class="receipt-title">Reçu de Transaction</div>
              <div class="receipt-number">${receiptNumber}</div>
            </div>
            
            <div class="transaction-details">
              <div class="row">
                <span>Date:</span>
                <span>${receiptDate}</span>
              </div>
              <div class="row">
                <span>Agent:</span>
                <span>${agent || "-"}</span>
              </div>
              <div class="row">
                <span>Client:</span>
                <span>${client || "-"}</span>
              </div>
              <div class="row">
                <span>Téléphone:</span>
                <span>${phone || "-"}</span>
              </div>
              <div class="row">
                <span>Opération:</span>
                <span>${getOperationDisplayName()}</span>
              </div>
              ${getOperationDetailsHTML()}
            </div>
            
            <div class="qrcode-section">
              <div class="qrcode-container">
                ${qrCodeDataURL 
                  ? `<img src="${qrCodeDataURL}" alt="QR Code" style="width: 120px; height: 120px;" />`
                  : `<div class="qr-fallback">QR Code<br/>non disponible<br/><br/>Numéro:<br/>${receiptNumber}</div>`
                }
              </div>
              <div class="qr-instructions">
                Scannez ce QR code pour vérifier<br/>
                l'authenticité de cette transaction
              </div>
            </div>
            
            <div class="footer">
              <div>Merci pour votre confiance</div>
              <div><strong>ZOLL TAX FOREX</strong></div>
              <div>© 2025 - Tous droits réservés</div>
              <div class="timestamp">
                Généré le ${new Date().toLocaleString("fr-FR")}
              </div>
            </div>
          </div>
          
          <script>
            // QR Code généré côté serveur - pas besoin de bibliothèque externe
            console.log('QR Code généré côté serveur');
            
            ${
              isPrintMode
                ? `
              // Auto-print après chargement complet
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 1500);
              };
              
              // Gestion après impression
              window.onafterprint = function() {
              };
            `
                : ""
            }
          </script>
        </body>
      </html>
    `
  }

  // Handle QR code rendering errors
  const handleQRError = () => {
    setQrCodeError(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Établissement de Reçu</h2>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nouveau Reçu</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Informations de base */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="client">Client</Label>
                <Input
                  id="client"
                  className="mt-1"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  placeholder="Nom du client"
                />
                {errors.client && <p className="mt-1 text-xs text-red-600">{errors.client}</p>}
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  className="mt-1"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +237 6XX XXX XXX"
                />
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone}</p>}
              </div>
            </div>

            {/* Type d'opération */}
            <div>
              <Label htmlFor="operation-type">Opération</Label>
              <Select value={operationType} onValueChange={(v: "transfer" | "exchange" | "card_recharge") => setOperationType(v)}>
                <SelectTrigger id="operation-type" className="mt-1">
                  <SelectValue placeholder="Sélectionner le type d'opération" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="transfer">Transfert d'argent</SelectItem>
                  <SelectItem value="exchange">Échange de devise</SelectItem>
                  <SelectItem value="card_recharge">Recharge de carte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {/* Champs dynamiques selon le type d'opération */}
            {operationType === "transfer" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                    <Label htmlFor="transfer-amount">Montant</Label>
                    <Input
                      id="transfer-amount"
                      type="number"
                      className="mt-1"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Montant du transfert"
                      min="0"
                      step="1"
                    />
                    {errors.transferAmount && <p className="mt-1 text-xs text-red-600">{errors.transferAmount}</p>}
                  </div>
                  <div>
                    <Label htmlFor="transfer-currency">Devise</Label>
                    <Select value={transferCurrency} onValueChange={(v: "XAF" | "USD" | "EUR") => setTransferCurrency(v)}>
                      <SelectTrigger id="transfer-currency" className="mt-1">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
                    <Label htmlFor="beneficiary-name">Nom du Bénéficiaire</Label>
              <Input
                      id="beneficiary-name"
                className="mt-1"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      placeholder="Nom complet du bénéficiaire"
                    />
                    {errors.beneficiaryName && <p className="mt-1 text-xs text-red-600">{errors.beneficiaryName}</p>}
            </div>
            <div>
                    <Label htmlFor="beneficiary-country">Pays du Bénéficiaire</Label>
              <Input
                      id="beneficiary-country"
                className="mt-1"
                      value={beneficiaryCountry}
                      onChange={(e) => setBeneficiaryCountry(e.target.value)}
                      placeholder="Pays de destination"
                    />
                    {errors.beneficiaryCountry && <p className="mt-1 text-xs text-red-600">{errors.beneficiaryCountry}</p>}
            </div>
                </div>
              </div>
            )}

            {operationType === "exchange" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
                    <Label htmlFor="exchange-from-amount">Montant à échanger</Label>
                    <Input
                      id="exchange-from-amount"
                      type="number"
                      className="mt-1"
                      value={exchangeFromAmount}
                      onChange={(e) => setExchangeFromAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Montant à échanger"
                      min="0"
                      step="1"
                    />
                    {errors.exchangeFromAmount && <p className="mt-1 text-xs text-red-600">{errors.exchangeFromAmount}</p>}
              </div>
                  <div>
                    <Label htmlFor="exchange-from-currency">Devise d'origine</Label>
                    <Select value={exchangeFromCurrency} onValueChange={(v: "XAF" | "USD" | "EUR") => setExchangeFromCurrency(v)}>
                      <SelectTrigger id="exchange-from-currency" className="mt-1">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XAF">XAF</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="exchange-to-amount">Montant reçu</Label>
              <Input
                      id="exchange-to-amount"
                type="number"
                className="mt-1"
                      value={exchangeToAmount}
                      onChange={(e) => setExchangeToAmount(e.target.value === "" ? "" : Number(e.target.value))}
                      placeholder="Montant reçu"
                min="0"
                step="1"
              />
                    {errors.exchangeToAmount && <p className="mt-1 text-xs text-red-600">{errors.exchangeToAmount}</p>}
            </div>
                  <div>
                    <Label htmlFor="exchange-to-currency">Devise reçue</Label>
                    <Select value={exchangeToCurrency} onValueChange={(v: "XAF" | "USD" | "EUR") => setExchangeToCurrency(v)}>
                      <SelectTrigger id="exchange-to-currency" className="mt-1">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="XAF">XAF</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {operationType === "card_recharge" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                  <Label htmlFor="card-number">Numéro de carte</Label>
                  <Input
                    id="card-number"
                    className="mt-1"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="Numéro de carte"
                  />
                  {errors.cardNumber && <p className="mt-1 text-xs text-red-600">{errors.cardNumber}</p>}
              </div>
              <div>
                  <Label htmlFor="card-amount">Montant de recharge</Label>
                  <Input
                    id="card-amount"
                    type="number"
                    className="mt-1"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Montant en XAF"
                    min="0"
                    step="1"
                  />
                  {errors.cardAmount && <p className="mt-1 text-xs text-red-600">{errors.cardAmount}</p>}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button variant="secondary" onClick={compute}>
                Générer le reçu
              </Button>
              <Button onClick={save} disabled={!receiptDate}>
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aperçu du reçu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4">
              <div className="mb-4 text-center">
                <h4 className="text-xl font-bold">Reçu de Transaction</h4>
                <p className="text-sm text-gray-500">
                  N°: <span className="font-medium">{receiptNumber}</span>
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <Row label="Date" value={receiptDate || "-"} />
                <Row label="Agent" value={agent || "-"} />
                <Row label="Client" value={client || "-"} />
                <Row label="Téléphone" value={phone || "-"} />
                <Row label="Opération" value={getOperationDisplayName()} />
                {getOperationDetails()}
              </div>

              <div className="mt-6 border-t pt-4 text-center">
                <div className="mb-2 flex justify-center">
                  {qrCodeError ? (
                    <div className="flex h-[100px] w-[100px] items-center justify-center border border-gray-300 bg-gray-100 text-xs text-gray-500">
                      QR Code Error
                    </div>
                  ) : (
                    <div className="relative">
                      <QRCodeSVG
                        value={createQRData()}
                        size={100}
                        level="M"
                        includeMargin={true}
                        onError={handleQRError}
                      />
                      {receiptNumber === "TRX-XXXX-XXX" && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 text-xs text-gray-500">
                          Calculez d'abord
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {receiptNumber === "TRX-XXXX-XXX"
                    ? "Scannez pour vérifier la transaction"
                    : "QR Code généré avec succès"}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={previewReceipt}
                  disabled={!receiptDate || qrCodeError}
                  className="w-full bg-transparent"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Prévisualiser
                </Button>
                <Button onClick={printReceipt} disabled={!receiptDate || qrCodeError || isPrinting} className="w-full">
                  <Printer className="mr-2 h-4 w-4" />
                  {isPrinting ? "Impression..." : "Imprimer le reçu"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section Mes Transactions à Clôturer */}
      {user && (
        <CashierPendingTransactionsByType user={user} transactionType="receipt" />
      )}

      {/* Section Reçus du jour */}
      {user && (
        <DailyOperations 
          operationType="receipt" 
          user={user} 
          title="Reçus du jour"
        />
      )}
    </div>
  )
}

function Row({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}:</span>
      <span className={bold ? "font-medium" : ""}>{value}</span>
    </div>
  )
}

function format(n: number | string | "") {
  const v = typeof n === "number" ? n : Number.parseFloat(String(n))
  if (isNaN(v)) return "0"
  return v.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
}

function num(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
}
