"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { QRCodeSVG } from "qrcode.react"
import { useToast } from "@/hooks/use-toast"
import { Calculator, Send, CheckCircle, AlertCircle, Upload, FileText, X, Eye, Printer } from "lucide-react"
import { CashierPendingTransactionsByType } from "./cashier-pending-transactions-by-type"
import { DailyOperations } from "./daily-operations"
import { getSessionClient, SessionUser } from "@/lib/auth-client"

type TransferData = {
  beneficiaryName: string
  destinationCountry: string
  destinationCity: string
  amountReceived: number
  receivedCurrency: string
  amountToSend: number
  sendCurrency: string
  withdrawalMode: "cash" | "bank_transfer"
  transferMethod: string
  ibanFile?: File
}

export function TransferView() {
  const [transferData, setTransferData] = React.useState<TransferData>({
    beneficiaryName: "",
    destinationCountry: "",
    destinationCity: "",
    amountReceived: 0,
    receivedCurrency: "XAF",
    amountToSend: 0,
    sendCurrency: "XAF",
    withdrawalMode: "cash",
    transferMethod: "",
    ibanFile: undefined
  })
  
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [transferId, setTransferId] = React.useState<string>("")
  const [qrCodeError, setQrCodeError] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const { toast } = useToast()
  
  // Récupérer l'utilisateur connecté
  const [user, setUser] = React.useState<SessionUser | null>(null)
  
  React.useEffect(() => {
    const sessionUser = getSessionClient()
    if (sessionUser) {
      setUser(sessionUser)
    }
  }, [])

  // Taux de change simulés
  const exchangeRates = {
    XAF: { USD: 0.0017, EUR: 0.0015, GBP: 0.0013 },
    USD: { XAF: 580, EUR: 0.85, GBP: 0.75 },
    EUR: { XAF: 650, USD: 1.18, GBP: 0.88 },
    GBP: { XAF: 750, USD: 1.33, EUR: 1.14 }
  }

  // Moyens de transfert disponibles
  const transferMethods = [
    "MoneyGram",
    "Ria Money Transfer", 
    "Western Union",
    "Autre"
  ]

  // Calcul automatique du montant à envoyer
  React.useEffect(() => {
    if (transferData.amountReceived > 0 && transferData.receivedCurrency && transferData.sendCurrency) {
      const rate = exchangeRates[transferData.receivedCurrency as keyof typeof exchangeRates]?.[transferData.sendCurrency as keyof typeof exchangeRates[typeof transferData.receivedCurrency]] || 1
      const calculatedAmount = transferData.amountReceived * rate
      setTransferData(prev => ({ ...prev, amountToSend: Math.round(calculatedAmount * 100) / 100 }))
    }
  }, [transferData.amountReceived, transferData.receivedCurrency, transferData.sendCurrency])

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!transferData.beneficiaryName.trim()) {
      newErrors.beneficiaryName = "Le nom du bénéficiaire est requis"
    }

    if (!transferData.destinationCountry.trim()) {
      newErrors.destinationCountry = "Le pays de destination est requis"
    }

    if (!transferData.destinationCity.trim()) {
      newErrors.destinationCity = "La ville de destination est requise"
    }

    if (!transferData.transferMethod.trim()) {
      newErrors.transferMethod = "Le moyen de transfert est requis"
    }

    if (transferData.amountReceived <= 0) {
      newErrors.amountReceived = "Le montant reçu doit être supérieur à 0"
    }

    if (transferData.amountToSend <= 0) {
      newErrors.amountToSend = "Le montant à envoyer doit être supérieur à 0"
    }

    if (transferData.withdrawalMode === "bank_transfer" && !transferData.ibanFile) {
      newErrors.ibanFile = "Le fichier IBAN est requis pour un virement bancaire"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs avant de continuer",
        variant: "destructive"
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      // Simulation d'envoi
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Génération d'un ID de transfert
      const newTransferId = `TRF-${Date.now().toString().slice(-8)}`
      setTransferId(newTransferId)
      
      // Convertir le fichier IBAN en base64 pour le stockage
      let ibanFileData = null
      if (transferData.ibanFile) {
        try {
          const arrayBuffer = await transferData.ibanFile.arrayBuffer()
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
          ibanFileData = {
            name: transferData.ibanFile.name,
            type: transferData.ibanFile.type,
            size: transferData.ibanFile.size,
            data: base64
          }
        } catch (error) {
        }
      }

       // Sauvegarder dans la base de données via l'API
       try {
         const response = await fetch('/api/transactions', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             type: "transfer",
             description: `Transfert d'argent vers ${transferData.destinationCountry}`,
             amount: transferData.amountReceived,
             currency: transferData.receivedCurrency,
             details: {
               beneficiary_name: transferData.beneficiaryName,
               destination_country: transferData.destinationCountry,
               destination_city: transferData.destinationCity,
               transfer_method: transferData.transferMethod,
               amount_received: transferData.amountReceived,
               received_currency: transferData.receivedCurrency,
               amount_sent: transferData.amountToSend,
               sent_currency: transferData.sendCurrency,
               withdrawal_mode: transferData.withdrawalMode,
               iban_file: transferData.ibanFile?.name || null,
               iban_file_data: ibanFileData
             }
           })
         })

         if (!response.ok) {
           const errorData = await response.json()
           throw new Error(errorData.error || 'Erreur lors de la sauvegarde')
         }

         const result = await response.json()
         const newTransaction = result.data
         
         // Déclencher un événement personnalisé pour notifier les autres composants
         window.dispatchEvent(new CustomEvent('transferCreated', { detail: newTransaction }))
         
       } catch (error) {
         toast({
           title: "Erreur",
           description: `Erreur lors de la sauvegarde: ${error.message}`,
           variant: "destructive"
         })
         return
       }
      
        toast({
          title: "Transfert soumis avec succès",
          description: `Le transfert ${newTransferId} a été soumis et est en attente de validation par l'auditeur`,
        })

      // Réinitialisation du formulaire
      setTransferData({
        beneficiaryName: "",
        destinationCountry: "",
        destinationCity: "",
        transferMethod: "",
        amountReceived: 0,
        receivedCurrency: "XAF",
        amountToSend: 0,
        sendCurrency: "XAF",
        withdrawalMode: "cash",
        ibanFile: undefined
      })
      
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi du transfert",
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Liste complète des pays couverts par Western Union, Ria et MoneyGram
  const countries = [
    // Afrique
    "Afrique du Sud", "Algérie", "Angola", "Bénin", "Botswana", "Burkina Faso", "Burundi",
    "Cameroun", "Cap-Vert", "Centrafrique", "Tchad", "Comores", "Congo", "RDC", "Côte d'Ivoire",
    "Djibouti", "Égypte", "Érythrée", "Eswatini", "Éthiopie", "Gabon", "Gambie", "Ghana",
    "Guinée", "Guinée-Bissau", "Guinée équatoriale", "Kenya", "Lesotho", "Liberia", "Libye",
    "Madagascar", "Malawi", "Mali", "Maroc", "Maurice", "Mauritanie", "Mozambique", "Namibie",
    "Niger", "Nigeria", "Ouganda", "Rwanda", "São Tomé-et-Príncipe", "Sénégal", "Seychelles",
    "Sierra Leone", "Somalie", "Soudan", "Soudan du Sud", "Tanzanie", "Togo", "Tunisie",
    "Zambie", "Zimbabwe",
    // Amérique du Nord
    "Canada", "États-Unis", "Mexique", "Guatemala", "Belize", "El Salvador", "Honduras",
    "Nicaragua", "Costa Rica", "Panama", "Cuba", "Jamaïque", "Haïti", "République dominicaine",
    "Trinité-et-Tobago", "Barbade", "Bahamas", "Antigua-et-Barbuda", "Dominique", "Grenade",
    "Saint-Kitts-et-Nevis", "Sainte-Lucie", "Saint-Vincent-et-les-Grenadines",
    // Amérique du Sud
    "Argentine", "Bolivie", "Brésil", "Chili", "Colombie", "Équateur", "Guyane", "Guyane française",
    "Paraguay", "Pérou", "Suriname", "Uruguay", "Venezuela",
    // Asie
    "Afghanistan", "Arabie saoudite", "Arménie", "Azerbaïdjan", "Bahreïn", "Bangladesh", "Bhoutan",
    "Birmanie", "Brunei", "Cambodge", "Chine", "Corée du Nord", "Corée du Sud", "Émirats arabes unis",
    "Géorgie", "Inde", "Indonésie", "Irak", "Iran", "Israël", "Japon", "Jordanie", "Kazakhstan",
    "Kirghizistan", "Koweït", "Laos", "Liban", "Malaisie", "Maldives", "Mongolie", "Népal",
    "Oman", "Ouzbékistan", "Pakistan", "Palestine", "Philippines", "Qatar", "Singapour", "Sri Lanka",
    "Syrie", "Tadjikistan", "Taïwan", "Thaïlande", "Timor oriental", "Turkménistan", "Turquie",
    "Viêt Nam", "Yémen",
    // Europe
    "Albanie", "Allemagne", "Andorre", "Autriche", "Biélorussie", "Belgique", "Bosnie-Herzégovine",
    "Bulgarie", "Chypre", "Croatie", "Danemark", "Espagne", "Estonie", "Finlande", "France",
    "Grèce", "Hongrie", "Irlande", "Islande", "Italie", "Lettonie", "Liechtenstein", "Lituanie",
    "Luxembourg", "Macédoine du Nord", "Malte", "Moldavie", "Monaco", "Monténégro", "Norvège",
    "Pays-Bas", "Pologne", "Portugal", "République tchèque", "Roumanie", "Royaume-Uni", "Russie",
    "Saint-Marin", "Serbie", "Slovaquie", "Slovénie", "Suède", "Suisse", "Ukraine", "Vatican",
    // Océanie
    "Australie", "Fidji", "Kiribati", "Marshall", "Micronésie", "Nauru", "Nouvelle-Zélande",
    "Palaos", "Papouasie-Nouvelle-Guinée", "Samoa", "Salomon", "Tonga", "Tuvalu", "Vanuatu"
  ].sort()

  // Liste complète des devises les plus répandues
  const currencies = [
    "XAF", "USD", "EUR", "GBP", "JPY", "CNY", "AUD", "CAD", "CHF", "HKD", "SGD", "NZD",
    "INR", "BRL", "MXN", "ZAR", "TRY", "RUB", "KRW", "SEK", "NOK", "DKK", "PLN", "THB",
    "MYR", "PHP", "IDR", "VND", "EGP", "NGN", "KES", "GHS", "ETB", "TZS", "UGX", "MAD",
    "TND", "DZD", "XOF", "XPF", "ARS", "CLP", "COP", "PEN", "UYU", "PYG", "BOB", "VES",
    "ILS", "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD", "LBP", "IQD", "IRR", "AFN",
    "PKR", "BDT", "LKR", "NPR", "MMK", "KHR", "LAK", "MNT", "KZT", "UZS", "TJS", "TMT",
    "AZN", "AMD", "GEL", "BYN", "MDL", "BGN", "RON", "RSD", "BAM", "MKD", "ALL", "HRK",
    "ISK", "CZK", "HUF"
  ].sort()

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Vérifier le type de fichier (PDF, images, etc.)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Type de fichier non supporté",
          description: "Veuillez sélectionner un fichier PDF ou une image (JPG, PNG)",
          variant: "destructive"
        })
        return
      }
      
      // Vérifier la taille du fichier (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Fichier trop volumineux",
          description: "La taille du fichier ne doit pas dépasser 5MB",
          variant: "destructive"
        })
        return
      }
      
      setTransferData(prev => ({ ...prev, ibanFile: file }))
      setErrors(prev => ({ ...prev, ibanFile: undefined }))
    }
  }

  const removeFile = () => {
    setTransferData(prev => ({ ...prev, ibanFile: undefined }))
  }

  // Fonctions pour l'aperçu du reçu
  const generateTransferId = () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `TRF-${dateStr}-${timeStr}-${random}`
  }

  const createQRData = () => {
    const transferId = generateTransferId()
    return JSON.stringify({
      id: transferId,
      type: "transfer",
      beneficiary: transferData.beneficiaryName,
      destination: `${transferData.destinationCity}, ${transferData.destinationCountry}`,
      amountReceived: transferData.amountReceived,
      receivedCurrency: transferData.receivedCurrency,
      amountToSend: transferData.amountToSend,
      sendCurrency: transferData.sendCurrency,
      withdrawalMode: transferData.withdrawalMode,
      transferMethod: transferData.transferMethod,
      date: new Date().toISOString(),
      agent: user?.name || "Agent"
    })
  }

  const handleQRError = () => {
    setQrCodeError(true)
  }

  const previewReceipt = async () => {
    const qrData = createQRData()
    const transferId = generateTransferId()
    
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
    
    const receiptHTML = generateReceiptHTML(qrCodeDataURL, transferId)
    
    const printWindow = window.open('', '_blank', 'width=600,height=800')
    if (printWindow) {
      printWindow.document.write(receiptHTML)
      printWindow.document.close()
    }
  }

  const generateReceiptHTML = (qrCodeDataURL: string, transferId: string) => {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Reçu de Transfert - ${transferId}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace;
              margin: 0; padding: 20px;
              background: white; color: #000; line-height: 1.4;
            }
            .receipt { 
              max-width: 400px; margin: 0 auto; 
              border: 2px solid #000; padding: 20px; background: white;
            }
            .header { 
              text-align: center; margin-bottom: 20px;
              border-bottom: 1px dashed #000; padding-bottom: 15px;
            }
            .logo { 
              font-size: 18px; font-weight: bold; margin-bottom: 8px;
              text-transform: uppercase;
            }
            .receipt-title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
            .receipt-number {
              font-size: 14px; font-weight: bold; background: #f0f0f0;
              padding: 5px; border: 1px solid #000;
            }
            .row { 
              display: flex; justify-content: space-between; 
              margin: 8px 0; padding: 2px 0;
            }
            .row.total {
              border-top: 1px solid #000; border-bottom: 1px solid #000;
              font-weight: bold; margin-top: 10px; padding: 8px 0;
            }
            .qrcode-section { 
              text-align: center; margin: 20px 0;
              border-top: 1px dashed #000; padding-top: 15px;
            }
            .qrcode-container {
              display: inline-block; border: 1px solid #000;
              padding: 10px; background: white;
            }
            .footer { 
              text-align: center; font-size: 11px; color: #666; 
              margin-top: 20px; border-top: 1px dashed #000; padding-top: 15px;
            }
            .timestamp { font-size: 10px; color: #888; margin-top: 10px; }
            @media print {
              body { margin: 0; padding: 10px; }
              .receipt { border: 2px solid #000; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div class="logo">ZOLL TAX FOREX</div>
              <div class="receipt-title">Reçu de Transfert d'Argent</div>
              <div class="receipt-number">${transferId}</div>
            </div>
            
            <div class="transaction-details">
              <div class="row">
                <span>Date:</span>
                <span>${new Date().toLocaleDateString("fr-FR")}</span>
              </div>
              <div class="row">
                <span>Agent:</span>
                <span>${user?.name || "-"}</span>
              </div>
              <div class="row">
                <span>Bénéficiaire:</span>
                <span>${transferData.beneficiaryName || "-"}</span>
              </div>
              <div class="row">
                <span>Destination:</span>
                <span>${transferData.destinationCity}, ${transferData.destinationCountry}</span>
              </div>
              <div class="row">
                <span>Moyen de transfert:</span>
                <span>${transferData.transferMethod || "-"}</span>
              </div>
              <div class="row">
                <span>Montant reçu:</span>
                <span>${transferData.amountReceived.toLocaleString("fr-FR")} ${transferData.receivedCurrency}</span>
              </div>
              <div class="row">
                <span>Montant envoyé:</span>
                <span>${transferData.amountToSend.toLocaleString("fr-FR")} ${transferData.sendCurrency}</span>
              </div>
              <div class="row">
                <span>Mode de retrait:</span>
                <span>${transferData.withdrawalMode === "cash" ? "Espèces" : "Virement bancaire"}</span>
              </div>
              <div class="row total">
                <span>Montant total:</span>
                <span>${transferData.amountReceived.toLocaleString("fr-FR")} ${transferData.receivedCurrency}</span>
              </div>
            </div>
            
            <div class="qrcode-section">
              <div class="qrcode-container">
                ${qrCodeDataURL 
                  ? `<img src="${qrCodeDataURL}" alt="QR Code" style="width: 120px; height: 120px;" />`
                  : `<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>`
                }
              </div>
              <div style="font-size: 11px; margin-top: 8px; font-style: italic;">
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
          </script>
        </body>
      </html>
    `
  }

  const printReceipt = async () => {
    if (!transferData.beneficiaryName || !transferData.destinationCountry) {
      toast({
        title: "Données manquantes",
        description: "Veuillez remplir tous les champs obligatoires avant d'imprimer le reçu",
        variant: "destructive"
      })
      return
    }

    setIsPrinting(true)
    try {
      await previewReceipt()
      // Attendre un peu pour que la fenêtre se charge
      setTimeout(() => {
        setIsPrinting(false)
      }, 1000)
    } catch (error) {
      setIsPrinting(false)
      toast({
        title: "Erreur d'impression",
        description: "Une erreur est survenue lors de l'impression du reçu",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Transfert d'Argent</h2>
          <p className="text-gray-600 mt-1">Effectuer un transfert d'argent vers l'étranger</p>
        </div>
        {transferId && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Transfert {transferId} créé</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulaire principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Informations du Transfert
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Informations du bénéficiaire */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Bénéficiaire</h3>
              
              <div>
                <Label htmlFor="beneficiaryName">Nom(s) et Prénom(s) *</Label>
                <Input
                  id="beneficiaryName"
                  value={transferData.beneficiaryName}
                  onChange={(e) => setTransferData(prev => ({ ...prev, beneficiaryName: e.target.value }))}
                  placeholder="Ex: Jean Dupont"
                  className={errors.beneficiaryName ? "border-red-500" : ""}
                />
                {errors.beneficiaryName && (
                  <p className="text-sm text-red-600 mt-1">{errors.beneficiaryName}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="destinationCountry">Pays de destination *</Label>
                  <Select
                    value={transferData.destinationCountry}
                    onValueChange={(value) => setTransferData(prev => ({ ...prev, destinationCountry: value }))}
                  >
                    <SelectTrigger className={errors.destinationCountry ? "border-red-500" : ""}>
                      <SelectValue placeholder="Sélectionner un pays" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map(country => (
                        <SelectItem key={country} value={country}>{country}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.destinationCountry && (
                    <p className="text-sm text-red-600 mt-1">{errors.destinationCountry}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="destinationCity">Ville de destination *</Label>
                  <Input
                    id="destinationCity"
                    value={transferData.destinationCity}
                    onChange={(e) => setTransferData(prev => ({ ...prev, destinationCity: e.target.value }))}
                    placeholder="Ex: Paris"
                    className={errors.destinationCity ? "border-red-500" : ""}
                  />
                  {errors.destinationCity && (
                    <p className="text-sm text-red-600 mt-1">{errors.destinationCity}</p>
                  )}
                </div>
              </div>

              {/* Moyen de transfert */}
              <div>
                <Label htmlFor="transferMethod">Moyen de transfert *</Label>
                <Select
                  value={transferData.transferMethod}
                  onValueChange={(value) => setTransferData(prev => ({ ...prev, transferMethod: value }))}
                >
                  <SelectTrigger className={errors.transferMethod ? "border-red-500" : ""}>
                    <SelectValue placeholder="Sélectionner un moyen de transfert" />
                  </SelectTrigger>
                  <SelectContent>
                    {transferMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.transferMethod && (
                  <p className="text-sm text-red-600 mt-1">{errors.transferMethod}</p>
                )}
              </div>
            </div>

            {/* Montants */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Montants</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amountReceived">Montant reçu *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="amountReceived"
                      type="number"
                      value={transferData.amountReceived || ""}
                      onChange={(e) => setTransferData(prev => ({ ...prev, amountReceived: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className={errors.amountReceived ? "border-red-500" : ""}
                    />
                    <Select
                      value={transferData.receivedCurrency}
                      onValueChange={(value) => setTransferData(prev => ({ ...prev, receivedCurrency: value }))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(currency => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.amountReceived && (
                    <p className="text-sm text-red-600 mt-1">{errors.amountReceived}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="amountToSend">Montant à envoyer *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="amountToSend"
                      type="number"
                      value={transferData.amountToSend || ""}
                      onChange={(e) => setTransferData(prev => ({ ...prev, amountToSend: Number(e.target.value) || 0 }))}
                      placeholder="0"
                      className={errors.amountToSend ? "border-red-500" : ""}
                    />
                    <Select
                      value={transferData.sendCurrency}
                      onValueChange={(value) => setTransferData(prev => ({ ...prev, sendCurrency: value }))}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(currency => (
                          <SelectItem key={currency} value={currency}>{currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.amountToSend && (
                    <p className="text-sm text-red-600 mt-1">{errors.amountToSend}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Mode de retrait */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Mode de retrait</h3>
              
              <RadioGroup
                value={transferData.withdrawalMode}
                onValueChange={(value) => setTransferData(prev => ({ ...prev, withdrawalMode: value as "cash" | "bank_transfer" }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="cash" id="cash" />
                  <Label htmlFor="cash">Espèces</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                  <Label htmlFor="bank_transfer">Virement bancaire</Label>
                </div>
              </RadioGroup>

              {transferData.withdrawalMode === "bank_transfer" && (
                <div>
                  <Label htmlFor="ibanFile">Fichier IBAN *</Label>
                  <div className="space-y-2">
                    {!transferData.ibanFile ? (
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <input
                          type="file"
                          id="ibanFile"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <label htmlFor="ibanFile" className="cursor-pointer">
                          <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600 mb-1">
                            Cliquez pour joindre le fichier IBAN
                          </p>
                          <p className="text-xs text-gray-500">
                            PDF, JPG, PNG (max 5MB)
                          </p>
                        </label>
                      </div>
                    ) : (
                      <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {transferData.ibanFile.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {(transferData.ibanFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeFile}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {errors.ibanFile && (
                      <p className="text-sm text-red-600">{errors.ibanFile}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Effectuer le transfert
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Aperçu du reçu */}
        <Card>
          <CardHeader>
            <CardTitle>Aperçu du reçu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border p-4">
              <div className="mb-4 text-center">
                <h4 className="text-xl font-bold">Reçu de Transfert d'Argent</h4>
                <p className="text-sm text-gray-500">
                  N°: <span className="font-medium">{generateTransferId()}</span>
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span>{new Date().toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Agent:</span>
                  <span>{user?.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bénéficiaire:</span>
                  <span>{transferData.beneficiaryName || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Destination:</span>
                  <span>{transferData.destinationCity && transferData.destinationCountry 
                    ? `${transferData.destinationCity}, ${transferData.destinationCountry}`
                    : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Moyen de transfert:</span>
                  <span>{transferData.transferMethod || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant reçu:</span>
                  <span>{transferData.amountReceived > 0 
                    ? `${transferData.amountReceived.toLocaleString("fr-FR")} ${transferData.receivedCurrency}`
                    : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant envoyé:</span>
                  <span>{transferData.amountToSend > 0 
                    ? `${transferData.amountToSend.toLocaleString("fr-FR")} ${transferData.sendCurrency}`
                    : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mode de retrait:</span>
                  <span>{transferData.withdrawalMode === "cash" ? "Espèces" : "Virement bancaire"}</span>
                </div>
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
                      {!transferData.beneficiaryName && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 text-xs text-gray-500">
                          Remplissez d'abord
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {!transferData.beneficiaryName
                    ? "Scannez pour vérifier la transaction"
                    : "QR Code généré avec succès"}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={previewReceipt}
                  disabled={!transferData.beneficiaryName || qrCodeError}
                  className="w-full bg-transparent"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Prévisualiser
                </Button>
                <Button 
                  onClick={printReceipt} 
                  disabled={!transferData.beneficiaryName || qrCodeError || isPrinting} 
                  className="w-full"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {isPrinting ? "Impression..." : "Imprimer le reçu"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Section des transactions en attente pour les caissiers */}
      {user && (
        <CashierPendingTransactionsByType user={user} transactionType="transfer" />
      )}

      {/* Section Opérations du jour */}
      {user && (
        <DailyOperations 
          operationType="transfer" 
          user={user} 
        />
      )}
    </div>
    )
  }
