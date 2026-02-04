"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Download, Send, Globe, ArrowRightLeft, History } from "lucide-react"
import { hasPermission } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth-client"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Settings = {
  id: string
  usd: number
  eur: number
  gbp: number
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
  const initialFormData = {
    transfer_commission_min_xaf: String(initialSettings.transfer_commission_min_xaf ?? 0),
    card_fee_xaf: String(initialSettings.card_fee_xaf ?? 14000),
    commission_international_pct: String(initialSettings.commission_international_pct ?? 0),
    usd: initialSettings.usd.toString(),
    eur: initialSettings.eur.toString(),
    gbp: initialSettings.gbp.toString(),
    commission: initialSettings.commission.toString(),
  }
  const [formData, setFormData] = useState(initialFormData)
  // Ref mise à jour de façon synchrone à chaque onChange pour éviter état/DOM périmés au clic "Mettre à jour"
  const latestFormDataRef = useRef(initialFormData)
  // Ne pas écraser la saisie quand le fetch initial se termine après que l'utilisateur a déjà modifié un champ
  const userHasEditedRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data?.ok) {
          const s = data.data.settings
          setSettings(s)
          setHistory(data.data.history ?? [])
          // Ne pas écraser le formulaire si l'utilisateur a déjà commencé à saisir
          if (!userHasEditedRef.current) {
            const next = {
              transfer_commission_min_xaf: String(s.transfer_commission_min_xaf ?? 0),
              card_fee_xaf: String(s.card_fee_xaf ?? 14000),
              commission_international_pct: String(s.commission_international_pct ?? 0),
              usd: s.usd?.toString() ?? "",
              eur: s.eur?.toString() ?? "",
              gbp: s.gbp?.toString() ?? "",
              commission: s.commission?.toString() ?? "",
            }
            setFormData(next)
            latestFormDataRef.current = next
          }
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de charger les paramètres",
            variant: "destructive",
          })
        }
      } catch {
        if (!cancelled) {
          toast({
            title: "Erreur réseau",
            description: "Impossible de se connecter au serveur",
            variant: "destructive",
          })
        }
      }
    }
    loadSettings()
    return () => { cancelled = true }
  }, [toast])

  const parseNum = (s: string): number => {
    const n = parseFloat(String(s).trim().replace(/,/g, ".").replace(/[^0-9.-]/g, ""))
    return Number.isNaN(n) ? 0 : n
  }
  const parseIntSafe = (s: string): number => Math.max(0, Math.round(parseNum(s)))

  const handleSaveSettings = async () => {
    setPending(true)
    try {
      const fd = latestFormDataRef.current
      const payload = {
        transfer_commission_min_xaf: parseIntSafe(fd.transfer_commission_min_xaf),
        card_fee_xaf: parseIntSafe(fd.card_fee_xaf),
        commission_international_pct: parseNum(fd.commission_international_pct),
        usd: parseNum(fd.usd),
        eur: parseNum(fd.eur),
        gbp: parseNum(fd.gbp),
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
        const next = {
          transfer_commission_min_xaf: String(s.transfer_commission_min_xaf ?? 0),
          card_fee_xaf: String(s.card_fee_xaf ?? 14000),
          commission_international_pct: String(s.commission_international_pct ?? 0),
          usd: s.usd?.toString() ?? "",
          eur: s.eur?.toString() ?? "",
          gbp: s.gbp?.toString() ?? "",
          commission: s.commission?.toString() ?? "",
        }
        setFormData(next)
        latestFormDataRef.current = next
        userHasEditedRef.current = false
        toast({
          title: "Succès",
          description: "Paramètres mis à jour avec succès",
        })
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
    }
  }

  const handleExportHistory = () => {
    const headers = [
      "Date",
      "Utilisateur",
      "Commission min. (XAF)",
      "Frais cartes (XAF)",
      "Comm. int. (%)",
      "USD",
      "EUR",
      "GBP",
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
      item.usd?.toString() ?? "",
      item.eur?.toString() ?? "",
      item.gbp?.toString() ?? "",
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
          <Button onClick={handleExportHistory} variant="outline" size="sm" className="shrink-0">
            <Download className="h-4 w-4 mr-2" />
            Exporter l&apos;historique
          </Button>
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
                onChange={(e) => {
                userHasEditedRef.current = true
                const v = e.target.value
                setFormData((prev) => ({ ...prev, transfer_commission_min_xaf: v }))
                latestFormDataRef.current = { ...latestFormDataRef.current, transfer_commission_min_xaf: v }
              }}
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
                onChange={(e) => {
                userHasEditedRef.current = true
                const v = e.target.value
                setFormData((prev) => ({ ...prev, commission_international_pct: v }))
                latestFormDataRef.current = { ...latestFormDataRef.current, commission_international_pct: v }
              }}
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
                onChange={(e) => {
                userHasEditedRef.current = true
                const v = e.target.value
                setFormData((prev) => ({ ...prev, card_fee_xaf: v }))
                latestFormDataRef.current = { ...latestFormDataRef.current, card_fee_xaf: v }
              }}
                readOnly={!canEdit}
                className="bg-white dark:bg-slate-900"
              />
            </div>
          </CardContent>
        </Card>

        {/* 3 - Bureau de change */}
        <Card className="border-slate-200 shadow-sm overflow-hidden dark:border-slate-800">
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
                  Taux actuels et marge
                </p>
              </div>
            </div>
          </div>
          <CardContent className="pt-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="usd" className="text-slate-700 dark:text-slate-300 text-xs">USD (XAF)</Label>
                <Input
                  id="usd"
                  type="number"
                  step="0.01"
                  value={formData.usd}
                  onChange={(e) => {
                  userHasEditedRef.current = true
                  const v = e.target.value
                  setFormData((prev) => ({ ...prev, usd: v }))
                  latestFormDataRef.current = { ...latestFormDataRef.current, usd: v }
                }}
                  readOnly={!canEdit}
                  className="bg-white dark:bg-slate-900 h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eur" className="text-slate-700 dark:text-slate-300 text-xs">EUR (XAF)</Label>
                <Input
                  id="eur"
                  type="number"
                  step="0.01"
                  value={formData.eur}
                  onChange={(e) => {
                  userHasEditedRef.current = true
                  const v = e.target.value
                  setFormData((prev) => ({ ...prev, eur: v }))
                  latestFormDataRef.current = { ...latestFormDataRef.current, eur: v }
                }}
                  readOnly={!canEdit}
                  className="bg-white dark:bg-slate-900 h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gbp" className="text-slate-700 dark:text-slate-300 text-xs">GBP (XAF)</Label>
                <Input
                  id="gbp"
                  type="number"
                  step="0.01"
                  value={formData.gbp}
                  onChange={(e) => {
                  userHasEditedRef.current = true
                  const v = e.target.value
                  setFormData((prev) => ({ ...prev, gbp: v }))
                  latestFormDataRef.current = { ...latestFormDataRef.current, gbp: v }
                }}
                  readOnly={!canEdit}
                  className="bg-white dark:bg-slate-900 h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission" className="text-slate-700 dark:text-slate-300 text-xs">Marge / Comm. (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  step="0.01"
                  value={formData.commission}
                  onChange={(e) => {
                  userHasEditedRef.current = true
                  const v = e.target.value
                  setFormData((prev) => ({ ...prev, commission: v }))
                  latestFormDataRef.current = { ...latestFormDataRef.current, commission: v }
                }}
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
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">USD</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">EUR</TableHead>
                  <TableHead className="font-medium text-slate-600 dark:text-slate-400">GBP</TableHead>
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
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">{item.usd}</TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">{item.eur}</TableCell>
                    <TableCell className="text-sm tabular-nums text-slate-700 dark:text-slate-300">{item.gbp}</TableCell>
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
