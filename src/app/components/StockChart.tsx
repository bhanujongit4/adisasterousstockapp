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
import { StockQuote } from '../lib/stockData'
import styles from './StockChart.module.css'

interface Props {
  stock: StockQuote
  autoRefreshEnabled: boolean
  setAutoRefreshEnabled: Dispatch<SetStateAction<boolean>>
}

type ChartType = 'candlestick' | 'line' | 'area' | 'bar' | 'baseline'
type DrawMode = 'none' | 'trendline' | 'marker' | 'note'
type Timeframe = '5m' | '15m' | '1h'

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

const EMPTY_ANNOTATIONS: StoredAnnotations = {
  trendlines: [],
  markers: [],
  notes: [],
}

const STORAGE_PREFIX = 'stockanalysis-lightweight-annotations-v1'

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
  const minutes = timeframe === '5m' ? 5 : timeframe === '15m' ? 15 : 60
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
      currentBar = {
        timestamp: bucketStart,
        time: formatBucketTime(bucketStart),
        open: item.price,
        high: item.price,
        low: item.price,
        close: item.price,
        volume: item.volume,
      }
      continue
    }

    currentBar.high = Math.max(currentBar.high, item.price)
    currentBar.low = Math.min(currentBar.low, item.price)
    currentBar.close = item.price
    currentBar.volume += item.volume
  }

  if (currentBar) bars.push(currentBar)
  return bars
}

export default function StockChart({ stock, autoRefreshEnabled, setAutoRefreshEnabled }: Props) {
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [timeframe, setTimeframe] = useState<Timeframe>('5m')
  const [drawMode, setDrawMode] = useState<DrawMode>('none')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [trendlineStart, setTrendlineStart] = useState<PointAnnotation | null>(null)
  const [annotations, setAnnotations] = useState<StoredAnnotations>(EMPTY_ANNOTATIONS)
  const [notePositions, setNotePositions] = useState<NotePosition[]>([])

  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area' | 'Bar' | 'Baseline', Time> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram', Time> | null>(null)
  const markerPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const trendlineSeriesRef = useRef<Map<string, ISeriesApi<'Line', Time>>>(new Map())
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const drawModeRef = useRef<DrawMode>(drawMode)
  const isFullscreenRef = useRef<boolean>(isFullscreen)
  const trendlineStartRef = useRef<PointAnnotation | null>(trendlineStart)
  const annotationsRef = useRef<StoredAnnotations>(annotations)
  const updateNotePositionsRef = useRef<() => void>(() => {})

  const aggregatedHistory = useMemo(
    () => aggregateHistory(stock.history, timeframe),
    [stock.history, timeframe]
  )

  const ohlcData = useMemo(() => sortByTime(aggregatedHistory.map((item) => {
    return {
      time: asUtcTimestamp(item.timestamp),
      open: Number(item.open.toFixed(2)),
      high: Number(item.high.toFixed(2)),
      low: Number(item.low.toFixed(2)),
      close: Number(item.close.toFixed(2)),
    }
  })), [aggregatedHistory])

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

    const chart = createChart(chartContainer, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
        fontFamily: 'IBM Plex Mono, monospace',
      },
      rightPriceScale: {
        borderColor: '#1e293b',
        scaleMargins: { top: 0.08, bottom: 0.22 },
      },
      grid: {
        vertLines: { color: 'rgba(148,163,184,0.12)' },
        horzLines: { color: 'rgba(148,163,184,0.12)' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
      },
      timeScale: {
        borderColor: '#1e293b',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        vertTouchDrag: false,
      },
    })

    const isUpDay = stock.changePercent >= 0
    let mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area' | 'Bar' | 'Baseline', Time>

    if (chartType === 'candlestick') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#14b8a6',
        downColor: '#ef4444',
        borderUpColor: '#14b8a6',
        borderDownColor: '#ef4444',
        wickUpColor: '#14b8a6',
        wickDownColor: '#ef4444',
      })
    } else if (chartType === 'line') {
      mainSeries = chart.addSeries(LineSeries, {
        color: isUpDay ? '#14b8a6' : '#ef4444',
        lineWidth: 2,
      })
    } else if (chartType === 'area') {
      mainSeries = chart.addSeries(AreaSeries, {
        lineColor: isUpDay ? '#14b8a6' : '#ef4444',
        topColor: isUpDay ? 'rgba(20,184,166,0.35)' : 'rgba(239,68,68,0.35)',
        bottomColor: 'rgba(15,23,42,0.03)',
        lineWidth: 2,
      })
    } else if (chartType === 'bar') {
      mainSeries = chart.addSeries(BarSeries, {
        upColor: '#14b8a6',
        downColor: '#ef4444',
      })
    } else {
      mainSeries = chart.addSeries(BaselineSeries, {
        topLineColor: '#14b8a6',
        topFillColor1: 'rgba(20,184,166,0.35)',
        topFillColor2: 'rgba(20,184,166,0.07)',
        bottomLineColor: '#ef4444',
        bottomFillColor1: 'rgba(239,68,68,0.07)',
        bottomFillColor2: 'rgba(239,68,68,0.35)',
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
    })
    volumeSeriesRef.current = volumeSeries

    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      visible: false,
    })

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
    }
  }, [chartType, stock.symbol])

  useEffect(() => {
    if (!mainSeriesRef.current || !volumeSeriesRef.current) return

    if (chartType === 'candlestick' || chartType === 'bar') {
      mainSeriesRef.current.setData(ohlcData as never[])
    } else {
      mainSeriesRef.current.setData(lineLikeData as never[])
    }
    volumeSeriesRef.current.setData(volumeData)

    if (chartRef.current?.timeScale()) {
      chartRef.current.timeScale().fitContent()
    }
  }, [chartType, lineLikeData, ohlcData, volumeData])

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

      <div className={styles.chartStack}>
        <div className={styles.mainChart} ref={chartContainerRef} />
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
