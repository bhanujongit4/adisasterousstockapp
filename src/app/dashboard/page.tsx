'use client'

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Activity, AlertTriangle, LogOut, Moon, Radar, RefreshCw, Sparkles, Sun, TrendingDown, TrendingUp } from 'lucide-react'
import { StockChoice, StockQuote } from '../lib/stockData'
import { useStockData } from '../hooks/useStockData'
import MarketTicker from '../components/MarketTicker'
import WatchlistPanel from '../components/WatchlistPanel'
import StockChart from '../components/StockChart'
import MarketStats from '../components/MarketStats'
import StockSignalCard from '../components/StockSignalCard'
import styles from './Dashboard.module.css'

type User = { id: number; email: string }

type WatchlistResponse = {
  symbols: string[]
  available: StockChoice[]
  limit: number
}

type AnomalyMarker = {
  timestamp: number
  severity: 'CRITICAL' | 'WARNING' | 'WATCH' | 'NORMAL'
  composite_score: number
  price?: number | null
}

export default function DashboardPage() {
  const router = useRouter()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [sessionChecking, setSessionChecking] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])
  const [watchlistLimit, setWatchlistLimit] = useState(10)
  const [availableStocks, setAvailableStocks] = useState<StockChoice[]>([])
  const [pendingTop32, setPendingTop32] = useState('')
  const [manualSymbol, setManualSymbol] = useState('')
  const [watchlistError, setWatchlistError] = useState('')
  const [anomalyMarkers, setAnomalyMarkers] = useState<AnomalyMarker[]>([])

  const {
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
  } = useStockData({ symbols: watchlistSymbols, enabled: Boolean(user) })

  const addableTop32 = useMemo(
    () => availableStocks.filter((s) => !watchlistSymbols.includes(s.symbol)),
    [availableStocks, watchlistSymbols],
  )

  const modelGuides: ModelGuide[] = [
    {
      tone: 'neutral',
      icon: Radar,
      title: 'Regime Model',
      badge: 'Market mood',
      summary: 'Tells you whether the stock is trending, drifting, or whipping around.',
      plainEnglish:
        'Think of this like the weather forecast for the chart. It helps you understand the current mood before you decide whether to be patient, cautious, or aggressive.',
      chips: [
        'Trend up = buyers are in control',
        'Trend down = sellers are in control',
        'Mean-reverting = price may snap back',
        'Volatile = the stock is moving fast',
      ],
    },
    {
      tone: 'positive',
      icon: Sparkles,
      title: 'Order Flow',
      badge: 'Fill quality',
      summary: 'Shows whether trades are likely to move cleanly or get crowded.',
      plainEnglish:
        'This is the “how smooth is the ride?” model. A calm reading usually means cleaner execution, while a crowded reading means trades may slip, spike, or feel messy.',
      chips: [
        'Calm = smoother fills',
        'Crowded = harder fills',
        'Improving = getting cleaner',
        'Worsening = getting noisier',
      ],
    },
    {
      tone: 'warning',
      icon: AlertTriangle,
      title: 'Anomaly Model',
      badge: 'Yellow candles',
      summary: 'Highlights candles that stand out from the recent pattern.',
      plainEnglish:
        'This is the “something odd just happened” detector. It does not say buy or sell by itself. It simply warns that the latest candle looks unusual and deserves attention.',
      chips: [
        'Normal = nothing special',
        'Watch = mild surprise',
        'Warning = yellow highlight on the chart',
        'Critical = strongest unusual move',
      ],
    },
  ]

  useLayoutEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (!res.ok) { if (!cancelled) router.replace('/'); return }
        const data = await res.json()
        if (cancelled || !data?.user) { if (!cancelled) router.replace('/'); return }
        setUser(data.user)
        await loadWatchlist()
      } finally {
        if (!cancelled) setSessionChecking(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!pendingTop32 && addableTop32.length > 0) {
      setPendingTop32(addableTop32[0].symbol)
    }
  }, [addableTop32, pendingTop32])

  useEffect(() => {
    setAnomalyMarkers([])
  }, [selectedSymbol])

  async function loadWatchlist() {
    const res = await fetch('/api/watchlist')
    if (!res.ok) return
    const data = (await res.json()) as WatchlistResponse
    setWatchlistSymbols(data.symbols)
    setAvailableStocks(data.available)
    setWatchlistLimit(data.limit)
    setWatchlistError('')
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
  }

  async function addSymbol(symbolRaw: string) {
    const symbol = symbolRaw.trim().toUpperCase()
    if (!symbol) return
    setWatchlistError('')
    const res = await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    })
    const data = await res.json()
    if (!res.ok) { setWatchlistError(data?.error ?? 'Could not add symbol.'); return }
    const next = data as WatchlistResponse
    setWatchlistSymbols(next.symbols)
    setAvailableStocks(next.available)
    setWatchlistLimit(next.limit)
    setManualSymbol('')
  }

  async function removeSymbol(symbol: string) {
    setWatchlistError('')
    const res = await fetch('/api/watchlist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol }),
    })
    const data = await res.json()
    if (!res.ok) { setWatchlistError(data?.error ?? 'Could not remove symbol.'); return }
    const next = data as WatchlistResponse
    setWatchlistSymbols(next.symbols)
    setAvailableStocks(next.available)
    setWatchlistLimit(next.limit)
  }

  async function handleManualAdd() {
    const symbol = manualSymbol.trim().toUpperCase()
    if (!symbol) return
    await addSymbol(symbol)
  }

  if (sessionChecking || !user || (loading && stocks.length === 0)) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingDot} />
        <span>Initializing IN$JAM</span>
      </div>
    )
  }

  return (
    <div className={styles.root}>

      {/* ── NAV ── */}
      <header className={styles.nav}>
        <div className={styles.logo}>
          <Activity size={15} strokeWidth={2.5} color="var(--green)" />
          <span className={styles.logoText}>IN$JAM</span>
        </div>

        <div className={styles.navMeta}>
          <span className={styles.metaItem}>{user.email}</span>
          <span className={styles.metaItem}>
            <span className={styles.metaDot} />
            Live
          </span>
          {lastUpdated && (
            <span className={styles.metaItem}>
              {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}
          <button className={styles.refreshBtn} onClick={refresh} title="Refresh">
            <RefreshCw size={12} />
          </button>
          <button
            className={styles.themeBtn}
            onClick={() => setTheme((p) => (p === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}
          </button>
          <button className={styles.themeBtn} onClick={handleLogout} title="Logout">
            <LogOut size={12} />
          </button>
        </div>
      </header>

      {/* ── TICKER ── */}
      <MarketTicker stocks={stocks} />

      {/* ── MAIN LAYOUT ── */}
      <div className={styles.layout}>

        {/* LEFT SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.watchlistManager}>
            <div className={styles.managerHead}>
              Watchlist ({watchlistSymbols.length}/{watchlistLimit})
            </div>

            <div className={styles.managerRow}>
              <select
                className={styles.managerSelect}
                value={pendingTop32}
                onChange={(e) => setPendingTop32(e.target.value)}
                disabled={addableTop32.length === 0 || watchlistSymbols.length >= watchlistLimit}
              >
                {addableTop32.length === 0 && <option value="">No top-32 symbols left</option>}
                {addableTop32.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
              <button
                className={styles.managerBtn}
                onClick={() => pendingTop32 && addSymbol(pendingTop32)}
                disabled={!pendingTop32 || watchlistSymbols.length >= watchlistLimit}
              >
                Add
              </button>
            </div>

            <div className={styles.managerRow}>
              <input
                className={styles.managerInput}
                value={manualSymbol}
                onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
                placeholder="Symbol (e.g. IBM)"
                maxLength={12}
              />
              <button
                className={styles.managerBtn}
                onClick={handleManualAdd}
                disabled={watchlistSymbols.length >= watchlistLimit}
              >
                Find
              </button>
            </div>

            {watchlistError && (
              <div className={styles.watchlistError}>{watchlistError}</div>
            )}

            <div className={styles.symbolPills}>
              {watchlistSymbols.map((symbol) => (
                <button
                  key={symbol}
                  className={styles.symbolPill}
                  onClick={() => removeSymbol(symbol)}
                  title="Remove"
                >
                  {symbol} ×
                </button>
              ))}
            </div>
          </div>

          <WatchlistPanel
            stocks={stocks}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
        </aside>

        {/* CENTER */}
        <main className={styles.center}>
          {watchlistSymbols.length === 0 ? (
            <div className={styles.emptyState}>
              Add symbols to your watchlist to begin.
            </div>
          ) : (
            selectedStock && (
              <>
                <MarketStats stock={selectedStock} />
                <div className={styles.mobileGuide}>
                  <ModelGuidePanel guides={modelGuides} />
                </div>
                <StockSignalCard
                  ticker={selectedStock.symbol}
                  onAnomalyOverlayChange={setAnomalyMarkers}
                />
                <div className={styles.chartArea}>
                  <div className={styles.chartHeader}>
                    <span className={styles.chartLabel}>
                      {selectedStock.symbol} — {timeframe.toUpperCase()}
                    </span>
                    <span className={styles.chartSub}>
                      Prev Close ${selectedStock.prevClose.toFixed(2)}
                    </span>
                  </div>
                  <div className={styles.chartBody}>
                    <StockChart
                      stock={selectedStock}
                      autoRefreshEnabled={autoRefreshEnabled}
                      setAutoRefreshEnabled={setAutoRefreshEnabled}
                      timeframe={timeframe}
                      setTimeframe={setTimeframe}
                      theme={theme}
                      anomalyMarkers={anomalyMarkers}
                    />
                  </div>
                </div>
              </>
            )
          )}
        </main>

        {/* RIGHT PANEL */}
        <aside className={styles.rightPanel}>
          <div className={styles.desktopGuide}>
            <ModelGuidePanel guides={modelGuides} />
          </div>
          <MarketSummary stocks={stocks} />
        </aside>
      </div>
    </div>
  )
}

/* ── MOVER LIST ── */
function MoverList({
  title, stocks, type, onSelect,
}: {
  title: string
  stocks: StockQuote[]
  type: 'up' | 'down'
  onSelect: (s: string) => void
}) {
  const color = type === 'up' ? 'var(--green)' : 'var(--red)'
  const Icon  = type === 'up' ? TrendingUp : TrendingDown

  return (
    <div className={styles.moverBlock}>
      <div className={styles.moverHeader}>
        <Icon size={11} color={color} />
        <span>{title}</span>
      </div>
      {stocks.map((s) => (
        <button key={s.symbol} className={styles.moverItem} onClick={() => onSelect(s.symbol)}>
          <span className={styles.moverSym}>{s.symbol}</span>
          <div className={styles.moverBar}>
            <div
              className={styles.moverFill}
              style={{ width: `${Math.min(100, Math.abs(s.changePercent) * 20)}%`, background: color }}
            />
          </div>
          <span className={`num ${styles.moverPct}`} style={{ color }}>
            {type === 'up' ? '+' : ''}{s.changePercent.toFixed(2)}%
          </span>
        </button>
      ))}
    </div>
  )
}

/* ── MARKET BREADTH ── */
type GuideTone = 'neutral' | 'positive' | 'warning'

type ModelGuide = {
  tone: GuideTone
  icon: LucideIcon
  title: string
  badge: string
  summary: string
  plainEnglish: string
  chips: string[]
}

function ModelGuidePanel({ guides }: { guides: ModelGuide[] }) {
  return (
    <section className={styles.guideStack}>
      <div className={styles.guideIntro}>
        <div className={styles.guideKicker}>How to read the models</div>
        <p>Plain-English explanations of what each model is telling you, without the machine learning jargon.</p>
      </div>

      {guides.map((guide) => {
        const Icon = guide.icon
        return (
          <article key={guide.title} className={`${styles.guideCard} ${styles[guide.tone]}`}>
            <div className={styles.guideTop}>
              <div className={styles.guideIconWrap}>
                <Icon size={15} />
              </div>
              <div className={styles.guideMeta}>
                <div className={styles.guideTitleRow}>
                  <h3>{guide.title}</h3>
                  <span>{guide.badge}</span>
                </div>
                <p>{guide.summary}</p>
              </div>
            </div>

            <div className={styles.guideBody}>
              <p>{guide.plainEnglish}</p>
              <div className={styles.guidePills}>
                {guide.chips.map((chip) => (
                  <span key={chip} className={styles.guidePill}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}

function MarketSummary({ stocks }: { stocks: StockQuote[] }) {
  const up   = stocks.filter((s) => s.changePercent > 0).length
  const down = stocks.filter((s) => s.changePercent < 0).length
  const flat = stocks.length - up - down
  const pctUp = stocks.length > 0 ? ((up / stocks.length) * 100).toFixed(0) : '0'

  return (
    <div className={styles.moverBlock}>
      <div className={styles.moverHeader}>
        <span>Market Breadth</span>
      </div>
      <div className={styles.breadthBar}>
        <div className={styles.breadthUp}   style={{ flex: up }}   title={`${up} advancing`} />
        <div className={styles.breadthFlat} style={{ flex: flat }} />
        <div className={styles.breadthDown} style={{ flex: down }}  title={`${down} declining`} />
      </div>
      <div className={styles.breadthLabels}>
        <span className="num" style={{ color: 'var(--green)', fontSize: 11 }}>↑ {up}</span>
        <span className="num" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{pctUp}% up</span>
        <span className="num" style={{ color: 'var(--red)', fontSize: 11 }}>↓ {down}</span>
      </div>
    </div>
  )
}

