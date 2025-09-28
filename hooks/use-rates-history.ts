"use client"

import { useState, useEffect } from "react"

export interface RatesHistoryItem {
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

export interface ChartDataPoint {
  d: string
  usd: number
  eur: number
  gbp: number
}

export function useRatesHistory() {
  const [history, setHistory] = useState<RatesHistoryItem[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/settings')
        const data = await response.json()
        
        if (response.ok && data?.ok && data.data?.history) {
          const historyData = data.data.history
          setHistory(historyData)
          
          // Convertir l'historique en format pour le graphique
          const chartDataPoints: ChartDataPoint[] = historyData
            .slice(0, 10) // Limiter aux 10 dernières entrées
            .reverse() // Inverser pour avoir les plus anciens en premier
            .map((item, index) => ({
              d: new Date(item.created_at).toLocaleDateString('fr-FR', { 
                day: '2-digit', 
                month: '2-digit' 
              }),
              usd: Number(item.usd),
              eur: Number(item.eur),
              gbp: Number(item.gbp)
            }))
          
          setChartData(chartDataPoints)
        } else {
          setError('Impossible de charger l\'historique des taux')
          
          // Données par défaut en cas d'erreur
          const defaultData: ChartDataPoint[] = [
            { d: "01/06", usd: 570, eur: 640, gbp: 735 },
            { d: "02/06", usd: 572, eur: 640, gbp: 735 },
            { d: "03/06", usd: 575, eur: 642, gbp: 735 },
            { d: "04/06", usd: 575, eur: 645, gbp: 735 },
            { d: "05/06", usd: 575, eur: 645, gbp: 740 },
            { d: "06/06", usd: 575, eur: 645, gbp: 740 },
            { d: "07/06", usd: 575, eur: 645, gbp: 740 },
            { d: "08/06", usd: 575, eur: 645, gbp: 740 },
            { d: "09/06", usd: 580, eur: 650, gbp: 750 },
            { d: "10/06", usd: 580, eur: 650, gbp: 750 },
          ]
          setChartData(defaultData)
        }
      } catch (err) {
        setError('Erreur lors du chargement de l\'historique des taux')
        
        // Données par défaut en cas d'erreur
        const defaultData: ChartDataPoint[] = [
          { d: "01/06", usd: 570, eur: 640, gbp: 735 },
          { d: "02/06", usd: 572, eur: 640, gbp: 735 },
          { d: "03/06", usd: 575, eur: 642, gbp: 735 },
          { d: "04/06", usd: 575, eur: 645, gbp: 735 },
          { d: "05/06", usd: 575, eur: 645, gbp: 740 },
          { d: "06/06", usd: 575, eur: 645, gbp: 740 },
          { d: "07/06", usd: 575, eur: 645, gbp: 740 },
          { d: "08/06", usd: 575, eur: 645, gbp: 740 },
          { d: "09/06", usd: 580, eur: 650, gbp: 750 },
          { d: "10/06", usd: 580, eur: 650, gbp: 750 },
        ]
        setChartData(defaultData)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  return { history, chartData, loading, error }
}
