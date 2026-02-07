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
import { Receipt, Download, QrCode, History, Search, FileText, Eye, Filter, RotateCcw, FileSpreadsheet, ChevronDown, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

function parseCommissionRate(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return Math.max(0, Math.min(100, v))
  const n = parseFloat(String(v).trim().replace(/,/g, ".").replace(/[^0-9.-]/g, ""))
  return Number.isNaN(n) ? 3.6 : Math.max(0, Math.min(100, n))
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
  const [showHistory, setShowHistory] = useState(false)
  const [receiptHistory, setReceiptHistory] = useState<ReceiptHistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [filterDateFrom, setFilterDateFrom] = useState("")
  const [filterDateTo, setFilterDateTo] = useState("")
  const [filterOperation, setFilterOperation] = useState("all")
  const [filterCreator, setFilterCreator] = useState("all")
  const [filterClient, setFilterClient] = useState("all")
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPerPage, setHistoryPerPage] = useState(10)

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

  useEffect(() => {
    if (showHistory) {
      loadReceiptHistory()
    }
  }, [showHistory, searchQuery])

  const OPERATION_LABELS: Record<string, string> = {
    transfer: "Transfert", exchange: "Bureau de change", card_recharge: "Recharge carte",
    cash_deposit: "Dépôt espèces", cash_withdrawal: "Retrait espèces", other: "Autre",
  }

  // Filtered history
  const filteredHistory = receiptHistory.filter((r) => {
    if (filterDateFrom) {
      const d = new Date(r.created_at)
      if (d < new Date(filterDateFrom + "T00:00:00")) return false
    }
    if (filterDateTo) {
      const d = new Date(r.created_at)
      if (d > new Date(filterDateTo + "T23:59:59")) return false
    }
    if (filterOperation !== "all" && r.operation_type !== filterOperation) return false
    if (filterCreator !== "all" && (r.created_by_name || "Système") !== filterCreator) return false
    if (filterClient !== "all" && r.client_name !== filterClient) return false
    return true
  })

  const uniqueCreators = [...new Set(receiptHistory.map((r) => r.created_by_name || "Système"))].sort()
  const uniqueClients = [...new Set(receiptHistory.map((r) => r.client_name))].sort()
  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historyPerPage))
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage)

  useEffect(() => { setHistoryPage(1) }, [filterDateFrom, filterDateTo, filterOperation, filterCreator, filterClient, searchQuery, historyPerPage])

  const hasActiveFilters = filterDateFrom || filterDateTo || filterOperation !== "all" || filterCreator !== "all" || filterClient !== "all" || searchQuery
  const resetFilters = () => {
    setFilterDateFrom(""); setFilterDateTo(""); setFilterOperation("all"); setFilterCreator("all"); setFilterClient("all"); setSearchQuery("")
  }

  // --- Export CSV ---
  const handleExportHistoryCsv = () => {
    if (filteredHistory.length === 0) { toast.error("Aucune donnée à exporter"); return }
    try {
      const headers = ["N° Reçu","Client","Téléphone","Opération","Montant reçu","Montant envoyé","Commission","Devise","Créé par","Date"]
      const rows = filteredHistory.map(r => [
        r.receipt_number,
        `"${r.client_name}"`,
        `"${r.client_phone || ""}"`,
        `"${OPERATION_LABELS[r.operation_type] || r.operation_type}"`,
        r.amount_received,
        r.amount_sent,
        r.commission,
        r.currency,
        `"${r.created_by_name || "Système"}"`,
        `"${new Date(r.created_at).toLocaleString("fr-FR")}"`,
      ])
      const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `recus-transfert-${new Date().toISOString().split("T")[0]}.csv`
      a.click(); URL.revokeObjectURL(url)
      toast.success(`${filteredHistory.length} reçus exportés en CSV`)
    } catch { toast.error("Erreur lors de l'exportation") }
  }

  // --- Export PDF ---
  const handleExportHistoryPdf = () => {
    if (filteredHistory.length === 0) { toast.error("Aucune donnée à exporter"); return }
    try {
      const fmt = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
      const totalReceived = filteredHistory.reduce((s, r) => s + Number(r.amount_received), 0)
      const totalSent = filteredHistory.reduce((s, r) => s + Number(r.amount_sent), 0)
      const totalComm = filteredHistory.reduce((s, r) => s + Number(r.commission), 0)
      const filterInfo: string[] = []
      if (filterDateFrom || filterDateTo) filterInfo.push(`Dates : ${filterDateFrom || "..."} au ${filterDateTo || "..."}`)
      if (filterOperation !== "all") filterInfo.push(`Opération : ${OPERATION_LABELS[filterOperation] || filterOperation}`)
      if (filterCreator !== "all") filterInfo.push(`Créé par : ${filterCreator}`)
      if (filterClient !== "all") filterInfo.push(`Client : ${filterClient}`)
      if (searchQuery) filterInfo.push(`Recherche : "${searchQuery}"`)

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Historique Reçus</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #2563eb;margin-bottom:10px}
.header h1{font-size:18px;color:#1e3a5f;font-weight:700}.header .sub{font-size:11px;color:#64748b;margin-top:2px}
.header .meta{text-align:right;font-size:10px;color:#64748b}
.filters{font-size:9px;color:#64748b;margin-bottom:10px}.filters span{background:#eff6ff;color:#2563eb;padding:2px 6px;border-radius:3px;margin-right:4px;display:inline-block;margin-bottom:2px}
.cards{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;min-width:130px}
.card .label{font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}.card .val{font-size:15px;font-weight:700;color:#1e293b;margin-top:2px}
table{width:100%;border-collapse:collapse}
thead th{background:#1e3a5f;color:#fff;padding:6px 6px;text-align:left;font-size:8px;font-weight:600;text-transform:uppercase}
thead th:first-child{border-radius:4px 0 0 0}thead th:last-child{border-radius:0 4px 0 0}
tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}
tbody td{padding:5px 6px;font-size:9px}.r{text-align:right;font-weight:600}
.footer{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>ZOLL TAX FOREX</h1><div class="sub">Historique des reçus - Transfert International</div></div>
<div class="meta">Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div></div>
${filterInfo.length ? `<div class="filters">Filtres : ${filterInfo.map(f=>`<span>${f}</span>`).join("")}</div>` : ""}
<div class="cards">
<div class="card"><div class="label">Total reçus</div><div class="val">${fmt(filteredHistory.length)}</div></div>
<div class="card"><div class="label">Total reçu</div><div class="val">${fmt(totalReceived)} XAF</div></div>
<div class="card"><div class="label">Total envoyé</div><div class="val">${fmt(totalSent)} XAF</div></div>
<div class="card"><div class="label">Total commissions</div><div class="val">${fmt(totalComm)} XAF</div></div>
</div>
<table><thead><tr><th>#</th><th>N° Reçu</th><th>Date</th><th>Client</th><th>Opération</th><th style="text-align:right">Montant reçu</th><th style="text-align:right">Montant envoyé</th><th style="text-align:right">Commission</th><th>Créé par</th></tr></thead>
<tbody>${filteredHistory.map((r,i)=>`<tr>
<td>${i+1}</td><td style="font-size:8px">${r.receipt_number}</td>
<td>${new Date(r.created_at).toLocaleDateString("fr-FR")}</td>
<td>${r.client_name}</td>
<td>${OPERATION_LABELS[r.operation_type]||r.operation_type}</td>
<td class="r">${fmt(Number(r.amount_received))} ${r.currency}</td>
<td class="r">${fmt(Number(r.amount_sent))} ${r.currency}</td>
<td class="r">${fmt(Number(r.commission))} ${r.currency}</td>
<td>${r.created_by_name||"Système"}</td>
</tr>`).join("")}</tbody></table>
<div class="footer"><span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span><span>${fmt(filteredHistory.length)} reçus • Reçu : ${fmt(totalReceived)} XAF • Envoyé : ${fmt(totalSent)} XAF</span></div>
</body></html>`
      const w = window.open("", "_blank")
      if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
      toast.success(`${filteredHistory.length} reçus prêts à imprimer`)
    } catch { toast.error("Erreur lors de la génération du PDF") }
  }

  // Charger le taux de commission Transfert International depuis Taux & Plafonds
  useEffect(() => {
    let cancelled = false
    fetch("/api/settings?type=public")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.ok || !data?.data?.settings) return
        const rate = parseCommissionRate(data.data.settings.commission_international_pct ?? 3.6)
        setReceiptData((prev) => ({ ...prev, commissionRate: rate }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

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
      setReceiptData((prev) => ({
        ...prev,
        clientName: "",
        clientPhone: "",
        clientEmail: "",
        operationType: "",
        amountReceived: 0,
        amountSent: 0,
        commission: 0,
        currency: "XAF",
        notes: "",
        receiptNumber: ""
      }))
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
                <Label htmlFor="commission">Commission ({Number(receiptData.commissionRate).toFixed(1)}%)</Label>
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
                  <span>Commission ({Number(receiptData.commissionRate).toFixed(1)}%):</span>
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
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <History className="h-5 w-5" />
                  <span>Historique des reçus</span>
                </CardTitle>
                <CardDescription>
                  Liste de tous les reçus générés
                  {filteredHistory.length > 0 && <span className="ml-1 font-medium">({filteredHistory.length})</span>}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Download className="h-4 w-4" />
                      Exporter
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={handleExportHistoryCsv} className="gap-2 cursor-pointer">
                      <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                      Exporter en CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportHistoryPdf} className="gap-2 cursor-pointer">
                      <FileText className="h-4 w-4 text-red-500" />
                      Exporter en PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
                    <RotateCcw className="h-3.5 w-3.5" />
                    Réinitialiser
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filtres */}
            <div className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par numéro, client, téléphone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9 text-sm rounded-lg"
                  />
                </div>
                <Button
                  onClick={loadReceiptHistory}
                  disabled={isLoadingHistory}
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 rounded-lg"
                >
                  {isLoadingHistory ? "Chargement..." : "Rechercher"}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Date range */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="input-date-centered h-9 w-[140px] min-w-0 text-sm rounded-lg"
                  />
                  <span className="text-sm text-muted-foreground shrink-0">au</span>
                  <Input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="input-date-centered h-9 w-[140px] min-w-0 text-sm rounded-lg"
                  />
                </div>

                <div className="h-6 w-px bg-border shrink-0 hidden sm:block" />

                <Select value={filterOperation} onValueChange={setFilterOperation}>
                  <SelectTrigger className="h-9 w-auto min-w-[140px] rounded-lg text-sm px-3 gap-1.5">
                    <SelectValue placeholder="Opération" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les opérations</SelectItem>
                    <SelectItem value="transfer">Transfert</SelectItem>
                    <SelectItem value="exchange">Bureau de change</SelectItem>
                    <SelectItem value="card_recharge">Recharge carte</SelectItem>
                    <SelectItem value="cash_deposit">Dépôt espèces</SelectItem>
                    <SelectItem value="cash_withdrawal">Retrait espèces</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg text-sm px-3 gap-1.5">
                    <SelectValue placeholder="Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les clients</SelectItem>
                    {uniqueClients.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCreator} onValueChange={setFilterCreator}>
                  <SelectTrigger className="h-9 w-auto min-w-[130px] rounded-lg text-sm px-3 gap-1.5">
                    <SelectValue placeholder="Créé par" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les agents</SelectItem>
                    {uniqueCreators.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  ) : paginatedHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        Aucun reçu trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHistory.map((receipt) => (
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
                                        <span className="font-medium">Commission ({Number(parseCommissionRate(receipt.commission_rate)).toFixed(1)}%):</span> -{Number(receipt.commission).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} {receipt.currency}
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

            {/* Pagination */}
            {filteredHistory.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Éléments par page :</span>
                  <Select value={String(historyPerPage)} onValueChange={(v) => setHistoryPerPage(Number(v))}>
                    <SelectTrigger className="h-8 w-[70px] text-sm rounded-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-sm text-muted-foreground">
                  Affichage de <strong>{filteredHistory.length === 0 ? 0 : (historyPage - 1) * historyPerPage + 1}</strong> à <strong>{Math.min(historyPage * historyPerPage, filteredHistory.length)}</strong> sur <strong>{filteredHistory.length}</strong> reçus
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(p => p - 1)} className="h-8 text-sm px-3 rounded-md">
                    Précédent
                  </Button>
                  <Button variant="outline" size="sm" disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage(p => p + 1)} className="h-8 text-sm px-3 rounded-md">
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
