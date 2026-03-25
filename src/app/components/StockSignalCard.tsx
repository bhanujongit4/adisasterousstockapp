'use client'

import { useMemo, useState } from 'react'
import styles from './StockSignalCard.module.css'

type SignalTimeframe = '5m' | '15m' | '1h' | '1d'

interface RegimeResult {
  ticker: string
  regime: string
  confidence: number
  hurst: number
  adx: number
  hmm_regime: string
  hmm_prob: number
  vol_percentile: number
}

interface MicrostructureResult {
  ticker: string
  congestion_score: number
  latency_regime: string
  congestion_trend: string
}

interface AnomalyResult {
  ticker: string
  timeframe: string
  latest_timestamp: number
  latest_price: number
  severity: 'CRITICAL' | 'WARNING' | 'WATCH' | 'NORMAL'
  composite_score: number
  anomaly_note: string
  engine_scores: {
    isolation_forest: number
    rolling_zscore: number
    cusum: number
  }
  top_features: Array<[string, number]>
  components: {
    score_percentile?: number
  }
  recent_markers: Array<{
    timestamp: number
    severity: 'CRITICAL' | 'WARNING' | 'WATCH' | 'NORMAL'
    composite_score: number
    price?: number | null
  }>
}

interface Props {
  ticker: string
  onAnomalyOverlayChange?: (markers: AnomalyResult['recent_markers']) => void
}

function sentimentClass(value: string) {
  const v = value.toUpperCase()
  if (v.includes('UP') || v === 'LOW' || v === 'IMPROVING') return styles.positive
  if (v.includes('DOWN') || v === 'HIGH' || v === 'EXTREME' || v === 'WORSENING') return styles.negative
  return styles.neutral
}

