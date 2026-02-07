"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export interface ExchangeRates {
  USD: number
  EUR: number
  GBP: number
  /** Taux d'achat USD (XAF) */
  USD_buy: number
  /** Taux de vente USD (XAF) */
  USD_sell: number
  /** Taux d'achat EUR (XAF) */
  EUR_buy: number
  /** Taux de vente EUR (XAF) */
  EUR_sell: number
  /** Taux d'achat GBP (XAF) */
  GBP_buy: number
  /** Taux de vente GBP (XAF) */
  GBP_sell: number
  commission: number
}

/** Intervalle de rafraîchissement automatique (30 secondes) */
const REFRESH_INTERVAL_MS = 30_000

export function useExchangeRates() {
  const [rates, setRates] = useState<ExchangeRates>({
    USD: 580,
    EUR: 650,
    GBP: 750,
    USD_buy: 569,
    USD_sell: 575,
    EUR_buy: 693,
    EUR_sell: 700,
    GBP_buy: 800,
    GBP_sell: 810,
    commission: 1.0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRates = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true)
      setError(null)

      const response = await fetch("/api/settings?type=public")
      const data = await response.json()

      if (response.ok && data?.ok && data.data?.settings) {
        const s = data.data.settings
        setRates({
          USD: Number(s.usd) || 580,
          EUR: Number(s.eur) || 650,
          GBP: Number(s.gbp) || 750,
          USD_buy: Number(s.usd_buy) || Number(s.usd) || 569,
          USD_sell: Number(s.usd_sell) || Number(s.usd) || 575,
          EUR_buy: Number(s.eur_buy) || Number(s.eur) || 693,
          EUR_sell: Number(s.eur_sell) || Number(s.eur) || 700,
          GBP_buy: Number(s.gbp_buy) || Number(s.gbp) || 800,
          GBP_sell: Number(s.gbp_sell) || Number(s.gbp) || 810,
          commission: Number(s.commission) || 1.0,
        })
      } else {
        setError("Impossible de charger les taux de change")
      }
    } catch (err) {
      setError("Erreur lors du chargement des taux de change")
    } finally {
      if (isInitial) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Chargement initial
    fetchRates(true)

    // Rafraîchissement automatique toutes les 30 secondes
    intervalRef.current = setInterval(() => {
      fetchRates(false)
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchRates])

  /** Permet de forcer un rafraîchissement manuel */
  const refresh = useCallback(() => fetchRates(false), [fetchRates])

  return { rates, loading, error, refresh }
}
