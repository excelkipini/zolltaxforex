"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Download } from "lucide-react"
import { hasPermission } from "@/lib/rbac"
import type { SessionUser } from "@/lib/auth-client"

type Settings = {
  id: string
  usd: number
  eur: number
  gbp: number
  transfer_limit: number
  daily_limit: number
  card_limit: number
  commission: number
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
  changed_by?: string
  created_at: string
}

export function RatesView({ initialSettings, initialHistory, currentUser }: { 
  initialSettings: Settings, 
  initialHistory: HistoryItem[], 
  currentUser: SessionUser 
}) {
  const [settings, setSettings] = useState<Settings>(initialSettings)
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory)
  const [pending, setPending] = useState(false)
  const [formData, setFormData] = useState({
    usd: initialSettings.usd.toString(),
    eur: initialSettings.eur.toString(),
    gbp: initialSettings.gbp.toString(),
    transfer_limit: initialSettings.transfer_limit.toString(),
    daily_limit: initialSettings.daily_limit.toString(),
    card_limit: initialSettings.card_limit.toString(),
    commission: initialSettings.commission.toString()
  })
  const { toast } = useToast()

  // Charger les paramètres depuis l'API
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings")
        const data = await res.json()
        if (res.ok && data?.ok) {
          setSettings(data.data.settings)
          setHistory(data.data.history)
          // Initialiser le formulaire avec les données actuelles
          setFormData({
            usd: data.data.settings.usd.toString(),
            eur: data.data.settings.eur.toString(),
            gbp: data.data.settings.gbp.toString(),
            transfer_limit: data.data.settings.transfer_limit.toString(),
            daily_limit: data.data.settings.daily_limit.toString(),
            card_limit: data.data.settings.card_limit.toString(),
            commission: data.data.settings.commission.toString()
          })
        } else {
          toast({
            title: "Erreur",
            description: "Impossible de charger les paramètres",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Erreur réseau",
          description: "Impossible de se connecter au serveur",
          variant: "destructive"
        })
      }
    }
    loadSettings()
  }, [toast])

  const handleSaveSettings = async () => {
    setPending(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usd: Number(formData.usd),
          eur: Number(formData.eur),
          gbp: Number(formData.gbp),
          transfer_limit: Number(formData.transfer_limit),
          daily_limit: Number(formData.daily_limit),
          card_limit: Number(formData.card_limit),
          commission: Number(formData.commission)
        })
      })
      const data = await res.json()
      
      if (res.ok && data?.ok) {
        setSettings(data.data)
        toast({
          title: "Succès",
          description: "Paramètres mis à jour avec succès"
        })
        
        // Recharger l'historique
        const historyRes = await fetch("/api/settings")
        const historyData = await historyRes.json()
        if (historyRes.ok && historyData?.ok) {
          setHistory(historyData.data.history)
        }
      } else {
        toast({
          title: "Erreur",
          description: data?.error || "Erreur lors de la mise à jour",
          variant: "destructive"
        })
      }
    } catch (error) {
      toast({
        title: "Erreur réseau",
        description: "Impossible de mettre à jour les paramètres",
        variant: "destructive"
      })
    } finally {
      setPending(false)
    }
  }

  const handleExportHistory = () => {
    const csvContent = [
      ["Date", "Utilisateur", "USD", "EUR", "GBP", "Limite Transfert", "Limite Quotidienne", "Limite Carte", "Commission"],
      ...history.map(item => [
        new Date(item.created_at).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        item.changed_by || "Système",
        item.usd.toString(),
        item.eur.toString(),
        item.gbp.toString(),
        item.transfer_limit.toString(),
        item.daily_limit.toString(),
        item.card_limit.toString(),
        item.commission.toString()
      ])
    ].map(row => row.join(",")).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `historique-parametres-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Taux & Plafonds</h2>
        <Button onClick={handleExportHistory} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter l'historique
        </Button>
      </div>

        <Card>
        <CardHeader>
          <CardTitle>Paramètres globaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Taux de change</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="usd">USD (XAF)</Label>
                  <Input
                    id="usd"
                    type="number"
                    step="0.01"
                    value={formData.usd}
                    onChange={(e) => setFormData(prev => ({ ...prev, usd: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
                <div>
                  <Label htmlFor="eur">EUR (XAF)</Label>
                  <Input
                    id="eur"
                    type="number"
                    step="0.01"
                    value={formData.eur}
                    onChange={(e) => setFormData(prev => ({ ...prev, eur: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
                <div>
                  <Label htmlFor="gbp">GBP (XAF)</Label>
                  <Input
                    id="gbp"
                    type="number"
                    step="0.01"
                    value={formData.gbp}
                    onChange={(e) => setFormData(prev => ({ ...prev, gbp: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Plafonds</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="transfer_limit">Limite de transfert (XAF)</Label>
                  <Input
                    id="transfer_limit"
                    type="number"
                    value={formData.transfer_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, transfer_limit: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
                <div>
                  <Label htmlFor="daily_limit">Limite quotidienne (XAF)</Label>
                  <Input
                    id="daily_limit"
                    type="number"
                    value={formData.daily_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, daily_limit: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
                <div>
                  <Label htmlFor="card_limit">Limite carte (XAF)</Label>
                  <Input
                    id="card_limit"
                    type="number"
                    value={formData.card_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, card_limit: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
                <div>
                  <Label htmlFor="commission">Commission (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    step="0.01"
                    value={formData.commission}
                    onChange={(e) => setFormData(prev => ({ ...prev, commission: e.target.value }))}
                    readOnly={!hasPermission(currentUser, "edit_rates")}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            {hasPermission(currentUser, "edit_rates") && (
              <Button onClick={handleSaveSettings} disabled={pending}>
                {pending ? "Mise à jour..." : "Mettre à jour"}
            </Button>
            )}
          </div>
          </CardContent>
        </Card>

        <Card>
        <CardHeader>
          <CardTitle>Historique des modifications</CardTitle>
        </CardHeader>
        <CardContent>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                  {["Date","Utilisateur","USD","EUR","GBP","Limite Transfert","Limite Quotidienne","Limite Carte","Commission"].map((h)=>(
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
                {history.map((item)=>(
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(item.created_at).toLocaleString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.changed_by || "Système"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.usd}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.eur}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.gbp}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.transfer_limit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.daily_limit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.card_limit.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.commission}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        </CardContent>
      </Card>
    </div>
  )
}