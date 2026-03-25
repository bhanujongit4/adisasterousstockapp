'use client'

import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  AreaSeries,
  BarSeries,
  BaselineSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import { StockQuote, type ChartTimeframe } from '../lib/stockData'
import styles from './StockChart.module.css'
import {
  ADL,
  ADX,
  ATR,
  AwesomeOscillator,
  BollingerBands,
  CCI,
  EMA,
  ForceIndex,
  IchimokuCloud,
  KeltnerChannels,
  MACD,
  MFI,
  OBV,
  PSAR,
  ROC,
  RSI,
  SMA,
  Stochastic,
  TRIX,
  VWAP,
  WMA,
  WilliamsR,
} from 'technicalindicators'

interface Props {
  stock: StockQuote
  autoRefreshEnabled: boolean
  setAutoRefreshEnabled: Dispatch<SetStateAction<boolean>>
  timeframe: ChartTimeframe
  setTimeframe: Dispatch<SetStateAction<ChartTimeframe>>
  theme: 'dark' | 'light'
  anomalyMarkers?: Array<{
    timestamp: number
    severity: 'CRITICAL' | 'WARNING' | 'WATCH' | 'NORMAL'
    composite_score: number
    price?: number | null
  }>
}

type ChartType = 'candlestick' | 'line' | 'area' | 'bar' | 'baseline'
type DrawMode = 'none' | 'trendline' | 'marker' | 'note'
type Timeframe = ChartTimeframe
type IndicatorPane = 'overlay' | 'oscillator'

type IndicatorKey =
  | 'SMA'
  | 'EMA'
  | 'WMA'
  | 'BOLLINGER'
  | 'VWAP'
  | 'PSAR'
  | 'KELTNER'
  | 'ICHIMOKU'
  | 'RSI'
  | 'MACD'
  | 'STOCH'
  | 'WILLIAMSR'
  | 'CCI'
  | 'ADX'
  | 'ATR'
  | 'ROC'
  | 'TRIX'
  | 'MFI'
  | 'OBV'
  | 'ADL'
  | 'FORCE'
  | 'AO'

interface PointAnnotation {
  time: number
  price: number
}

interface TrendlineAnnotation {
  id: string
  start: PointAnnotation
  end: PointAnnotation
  color: string
}

interface MarkerAnnotation extends PointAnnotation {
  id: string
  color: string
  label: string
}

interface NoteAnnotation extends PointAnnotation {
  id: string
  text: string
  fontSize?: number
}

interface StoredAnnotations {
  trendlines: TrendlineAnnotation[]
  markers: MarkerAnnotation[]
  notes: NoteAnnotation[]
}

type AnnotationKind = 'trendline' | 'marker' | 'note'

interface NotePosition extends NoteAnnotation {
  left: number
  top: number
}

interface MarkerControlPosition {
  id: string
  left: number
  top: number
}

interface TrendlineControlPosition {
  id: string
  left: number
  top: number
}

