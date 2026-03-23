'use client'

import { useState, useEffect, useCallback } from 'react'
import { getMockStocks, StockQuote, DEFAULT_WATCHLIST } from '../lib/stockData'

export function useStockData() {
  const [stocks, setStocks] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL')

  const refresh = useCallback(() => {
    // Simulate price drift on refresh
    setStocks(prev => {
      if (prev.length === 0) return prev
      return prev.map(s => {
        const drift = (Math.random() - 0.49) * 0.4
        const newPrice = parseFloat((s.price + drift).toFixed(2))
        const newChange = parseFloat((s.change + drift).toFixed(2))
        const newChangePct = parseFloat(((newChange / s.prevClose) * 100).toFixed(2))
        const newHistory = [
          ...s.history.slice(1),
          {
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
            price: newPrice,
            volume: Math.floor(Math.random() * 500_000 + 100_000),
          },
        ]
        return { ...s, price: newPrice, change: newChange, changePercent: newChangePct, history: newHistory }
      })
    })
    setLastUpdated(new Date())
  }, [])

  useEffect(() => {
    const data = getMockStocks()
    setStocks(data)
    setLoading(false)
    setLastUpdated(new Date())
  }, [])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  const selectedStock = stocks.find(s => s.symbol === selectedSymbol) ?? stocks[0] ?? null

  return { stocks, loading, lastUpdated, selectedSymbol, setSelectedSymbol, selectedStock, refresh }
}