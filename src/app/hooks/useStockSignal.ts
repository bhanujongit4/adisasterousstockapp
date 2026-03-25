'use client'

import { useEffect, useState } from 'react'
import type { SignalTimeframe, StockSignal } from '../../../shared/contracts/stockSignal'

interface UseStockSignalResult {
  signal: StockSignal | null
  loading: boolean
  error: string
  refresh: () => Promise<void>
}

export function useStockSignal(ticker: string, timeframe: SignalTimeframe = '15m'): UseStockSignalResult {
  const [signal, setSignal] = useState<StockSignal | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    if (!ticker) {
      setSignal(null)
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/signals?ticker=${encodeURIComponent(ticker)}&timeframe=${timeframe}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error ?? 'Failed to load signals.')
        setSignal(null)
        return
      }
      setSignal(json?.signal ?? null)
    } catch {
      setError('Failed to load signals.')
      setSignal(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, timeframe])

  return { signal, loading, error, refresh }
}