interface AggregatedHistoryBar {
  timestamp: number
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface CandleDetails {
  timestamp: number
  timeLabel: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface IndicatorDefinition {
  key: IndicatorKey
  label: string
  pane: IndicatorPane
  description: string
}

interface IndicatorLine {
  id: string
  label: string
  pane: IndicatorPane
  color: string
  data: Array<{ time: UTCTimestamp; value: number }>
}

interface IndicatorValueSnapshot {
  id: string
  label: string
  pane: IndicatorPane
  color: string
  value: number
}

interface HoverDetails {
  timeLabel: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  indicatorValues: IndicatorValueSnapshot[]
  anomalySeverity?: string
  anomalyScore?: number
}

interface PaneOverlayState {
  tops: number[]
  separators: number[]
}

const EMPTY_ANNOTATIONS: StoredAnnotations = {
  trendlines: [],
  markers: [],
  notes: [],
}

const INDICATOR_COLORS = ['#29c38a', '#e3a548', '#e06d78', '#9aa6bb', '#7bc5a2', '#c7a76a', '#b08ad2', '#7f8ca2', '#89b9a6']
const DEFAULT_PANE_FACTORS: Record<number, number[]> = {
  2: [0.78, 0.22],
  3: [0.62, 0.18, 0.2],
}
const INDICATOR_DEFINITIONS: IndicatorDefinition[] = [
  { key: 'SMA', label: 'SMA', pane: 'overlay', description: 'Simple moving average trend smoothing.' },
  { key: 'EMA', label: 'EMA', pane: 'overlay', description: 'Exponential moving average with faster reaction.' },
  { key: 'WMA', label: 'WMA', pane: 'overlay', description: 'Weighted moving average emphasizing recent prices.' },
  { key: 'BOLLINGER', label: 'Bollinger Bands', pane: 'overlay', description: 'Volatility envelopes around moving average.' },
  { key: 'VWAP', label: 'VWAP', pane: 'overlay', description: 'Volume weighted average price anchor.' },
  { key: 'PSAR', label: 'Parabolic SAR', pane: 'overlay', description: 'Trend-following stop and reversal points.' },
  { key: 'KELTNER', label: 'Keltner Channels', pane: 'overlay', description: 'ATR-based channel around EMA.' },
  { key: 'ICHIMOKU', label: 'Ichimoku', pane: 'overlay', description: 'Multi-line trend and momentum cloud system.' },
  { key: 'RSI', label: 'RSI', pane: 'oscillator', description: 'Momentum oscillator with overbought/oversold zones.' },
  { key: 'MACD', label: 'MACD', pane: 'oscillator', description: 'Momentum crossover between fast and slow EMAs.' },
  { key: 'STOCH', label: 'Stochastic', pane: 'oscillator', description: 'Close-relative momentum (%K/%D).' },
  { key: 'WILLIAMSR', label: 'Williams %R', pane: 'oscillator', description: 'Momentum on a -100 to 0 scale.' },
  { key: 'CCI', label: 'CCI', pane: 'oscillator', description: 'Commodity channel deviation oscillator.' },
  { key: 'ADX', label: 'ADX', pane: 'oscillator', description: 'Trend strength plus DI directional lines.' },
  { key: 'ATR', label: 'ATR', pane: 'oscillator', description: 'Average true range volatility measure.' },
  { key: 'ROC', label: 'ROC', pane: 'oscillator', description: 'Rate of change momentum percentage.' },
  { key: 'TRIX', label: 'TRIX', pane: 'oscillator', description: 'Triple-smoothed momentum oscillator.' },
  { key: 'MFI', label: 'MFI', pane: 'oscillator', description: 'Volume-weighted RSI-style momentum oscillator.' },
  { key: 'OBV', label: 'OBV', pane: 'oscillator', description: 'Cumulative volume flow indicator.' },
  { key: 'ADL', label: 'ADL', pane: 'oscillator', description: 'Accumulation/Distribution line from price+volume.' },
  { key: 'FORCE', label: 'Force Index', pane: 'oscillator', description: 'Price impulse weighted by volume.' },
  { key: 'AO', label: 'Awesome Osc', pane: 'oscillator', description: 'Momentum from short vs long midpoint average.' },
]

function asUtcTimestamp(value: number): UTCTimestamp {
  return value as UTCTimestamp
}

function sortByTime<T extends { time: UTCTimestamp }>(data: T[]): T[] {
  return [...data].sort((a, b) => Number(a.time) - Number(b.time))
}

function formatBucketTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function aggregateHistory(history: StockQuote['history'], timeframe: Timeframe): AggregatedHistoryBar[] {
  const minutes = timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : timeframe === '1h' ? 60 : 1440
  const bucketSizeSeconds = minutes * 60
  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp)
  if (sorted.length === 0) return []

  const bars: AggregatedHistoryBar[] = []
  let currentBucketStart = -1
  let currentBar: AggregatedHistoryBar | null = null

  for (const item of sorted) {
    const bucketStart = Math.floor(item.timestamp / bucketSizeSeconds) * bucketSizeSeconds

    if (!currentBar || bucketStart !== currentBucketStart) {
      if (currentBar) bars.push(currentBar)
      currentBucketStart = bucketStart
      const open = Number.isFinite(Number(item.open)) ? Number(item.open) : item.price
      const high = Number.isFinite(Number(item.high)) ? Number(item.high) : item.price
      const low = Number.isFinite(Number(item.low)) ? Number(item.low) : item.price
      currentBar = {
        timestamp: bucketStart,
        time: formatBucketTime(bucketStart),
        open,
        high,
        low,
        close: item.price,
        volume: item.volume,
      }
      continue
    }

    const high = Number.isFinite(Number(item.high)) ? Number(item.high) : item.price
    const low = Number.isFinite(Number(item.low)) ? Number(item.low) : item.price
    currentBar.high = Math.max(currentBar.high, high, item.price)
    currentBar.low = Math.min(currentBar.low, low, item.price)
    currentBar.close = item.price
    currentBar.volume += item.volume
  }

  if (currentBar) bars.push(currentBar)
  return bars
}

function getBarSpacing(timeframe: Timeframe, scale = 1) {
  if (timeframe === '5m') return Math.round(5 * scale)
  if (timeframe === '15m') return Math.round(7 * scale)
  if (timeframe === '1h') return Math.round(10 * scale)
  return Math.round(14 * scale)
}

function buildAlignedSeries(
  times: UTCTimestamp[],
  values: Array<number | undefined | null>,
): Array<{ time: UTCTimestamp; value: number }> {
  const validValues = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (validValues.length === 0) return []
  const startIndex = Math.max(0, times.length - validValues.length)
  return validValues.map((value, idx) => ({
    time: times[startIndex + idx],
    value,
  }))
}

export default function StockChart({
  stock,
  autoRefreshEnabled,
  setAutoRefreshEnabled,
  timeframe,
  setTimeframe,
  theme,
  anomalyMarkers = [],
}: Props) {
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorKey[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [trendlineStart, setTrendlineStart] = useState<PointAnnotation | null>(null)
  const [annotations, setAnnotations] = useState<StoredAnnotations>(EMPTY_ANNOTATIONS)
  const [annotationsLoading, setAnnotationsLoading] = useState(false)
  const [annotationsError, setAnnotationsError] = useState('')
  const [pendingNotePoint, setPendingNotePoint] = useState<PointAnnotation | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [pendingNotePosition, setPendingNotePosition] = useState<{ left: number; top: number } | null>(null)
  const [notePositions, setNotePositions] = useState<NotePosition[]>([])
  const [markerControlPositions, setMarkerControlPositions] = useState<MarkerControlPosition[]>([])
  const [trendlineControlPositions, setTrendlineControlPositions] = useState<TrendlineControlPosition[]>([])
  const [hoverDetails, setHoverDetails] = useState<HoverDetails | null>(null)
  const [paneOverlay, setPaneOverlay] = useState<PaneOverlayState>({ tops: [10, 10], separators: [0] })

  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area' | 'Bar' | 'Baseline', Time> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram', Time> | null>(null)
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const trendlineSeriesRef = useRef<Map<string, ISeriesApi<'Line', Time>>>(new Map())
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line', Time>>>(new Map())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const drawModeRef = useRef<DrawMode>(drawMode)
  const isFullscreenRef = useRef<boolean>(isFullscreen)
  const trendlineStartRef = useRef<PointAnnotation | null>(trendlineStart)
  const annotationsRef = useRef<StoredAnnotations>(annotations)
  const candleLookupRef = useRef<Map<number, CandleDetails>>(new Map())
  const indicatorLinesRef = useRef<IndicatorLine[]>([])
  const updateOverlayPositionsRef = useRef<() => void>(() => {})
  const anomalyByTimeRef = useRef<Map<number, { severity: string; score: number }>>(new Map())
  const paneFactorsByCountRef = useRef<Record<number, number[]>>({ ...DEFAULT_PANE_FACTORS })
  const lastPaneCountRef = useRef<number>(2)

  const aggregatedHistory = useMemo(
    () => aggregateHistory(stock.history, timeframe),
    [stock.history, timeframe]
  )

  const candleLookup = useMemo(() => {
    const map = new Map<number, CandleDetails>()
    for (const item of aggregatedHistory) {
      map.set(item.timestamp, {
        timestamp: item.timestamp,
        timeLabel: item.time,
        open: Number(item.open.toFixed(2)),
        high: Number(item.high.toFixed(2)),
        low: Number(item.low.toFixed(2)),
        close: Number(item.close.toFixed(2)),
        volume: item.volume,
      })
    }
    return map
  }, [aggregatedHistory])

  useEffect(() => {
    candleLookupRef.current = candleLookup
  }, [candleLookup])

  const ohlcData = useMemo(() => sortByTime(aggregatedHistory.map((item, index) => {
    const previousClose = index === 0
      ? item.open
      : aggregatedHistory[index - 1].close
    const open = timeframe === '5m' ? previousClose : item.open
    const close = item.close
    const fallbackSpread = Math.max(0.02, Math.abs(close - open) * 0.28)
    const high = Math.max(item.high, open, close) + fallbackSpread
    const low = Math.max(0.01, Math.min(item.low, open, close) - fallbackSpread)

    return {
      time: asUtcTimestamp(item.timestamp),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
    }
  })), [aggregatedHistory, timeframe])

  const lineLikeData = useMemo(() => sortByTime(ohlcData.map((bar) => ({
    time: bar.time,
    value: bar.close,
  }))), [ohlcData])

  const volumeData = useMemo(() => sortByTime(aggregatedHistory.map((item) => {
    return {
      time: asUtcTimestamp(item.timestamp),
      value: item.volume,
      color: item.close >= item.open ? 'rgba(20, 184, 166, 0.48)' : 'rgba(239, 68, 68, 0.48)',
    }
  })), [aggregatedHistory])

  const indicatorLines = useMemo<IndicatorLine[]>(() => {
    const result: IndicatorLine[] = []
    const times = aggregatedHistory.map((h) => asUtcTimestamp(h.timestamp))
    const close = aggregatedHistory.map((h) => h.close)
    const high = aggregatedHistory.map((h) => h.high)
    const low = aggregatedHistory.map((h) => h.low)
    const volume = aggregatedHistory.map((h) => h.volume)

    const pushLine = (id: string, label: string, pane: IndicatorPane, values: Array<number | undefined | null>) => {
      const data = buildAlignedSeries(times, values)
      if (data.length === 0) return
      const color = INDICATOR_COLORS[result.length % INDICATOR_COLORS.length]
      result.push({ id, label, pane, color, data })
    }

    for (const key of selectedIndicators) {
      try {
        if (key === 'SMA') pushLine('SMA', 'SMA(14)', 'overlay', SMA.calculate({ period: 14, values: close }))
        if (key === 'EMA') pushLine('EMA', 'EMA(14)', 'overlay', EMA.calculate({ period: 14, values: close }))
        if (key === 'WMA') pushLine('WMA', 'WMA(14)', 'overlay', WMA.calculate({ period: 14, values: close }))
        if (key === 'VWAP') pushLine('VWAP', 'VWAP', 'overlay', VWAP.calculate({ close, high, low, volume }))
        if (key === 'PSAR') pushLine('PSAR', 'PSAR', 'overlay', PSAR.calculate({ high, low, step: 0.02, max: 0.2 }))
        if (key === 'ATR') pushLine('ATR', 'ATR(14)', 'oscillator', ATR.calculate({ period: 14, high, low, close }))
        if (key === 'RSI') pushLine('RSI', 'RSI(14)', 'oscillator', RSI.calculate({ period: 14, values: close }))
        if (key === 'ROC') pushLine('ROC', 'ROC(12)', 'oscillator', ROC.calculate({ period: 12, values: close }))
        if (key === 'TRIX') pushLine('TRIX', 'TRIX(18)', 'oscillator', TRIX.calculate({ period: 18, values: close }))
        if (key === 'CCI') pushLine('CCI', 'CCI(20)', 'oscillator', CCI.calculate({ period: 20, high, low, close }))
        if (key === 'MFI') pushLine('MFI', 'MFI(14)', 'oscillator', MFI.calculate({ period: 14, high, low, close, volume }))
        if (key === 'WILLIAMSR') pushLine('WILLIAMSR', 'Williams%R(14)', 'oscillator', WilliamsR.calculate({ period: 14, high, low, close }))
        if (key === 'OBV') pushLine('OBV', 'OBV', 'oscillator', OBV.calculate({ close, volume }))
        if (key === 'ADL') pushLine('ADL', 'ADL', 'oscillator', ADL.calculate({ close, high, low, volume }))
        if (key === 'FORCE') pushLine('FORCE', 'Force(13)', 'oscillator', ForceIndex.calculate({ close, volume, period: 13 }))
        if (key === 'AO') pushLine('AO', 'Awesome', 'oscillator', AwesomeOscillator.calculate({ high, low, fastPeriod: 5, slowPeriod: 34 }))
        if (key === 'BOLLINGER') {
          const bands = BollingerBands.calculate({ period: 20, stdDev: 2, values: close })
          pushLine('BOLL_MID', 'BB Mid', 'overlay', bands.map((b) => b.middle))
          pushLine('BOLL_UP', 'BB Upper', 'overlay', bands.map((b) => b.upper))
          pushLine('BOLL_LOW', 'BB Lower', 'overlay', bands.map((b) => b.lower))
        }
        if (key === 'KELTNER') {
          const channels = KeltnerChannels.calculate({ high, low, close, maPeriod: 20, atrPeriod: 10, multiplier: 2, useSMA: false })
          pushLine('KELT_MID', 'Kelt Mid', 'overlay', channels.map((c) => c.middle))
          pushLine('KELT_UP', 'Kelt Upper', 'overlay', channels.map((c) => c.upper))
          pushLine('KELT_LOW', 'Kelt Lower', 'overlay', channels.map((c) => c.lower))
        }
        if (key === 'ICHIMOKU') {
          const cloud = IchimokuCloud.calculate({ high, low, conversionPeriod: 9, basePeriod: 26, spanPeriod: 52, displacement: 26 })
          pushLine('ICHI_CONV', 'Ichi Conv', 'overlay', cloud.map((c) => c.conversion))
          pushLine('ICHI_BASE', 'Ichi Base', 'overlay', cloud.map((c) => c.base))
          pushLine('ICHI_SPAN_A', 'Ichi SpanA', 'overlay', cloud.map((c) => c.spanA))
          pushLine('ICHI_SPAN_B', 'Ichi SpanB', 'overlay', cloud.map((c) => c.spanB))
        }
        if (key === 'MACD') {
          const macd = MACD.calculate({
            values: close,
            fastPeriod: 12,
            slowPeriod: 26,
            signalPeriod: 9,
            SimpleMAOscillator: false,
            SimpleMASignal: false,
          })
          pushLine('MACD_LINE', 'MACD', 'oscillator', macd.map((m) => m.MACD))
          pushLine('MACD_SIGNAL', 'MACD Signal', 'oscillator', macd.map((m) => m.signal))
          pushLine('MACD_HIST', 'MACD Hist', 'oscillator', macd.map((m) => m.histogram))
        }
        if (key === 'STOCH') {
          const stochastic = Stochastic.calculate({ high, low, close, period: 14, signalPeriod: 3 })
          pushLine('STOCH_K', 'Stoch %K', 'oscillator', stochastic.map((s) => s.k))
          pushLine('STOCH_D', 'Stoch %D', 'oscillator', stochastic.map((s) => s.d))
        }
        if (key === 'ADX') {
          const adx = ADX.calculate({ high, low, close, period: 14 })
          pushLine('ADX_LINE', 'ADX', 'oscillator', adx.map((a) => a.adx))
          pushLine('ADX_PDI', '+DI', 'oscillator', adx.map((a) => a.pdi))
          pushLine('ADX_MDI', '-DI', 'oscillator', adx.map((a) => a.mdi))
        }
      } catch {
        // Skip indicators that cannot be computed for current data length.
      }
    }

    return result
  }, [aggregatedHistory, selectedIndicators])

  const anomalyByTime = useMemo(() => {
    const map = new Map<number, { severity: string; score: number }>()
    anomalyMarkers.forEach((m) => {
      map.set(m.timestamp, { severity: m.severity, score: m.composite_score })
    })
    return map
  }, [anomalyMarkers])

  useEffect(() => {
    anomalyByTimeRef.current = anomalyByTime
  }, [anomalyByTime])

  async function loadAnnotations(symbol: string) {
    setAnnotationsLoading(true)
    setAnnotationsError('')
    try {
      const res = await fetch(`/api/annotations?symbol=${encodeURIComponent(symbol)}`)
      const data = await res.json()
      if (!res.ok) {
        setAnnotationsError(data?.error ?? 'Failed to load annotations.')
        setAnnotations(EMPTY_ANNOTATIONS)
        return
      }

      setAnnotations({
        trendlines: Array.isArray(data?.trendlines) ? data.trendlines : [],
        markers: Array.isArray(data?.markers) ? data.markers : [],
        notes: Array.isArray(data?.notes) ? data.notes : [],
      })
    } catch {
      setAnnotationsError('Failed to load annotations.')
      setAnnotations(EMPTY_ANNOTATIONS)
    } finally {
      setAnnotationsLoading(false)
    }
  }

  async function createAnnotation(kind: AnnotationKind, payload: unknown): Promise<any | null> {
    setAnnotationsError('')
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.symbol, kind, payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnnotationsError(data?.error ?? 'Failed to save annotation.')
        return null
      }
      return data?.annotation ?? null
    } catch {
      setAnnotationsError('Failed to save annotation.')
      return null
    }
  }

