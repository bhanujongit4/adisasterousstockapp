'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchStockQuotes, StockQuote, DEFAULT_WATCHLIST, type ChartTimeframe } from '../lib/stockData'

export function useStockData() {
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true)
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5m')

  const refresh = useCallback(async () => {
    const data = await fetchStockQuotes(DEFAULT_WATCHLIST, timeframe)
    setStocks(data)
    setLastUpdated(new Date())
  }, [timeframe])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const data = await fetchStockQuotes(DEFAULT_WATCHLIST, timeframe)
      if (cancelled) return
      setStocks(data)
      setLoading(false)
      setLastUpdated(new Date())
    }

    load()
    return () => {
      cancelled = true
    }
  }, [timeframe])

  useEffect(() => {
    if (!autoRefreshEnabled) return
    const id = setInterval(() => {
      refresh()
    }, 5000)
    return () => clearInterval(id)
  }, [autoRefreshEnabled, refresh])

  const selectedStock = stocks.find(s => s.symbol === selectedSymbol) ?? stocks[0] ?? null

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
