"use client"

import { useState, useEffect } from "react"

export interface ExchangeRates {
  USD: number
  EUR: number
  GBP: number
  commission: number
}

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>({
    USD: 580,
    EUR: 650,
    GBP: 750,
    commission: 1.0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const response = await fetch('/api/settings')
        const data = await response.json()
        
        if (response.ok && data?.ok && data.data?.settings) {
          const settings = data.data.settings
          setRates({
            USD: Number(settings.usd) || 580,
            EUR: Number(settings.eur) || 650,
            GBP: Number(settings.gbp) || 750,
            commission: Number(settings.commission) || 1.0
          })
        } else {
          setError('Impossible de charger les taux de change')
        }
      } catch (err) {
        setError('Erreur lors du chargement des taux de change')
      } finally {
        setLoading(false)
      }
    }

    fetchRates()
  }, [])

  return { rates, loading, error }
}