  async function deleteAnnotation(id: string) {
    setAnnotationsError('')
    try {
      const res = await fetch('/api/annotations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.symbol, id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnnotationsError(data?.error ?? 'Failed to delete annotation.')
        return false
      }
      return true
    } catch {
      setAnnotationsError('Failed to delete annotation.')
      return false
    }
  }

  async function updateAnnotation(id: string, payload: unknown): Promise<any | null> {
    setAnnotationsError('')
    try {
      const res = await fetch('/api/annotations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.symbol, id, payload }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnnotationsError(data?.error ?? 'Failed to update annotation.')
        return null
      }
      return data?.annotation ?? null
    } catch {
      setAnnotationsError('Failed to update annotation.')
      return null
    }
  }

  function nearestIndicatorValue(
    lineData: Array<{ time: UTCTimestamp; value: number }>,
    targetTime: number,
  ): number | null {
    if (lineData.length === 0) return null
    let nearest = lineData[0]
    let minDelta = Math.abs(Number(nearest.time) - targetTime)

    for (let i = 1; i < lineData.length; i += 1) {
      const point = lineData[i]
      const delta = Math.abs(Number(point.time) - targetTime)
      if (delta < minDelta) {
        nearest = point
        minDelta = delta
      }
    }
    return nearest.value
  }