export default function StockSignalCard({ ticker, onAnomalyOverlayChange }: Props) {
  const [regimeTimeframe, setRegimeTimeframe] = useState<SignalTimeframe>('1h')
  const [microTimeframe, setMicroTimeframe] = useState<'5m' | '15m'>('5m')
  const [anomalyTimeframe, setAnomalyTimeframe] = useState<SignalTimeframe>('15m')
  const [anomalyContamination, setAnomalyContamination] = useState('0.02')

  const [regimeLoading, setRegimeLoading] = useState(false)
  const [microLoading, setMicroLoading] = useState(false)
  const [anomalyLoading, setAnomalyLoading] = useState(false)
  const [regimeError, setRegimeError] = useState('')
  const [microError, setMicroError] = useState('')
  const [anomalyError, setAnomalyError] = useState('')
  const [regimeData, setRegimeData] = useState<RegimeResult | null>(null)
  const [microData, setMicroData] = useState<MicrostructureResult | null>(null)
  const [anomalyData, setAnomalyData] = useState<AnomalyResult | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string>('')

  const toErrorText = (value: unknown, fallback: string) => {
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).join(' | ')
    if (value && typeof value === 'object') return JSON.stringify(value)
    return fallback
  }

  async function generateRegime() {
    setRegimeLoading(true)
    setRegimeError('')
    try {
      const res = await fetch(`/api/signals/regime?ticker=${encodeURIComponent(ticker)}&timeframe=${regimeTimeframe}`, { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) {
        setRegimeError(toErrorText(payload?.error, 'Failed to generate regime signal.'))
        return
      }
      setRegimeData(payload?.regime ?? null)
      setGeneratedAt(new Date().toLocaleTimeString('en-US', { hour12: false }))
    } catch {
      setRegimeError('Failed to generate regime signal.')
    } finally {
      setRegimeLoading(false)
    }
  }

  async function generateMicrostructure() {
    setMicroLoading(true)
    setMicroError('')
    try {
      const res = await fetch(`/api/signals/microstructure?ticker=${encodeURIComponent(ticker)}&timeframe=${microTimeframe}`, { cache: 'no-store' })
      const payload = await res.json()
      if (!res.ok) {
        setMicroError(toErrorText(payload?.error, 'Failed to generate microstructure signal.'))
        return
      }
      setMicroData(payload?.microstructure ?? null)
      setGeneratedAt(new Date().toLocaleTimeString('en-US', { hour12: false }))
    } catch {
      setMicroError('Failed to generate microstructure signal.')
    } finally {
      setMicroLoading(false)
    }
  }

  async function generateAnomaly() {
    setAnomalyLoading(true)
    setAnomalyError('')
    try {
      const res = await fetch(
        `/api/signals/anomaly?ticker=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(anomalyTimeframe)}&contamination=${encodeURIComponent(anomalyContamination)}`,
        { cache: 'no-store' }
      )
      const payload = await res.json()
      if (!res.ok) {
        setAnomalyError(toErrorText(payload?.error, 'Failed to generate anomaly signal.'))
        return
      }
      const anomaly = payload?.anomaly ?? null
      setAnomalyData(anomaly)
      onAnomalyOverlayChange?.(Array.isArray(anomaly?.recent_markers) ? anomaly.recent_markers : [])
      setGeneratedAt(new Date().toLocaleTimeString('en-US', { hour12: false }))
    } catch {
      setAnomalyError('Failed to generate anomaly signal.')
    } finally {
      setAnomalyLoading(false)
    }
  }

  const confidencePct = useMemo(() => (regimeData ? Math.round((regimeData.confidence ?? 0) * 100) : 0), [regimeData])

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>STOCK INTELLIGENCE LAB</div>
          <div className={styles.subtitle}>{ticker} · manual generation only</div>
        </div>
        {generatedAt && <div className={styles.generated}>LAST RUN {generatedAt}</div>}
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Regime Model</span>
            <select className={styles.select} value={regimeTimeframe} onChange={(e) => setRegimeTimeframe(e.target.value as SignalTimeframe)}>
              <option value="5m">5M</option>
              <option value="15m">15M</option>
              <option value="1h">1H</option>
              <option value="1d">1D</option>
            </select>
          </div>

          <button className={styles.generateBtn} onClick={() => void generateRegime()} disabled={regimeLoading}>
            {regimeLoading ? 'Generating...' : 'Generate Regime Results'}
          </button>

          {regimeError && <div className={styles.error}>{regimeError}</div>}

          {regimeData && (
            <div className={styles.metrics}>
              <div className={styles.metricRow}>
                <span>Regime</span>
                <span className={sentimentClass(regimeData.regime)}>{regimeData.regime}</span>
              </div>
              <div className={styles.metricRow}>
                <span>Confidence</span>
                <span className={confidencePct >= 55 ? styles.positive : styles.negative}>{confidencePct}%</span>
              </div>
              <div className={styles.metricRow}><span>Hurst</span><span>{regimeData.hurst?.toFixed(3)}</span></div>
              <div className={styles.metricRow}><span>ADX</span><span>{regimeData.adx?.toFixed(2)}</span></div>
              <div className={styles.metricRow}><span>HMM Regime</span><span>{regimeData.hmm_regime}</span></div>
              <div className={styles.metricRow}><span>HMM Prob</span><span>{(regimeData.hmm_prob * 100).toFixed(1)}%</span></div>
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Microstructure Model</span>
            <select className={styles.select} value={microTimeframe} onChange={(e) => setMicroTimeframe(e.target.value as '5m' | '15m')}>
              <option value="5m">5M</option>
              <option value="15m">15M</option>
            </select>
          </div>

          <button className={styles.generateBtn} onClick={() => void generateMicrostructure()} disabled={microLoading}>
            {microLoading ? 'Generating...' : 'Generate Microstructure Results'}
          </button>

          {microError && <div className={styles.error}>{microError}</div>}

          {microData && (
            <div className={styles.metrics}>
              <div className={styles.metricRow}>
                <span>Latency Regime</span>
                <span className={sentimentClass(microData.latency_regime)}>{microData.latency_regime}</span>
              </div>
              <div className={styles.metricRow}>
                <span>Congestion Trend</span>
                <span className={sentimentClass(microData.congestion_trend)}>{microData.congestion_trend}</span>
              </div>
              <div className={styles.metricRow}>
                <span>Congestion Score</span>
                <span className={microData.congestion_score <= 0.45 ? styles.positive : microData.congestion_score >= 0.7 ? styles.negative : styles.neutral}>
                  {microData.congestion_score?.toFixed(3)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>Anomaly Model</span>
            <div className={styles.inlineControls}>
              <select className={styles.select} value={anomalyTimeframe} onChange={(e) => setAnomalyTimeframe(e.target.value as SignalTimeframe)}>
                <option value="5m">5M</option>
                <option value="15m">15M</option>
                <option value="1h">1H</option>
                <option value="1d">1D</option>
              </select>
              <input
                className={styles.input}
                value={anomalyContamination}
                onChange={(e) => setAnomalyContamination(e.target.value)}
                title="contamination"
                placeholder="0.02"
              />
            </div>
          </div>

          <button className={styles.generateBtn} onClick={() => void generateAnomaly()} disabled={anomalyLoading}>
            {anomalyLoading ? 'Generating...' : 'Generate Anomaly Results'}
          </button>

          {anomalyError && <div className={styles.error}>{anomalyError}</div>}

          {anomalyData && (
            <div className={styles.metrics}>
              <div className={styles.metricRow}>
                <span>Severity</span>
                <span className={
                  anomalyData.severity === 'NORMAL'
                    ? styles.positive
                    : anomalyData.severity === 'WATCH'
                      ? styles.neutral
                      : styles.negative
                }>
                  {anomalyData.severity}
                </span>
              </div>
              <div className={styles.metricRow}><span>Candle Time</span><span>{new Date(anomalyData.latest_timestamp * 1000).toLocaleString('en-US', { hour12: false })}</span></div>
              <div className={styles.metricRow}><span>Close Price</span><span>${anomalyData.latest_price?.toFixed(2)}</span></div>
              <div className={styles.metricRow}>
                <span>Composite Score</span>
                <span className={
                  anomalyData.composite_score < 0.45
                    ? styles.positive
                    : anomalyData.composite_score < 0.65
                      ? styles.neutral
                      : styles.negative
                }>
                  {anomalyData.composite_score.toFixed(4)}
                </span>
              </div>
              <div className={styles.metricRow}><span>Isolation Forest</span><span>{anomalyData.engine_scores?.isolation_forest?.toFixed(4)}</span></div>
              <div className={styles.metricRow}><span>Rolling Z-Score</span><span>{anomalyData.engine_scores?.rolling_zscore?.toFixed(4)}</span></div>
              <div className={styles.metricRow}><span>CUSUM</span><span>{anomalyData.engine_scores?.cusum?.toFixed(4)}</span></div>
              {anomalyData.components?.score_percentile !== undefined && (
                <div className={styles.metricRow}><span>Score Percentile</span><span>{(anomalyData.components.score_percentile * 100).toFixed(1)}%</span></div>
              )}
              {Array.isArray(anomalyData.top_features) && anomalyData.top_features.length > 0 && (
                <div className={styles.featureList}>
                  {anomalyData.top_features.slice(0, 3).map((item) => (
                    <span key={item[0]} className={styles.featurePill}>{item[0]} · z={item[1]}</span>
                  ))}
                </div>
              )}
              <div className={styles.noteBox}>{anomalyData.anomaly_note}</div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
