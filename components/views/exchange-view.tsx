"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { QRCodeSVG } from "qrcode.react"
import { exchangeSchema, zodToFieldErrors, type FieldErrors } from "@/lib/validation"
import { useToast } from "@/hooks/use-toast"
import { Eye, Printer } from "lucide-react"
import { DailyOperations } from "./daily-operations"
import { CashierPendingTransactionsByType } from "./cashier-pending-transactions-by-type"
import { getSessionClient, SessionUser } from "@/lib/auth-client"


export function ExchangeView({
  rates = { USD: 580, EUR: 650, GBP: 750 },
  commissionPercent = 1.0,
}: {
  rates?: { USD: number; EUR: number; GBP: number }
  commissionPercent?: number
}) {
  const { toast } = useToast()
  const [type, setType] = React.useState<"buy" | "sell">("buy")
  const [cur, setCur] = React.useState<"USD" | "EUR" | "GBP">("USD")
  const [client, setClient] = React.useState("")
  const [xaf, setXaf] = React.useState<number | "">("")
  const [foreign, setForeign] = React.useState<number | "">("")
  const [commission, setCommission] = React.useState(0)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [qrCodeError, setQrCodeError] = React.useState(false)
  const [isPrinting, setIsPrinting] = React.useState(false)
  
  // Récupérer l'utilisateur connecté
  const [user, setUser] = React.useState<SessionUser | null>(null)
  
  React.useEffect(() => {
    const sessionUser = getSessionClient()
    if (sessionUser) {
      setUser(sessionUser)
    }
  }, [])

  const rate = cur === "USD" ? rates.USD : cur === "EUR" ? rates.EUR : rates.GBP
  const k = Math.max(0, Number(commissionPercent || 1.0)) / 100 // commission rate (0..1)

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

  function calculate() {
    const v = validateOrSetErrors(false)
    if (!v.ok) return

    let lxaf = typeof xaf === "number" ? xaf : Number.NaN
    let lfor = typeof foreign === "number" ? foreign : Number.NaN

    if (type === "buy") {
      // Client vend des devises -> nous achetons la devise; XAF = lfor * rate (montant brut)
      if (Number.isFinite(lxaf)) {
        lfor = lxaf / rate
        setForeign(Number(lfor.toFixed(2)))
      } else if (Number.isFinite(lfor)) {
        lxaf = lfor * rate
        setXaf(Number(lxaf.toFixed(0)))
      }
      const c = Math.round((lxaf || 0) * k)
      setCommission(c)
    } else {
      // "sell": nous vendons la devise au client; net XAF = (lfor * rate) * (1 - k)
      if (Number.isFinite(lfor)) {
        const gross = lfor * rate
        const c = Math.round(gross * k)
        const net = Math.max(0, Math.round(gross - c))
        setCommission(c)
        setXaf(net)
      } else if (Number.isFinite(lxaf)) {
        // net = gross * (1 - k) => gross = net / (1 - k), foreign = gross / rate
        const gross = (lxaf || 0) / Math.max(0.000001, 1 - k)
        const c = Math.round(gross * k)
        const f = gross / rate
        setCommission(c)
        setForeign(Number(f.toFixed(2)))
      }
    }
  }

  const save = async () => {
    const v = validateOrSetErrors(true)
    if (!v.ok) return
    const lxaf = typeof xaf === "number" ? xaf : Number.NaN
    if (!Number.isFinite(lxaf) || lxaf <= 0) {
      setErrors((p) => ({ ...p, xaf: "Montant XAF requis et > 0 après calcul" }))
      return
    }

    try {
      // Génération d'un ID de transaction
      const newTransactionId = `EXC-${Date.now().toString().slice(-8)}`
      
      // Créer l'objet transaction pour le stockage
      const newTransaction = {
        id: newTransactionId,
        type: "exchange" as const,
        description: `Change ${cur} - ${type === "buy" ? "Achat" : "Vente"} - ${client}`,
        amount: lxaf,
        currency: "XAF",
        status: "pending" as const, // Statut en attente pour validation par l'auditeur
        created_by: user?.name || "Utilisateur", // Utiliser le nom de l'utilisateur connecté
        agency: user?.agency || "Agence Centrale", // Utiliser l'agence de l'utilisateur connecté
        created_at: new Date().toISOString(),
        details: {
          exchange_type: type,
          client_name: client,
          from_currency: type === "buy" ? cur : "XAF",
          to_currency: type === "buy" ? "XAF" : cur,
          exchange_rate: rate,
          amount_xaf: lxaf,
          amount_foreign: typeof foreign === "number" ? foreign : 0,
          commission: commission
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
            type: "exchange",
            description: `Change ${cur} - ${type === "buy" ? "Achat" : "Vente"} - ${client}`,
            amount: lxaf,
            currency: "XAF",
            details: {
              exchange_type: type,
              client_name: client,
              from_currency: type === "buy" ? cur : "XAF",
              to_currency: type === "buy" ? "XAF" : cur,
              exchange_rate: rate,
              amount_xaf: lxaf,
              amount_foreign: typeof foreign === "number" ? foreign : 0,
              commission: commission
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
        
      } catch (error) {
        toast({
          title: "Erreur",
          description: `Erreur lors de la sauvegarde: ${error.message}`,
          variant: "destructive"
        })
        return
      }
      
      toast({
        title: "Transaction soumise avec succès",
        description: `La transaction ${newTransactionId} a été soumise et est en attente de validation par l'auditeur`,
      })

      // Reset form
    setClient("")
    setXaf("")
    setForeign("")
    setCommission(0)
    setErrors({})
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement de la transaction",
        variant: "destructive"
      })
    }
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
    return JSON.stringify({
      id: exchangeId,
      type: "exchange",
      exchangeType: type,
      client: client,
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

  const previewReceipt = () => {
    const qrData = createQRData()
    const exchangeId = generateExchangeId()
    
    const receiptHTML = `
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
                <div id="qrcode"></div>
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
          
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              try {
                if (typeof QRCode !== 'undefined') {
                  new QRCode(document.getElementById("qrcode"), {
                    text: '${qrData}',
                    width: 120, height: 120,
                    colorDark: "#000000", colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                  });
                } else {
                  document.getElementById("qrcode").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
                }
              } catch (error) {
                document.getElementById("qrcode").innerHTML = '<div style="width: 120px; height: 120px; border: 2px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; text-align: center; background: #f9f9f9;">QR Code<br/>Non disponible</div>';
              }
            });
          </script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=600,height=800')
    if (printWindow) {
      printWindow.document.write(receiptHTML)
      printWindow.document.close()
    }
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
      previewReceipt()
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
      <h2 className="text-2xl font-bold text-gray-800">Bureau de change</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Nouvelle opération de change</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Taux de change actuels - Section élégante */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-blue-900">Taux de change actuels</h3>
                <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  Mis à jour aujourd'hui
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs text-blue-600 font-medium mb-1">USD</div>
                  <div className="text-lg font-bold text-blue-900">{rates.USD}</div>
                  <div className="text-xs text-blue-600">XAF</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-blue-600 font-medium mb-1">EUR</div>
                  <div className="text-lg font-bold text-blue-900">{rates.EUR}</div>
                  <div className="text-xs text-blue-600">XAF</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-blue-600 font-medium mb-1">GBP</div>
                  <div className="text-lg font-bold text-blue-900">{rates.GBP}</div>
                  <div className="text-xs text-blue-600">XAF</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={type} onValueChange={(v: "buy" | "sell") => setType(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Achat devise</SelectItem>
                    <SelectItem value="sell">Vente devise</SelectItem>
                  </SelectContent>
                </Select>
                {errors.type && <p className="mt-1 text-xs text-red-600">{errors.type}</p>}
              </div>
              <div>
                <Label>Devise</Label>
                <Select value={cur} onValueChange={(v: "USD" | "EUR" | "GBP") => setCur(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
                {errors.cur && <p className="mt-1 text-xs text-red-600">{errors.cur}</p>}
              </div>
            </div>

            <div>
              <Label>Nom du client</Label>
              <Input className="mt-1" value={client} onChange={(e) => setClient(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Montant en XAF {type === "sell" ? "(net)" : ""}</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={xaf}
                  onChange={(e) => {
                    setXaf(e.target.value === "" ? "" : Number(e.target.value))
                    if (errors.xaf) setErrors((p) => ({ ...p, xaf: undefined }))
                  }}
                />
                {errors.xaf && <p className="mt-1 text-xs text-red-600">{errors.xaf}</p>}
              </div>
              <div>
                <Label>Montant en {cur}</Label>
                <Input
                  type="number"
                  className="mt-1"
                  value={foreign}
                  onChange={(e) => {
                    setForeign(e.target.value === "" ? "" : Number(e.target.value))
                    if (errors.foreign) setErrors((p) => ({ ...p, foreign: undefined }))
                  }}
                />
                {errors.foreign && <p className="mt-1 text-xs text-red-600">{errors.foreign}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Taux appliqué</Label>
                <div className="mt-1 rounded-md bg-gray-100 p-2">
                  1 {cur} = {rate} XAF
                </div>
              </div>
              <div>
                <Label>Marge/Commission ({(commissionPercent || 1.0).toFixed(2)}%)</Label>
                <div className="mt-1 rounded-md bg-gray-100 p-2">{num(commission)} XAF</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setClient("")
                  setXaf("")
                  setForeign("")
                  setCommission(0)
                  setErrors({})
                }}
              >
                Annuler
              </Button>
              <Button variant="secondary" onClick={calculate}>
                Calculer
              </Button>
              <Button onClick={save}>Enregistrer</Button>
            </div>
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
                <h4 className="text-xl font-bold">Reçu d'Échange de Devise</h4>
                <p className="text-sm text-gray-500">
                  N°: <span className="font-medium">{generateExchangeId()}</span>
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
                  <span className="text-gray-600">Client:</span>
                  <span>{client || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Type d'opération:</span>
                  <span>{type === "buy" ? "Achat devise" : "Vente devise"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Devise:</span>
                  <span>{cur}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taux appliqué:</span>
                  <span>1 {cur} = {rate} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant XAF:</span>
                  <span>{typeof xaf === "number" ? xaf.toLocaleString("fr-FR") : 0} XAF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant {cur}:</span>
                  <span>{typeof foreign === "number" ? foreign.toLocaleString("fr-FR") : 0} {cur}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Commission:</span>
                  <span>{commission.toLocaleString("fr-FR")} XAF</span>
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
                      {!client && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 text-xs text-gray-500">
                          Remplissez d'abord
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {!client
                    ? "Scannez pour vérifier la transaction"
                    : "QR Code généré avec succès"}
                </p>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <Button
                  variant="outline"
                  onClick={previewReceipt}
                  disabled={!client || qrCodeError}
                  className="w-full bg-transparent"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Prévisualiser
                </Button>
                <Button 
                  onClick={printReceipt} 
                  disabled={!client || qrCodeError || isPrinting} 
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

      {/* Section Mes Transactions à Clôturer */}
      {user && (
        <CashierPendingTransactionsByType user={user} transactionType="exchange" />
      )}

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