  useEffect(() => {
    drawModeRef.current = drawMode
  }, [drawMode])

  useEffect(() => {
    isFullscreenRef.current = isFullscreen
  }, [isFullscreen])

  useEffect(() => {
    trendlineStartRef.current = trendlineStart
  }, [trendlineStart])

  useEffect(() => {
    annotationsRef.current = annotations
  }, [annotations])

  useEffect(() => {
    indicatorLinesRef.current = indicatorLines
  }, [indicatorLines])

  useEffect(() => {
    if (!isFullscreen) {
      setDrawMode('none')
      setTrendlineStart(null)
      setPendingNotePoint(null)
      setNoteDraft('')
      setPendingNotePosition(null)
    }
  }, [isFullscreen])

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (isFullscreen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [isFullscreen])

  useEffect(() => {
    loadAnnotations(stock.symbol)
    setTrendlineStart(null)
    setPendingNotePoint(null)
    setNoteDraft('')
    setPendingNotePosition(null)
  }, [stock.symbol])

  function capturePaneFactors() {
    if (!chartRef.current) return
    const panes = chartRef.current.panes()
    const count = panes.length
    if (count < 2) return
    paneFactorsByCountRef.current[count] = panes.map((pane) => pane.getStretchFactor())
  }

  function applyPaneFactors(paneCount: number) {
    if (!chartRef.current || paneCount < 2) return
    const panes = chartRef.current.panes()
    const fallback = DEFAULT_PANE_FACTORS[paneCount] ?? DEFAULT_PANE_FACTORS[2]
    const factors = paneFactorsByCountRef.current[paneCount] ?? fallback
    panes.forEach((pane, index) => {
      const nextFactor = factors[index] ?? fallback[index] ?? 1
      pane.setStretchFactor(nextFactor)
    })
  }

  function syncPaneOverlay() {
    if (!chartRef.current) return
    const panes = chartRef.current.panes()
    if (panes.length === 0) return

    const tops: number[] = []
    const separators: number[] = []
    let offset = 0
    panes.forEach((pane, index) => {
      tops.push(offset + 10)
      offset += pane.getHeight()
      if (index < panes.length - 1) {
        separators.push(offset)
      }
    })

    setPaneOverlay((prev) => {
      if (
        prev.tops.length === tops.length &&
        prev.separators.length === separators.length &&
        prev.tops.every((value, index) => Math.abs(value - tops[index]) < 1) &&
        prev.separators.every((value, index) => Math.abs(value - separators[index]) < 1)
      ) {
        return prev
      }
      return { tops, separators }
    })
  }

  useEffect(() => {
    const chartContainer = chartContainerRef.current
    if (!chartContainer) return
    const rootStyle = getComputedStyle(document.documentElement)
    const bgSecondary = rootStyle.getPropertyValue('--bg-secondary').trim() || '#0c0e11'
    const textSecondary = rootStyle.getPropertyValue('--text-secondary').trim() || '#98a5b9'
    const border = rootStyle.getPropertyValue('--border').trim() || '#242a35'
    const borderBright = rootStyle.getPropertyValue('--border-bright').trim() || '#343e4d'
    const green = rootStyle.getPropertyValue('--green').trim() || '#29c38a'
    const red = rootStyle.getPropertyValue('--red').trim() || '#e15a67'

    const chart = createChart(chartContainer, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: bgSecondary },
        textColor: textSecondary,
        fontFamily: 'IBM Plex Sans, sans-serif',
        attributionLogo: false,
        panes: {
          enableResize: true,
          separatorColor: borderBright,
          separatorHoverColor: textSecondary,
        },
      },
      rightPriceScale: {
        borderColor: border,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
        barSpacing: getBarSpacing(timeframe, isFullscreen ? 1.5 : 1),
        minBarSpacing: 4,
        rightOffset: 0,
        shiftVisibleRangeOnNewBar: false,
        fixLeftEdge: true,
        rightBarStaysOnScroll: true,
        lockVisibleTimeRangeOnResize: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
    })

