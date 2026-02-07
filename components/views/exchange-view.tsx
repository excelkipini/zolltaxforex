"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeSVG } from "qrcode.react"
import { exchangeSchema, zodToFieldErrors, type FieldErrors } from "@/lib/validation"
import { useToast } from "@/hooks/use-toast"
import { Eye, Printer, Calculator, Save, RotateCcw, User, CreditCard, Phone, ArrowRightLeft, Banknote, TrendingUp, TrendingDown } from "lucide-react"
import { DailyOperations } from "./daily-operations"
import { getSessionClient, SessionUser } from "@/lib/auth-client"
import { Badge } from "@/components/ui/badge"
import { printExchangeReceipt, generateReceiptId, type ExchangeReceiptData } from "@/lib/exchange-receipts"

// Types de pièces d'identité
const ID_TYPES = [
  { value: "passport", label: "Passeport" },
  { value: "cni", label: "Carte d'identité nationale" },
  { value: "niu", label: "NIU (Numéro d'Identification Unique)" },
  { value: "permis", label: "Permis de conduire" },
] as const

type IdType = typeof ID_TYPES[number]["value"]

export function ExchangeView({
  buyRates = { USD: 569, EUR: 693, GBP: 800 },
  sellRates = { USD: 575, EUR: 700, GBP: 810 },
  commissionPercent = 1.0,
}: {
  buyRates?: { USD: number; EUR: number; GBP: number }
  sellRates?: { USD: number; EUR: number; GBP: number }
  commissionPercent?: number
}) {
  const { toast } = useToast()
  const [type, setType] = React.useState<"buy" | "sell">("buy")
  const [cur, setCur] = React.useState<"USD" | "EUR" | "GBP">("USD")
  const [client, setClient] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [idType, setIdType] = React.useState<IdType | "">("")
  const [idNumber, setIdNumber] = React.useState("")
  const [xaf, setXaf] = React.useState<number | "">("")
  const [foreign, setForeign] = React.useState<number | "">("")
  const [commission, setCommission] = React.useState(0)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [qrCodeError, setQrCodeError] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [lastEditedField, setLastEditedField] = React.useState<"xaf" | "foreign" | null>(null)
  
  // Récupérer l'utilisateur connecté
  const [user, setUser] = React.useState<SessionUser | null>(null)
  
  React.useEffect(() => {
    const sessionUser = getSessionClient()
    if (sessionUser) {
      setUser(sessionUser)
    }
  }, [])

  // Sélectionner le taux approprié selon le type d'opération
  // type "buy" = nous achetons les devises du client -> utiliser buyRates
  // type "sell" = nous vendons des devises au client -> utiliser sellRates
  const currentRates = type === "buy" ? buyRates : sellRates
  const rate = cur === "USD" ? currentRates.USD : cur === "EUR" ? currentRates.EUR : currentRates.GBP
  // commissionPercent vient de la base de données comme un pourcentage (ex: 1.5 = 1.5%)
  // Utiliser ?? au lieu de || pour permettre 0% comme valeur valide
  const commissionRate = commissionPercent ?? 0
  const k = Math.max(0, Number(commissionRate)) / 100 // commission rate (0..1)

  function validateOrSetErrors(atSave = false) {
    setErrors({})
    const payload = {
      type,
      cur,
      xaf: typeof xaf === "number" ? xaf : undefined,
      foreign: typeof foreign === "number" ? foreign : undefined,
    }
    try {
      exchangeSchema.parse(payload)
      return { ok: true as const }
    } catch (e) {
      const fe = zodToFieldErrors(e)
      // When the "at least one field" error lands on xaf, also reflect on foreign for clarity
      if (fe.xaf && !payload.foreign) {
        fe.foreign = fe.foreign ?? fe.xaf
      }
      setErrors(fe)
      if (atSave && fe.form) alert(fe.form)
      return { ok: false as const }
    }
  }

  // Calcul automatique basé sur le dernier champ modifié
  const performCalculation = React.useCallback((fromField: "xaf" | "foreign" | null, xafVal: number | "", foreignVal: number | "") => {
    let lxaf = typeof xafVal === "number" ? xafVal : Number.NaN
    let lfor = typeof foreignVal === "number" ? foreignVal : Number.NaN

    if (type === "buy") {
      // Client vend des devises -> nous achetons la devise; XAF = lfor * rate (montant brut)
      if (fromField === "foreign" && Number.isFinite(lfor)) {
        lxaf = lfor * rate
        setXaf(Number(lxaf.toFixed(0)))
      } else if (fromField === "xaf" && Number.isFinite(lxaf)) {
        lfor = lxaf / rate
        setForeign(Number(lfor.toFixed(2)))
      }
      const c = Math.round((lxaf || 0) * k)
      setCommission(c)
    } else {
      // "sell": nous vendons la devise au client; net XAF = (lfor * rate) * (1 - k)
      if (fromField === "foreign" && Number.isFinite(lfor)) {
        const gross = lfor * rate
        const c = Math.round(gross * k)
        const net = Math.max(0, Math.round(gross - c))
        setCommission(c)
        setXaf(net)
      } else if (fromField === "xaf" && Number.isFinite(lxaf)) {
        // net = gross * (1 - k) => gross = net / (1 - k), foreign = gross / rate
        const gross = (lxaf || 0) / Math.max(0.000001, 1 - k)
        const c = Math.round(gross * k)
        const f = gross / rate
        setCommission(c)
        setForeign(Number(f.toFixed(2)))
      }
    }
  }, [type, rate, k])

  // Effet pour le calcul automatique
  React.useEffect(() => {
    if (lastEditedField) {
      const timeoutId = setTimeout(() => {
        performCalculation(lastEditedField, xaf, foreign)
      }, 300) // Debounce de 300ms
      return () => clearTimeout(timeoutId)
    }
  }, [xaf, foreign, lastEditedField, performCalculation])

  // Recalculer quand le type ou la devise change
  React.useEffect(() => {
    if (typeof xaf === "number" || typeof foreign === "number") {
      performCalculation(lastEditedField || "xaf", xaf, foreign)
    }
  }, [type, cur])

  function calculate() {
    const v = validateOrSetErrors(false)
    if (!v.ok) return
    performCalculation(lastEditedField || (typeof foreign === "number" ? "foreign" : "xaf"), xaf, foreign)
  }

  const save = async () => {
    // Validation des champs obligatoires
    const newErrors: FieldErrors = {}
    
    // Vérifier qu'une agence est disponible
    if (!user?.agency) {
      toast({
        title: "Agence non configurée",
        description: "Votre compte n'a pas d'agence assignée. Contactez l'administrateur.",
        variant: "destructive"
      })
      return
    }
    
    if (!client.trim()) {
      newErrors.client = "Le nom du client est requis"
    }
    
    if (!idType) {
      newErrors.idType = "Le type de pièce d'identité est requis"
    }
    
    if (!idNumber.trim()) {
      newErrors.idNumber = "Le numéro de pièce d'identité est requis"
    }
    
    const lxaf = typeof xaf === "number" ? xaf : Number.NaN
    if (!Number.isFinite(lxaf) || lxaf <= 0) {
      newErrors.xaf = "Montant XAF requis et > 0"
    }
    
    const lfor = typeof foreign === "number" ? foreign : Number.NaN
    if (!Number.isFinite(lfor) || lfor <= 0) {
      newErrors.foreign = "Montant devise requis et > 0"
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast({
        title: "Formulaire incomplet",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      })
      return
    }
    
    setIsSaving(true)
    
    try {
      // Génération d'un ID de transaction
      const newTransactionId = `EXC-${Date.now().toString().slice(-8)}`
      
      // Trouver le label du type de pièce d'identité
      const idTypeLabel = ID_TYPES.find(t => t.value === idType)?.label || idType
      
      // Sauvegarder dans la base de données via l'API
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: "exchange",
          description: `Change ${cur} - ${type === "buy" ? "Achat" : "Vente"} - ${client}`,
          amount: lxaf,
          currency: "XAF",
          details: {
            exchange_type: type,
            client_name: client,
            client_phone: phone || null,
            client_id_type: idType,
            client_id_type_label: idTypeLabel,
            client_id_number: idNumber,
            from_currency: type === "buy" ? cur : "XAF",
            to_currency: type === "buy" ? "XAF" : cur,
            exchange_rate: rate,
            amount_xaf: lxaf,
            amount_foreign: typeof foreign === "number" ? foreign : 0,
            commission: commission,
            agency_name: user?.agency || null
          }
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la sauvegarde')
      }

      const result = await response.json()
      const savedTransaction = result.data
      
      // Déclencher un événement personnalisé pour notifier les autres composants
      window.dispatchEvent(new CustomEvent('exchangeCreated', { detail: savedTransaction }))
      
      // Imprimer le reçu automatiquement
      const receiptData: ExchangeReceiptData = {
        type: type === "buy" ? "change_achat" : "change_vente",
        receiptId: generateReceiptId("EXC"),
        date: new Date().toLocaleString("fr-FR"),
        agent: user?.name || "—",
        clientName: client,
        clientPhone: phone || undefined,
        clientIdType: idTypeLabel,
        clientIdNumber: idNumber,
        operationType: type === "buy" ? "Achat devise" : "Vente devise",
        currency: cur,
        amountForeign: typeof foreign === "number" ? foreign : 0,
        amountXaf: lxaf,
        exchangeRate: rate,
        commission,
      }
      printExchangeReceipt(receiptData)
      
      toast({
        title: "Transaction enregistrée",
        description: `L'opération de change ${newTransactionId} a été soumise avec succès`,
      })

      // Reset form
      resetForm()
      
    } catch (error: any) {
      const errorMsg = error.message || "Une erreur est survenue lors de l'enregistrement"
      
      // Déterminer le titre et la description selon le type d'erreur
      let title = "Erreur"
      let description = errorMsg
      
      if (errorMsg.includes("Solde XAF insuffisant")) {
        title = "Solde insuffisant"
        description = `La caisse de votre agence n'a pas assez de XAF pour cette opération. ${errorMsg.includes("Disponible:") ? errorMsg.split("Disponible:")[1].trim() : "Demandez un approvisionnement."}`
      } else if (errorMsg.includes("Solde") && errorMsg.includes("insuffisant")) {
        title = "Solde insuffisant"
        description = `La caisse de votre agence n'a pas assez de devises pour cette opération. ${errorMsg}`
      } else if (errorMsg.includes("Agence") && errorMsg.includes("non trouvée")) {
        title = "Agence introuvable"
        description = "Votre agence n'est pas configurée correctement dans le système. Contactez l'administrateur."
      } else if (errorMsg.includes("Aucune agence")) {
        title = "Agence non assignée"
        description = "Vous devez être assigné à une agence pour effectuer des opérations de change."
      } else if (errorMsg.includes("permission") || errorMsg.includes("Permission") || errorMsg.includes("403")) {
        title = "Accès refusé"
        description = "Vous n'avez pas les permissions nécessaires pour effectuer cette opération."
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  const resetForm = () => {
    setClient("")
    setPhone("")
    setIdType("")
    setIdNumber("")
    setXaf("")
    setForeign("")
    setCommission(0)
    setErrors({})
    setLastEditedField(null)
  }

  // Fonctions pour l'aperçu du reçu
  const generateExchangeId = () => {
    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '')
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    return `EXC-${dateStr}-${timeStr}-${random}`
  }

  const createQRData = () => {
    const exchangeId = generateExchangeId()
    const idTypeLabel = ID_TYPES.find(t => t.value === idType)?.label || idType
    return JSON.stringify({
      id: exchangeId,
      type: "exchange",
      exchangeType: type,
      client: client,
      clientPhone: phone || null,
      clientIdType: idTypeLabel,
      clientIdNumber: idNumber,
      fromCurrency: type === "buy" ? cur : "XAF",
      toCurrency: type === "buy" ? "XAF" : cur,
      exchangeRate: rate,
      amountXAF: typeof xaf === "number" ? xaf : 0,
      amountForeign: typeof foreign === "number" ? foreign : 0,
      commission: commission,
      date: new Date().toISOString(),
      agent: user?.name || "Agent"
    })
  }

  const handleQRError = () => {
    setQrCodeError(true)
  }

  const previewReceipt = async () => {
    const qrData = createQRData()
    const exchangeId = generateExchangeId()
    
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
    
    const receiptHTML = generateReceiptHTML(qrCodeDataURL, exchangeId)
    
    const printWindow = window.open('', '_blank', 'width=600,height=800')
    if (printWindow) {
      printWindow.document.write(receiptHTML)
      printWindow.document.close()
    }
  }

  const generateReceiptHTML = (qrCodeDataURL: string, exchangeId: string) => {
    return `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Reçu d'Échange - ${exchangeId}</title>
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
              <div class="receipt-title">Reçu d'Échange de Devise</div>
              <div class="receipt-number">${exchangeId}</div>
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
                <span>Client:</span>
                <span>${client || "-"}</span>
              </div>
              ${phone ? `<div class="row">
                <span>Téléphone:</span>
                <span>${phone}</span>
              </div>` : ""}
              <div class="row">
                <span>Pièce d'identité:</span>
                <span>${ID_TYPES.find(t => t.value === idType)?.label || "-"}</span>
              </div>
              <div class="row">
                <span>N° Pièce:</span>
                <span>${idNumber || "-"}</span>
              </div>
              <div class="row">
                <span>Type d'opération:</span>
                <span>${type === "buy" ? "Achat devise" : "Vente devise"}</span>
              </div>
              <div class="row">
                <span>Devise:</span>
                <span>${cur}</span>
              </div>
              <div class="row">
                <span>Taux appliqué:</span>
                <span>1 ${cur} = ${rate} XAF</span>
              </div>
              <div class="row">
                <span>Montant XAF:</span>
                <span>${typeof xaf === "number" ? xaf.toLocaleString("fr-FR") : 0} XAF</span>
              </div>
              <div class="row">
                <span>Montant ${cur}:</span>
                <span>${typeof foreign === "number" ? foreign.toLocaleString("fr-FR") : 0} ${cur}</span>
              </div>
              <div class="row">
                <span>Commission:</span>
                <span>${commission.toLocaleString("fr-FR")} XAF</span>
              </div>
              <div class="row total">
                <span>Montant total:</span>
                <span>${typeof xaf === "number" ? xaf.toLocaleString("fr-FR") : 0} XAF</span>
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
    if (!client || typeof xaf !== "number" || typeof foreign !== "number") {
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

  // Vérifier si le formulaire est valide pour l'impression
  const isFormValidForPrint = client && idType && idNumber && typeof xaf === "number" && typeof foreign === "number"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Bureau de change</h2>
          <p className="text-sm text-muted-foreground mt-1">Gérez vos opérations d'achat et de vente de devises</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <ArrowRightLeft className="h-3 w-3 mr-1" />
          {type === "buy" ? "Achat" : "Vente"} {cur}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-0 shadow-lg">
          <CardHeader className="pb-4 border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Banknote className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Nouvelle opération de change</CardTitle>
                <CardDescription>Remplissez les informations pour créer une transaction</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {/* Taux de change actuels - Deux compartiments : Achat et Vente */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Taux de change actuels
                </h3>
                <Badge variant="secondary" className="text-xs font-medium">
                  Mis à jour aujourd'hui
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Taux d'achat - Vert */}
                <div className={`relative overflow-hidden rounded-xl border-2 p-4 shadow-sm transition-all duration-200 ${
                  type === "buy" 
                    ? "border-emerald-400 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 ring-2 ring-emerald-200 dark:border-emerald-600 dark:from-emerald-950/50 dark:via-green-950/50 dark:to-teal-950/50 dark:ring-emerald-800" 
                    : "border-emerald-200 bg-gradient-to-br from-emerald-50/50 via-green-50/50 to-teal-50/50 opacity-75 dark:border-emerald-800/50 dark:from-emerald-950/20 dark:via-green-950/20 dark:to-teal-950/20"
                }`}>
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-100/50 dark:bg-emerald-800/20"></div>
                  <div className="relative">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
                        <TrendingUp className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-100">Taux d'achat</h4>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Nous achetons vos devises</p>
                      </div>
                      {type === "buy" && <Badge className="ml-auto bg-emerald-600 text-[10px]">Actif</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["USD", "EUR", "GBP"] as const).map((currency) => (
                        <div key={currency} className={`rounded-lg bg-white/80 p-2 text-center shadow-sm backdrop-blur-sm dark:bg-emerald-900/30 ${
                          cur === currency && type === "buy" ? "ring-2 ring-emerald-400" : ""
                        }`}>
                          <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">{currency}</div>
                          <div className="text-lg font-bold tabular-nums text-emerald-900 dark:text-emerald-50">{buyRates[currency]}</div>
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400">XAF</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Taux de vente - Bleu */}
                <div className={`relative overflow-hidden rounded-xl border-2 p-4 shadow-sm transition-all duration-200 ${
                  type === "sell" 
                    ? "border-blue-400 bg-gradient-to-br from-blue-50 via-indigo-50 to-sky-50 ring-2 ring-blue-200 dark:border-blue-600 dark:from-blue-950/50 dark:via-indigo-950/50 dark:to-sky-950/50 dark:ring-blue-800" 
                    : "border-blue-200 bg-gradient-to-br from-blue-50/50 via-indigo-50/50 to-sky-50/50 opacity-75 dark:border-blue-800/50 dark:from-blue-950/20 dark:via-indigo-950/20 dark:to-sky-950/20"
                }`}>
                  <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-blue-100/50 dark:bg-blue-800/20"></div>
                  <div className="relative">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
                        <TrendingDown className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-blue-900 dark:text-blue-100">Taux de vente</h4>
                        <p className="text-[10px] text-blue-600 dark:text-blue-400">Nous vendons des devises</p>
                      </div>
                      {type === "sell" && <Badge className="ml-auto bg-blue-600 text-[10px]">Actif</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["USD", "EUR", "GBP"] as const).map((currency) => (
                        <div key={currency} className={`rounded-lg bg-white/80 p-2 text-center shadow-sm backdrop-blur-sm dark:bg-blue-900/30 ${
                          cur === currency && type === "sell" ? "ring-2 ring-blue-400" : ""
                        }`}>
                          <div className="text-[10px] font-semibold text-blue-700 dark:text-blue-300">{currency}</div>
                          <div className="text-lg font-bold tabular-nums text-blue-900 dark:text-blue-50">{sellRates[currency]}</div>
                          <div className="text-[10px] text-blue-600 dark:text-blue-400">XAF</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section Type d'opération */}
            <div className="rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-900/30">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                Type d'opération
              </h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Type de transaction</Label>
                  <Select value={type} onValueChange={(v: "buy" | "sell") => setType(v)}>
                    <SelectTrigger className={`${type === "buy" ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30" : "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30"}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="buy">
                        <span className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-emerald-600" />
                          Achat devise (client vend)
                        </span>
                      </SelectItem>
                      <SelectItem value="sell">
                        <span className="flex items-center gap-2">
                          <TrendingDown className="h-4 w-4 text-blue-600" />
                          Vente devise (client achète)
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.type && <p className="text-xs text-red-600">{errors.type}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Devise</Label>
                  <Select value={cur} onValueChange={(v: "USD" | "EUR" | "GBP") => setCur(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">🇺🇸</span>
                          USD - Dollar américain
                        </span>
                      </SelectItem>
                      <SelectItem value="EUR">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">🇪🇺</span>
                          EUR - Euro
                        </span>
                      </SelectItem>
                      <SelectItem value="GBP">
                        <span className="flex items-center gap-2">
                          <span className="text-lg">🇬🇧</span>
                          GBP - Livre sterling
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.cur && <p className="text-xs text-red-600">{errors.cur}</p>}
                </div>
              </div>
            </div>

            {/* Section Informations client */}
            <div className="rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-900/30">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Informations du client
              </h4>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Nom complet du client <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className={`pl-9 ${errors.client ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      placeholder="Ex: Jean Dupont"
                      value={client} 
                      onChange={(e) => {
                        setClient(e.target.value)
                        if (errors.client) setErrors((p) => ({ ...p, client: undefined }))
                      }} 
                    />
                  </div>
                  {errors.client && <p className="text-xs text-red-600">{errors.client}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Téléphone <span className="text-muted-foreground text-[10px]">(optionnel)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-9"
                      placeholder="Ex: +237 6XX XXX XXX"
                      value={phone} 
                      onChange={(e) => setPhone(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Type de pièce d'identité <span className="text-red-500">*</span>
                  </Label>
                  <Select value={idType} onValueChange={(v: IdType) => {
                    setIdType(v)
                    if (errors.idType) setErrors((p) => ({ ...p, idType: undefined }))
                  }}>
                    <SelectTrigger className={errors.idType ? "border-red-500 focus:ring-red-500" : ""}>
                      <CreditCard className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ID_TYPES.map((idTypeOption) => (
                        <SelectItem key={idTypeOption.value} value={idTypeOption.value}>
                          {idTypeOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.idType && <p className="text-xs text-red-600">{errors.idType}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Numéro de la pièce <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className={`pl-9 ${errors.idNumber ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      placeholder="Numéro du document"
                      value={idNumber} 
                      onChange={(e) => {
                        setIdNumber(e.target.value)
                        if (errors.idNumber) setErrors((p) => ({ ...p, idNumber: undefined }))
                      }} 
                    />
                  </div>
                  {errors.idNumber && <p className="text-xs text-red-600">{errors.idNumber}</p>}
                </div>
              </div>
            </div>

            {/* Section Montants */}
            <div className="rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-900/30">
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-muted-foreground" />
                Montants de l'opération
              </h4>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Montant en {cur} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">{cur}</span>
                    <Input
                      type="number"
                      className={`pl-12 text-right font-mono text-lg ${errors.foreign ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      placeholder="0.00"
                      value={foreign}
                      onChange={(e) => {
                        const value = e.target.value === "" ? "" : Number(e.target.value)
                        setForeign(value)
                        setLastEditedField("foreign")
                        if (errors.foreign) setErrors((p) => ({ ...p, foreign: undefined }))
                      }}
                    />
                  </div>
                  {errors.foreign && <p className="text-xs text-red-600">{errors.foreign}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Montant en XAF {type === "buy" ? "(net à verser au client)" : "(net à recevoir)"} <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">XAF</span>
                    <Input
                      type="number"
                      className={`pl-12 text-right font-mono text-lg ${errors.xaf ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      placeholder="0"
                      value={xaf}
                      onChange={(e) => {
                        const value = e.target.value === "" ? "" : Number(e.target.value)
                        setXaf(value)
                        setLastEditedField("xaf")
                        if (errors.xaf) setErrors((p) => ({ ...p, xaf: undefined }))
                      }}
                    />
                  </div>
                  {errors.xaf && <p className="text-xs text-red-600">{errors.xaf}</p>}
                </div>
              </div>
              
              {/* Résumé du calcul */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white p-3 border dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Taux appliqué</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    1 {cur} = <span className={type === "buy" ? "text-emerald-600" : "text-blue-600"}>{rate}</span> XAF
                  </div>
                </div>
                <div className="rounded-lg bg-white p-3 border dark:bg-slate-800">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Commission ({commissionRate.toFixed(2)}%)</div>
                  <div className="mt-1 text-sm font-bold text-amber-600 dark:text-amber-400">
                    {num(commission)} XAF
                  </div>
                </div>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 border-t">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Réinitialiser
              </Button>
              <Button 
                variant="outline" 
                onClick={calculate}
                className="gap-2"
              >
                <Calculator className="h-4 w-4" />
                Recalculer
              </Button>
              <Button 
                onClick={save} 
                disabled={isSaving}
                className="gap-2 min-w-[140px]"
              >
                {isSaving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Aperçu du reçu */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3 border-b bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Aperçu du reçu</CardTitle>
                <CardDescription className="text-xs">Prévisualisation avant impression</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="rounded-xl border bg-white p-4 shadow-inner dark:bg-slate-900">
              {/* En-tête du reçu */}
              <div className="mb-4 text-center border-b pb-3">
                <div className="text-xs font-bold text-primary uppercase tracking-wider">ZOLL TAX FOREX</div>
                <h4 className="text-base font-bold mt-1">Reçu d'Échange</h4>
                <Badge variant="outline" className="mt-2 text-[10px] font-mono">
                  {generateExchangeId()}
                </Badge>
              </div>

              {/* Détails de la transaction */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date().toLocaleDateString("fr-FR")}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Agent</span>
                  <span className="font-medium">{user?.name || "-"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{client || <span className="text-amber-500 italic">À renseigner</span>}</span>
                </div>
                {phone && (
                  <div className="flex justify-between py-1 border-b border-dashed">
                    <span className="text-muted-foreground">Téléphone</span>
                    <span className="font-medium">{phone}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Pièce d'identité</span>
                  <span className="font-medium">
                    {idType ? ID_TYPES.find(t => t.value === idType)?.label : <span className="text-amber-500 italic">À renseigner</span>}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">N° Pièce</span>
                  <span className="font-medium font-mono">{idNumber || <span className="text-amber-500 italic">À renseigner</span>}</span>
                </div>
                
                <div className="pt-2">
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                    type === "buy" 
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {type === "buy" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {type === "buy" ? "Achat devise" : "Vente devise"}
                  </div>
                </div>
                
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Devise</span>
                  <span className="font-bold">{cur}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Taux</span>
                  <span className="font-medium">1 {cur} = {rate} XAF</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Montant XAF</span>
                  <span className="font-bold tabular-nums">{typeof xaf === "number" ? xaf.toLocaleString("fr-FR") : 0} XAF</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dashed">
                  <span className="text-muted-foreground">Montant {cur}</span>
                  <span className="font-bold tabular-nums">{typeof foreign === "number" ? foreign.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"} {cur}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Commission</span>
                  <span className="font-medium text-amber-600 dark:text-amber-400 tabular-nums">{commission.toLocaleString("fr-FR")} XAF</span>
                </div>
              </div>

              {/* QR Code */}
              <div className="mt-4 border-t pt-4 text-center">
                <div className="mb-2 flex justify-center">
                  {qrCodeError ? (
                    <div className="flex h-[80px] w-[80px] items-center justify-center border border-gray-300 bg-gray-100 text-[10px] text-gray-500 rounded-lg">
                      Erreur QR
                    </div>
                  ) : (
                    <div className="relative">
                      <QRCodeSVG
                        value={createQRData()}
                        size={80}
                        level="M"
                        includeMargin={true}
                        onError={handleQRError}
                      />
                      {!isFormValidForPrint && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/90 dark:bg-slate-900/90 text-[10px] text-muted-foreground rounded">
                          En attente...
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {isFormValidForPrint
                    ? "QR Code prêt"
                    : "Complétez le formulaire"}
                </p>
              </div>

              {/* Boutons d'action */}
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={previewReceipt}
                  disabled={!isFormValidForPrint || qrCodeError}
                  className="w-full gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Prévisualiser
                </Button>
                <Button 
                  size="sm"
                  onClick={printReceipt} 
                  disabled={!isFormValidForPrint || qrCodeError || isPrinting} 
                  className="w-full gap-2"
                >
                  {isPrinting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Impression...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Imprimer le reçu
                    </>
                  )}
                </Button>
              </div>
              
              {/* Message d'aide */}
              {!isFormValidForPrint && (
                <p className="mt-3 text-[10px] text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg">
                  Remplissez tous les champs obligatoires (*) pour activer l'impression
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

{/* Les opérations de change ne nécessitent pas de validation - elles sont directement terminées */}

      {/* Section Opérations du jour */}
      {user && (
        <DailyOperations 
          operationType="exchange" 
          user={user} 
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function num(n: number) {
  if (!n) return "0"
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
}
