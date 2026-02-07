"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Download, Send, Globe, ArrowRightLeft, History, FileText, FileSpreadsheet, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { hasPermission } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Settings = {
  id: string
  usd: number
  eur: number
  gbp: number
  usd_buy: number
  usd_sell: number
  eur_buy: number
  eur_sell: number
  gbp_buy: number
  gbp_sell: number
  transfer_limit: number
  daily_limit: number
  card_limit: number
  commission: number
  transfer_commission_min_xaf: number
  card_fee_xaf: number
  commission_international_pct: number
  updated_at: string
}

type HistoryItem = {
  id: string
  usd: number
  eur: number
  gbp: number
  usd_buy?: number
  usd_sell?: number
  eur_buy?: number
  eur_sell?: number
  gbp_buy?: number
  gbp_sell?: number
  transfer_limit: number
  daily_limit: number
  card_limit: number
  commission: number
  transfer_commission_min_xaf?: number
  card_fee_xaf?: number
  commission_international_pct?: number
  changed_by?: string
  created_at: string
}

export function RatesView({
  initialSettings,
  initialHistory,
  currentUser,
}: {
  initialSettings: Settings
  initialHistory: HistoryItem[]
  currentUser: SessionUser 
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory)
  const [pending, setPending] = useState(false)
  const [formData, setFormData] = useState({
    transfer_commission_min_xaf: String(initialSettings.transfer_commission_min_xaf ?? 0),
    card_fee_xaf: String(initialSettings.card_fee_xaf ?? 14000),
    commission_international_pct: String(initialSettings.commission_international_pct ?? 0),
    usd: initialSettings.usd.toString(),
    eur: initialSettings.eur.toString(),
    gbp: initialSettings.gbp.toString(),
    usd_buy: String(initialSettings.usd_buy ?? initialSettings.usd),
    usd_sell: String(initialSettings.usd_sell ?? initialSettings.usd),
    eur_buy: String(initialSettings.eur_buy ?? initialSettings.eur),
    eur_sell: String(initialSettings.eur_sell ?? initialSettings.eur),
    gbp_buy: String(initialSettings.gbp_buy ?? initialSettings.gbp),
    gbp_sell: String(initialSettings.gbp_sell ?? initialSettings.gbp),
    commission: initialSettings.commission.toString(),
  })
  // Ref pour toujours avoir accès à la dernière valeur du formulaire
  const formDataRef = useRef(formData)
  formDataRef.current = formData
  // Ref pour empêcher les double-clics et requêtes trop rapides
  const savingRef = useRef(false)
  const lastSaveTimeRef = useRef(0)
  const MIN_SAVE_INTERVAL = 2000 // 2 secondes minimum entre les sauvegardes
  const { toast } = useToast()

  // Charger uniquement l'historique au montage (les settings viennent du SSR)
  useEffect(() => {
    let cancelled = false
    const loadHistory = async () => {
      try {
        const res = await fetch("/api/settings")
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data?.ok) {
          setHistory(data.data.history ?? [])
        }
      } catch {
        // Silently fail - history will be loaded on next save
      }
    }
    loadHistory()
    return () => { cancelled = true }
  }, [])

  const parseNum = (s: string): number => {
    const n = parseFloat(String(s).trim().replace(/,/g, ".").replace(/[^0-9.-]/g, ""))
    return Number.isNaN(n) ? 0 : n
  }
  const parseIntSafe = (s: string): number => Math.max(0, Math.round(parseNum(s)))

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveSettings = async () => {
    // Empêcher les double-clics et les requêtes trop rapides
    const now = Date.now()
    if (savingRef.current || pending || (now - lastSaveTimeRef.current) < MIN_SAVE_INTERVAL) {
      return
    }
    savingRef.current = true
    lastSaveTimeRef.current = now
    setPending(true)
    
    try {
      // Utiliser la ref pour avoir les valeurs les plus récentes
      const fd = formDataRef.current
      const payload = {
        transfer_commission_min_xaf: parseIntSafe(fd.transfer_commission_min_xaf),
        card_fee_xaf: parseIntSafe(fd.card_fee_xaf),
        commission_international_pct: parseNum(fd.commission_international_pct),
        usd: parseNum(fd.usd),
        eur: parseNum(fd.eur),
        gbp: parseNum(fd.gbp),
        usd_buy: parseNum(fd.usd_buy),
        usd_sell: parseNum(fd.usd_sell),
        eur_buy: parseNum(fd.eur_buy),
        eur_sell: parseNum(fd.eur_sell),
        gbp_buy: parseNum(fd.gbp_buy),
        gbp_sell: parseNum(fd.gbp_sell),
        commission: parseNum(fd.commission),
      }
      
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        const s = data.data
        setSettings(s)
        // Mettre à jour le formulaire avec les valeurs confirmées par le serveur
        setFormData({
          transfer_commission_min_xaf: String(s.transfer_commission_min_xaf ?? 0),
          card_fee_xaf: String(s.card_fee_xaf ?? 14000),
          commission_international_pct: String(s.commission_international_pct ?? 0),
          usd: s.usd?.toString() ?? "",
          eur: s.eur?.toString() ?? "",
          gbp: s.gbp?.toString() ?? "",
          usd_buy: String(s.usd_buy ?? s.usd ?? ""),
          usd_sell: String(s.usd_sell ?? s.usd ?? ""),
          eur_buy: String(s.eur_buy ?? s.eur ?? ""),
          eur_sell: String(s.eur_sell ?? s.eur ?? ""),
          gbp_buy: String(s.gbp_buy ?? s.gbp ?? ""),
          gbp_sell: String(s.gbp_sell ?? s.gbp ?? ""),
          commission: s.commission?.toString() ?? "",
        })
        toast({
          title: "Succès",
          description: "Paramètres mis à jour avec succès",
        })
        // Recharger l'historique
        const historyRes = await fetch("/api/settings")
        const historyData = await historyRes.json()
        if (historyRes.ok && historyData?.ok) {
          setHistory(historyData.data.history ?? [])
        }
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la mise à jour",
          variant: "destructive",
        })
      }
    } catch {
      toast({
        title: "Erreur réseau",
        description: "Impossible de mettre à jour les paramètres",
        variant: "destructive",
      })
    } finally {
      setPending(false)
      savingRef.current = false
    }
  }

  const handleExportHistory = () => {
    const headers = [
      "Date",
      "Utilisateur",
      "Commission min. (XAF)",
      "Frais cartes (XAF)",
      "Comm. int. (%)",
      "USD Achat",
      "USD Vente",
      "EUR Achat",
      "EUR Vente",
      "GBP Achat",
      "GBP Vente",
      "Marge/Comm. (%)",
    ]
    const rows = history.map((item) => [
      new Date(item.created_at).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        }),
        item.changed_by || "Système",
      String(item.transfer_commission_min_xaf ?? ""),
      String(item.card_fee_xaf ?? ""),
      String(item.commission_international_pct ?? ""),
      item.usd_buy?.toString() ?? item.usd?.toString() ?? "",
      item.usd_sell?.toString() ?? item.usd?.toString() ?? "",
      item.eur_buy?.toString() ?? item.eur?.toString() ?? "",
      item.eur_sell?.toString() ?? item.eur?.toString() ?? "",
      item.gbp_buy?.toString() ?? item.gbp?.toString() ?? "",
      item.gbp_sell?.toString() ?? item.gbp?.toString() ?? "",
      item.commission?.toString() ?? "",
    ])
    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `historique-taux-plafonds-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleExportHistoryPdf = () => {
    if (history.length === 0) return
    const fmtDate = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Historique Taux</title>
<style>
@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#1e293b;background:#fff}
.header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #2563eb;margin-bottom:10px}.header h1{font-size:18px;color:#1e3a5f;font-weight:700}.header .subtitle{font-size:11px;color:#64748b;margin-top:2px}.header .meta{text-align:right;font-size:10px;color:#64748b}
.summary{display:flex;gap:16px;margin-bottom:10px;flex-wrap:wrap}.summary-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;min-width:140px}.summary-card .label{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}.summary-card .value{font-size:16px;font-weight:700;color:#1e293b;margin-top:2px}
table{width:100%;border-collapse:collapse}thead th{background:#1e3a5f;color:#fff;padding:7px 8px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.3px}thead th:first-child{border-radius:4px 0 0 0}thead th:last-child{border-radius:0 4px 0 0}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr:nth-child(even){background:#f8fafc}tbody td{padding:6px 8px;font-size:10px;vertical-align:middle}
.footer{margin-top:12px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="header"><div><h1>ZOLL TAX FOREX</h1><div class="subtitle">Historique des Taux & Plafonds</div></div><div class="meta">Généré le ${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"})}</div></div>
<div class="summary"><div class="summary-card"><div class="label">Modifications</div><div class="value">${history.length}</div></div></div>
<table><thead><tr><th>Date</th><th>Utilisateur</th><th>Comm. min.</th><th>Frais cartes</th><th>Comm. int.</th><th>USD Achat</th><th>USD Vente</th><th>EUR Achat</th><th>EUR Vente</th><th>GBP Achat</th><th>GBP Vente</th><th>Marge %</th></tr></thead>
<tbody>${history.map(item => `<tr><td>${fmtDate(item.created_at)}</td><td>${item.changed_by||"Système"}</td><td>${item.transfer_commission_min_xaf??""}</td><td>${item.card_fee_xaf??""}</td><td>${item.commission_international_pct??""}%</td><td>${item.usd_buy??item.usd??""}</td><td>${item.usd_sell??item.usd??""}</td><td>${item.eur_buy??item.eur??""}</td><td>${item.eur_sell??item.eur??""}</td><td>${item.gbp_buy??item.gbp??""}</td><td>${item.gbp_sell??item.gbp??""}</td><td>${item.commission??""}%</td></tr>`).join("")}</tbody></table>
<div class="footer"><span>ZOLL TAX FOREX © ${new Date().getFullYear()} — Document confidentiel</span><span>${history.length} enregistrements</span></div>
</body></html>`
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400) }
  }

  const canEdit = hasPermission(currentUser, "edit_rates")

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Taux & Plafonds
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Les plafonds (transfert, quotidien, carte) sont gérés dans l&apos;onglet Gestion Cartes.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0 gap-2">
                <Download className="h-4 w-4" />
                Exporter l&apos;historique
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExportHistory} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Exporter en CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportHistoryPdf} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4 text-red-500" />
                Exporter en PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canEdit && (
            <Button onClick={handleSaveSettings} disabled={pending} size="sm" className="shrink-0">
              {pending ? "Mise à jour..." : "Mettre à jour"}
        </Button>
          )}
        </div>
      </div>

      {/* Cartes paramètres */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1 - Transfert d'argent */}
        <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800">
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/80 dark:from-emerald-950/30 dark:to-teal-950/20 border-b border-emerald-100 dark:border-emerald-900/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                  Transfert d&apos;argent
                </CardTitle>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Commission minimum pour la validation
                </p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer_commission_min_xaf" className="text-slate-700 dark:text-slate-300">
                Commission minimum pour la validation (XAF)
              </Label>
              <Input
                id="transfer_commission_min_xaf"
                type="number"
                min={0}
                step={1}
                value={formData.transfer_commission_min_xaf}
                onChange={(e) => updateField("transfer_commission_min_xaf", e.target.value)}
                readOnly={!canEdit}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </CardContent>
        </Card>

        {/* 2 - Transfert international */}
        <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/20 border-b border-blue-100 dark:border-blue-900/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-blue-900 dark:text-blue-100">
                  Transfert international
                </CardTitle>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                  Commission et frais cartes
                </p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commission_international_pct" className="text-slate-700 dark:text-slate-300">
                Commission (%)
              </Label>
              <Input
                id="commission_international_pct"
                type="number"
                min={0}
                step={0.01}
                value={formData.commission_international_pct}
                onChange={(e) => updateField("commission_international_pct", e.target.value)}
                readOnly={!canEdit}
                className="bg-white dark:bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="card_fee_xaf" className="text-slate-700 dark:text-slate-300">
                Frais des cartes (XAF)
              </Label>
              <Input
                id="card_fee_xaf"
                type="number"
                min={0}
                step={1}
                value={formData.card_fee_xaf}
                onChange={(e) => updateField("card_fee_xaf", e.target.value)}
                readOnly={!canEdit}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3 - Bureau de change */}
        <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800 lg:col-span-3">
          <div className="bg-gradient-to-br from-violet-50 to-purple-50/80 dark:from-violet-950/30 dark:to-purple-950/20 border-b border-violet-100 dark:border-violet-900/50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-violet-900 dark:text-violet-100">
                  Bureau de change
                </CardTitle>
                <p className="text-xs text-violet-700 dark:text-violet-300 mt-0.5">
                  Taux d&apos;achat et de vente des devises
                </p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5 space-y-5">
            {/* Taux d'achat - Vert */}
            <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-4 dark:border-emerald-800/50 dark:from-emerald-950/20 dark:to-green-950/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 shadow-sm">
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0-16l-4 4m4-4l4 4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Taux d&apos;achat</h4>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">Nous achetons les devises du client</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usd_buy" className="text-emerald-800 dark:text-emerald-200 text-xs font-medium">USD (XAF)</Label>
                  <Input
                    id="usd_buy"
                    type="number"
                    step="0.01"
                    value={formData.usd_buy}
                    onChange={(e) => updateField("usd_buy", e.target.value)}
                    readOnly={!canEdit}
                    className="bg-white dark:bg-emerald-950/30 h-9 border-emerald-200 dark:border-emerald-800 focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eur_buy" className="text-emerald-800 dark:text-emerald-200 text-xs font-medium">EUR (XAF)</Label>
                  <Input
                    id="eur_buy"
                    type="number"
                    step="0.01"
                    value={formData.eur_buy}
                    onChange={(e) => updateField("eur_buy", e.target.value)}
                    readOnly={!canEdit}
                    className="bg-white dark:bg-emerald-950/30 h-9 border-emerald-200 dark:border-emerald-800 focus:border-emerald-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gbp_buy" className="text-emerald-800 dark:text-emerald-200 text-xs font-medium">GBP (XAF)</Label>
                  <Input
                    id="gbp_buy"
                    type="number"
                    step="0.01"
                    value={formData.gbp_buy}
                    onChange={(e) => updateField("gbp_buy", e.target.value)}
                    readOnly={!canEdit}
                    className="bg-white dark:bg-emerald-950/30 h-9 border-emerald-200 dark:border-emerald-800 focus:border-emerald-400"
                  />
                </div>
              </div>
            </div>

            {/* Taux de vente - Bleu */}
            <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 dark:border-blue-800/50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 shadow-sm">
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 20V4m0 16l4-4m-4 4l-4-4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">Taux de vente</h4>
                  <p className="text-xs text-blue-600 dark:text-blue-400">Nous vendons des devises au client</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="usd_sell" className="text-blue-800 dark:text-blue-200 text-xs font-medium">USD (XAF)</Label>
                  <Input
                    id="usd_sell"
                    type="number"
                    step="0.01"
                    value={formData.usd_sell}
                    onChange={(e) => updateField("usd_sell", e.target.value)}
                    readOnly={!canEdit}
                    className="bg-white dark:bg-blue-950/30 h-9 border-blue-200 dark:border-blue-800 focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eur_sell" className="text-blue-800 dark:text-blue-200 text-xs font-medium">EUR (XAF)</Label>
                  <Input
                    id="eur_sell"
                    type="number"
                    step="0.01"
                    value={formData.eur_sell}
                    onChange={(e) => updateField("eur_sell", e.target.value)}
                    readOnly={!canEdit}
                    className="bg-white dark:bg-blue-950/30 h-9 border-blue-200 dark:border-blue-800 focus:border-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gbp_sell" className="text-blue-800 dark:text-blue-200 text-xs font-medium">GBP (XAF)</Label>
                  <Input
                    id="gbp_sell"
                    type="number"
                    step="0.01"
                    value={formData.gbp_sell}
                    onChange={(e) => updateField("gbp_sell", e.target.value)}
                    readOnly={!canEdit}
                    className="bg-white dark:bg-blue-950/30 h-9 border-blue-200 dark:border-blue-800 focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Marge / Commission */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="commission" className="text-slate-700 dark:text-slate-300 text-xs font-medium">Marge / Commission (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  value={formData.commission}
                  onChange={(e) => updateField("commission", e.target.value)}
                  readOnly={!canEdit}
                  className="bg-white dark:bg-slate-900 h-9"
                />
          </div>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Historique */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            <CardTitle className="text-lg">Historique des modifications</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50 dark:bg-slate-900/50 dark:hover:bg-slate-900/50">
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">Date</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">Utilisateur</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">Comm. min.</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">Frais cartes</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">Comm. int.</TableHead>
                  <TableHead className="font-medium text-emerald-700 dark:text-emerald-400">USD Achat</TableHead>
                  <TableHead className="font-medium text-blue-700 dark:text-blue-400">USD Vente</TableHead>
                  <TableHead className="font-medium text-emerald-700 dark:text-emerald-400">EUR Achat</TableHead>
                  <TableHead className="font-medium text-blue-700 dark:text-blue-400">EUR Vente</TableHead>
                  <TableHead className="font-medium text-emerald-700 dark:text-emerald-400">GBP Achat</TableHead>
                  <TableHead className="font-medium text-blue-700 dark:text-blue-400">GBP Vente</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">Marge %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {item.changed_by || "Système"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {item.transfer_commission_min_xaf != null
                        ? Number(item.transfer_commission_min_xaf).toLocaleString("fr-FR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {item.card_fee_xaf != null
                        ? Number(item.card_fee_xaf).toLocaleString("fr-FR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {item.commission_international_pct != null
                        ? `${Number(item.commission_international_pct)} %`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                      {item.usd_buy ?? item.usd ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-blue-700 dark:text-blue-400">
                      {item.usd_sell ?? item.usd ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                      {item.eur_buy ?? item.eur ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-blue-700 dark:text-blue-400">
                      {item.eur_sell ?? item.eur ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-emerald-700 dark:text-emerald-400">
                      {item.gbp_buy ?? item.gbp ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-blue-700 dark:text-blue-400">
                      {item.gbp_sell ?? item.gbp ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {item.commission != null ? `${Number(item.commission)} %` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {history.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Aucune modification enregistrée
        </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
