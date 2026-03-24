'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchStockQuotes, StockQuote, type ChartTimeframe } from '../lib/stockData'

type Options = {
  symbols: string[]
  enabled: boolean
}

export function useStockData({ symbols, enabled }: Options) {
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string>('')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5m')

  const refresh = useCallback(async () => {
    if (!enabled || symbols.length === 0) {
      setStocks([])
      setLastUpdated(new Date())
      return
    }
    const data = await fetchStockQuotes(symbols, timeframe)
    setStocks(data)
    setLastUpdated(new Date())
  }, [enabled, symbols, timeframe])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      if (!enabled) {
        if (!cancelled) {
          setStocks([])
          setLoading(false)
          setHasLoadedOnce(false)
          setLastUpdated(null)
        }
        return
      }

      if (symbols.length === 0) {
        if (!cancelled) {
          setStocks([])
          setLoading(false)
          setHasLoadedOnce(true)
          setLastUpdated(new Date())
        }
        return
      }

      if (!hasLoadedOnce) {
        setLoading(true)
      }

      const data = await fetchStockQuotes(symbols, timeframe)
      if (cancelled) return
      setStocks(data)
      setLoading(false)
      setHasLoadedOnce(true)
      setLastUpdated(new Date())
    }

    load()
    return () => {
      cancelled = true
    }
  }, [enabled, hasLoadedOnce, symbols, timeframe])

  useEffect(() => {
    if (!autoRefreshEnabled || !enabled || symbols.length === 0) return
    const id = setInterval(() => {
      refresh()
    }, 5000)
    return () => clearInterval(id)
  }, [autoRefreshEnabled, enabled, refresh, symbols.length])

  useEffect(() => {
    if (stocks.length === 0) {
      setSelectedSymbol('')
      return
    }

    if (!stocks.some((s) => s.symbol === selectedSymbol)) {
      setSelectedSymbol(stocks[0].symbol)
    }
  }, [selectedSymbol, stocks])

  const selectedStock = stocks.find((s) => s.symbol === selectedSymbol) ?? stocks[0] ?? null

  return {
    stocks,
    loading,
    lastUpdated,
    selectedSymbol,
    setSelectedSymbol,
    selectedStock,
    refresh,
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    timeframe,
    setTimeframe,
  }
}
