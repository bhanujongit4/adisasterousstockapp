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
}

interface StoredAnnotations {
  trendlines: TrendlineAnnotation[]
  markers: MarkerAnnotation[]
  notes: NoteAnnotation[]
}

interface NotePosition extends NoteAnnotation {
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

const EMPTY_ANNOTATIONS: StoredAnnotations = {
  trendlines: [],
  markers: [],
  notes: [],
}

const STORAGE_PREFIX = 'stockanalysis-lightweight-annotations-v1'
const INDICATOR_COLORS = ['#29c38a', '#e3a548', '#e06d78', '#9aa6bb', '#7bc5a2', '#c7a76a', '#b08ad2', '#7f8ca2', '#89b9a6']
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

function buildStorageKey(symbol: string) {
  return `${STORAGE_PREFIX}:${symbol}`
}

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

function getBarSpacing(timeframe: Timeframe) {
  if (timeframe === '5m') return 5
  if (timeframe === '15m') return 7
  if (timeframe === '1h') return 10
  return 14
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
}: Props) {
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorKey[]>([])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [trendlineStart, setTrendlineStart] = useState<PointAnnotation | null>(null)
  const [annotations, setAnnotations] = useState<StoredAnnotations>(EMPTY_ANNOTATIONS)
  const [notePositions, setNotePositions] = useState<NotePosition[]>([])
  const [selectedCandle, setSelectedCandle] = useState<CandleDetails | null>(null)

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
  const updateNotePositionsRef = useRef<() => void>(() => {})

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
    if (!isFullscreen || drawMode === 'none') return
    if (autoRefreshEnabled) setAutoRefreshEnabled(false)
  }, [autoRefreshEnabled, drawMode, isFullscreen, setAutoRefreshEnabled])

  useEffect(() => {
    if (!isFullscreen) {
      setDrawMode('none')
      setTrendlineStart(null)
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
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem(buildStorageKey(stock.symbol))

    if (!raw) {
      setAnnotations(EMPTY_ANNOTATIONS)
      setTrendlineStart(null)
      return
    }

    try {
      const parsed = JSON.parse(raw) as Partial<StoredAnnotations>
      setAnnotations({
        trendlines: parsed.trendlines ?? [],
        markers: parsed.markers ?? [],
        notes: parsed.notes ?? [],
      })
    } catch {
      setAnnotations(EMPTY_ANNOTATIONS)
    }

    setTrendlineStart(null)
  }, [stock.symbol])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(buildStorageKey(stock.symbol), JSON.stringify(annotations))
  }, [annotations, stock.symbol])

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
        fontFamily: 'JetBrains Mono, monospace',
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
        barSpacing: getBarSpacing(timeframe),
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

    const panes = chart.panes()
    panes[0]?.setStretchFactor(0.78)
    panes[1]?.setStretchFactor(0.22)

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
      const clickedTime = param.time
      if (typeof clickedTime === 'number') {
        const candle = candleLookupRef.current.get(clickedTime)
        if (candle) setSelectedCandle(candle)
      }
      if (!point) return

      if (!isFullscreenRef.current) return

      if (drawModeRef.current === 'marker') {
        const marker: MarkerAnnotation = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: point.time,
          price: point.price,
          color: '#22c55e',
          label: 'M',
        }

        setAnnotations((prev) => ({
          ...prev,
          markers: [...prev.markers, marker],
        }))
      }

      if (drawModeRef.current === 'note') {
        const note = window.prompt('Write your note for this chart coordinate:')
        if (!note || !note.trim()) return

        const notePoint: NoteAnnotation = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          time: point.time,
          price: point.price,
          text: note.trim(),
        }

        setAnnotations((prev) => ({
          ...prev,
          notes: [...prev.notes, notePoint],
        }))
      }

      if (drawModeRef.current === 'trendline') {
        if (!trendlineStartRef.current) {
          setTrendlineStart(point)
          return
        }

        const trendline: TrendlineAnnotation = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          start: trendlineStartRef.current,
          end: point,
          color: '#60a5fa',
        }

        setAnnotations((prev) => ({
          ...prev,
          trendlines: [...prev.trendlines, trendline],
        }))
        setTrendlineStart(null)
      }
    }

    const updateNotes = () => updateNotePositionsRef.current()
    chart.subscribeClick(onClick)
    chart.subscribeCrosshairMove(updateNotes)
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateNotes)

    const resizeObserver = new ResizeObserver(() => {
      updateNotePositionsRef.current()
    })
    resizeObserver.observe(chartContainer)
    resizeObserverRef.current = resizeObserver

    chartRef.current = chart

    return () => {
      chart.unsubscribeClick(onClick)
      chart.unsubscribeCrosshairMove(updateNotes)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateNotes)
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
  }, [chartType, stock.symbol, theme, timeframe])

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
    ]

    markerPluginRef.current.setMarkers(markerData)
  }, [annotations.markers, annotations.notes])

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
    if (hasOscillator && panes.length >= 3) {
      panes[0]?.setStretchFactor(0.62)
      panes[1]?.setStretchFactor(0.18)
      panes[2]?.setStretchFactor(0.2)
    } else if (panes.length >= 2) {
      panes[0]?.setStretchFactor(0.78)
      panes[1]?.setStretchFactor(0.22)
    }
  }, [indicatorLines])

  updateNotePositionsRef.current = () => {
    if (!chartRef.current || !mainSeriesRef.current) {
      setNotePositions((prev) => (prev.length === 0 ? prev : []))
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
  }

  useEffect(() => {
    updateNotePositionsRef.current()
  }, [annotations.notes, chartType, lineLikeData, ohlcData])

  useEffect(() => {
    setSelectedCandle(null)
  }, [stock.symbol, timeframe])

  function clearAnnotations() {
    setAnnotations(EMPTY_ANNOTATIONS)
    setTrendlineStart(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(buildStorageKey(stock.symbol))
    }
  }

  function activateMode(mode: Exclude<DrawMode, 'none'>) {
    if (!isFullscreen) return
    setDrawMode(mode)
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
              onClick={() => setAutoRefreshEnabled(true)}
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

        <button type="button" className={styles.clearBtn} onClick={clearAnnotations}>
          Clear Local Annotations
        </button>
      </div>

      <div className={styles.statusBar}>
        {!isFullscreen
          ? 'ANNOTATIONS LOCKED: OPEN FULLSCREEN TO DRAW'
          : drawMode === 'trendline' && trendlineStart
            ? 'TRENDLINE: CHOOSE SECOND POINT'
            : `TF: ${timeframe.toUpperCase()} | MODE: ${drawMode.toUpperCase()}${autoRefreshEnabled ? '' : ' (LIVE UPDATES PAUSED)'}`}
      </div>

      {indicatorLines.length > 0 && (
        <div className={styles.indicatorLegend}>
          {overlayIndicatorLines.length > 0 && (
            <div className={styles.legendGroup}>
              <span className={styles.legendTitle}>PRICE PANE</span>
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
              <span className={styles.legendTitle}>OSCILLATOR PANE</span>
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

      {selectedCandle && (
        <div className={styles.candlePanel}>
          <span className={styles.candleItem}>TIME: {selectedCandle.timeLabel}</span>
          <span className={styles.candleItem}>OPEN: ${selectedCandle.open.toFixed(2)}</span>
          <span className={styles.candleItem}>HIGH: ${selectedCandle.high.toFixed(2)}</span>
          <span className={styles.candleItem}>LOW: ${selectedCandle.low.toFixed(2)}</span>
          <span className={styles.candleItem}>CLOSE: ${selectedCandle.close.toFixed(2)}</span>
          <span className={styles.candleItem}>VOL: {selectedCandle.volume.toLocaleString('en-US')}</span>
        </div>
      )}

      <div className={styles.chartStack}>
        <div className={styles.mainChart} ref={chartContainerRef} />
        <div className={styles.priceBadge}>PRICE PANE</div>
        <div className={`${styles.volumeBadge} ${oscillatorIndicatorLines.length > 0 ? styles.volumeWithOsc : styles.volumeNoOsc}`}>
          VOLUME PANE
        </div>
        {oscillatorIndicatorLines.length > 0 && <div className={styles.oscillatorBadge}>OSCILLATOR PANE</div>}
        <div className={styles.noteLayer}>
          {notePositions.map((note) => (
            <div
              key={note.id}
              className={styles.notePin}
              style={{ left: note.left + 8, top: note.top - 8 }}
              title={note.text}
            >
              N
              <div className={styles.noteTooltip}>{note.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
