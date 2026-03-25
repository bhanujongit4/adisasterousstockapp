'use client'

import type { SignalTimeframe } from '../../../shared/contracts/stockSignal'
import { useStockSignal } from '../hooks/useStockSignal'

interface Props {
  ticker: string
  timeframe?: SignalTimeframe
}

export default function StockSignalCard({ ticker, timeframe = '15m' }: Props) {
  const { signal, loading, error, refresh } = useStockSignal(ticker, timeframe)

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Stock Intelligence: {ticker}</strong>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </div>

      {loading && <p>Loading signals...</p>}
      {error && <p style={{ color: 'var(--red)' }}>{error}</p>}

      {!loading && !error && !signal && <p>No signal data yet.</p>}

      {!loading && !error && signal && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div>Regime: <strong>{signal.regime.regime}</strong> ({Math.round((signal.regime.confidence ?? 0) * 100)}%)</div>
          <div>Latency: <strong>{signal.microstructure.latency_regime}</strong> | Congestion: {signal.microstructure.congestion_score?.toFixed(3)}</div>
          <div style={{ color: 'var(--text-muted)' }}>{signal.trading_note}</div>
        </div>
      )}
    </section>
  )
}
