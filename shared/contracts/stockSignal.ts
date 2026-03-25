export type SignalTimeframe = '5m' | '15m' | '1h' | '1d'

export interface RegimeSignal {
  ticker: string
  regime: string
  confidence: number
  hurst: number
  adx: number
  hmm_regime: string
  hmm_prob: number
  vol_percentile: number
  components: Record<string, unknown>
}

export interface MicrostructureSignal {
  ticker: string
  congestion_score: number
  latency_regime: string
  congestion_trend: string
  components: Record<string, unknown>
}

export interface StockSignal {
  ticker: string
  price: number | null
  regime: RegimeSignal
  microstructure: MicrostructureSignal
  trading_note: string
  timestamp: string
}