    const isUpDay = stock.changePercent >= 0
    let mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area' | 'Bar' | 'Baseline', Time>

    if (chartType === 'candlestick') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: green,
        downColor: red,
        borderUpColor: green,
        borderDownColor: red,
        wickUpColor: green,
        wickDownColor: red,
      })
    } else if (chartType === 'line') {
      mainSeries = chart.addSeries(LineSeries, {
        color: isUpDay ? green : red,
        lineWidth: 2,
      })
    } else if (chartType === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: isUpDay ? green : red,
        topColor: isUpDay ? 'rgba(41,195,138,0.24)' : 'rgba(225,90,103,0.24)',
        bottomColor: 'rgba(0,0,0,0)',
        lineWidth: 2,
      })
    } else if (chartType === 'bar') {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: green,
        downColor: red,
      })
    } else {
      mainSeries = chart.addSeries(BaselineSeries, {
        topLineColor: green,
        topFillColor1: 'rgba(41,195,138,0.24)',
        topFillColor2: 'rgba(41,195,138,0.06)',
        bottomLineColor: red,
        bottomFillColor1: 'rgba(225,90,103,0.06)',
        bottomFillColor2: 'rgba(225,90,103,0.24)',
        baseValue: { type: 'price', price: stock.prevClose },
        lineWidth: 2,
      })
    }

    mainSeriesRef.current = mainSeries

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: {
        type: 'volume',
      },
    }, 1)
    volumeSeriesRef.current = volumeSeries

    chart.priceScale('volume', 1).applyOptions({
      scaleMargins: {
        top: 0.1,
        bottom: 0.02,
      },
      visible: false,
    })

    applyPaneFactors(2)
    lastPaneCountRef.current = 2
    syncPaneOverlay()

    markerPluginRef.current = createSeriesMarkers(mainSeries, [])

    const resolveClickPoint = (param: MouseEventParams<Time>): PointAnnotation | null => {
      if (!param.point || !mainSeriesRef.current || !chartRef.current) return null
      const directTime = param.time
      const fallbackTime = chartRef.current.timeScale().coordinateToTime(param.point.x) ?? undefined
      const resolvedTime = directTime ?? fallbackTime
      if (typeof resolvedTime !== 'number') return null

      const resolvedPrice = mainSeriesRef.current.coordinateToPrice(param.point.y)
      if (resolvedPrice === null || Number.isNaN(resolvedPrice)) return null

      return { time: resolvedTime, price: Number(resolvedPrice) }
    }

    const onClick = (param: MouseEventParams<Time>) => {
      const point = resolveClickPoint(param)
      const clickedTime = typeof param.time === 'number'
        ? param.time
        : point?.time
      if (typeof clickedTime === 'number') {
        const candle = candleLookupRef.current.get(clickedTime)
        if (candle) {
          const snapshots = indicatorLinesRef.current
            .map((line) => {
              const value = nearestIndicatorValue(line.data, clickedTime)
              if (value == null) return null
              return {
                id: line.id,
                label: line.label,
                pane: line.pane,
                color: line.color,
                value: Number(value.toFixed(4)),
              }
            })
            .filter(Boolean) as IndicatorValueSnapshot[]

          setHoverDetails({
            timeLabel: candle.timeLabel,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            indicatorValues: snapshots,
          })
        }
      }
      if (!point) return

      if (!isFullscreenRef.current) return

      if (drawModeRef.current === 'marker') {
        const payload = {
          time: point.time,
          price: point.price,
          color: '#22c55e',
          label: 'M',
        }
        void createAnnotation('marker', payload).then((saved) => {
          if (!saved) return
          const marker: MarkerAnnotation = { ...payload, id: String(saved.id) }
          setAnnotations((prev) => ({
            ...prev,
            markers: [...prev.markers, marker],
          }))
        })
      }

      if (drawModeRef.current === 'note') {
        setPendingNotePoint(point)
        setNoteDraft('')
      }

      if (drawModeRef.current === 'trendline') {
        if (!trendlineStartRef.current) {
          setTrendlineStart(point)
          return
        }

        const payload = {
          start: trendlineStartRef.current,
          end: point,
          color: '#60a5fa',
        }
        void createAnnotation('trendline', payload).then((saved) => {
          if (!saved) return
          const trendline: TrendlineAnnotation = { ...payload, id: String(saved.id) }
          setAnnotations((prev) => ({
            ...prev,
            trendlines: [...prev.trendlines, trendline],
          }))
          setTrendlineStart(null)
        })
      }
    }

    const updateNotes = (param?: MouseEventParams<Time>) => {
      updateOverlayPositionsRef.current()
      if (!param) return

      let hoverTime: number | null = null
      if (typeof param.time === 'number') {
        hoverTime = param.time
      } else if (param.point && chartRef.current) {
        const inferred = chartRef.current.timeScale().coordinateToTime(param.point.x)
        if (typeof inferred === 'number') hoverTime = inferred
      }

      if (hoverTime == null) {
        setHoverDetails(null)
        return
      }

      const candle = candleLookupRef.current.get(hoverTime)
      if (!candle) {
        setHoverDetails(null)
        return
      }

      const snapshots = indicatorLinesRef.current
        .map((line) => {
          const value = nearestIndicatorValue(line.data, hoverTime as number)
          if (value == null) return null
          return {
            id: line.id,
            label: line.label,
            pane: line.pane,
            color: line.color,
            value: Number(value.toFixed(4)),
          }
        })
        .filter(Boolean) as IndicatorValueSnapshot[]

        setHoverDetails({
          timeLabel: candle.timeLabel,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          indicatorValues: snapshots,
          anomalySeverity: anomalyByTimeRef.current.get(hoverTime)?.severity,
          anomalyScore: anomalyByTimeRef.current.get(hoverTime)?.score,
        })
      }
    const onVisibleRangeChange = () => updateNotes()
    chart.subscribeClick(onClick)
    chart.subscribeCrosshairMove(updateNotes)
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange)

    const resizeObserver = new ResizeObserver(() => {
      updateOverlayPositionsRef.current()
      syncPaneOverlay()
    })
    resizeObserver.observe(chartContainer)
    resizeObserverRef.current = resizeObserver

    chartRef.current = chart

    const rememberPaneAdjustments = () => {
      capturePaneFactors()
      syncPaneOverlay()
    }
    chartContainer.addEventListener('pointerup', rememberPaneAdjustments)
    chartContainer.addEventListener('touchend', rememberPaneAdjustments)

    return () => {
      capturePaneFactors()
      chartContainer.removeEventListener('pointerup', rememberPaneAdjustments)
      chartContainer.removeEventListener('touchend', rememberPaneAdjustments)
      chart.unsubscribeClick(onClick)
      chart.unsubscribeCrosshairMove(updateNotes)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange)
      resizeObserverRef.current?.disconnect()
      resizeObserverRef.current = null
      chart.remove()
      chartRef.current = null
      mainSeriesRef.current = null
      volumeSeriesRef.current = null
      markerPluginRef.current = null
      trendlineSeriesRef.current.clear()
      indicatorSeriesRef.current.clear()
    }
  }, [chartType, stock.symbol, theme, timeframe, isFullscreen])

  useEffect(() => {
    if (!mainSeriesRef.current || !volumeSeriesRef.current) return

    if (chartType === 'candlestick' || chartType === 'bar') {
      mainSeriesRef.current.setData(ohlcData as never[])
    } else {
      mainSeriesRef.current.setData(lineLikeData as never[])
    }
    volumeSeriesRef.current.setData(volumeData)

  }, [chartType, lineLikeData, ohlcData, volumeData])

  useEffect(() => {
    chartRef.current?.timeScale().fitContent()
  }, [chartType, timeframe, stock.symbol])

  useEffect(() => {
    if (!markerPluginRef.current) return

    const anomalySeriesMarkers: SeriesMarker<Time>[] = anomalyMarkers.map((marker, index) => {
      const color = marker.severity === 'CRITICAL'
        ? '#ef4444'
        : marker.severity === 'WARNING'
          ? '#f97316'
          : marker.severity === 'WATCH'
            ? '#f59e0b'
            : '#22c55e'
      return {
        id: `anomaly-${marker.timestamp}-${index}`,
        time: asUtcTimestamp(marker.timestamp),
        position: 'belowBar' as const,
        shape: 'circle' as const,
        color,
        text: 'A',
      }
    })

    const markerData: SeriesMarker<Time>[] = [
      ...annotations.markers.map((marker) => ({
        id: marker.id,
        time: asUtcTimestamp(marker.time),
        position: 'inBar' as const,
        shape: 'circle' as const,
        color: marker.color,
        text: marker.label,
      })),
      ...annotations.notes.map((note) => ({
        id: note.id,
        time: asUtcTimestamp(note.time),
        position: 'atPriceMiddle' as const,
        shape: 'square' as const,
        color: '#f59e0b',
        text: 'N',
        price: note.price,
      })),
      ...anomalySeriesMarkers,
    ]

    markerPluginRef.current.setMarkers(markerData)
  }, [annotations.markers, annotations.notes, anomalyMarkers])

  useEffect(() => {
    if (!chartRef.current) return

    trendlineSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series)
    })
    trendlineSeriesRef.current.clear()

    annotations.trendlines.forEach((trendline) => {
      if (!chartRef.current) return
      const lineSeries = chartRef.current.addSeries(LineSeries, {
        color: trendline.color,
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      lineSeries.setData(sortByTime([
        { time: asUtcTimestamp(trendline.start.time), value: trendline.start.price },
        { time: asUtcTimestamp(trendline.end.time), value: trendline.end.price },
      ]))
      trendlineSeriesRef.current.set(trendline.id, lineSeries)
    })
  }, [annotations.trendlines])

  useEffect(() => {
    if (!chartRef.current) return

    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series)
    })
    indicatorSeriesRef.current.clear()

    for (const line of indicatorLines) {
      if (!chartRef.current) continue
      const paneIndex = line.pane === 'overlay' ? 0 : 2
      const series = chartRef.current.addSeries(LineSeries, {
        color: line.color,
        lineWidth: 1,
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
      }, paneIndex)
      series.setData(line.data)
      indicatorSeriesRef.current.set(line.id, series)
    }

    const panes = chartRef.current.panes()
    const hasOscillator = indicatorLines.some((line) => line.pane === 'oscillator')
    const expectedPaneCount = hasOscillator ? 3 : 2
    if (panes.length >= expectedPaneCount && lastPaneCountRef.current !== expectedPaneCount) {
      applyPaneFactors(expectedPaneCount)
      lastPaneCountRef.current = expectedPaneCount
    }
    syncPaneOverlay()
  }, [indicatorLines])

  updateOverlayPositionsRef.current = () => {
    if (!chartRef.current || !mainSeriesRef.current) {
      setNotePositions((prev) => (prev.length === 0 ? prev : []))
      setMarkerControlPositions((prev) => (prev.length === 0 ? prev : []))
      setTrendlineControlPositions((prev) => (prev.length === 0 ? prev : []))
      setPendingNotePosition(null)
      setPaneOverlay({ tops: [10, 10], separators: [0] })
      return
    }

    const nextPositions: NotePosition[] = annotationsRef.current.notes.flatMap((note) => {
      const left = chartRef.current?.timeScale().timeToCoordinate(asUtcTimestamp(note.time))
      const top = mainSeriesRef.current?.priceToCoordinate(note.price)

      if (left === null || left === undefined || top === null || top === undefined) return []
      return [{ ...note, left, top }]
    })

    setNotePositions((prev) => {
      if (prev.length !== nextPositions.length) return nextPositions

      for (let i = 0; i < prev.length; i += 1) {
        const a = prev[i]
        const b = nextPositions[i]
        if (
          a.id !== b.id ||
          a.text !== b.text ||
          a.time !== b.time ||
          a.price !== b.price ||
          a.left !== b.left ||
          a.top !== b.top
        ) {
          return nextPositions
        }
      }

      return prev
    })

    const nextMarkerControls: MarkerControlPosition[] = annotationsRef.current.markers.flatMap((marker) => {
      const left = chartRef.current?.timeScale().timeToCoordinate(asUtcTimestamp(marker.time))
      const top = mainSeriesRef.current?.priceToCoordinate(marker.price)
      if (left == null || top == null) return []
      return [{ id: marker.id, left, top }]
    })
    setMarkerControlPositions(nextMarkerControls)

    const nextTrendlineControls: TrendlineControlPosition[] = annotationsRef.current.trendlines.flatMap((line) => {
      const leftA = chartRef.current?.timeScale().timeToCoordinate(asUtcTimestamp(line.start.time))
      const topA = mainSeriesRef.current?.priceToCoordinate(line.start.price)
      const leftB = chartRef.current?.timeScale().timeToCoordinate(asUtcTimestamp(line.end.time))
      const topB = mainSeriesRef.current?.priceToCoordinate(line.end.price)
      if (leftA == null || topA == null || leftB == null || topB == null) return []
      return [{
        id: line.id,
        left: (leftA + leftB) / 2,
        top: (topA + topB) / 2,
      }]
    })
    setTrendlineControlPositions(nextTrendlineControls)

    if (pendingNotePoint) {
      const left = chartRef.current?.timeScale().timeToCoordinate(asUtcTimestamp(pendingNotePoint.time))
      const top = mainSeriesRef.current?.priceToCoordinate(pendingNotePoint.price)
      if (left == null || top == null) setPendingNotePosition(null)
      else setPendingNotePosition({ left, top })
    } else {
      setPendingNotePosition(null)
    }
    syncPaneOverlay()
  }

  useEffect(() => {
    updateOverlayPositionsRef.current()
  }, [annotations.markers, annotations.notes, annotations.trendlines, chartType, lineLikeData, ohlcData, pendingNotePoint])

  useEffect(() => {
    setHoverDetails(null)
  }, [stock.symbol, timeframe, indicatorLines.length])

  async function clearAnnotations() {
    setAnnotationsError('')
    try {
      const res = await fetch('/api/annotations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: stock.symbol }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAnnotationsError(data?.error ?? 'Failed to clear annotations.')
        return
      }
      setAnnotations(EMPTY_ANNOTATIONS)
    } catch {
      setAnnotationsError('Failed to clear annotations.')
      return
    }

    setTrendlineStart(null)
    setPendingNotePoint(null)
    setNoteDraft('')
    setPendingNotePosition(null)
  }

  function activateMode(mode: Exclude<DrawMode, 'none'>) {
    if (!isFullscreen) return
    if (autoRefreshEnabled) setAutoRefreshEnabled(false)
    setDrawMode(mode)
  }

  async function saveNoteAtPendingPoint() {
    if (!pendingNotePoint || !noteDraft.trim()) return
    const payload = {
      time: pendingNotePoint.time,
      price: pendingNotePoint.price,
      text: noteDraft.trim(),
      fontSize: 12,
    }
    const saved = await createAnnotation('note', payload)
    if (!saved) return
    const note: NoteAnnotation = { ...payload, id: String(saved.id) }
    setAnnotations((prev) => ({
      ...prev,
      notes: [...prev.notes, note],
    }))
    setPendingNotePoint(null)
    setNoteDraft('')
    setPendingNotePosition(null)
    setDrawMode('none')
  }

  async function updateNote(id: string, patch: Partial<Pick<NoteAnnotation, 'text' | 'fontSize'>>) {
    const current = annotations.notes.find((n) => n.id === id)
    if (!current) return
    const payload = {
      time: current.time,
      price: current.price,
      text: patch.text ?? current.text,
      fontSize: Math.min(24, Math.max(10, patch.fontSize ?? current.fontSize ?? 12)),
    }
    const updated = await updateAnnotation(id, payload)
    if (!updated) return

    setAnnotations((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === id ? { ...n, ...payload } : n)),
    }))
  }

  async function removeAnnotation(kind: AnnotationKind, id: string) {
    const ok = await deleteAnnotation(id)
    if (!ok) return

    setAnnotations((prev) => {
      if (kind === 'trendline') return { ...prev, trendlines: prev.trendlines.filter((item) => item.id !== id) }
      if (kind === 'marker') return { ...prev, markers: prev.markers.filter((item) => item.id !== id) }
      return { ...prev, notes: prev.notes.filter((item) => item.id !== id) }
    })
  }

  function resumeLiveUpdates() {
    setDrawMode('none')
    setTrendlineStart(null)
    setPendingNotePoint(null)
    setNoteDraft('')
    setPendingNotePosition(null)
    setAutoRefreshEnabled(true)
  }

  function toggleIndicator(key: IndicatorKey) {
    setSelectedIndicators((prev) => (
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    ))
  }

  const overlayIndicatorLines = indicatorLines.filter((line) => line.pane === 'overlay')
  const oscillatorIndicatorLines = indicatorLines.filter((line) => line.pane === 'oscillator')

  return (
    <div className={`${styles.wrapper} ${isFullscreen ? styles.fullscreenWrapper : ''}`}>
      <div className={styles.toolbar}>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={styles.fullscreenBtn}
            onClick={() => setIsFullscreen((prev) => !prev)}
          >
            {isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          </button>
          {isFullscreen && !autoRefreshEnabled && (
            <button
              type="button"
              className={styles.resumeBtn}
              onClick={resumeLiveUpdates}
            >
              Continue Live Updates
            </button>
          )}
        </div>

        <div className={styles.controlGroup}>
          <span className={styles.label}>Timeframe</span>
          <div className={styles.modeButtons}>
            <button
              type="button"
              className={`${styles.modeBtn} ${timeframe === '5m' ? styles.active : ''}`}
              onClick={() => setTimeframe('5m')}
            >
              5M
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${timeframe === '15m' ? styles.active : ''}`}
              onClick={() => setTimeframe('15m')}
            >
              15M
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${timeframe === '1h' ? styles.active : ''}`}
              onClick={() => setTimeframe('1h')}
            >
              1H
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${timeframe === '1d' ? styles.active : ''}`}
              onClick={() => setTimeframe('1d')}
            >
              1D
            </button>
          </div>
        </div>

        <div className={styles.controlGroup}>
          <label htmlFor="chartType" className={styles.label}>Chart</label>
          <select
            id="chartType"
            className={styles.select}
            value={chartType}
            onChange={(e) => setChartType(e.target.value as ChartType)}
          >
            <option value="candlestick">Candlestick</option>
            <option value="line">Line</option>
            <option value="area">Area</option>
            <option value="bar">OHLC Bar</option>
            <option value="baseline">Baseline</option>
          </select>
        </div>

        <details className={styles.indicatorMenu}>
          <summary className={styles.indicatorSummary}>
            Indicators ({selectedIndicators.length})
          </summary>
          <div className={styles.indicatorGrid}>
            {INDICATOR_DEFINITIONS.map((indicator) => (
              <button
                key={indicator.key}
                type="button"
                className={`${styles.indicatorBtn} ${selectedIndicators.includes(indicator.key) ? styles.activeIndicator : ''}`}
                onClick={() => toggleIndicator(indicator.key)}
                title={indicator.description}
              >
                {indicator.label}
              </button>
            ))}
          </div>
        </details>

        <div className={styles.controlGroup}>
          <span className={styles.label}>Draw</span>
          <div className={styles.modeButtons}>
            <button
              type="button"
              className={`${styles.modeBtn} ${drawMode === 'none' ? styles.active : ''}`}
              onClick={() => {
                setDrawMode('none')
                setTrendlineStart(null)
              }}
            >
              Pointer
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${drawMode === 'trendline' ? styles.active : ''}`}
              onClick={() => activateMode('trendline')}
              disabled={!isFullscreen}
              title={isFullscreen ? 'Draw trendline' : 'Open fullscreen to annotate'}
            >
              Trendline
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${drawMode === 'marker' ? styles.active : ''}`}
              onClick={() => activateMode('marker')}
              disabled={!isFullscreen}
              title={isFullscreen ? 'Add marker' : 'Open fullscreen to annotate'}
            >
              Marker
            </button>
            <button
              type="button"
              className={`${styles.modeBtn} ${drawMode === 'note' ? styles.active : ''}`}
              onClick={() => activateMode('note')}
              disabled={!isFullscreen}
              title={isFullscreen ? 'Add note' : 'Open fullscreen to annotate'}
            >
              Note
            </button>
          </div>
        </div>

        <button type="button" className={styles.clearBtn} onClick={() => void clearAnnotations()}>
          Clear All Annotations
        </button>
      </div>

      <div className={styles.statusBar}>
        {!isFullscreen
          ? 'ANNOTATIONS LOCKED: OPEN FULLSCREEN TO DRAW'
          : drawMode === 'trendline' && trendlineStart
            ? 'TRENDLINE: CHOOSE SECOND POINT'
            : `TF: ${timeframe.toUpperCase()} | MODE: ${drawMode.toUpperCase()}${autoRefreshEnabled ? '' : ' (LIVE UPDATES PAUSED)'}`}
      </div>

      {(annotationsLoading || annotationsError) && (
        <div className={styles.statusBar}>
          {annotationsLoading ? 'Loading annotations...' : annotationsError}
        </div>
      )}

      {indicatorLines.length > 0 && (
        <div className={styles.indicatorLegend}>
          {overlayIndicatorLines.length > 0 && (
            <div className={styles.legendGroup}>
              {overlayIndicatorLines.map((line) => (
                <span key={line.id} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: line.color }} />
                  {line.label}
                </span>
              ))}
            </div>
          )}
          {oscillatorIndicatorLines.length > 0 && (
            <div className={styles.legendGroup}>
              {oscillatorIndicatorLines.map((line) => (
                <span key={line.id} className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: line.color }} />
                  {line.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.chartStack}>
        <div className={styles.mainChart} ref={chartContainerRef} />
        {hoverDetails && (
          <div className={styles.hoverDataBox}>
            <div className={styles.hoverTime}>{hoverDetails.timeLabel}</div>
            <div className={styles.hoverGrid}>
              <span>O ${hoverDetails.open.toFixed(2)}</span>
              <span>H ${hoverDetails.high.toFixed(2)}</span>
              <span>L ${hoverDetails.low.toFixed(2)}</span>
              <span>C ${hoverDetails.close.toFixed(2)}</span>
              <span>V {hoverDetails.volume.toLocaleString('en-US')}</span>
            </div>
            {hoverDetails.indicatorValues.length > 0 && (
              <div className={styles.hoverIndicatorList}>
                {hoverDetails.indicatorValues.map((item) => (
                  <span key={item.id} className={styles.hoverIndicatorItem}>
                    <span className={styles.legendDot} style={{ backgroundColor: item.color }} />
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            )}
            {hoverDetails.anomalySeverity && (
              <div className={styles.hoverIndicatorList}>
                <span className={styles.hoverIndicatorItem}>
                  <span className={styles.legendDot} style={{ backgroundColor: hoverDetails.anomalySeverity === 'CRITICAL' ? '#ef4444' : hoverDetails.anomalySeverity === 'WARNING' ? '#f97316' : hoverDetails.anomalySeverity === 'WATCH' ? '#f59e0b' : '#22c55e' }} />
                  ANOMALY: {hoverDetails.anomalySeverity} ({(hoverDetails.anomalyScore ?? 0).toFixed(3)})
                </span>
              </div>
            )}
          </div>
        )}
        <div className={styles.paneLabel} style={{ top: paneOverlay.tops[0] ?? 10 }}>
          PRICE
        </div>
        {paneOverlay.tops[1] !== undefined && (
          <div className={styles.paneLabel} style={{ top: paneOverlay.tops[1] }}>
            VOLUME
          </div>
        )}
        {oscillatorIndicatorLines.length > 0 && paneOverlay.tops[2] !== undefined && (
          <div className={styles.paneLabel} style={{ top: paneOverlay.tops[2] }}>
            OSCILLATOR
          </div>
        )}
        {paneOverlay.separators.map((separatorTop, index) => (
          <div key={`separator-${index}`} className={styles.paneSeparatorGuide} style={{ top: separatorTop - 7 }}>
            <span className={styles.separatorHint}>DRAG TO RESIZE PANES</span>
          </div>
        ))}
        <div className={styles.noteLayer}>
          {trendlineControlPositions.map((item) => (
            <button
              key={`trendline-del-${item.id}`}
              type="button"
              className={styles.onChartDelete}
              style={{ left: item.left, top: item.top }}
              onClick={() => void removeAnnotation('trendline', item.id)}
              title="Delete trendline"
            >
              x
            </button>
          ))}
          {markerControlPositions.map((item) => (
            <button
              key={`marker-del-${item.id}`}
              type="button"
              className={styles.onChartDelete}
              style={{ left: item.left + 8, top: item.top - 8 }}
              onClick={() => void removeAnnotation('marker', item.id)}
              title="Delete marker"
            >
              x
            </button>
          ))}
          {notePositions.map((note) => (
            <div
              key={`${note.id}-${note.text}-${note.fontSize ?? 12}`}
              className={styles.noteCard}
              style={{ left: note.left + 10, top: note.top - 10 }}
            >
              <textarea
                className={styles.noteTextArea}
                style={{ fontSize: `${note.fontSize ?? 12}px` }}
                defaultValue={note.text}
                onBlur={(e) => {
                  const nextText = e.target.value.trim()
                  if (nextText && nextText !== note.text) {
                    void updateNote(note.id, { text: nextText })
                  }
                }}
              />
              <div className={styles.noteCardActions}>
                <button
                  type="button"
                  className={styles.noteActionBtn}
                  onClick={() => void updateNote(note.id, { fontSize: (note.fontSize ?? 12) - 1 })}
                  title="Smaller text"
                >
                  A-
                </button>
                <button
                  type="button"
                  className={styles.noteActionBtn}
                  onClick={() => void updateNote(note.id, { fontSize: (note.fontSize ?? 12) + 1 })}
                  title="Larger text"
                >
                  A+
                </button>
                <button
                  type="button"
                  className={styles.noteActionBtn}
                  onClick={() => void removeAnnotation('note', note.id)}
                  title="Delete note"
                >
                  x
                </button>
              </div>
            </div>
          ))}
          {pendingNotePoint && pendingNotePosition && (
            <div className={styles.pendingNoteCard} style={{ left: pendingNotePosition.left + 10, top: pendingNotePosition.top - 10 }}>
              <textarea
                className={styles.noteTextArea}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Write note text..."
              />
              <div className={styles.noteCardActions}>
                <button type="button" className={styles.noteActionBtn} onClick={() => void saveNoteAtPendingPoint()}>
                  Save
                </button>
                <button
                  type="button"
                  className={styles.noteActionBtn}
                  onClick={() => {
                    setPendingNotePoint(null)
                    setPendingNotePosition(null)
                    setNoteDraft('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

