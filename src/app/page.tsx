'use client'

import { useEffect, useMemo, useState } from 'react'
import { Activity, LogOut, Moon, RefreshCw, Sun, TrendingDown, TrendingUp } from 'lucide-react'
import { StockChoice, StockQuote } from './lib/stockData'
import { useStockData } from './hooks/useStockData'
import MarketTicker from './components/MarketTicker'
import WatchlistPanel from './components/WatchlistPanel'
import StockChart from './components/StockChart'
import MarketStats from './components/MarketStats'
import styles from './Page.module.css'

type User = { id: number; email: string }

type WatchlistResponse = {
  symbols: string[]
  available: StockChoice[]
  limit: number
}

export default function Home() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  const [sessionChecking, setSessionChecking] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([])
  const [watchlistLimit, setWatchlistLimit] = useState(10)
  const [availableStocks, setAvailableStocks] = useState<StockChoice[]>([])
  const [pendingTop32, setPendingTop32] = useState('')
  const [manualSymbol, setManualSymbol] = useState('')
  const [watchlistError, setWatchlistError] = useState('')

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)

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

  const gainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3)
  const losers = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3)

  const addableTop32 = useMemo(
    () => availableStocks.filter((s) => !watchlistSymbols.includes(s.symbol)),
    [availableStocks, watchlistSymbols],
  )

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (!res.ok) return

        const data = await res.json()
        if (cancelled || !data?.user) return

        setUser(data.user)
        await loadWatchlist()
      } finally {
        if (!cancelled) setSessionChecking(false)
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!pendingTop32 && addableTop32.length > 0) {
      setPendingTop32(addableTop32[0].symbol)
    }
  }, [addableTop32, pendingTop32])

  async function loadWatchlist() {
    const res = await fetch('/api/watchlist')
    if (!res.ok) return

    const data = (await res.json()) as WatchlistResponse
    setWatchlistSymbols(data.symbols)
    setAvailableStocks(data.available)
    setWatchlistLimit(data.limit)
    setWatchlistError('')
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAuthBusy(true)
    setAuthError('')

    try {
      const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        setAuthError(data?.error ?? 'Authentication failed.')
        return
      }

      setUser(data.user)
      setPassword('')
      await loadWatchlist()
    } catch {
      setAuthError('Authentication failed.')
    } finally {
      setAuthBusy(false)
      setSessionChecking(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setWatchlistSymbols([])
    setAvailableStocks([])
    setPendingTop32('')
    setManualSymbol('')
    setWatchlistError('')
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

    if (!res.ok) {
      setWatchlistError(data?.error ?? 'Could not add symbol.')
      return
    }

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

    if (!res.ok) {
      setWatchlistError(data?.error ?? 'Could not remove symbol.')
      return
    }

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

  if (sessionChecking || (user && loading && stocks.length === 0)) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingDot} />
        <span>INITIALIZING TERMINAL</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.authShell}>
        <form className={styles.authCard} onSubmit={handleAuthSubmit}>
          <div className={styles.authHeader}>MKTS TERMINAL</div>
          <div className={styles.authSub}>Use Neon-backed account auth to load your private watchlist.</div>

          <label className={styles.authLabel}>Email</label>
          <input
            className={styles.authInput}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
            required
          />

          <label className={styles.authLabel}>Password</label>
          <input
            className={styles.authInput}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            type="password"
            autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
            required
          />

          {authError && <div className={styles.authError}>{authError}</div>}

          <button className={styles.authPrimary} type="submit" disabled={authBusy}>
            {authBusy ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Login'}
          </button>

          <button
            className={styles.authSwitch}
            type="button"
            onClick={() => {
              setAuthMode((prev) => (prev === 'login' ? 'signup' : 'login'))
              setAuthError('')
            }}
          >
            {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <header className={styles.nav}>
        <div className={styles.logo}>
          <Activity size={16} strokeWidth={2.5} color="var(--green)" />
          <span className={styles.logoText}>MKTS</span>
          <span className={styles.logoBadge}>TERMINAL</span>
        </div>
        <div className={styles.navMeta}>
          <span className={styles.metaItem}>{user.email}</span>
          <span className={styles.metaItem}>
            <span className={styles.metaDot} />
            LIVE DATA
          </span>
          {lastUpdated && (
            <span className={styles.metaItem}>
              UPDATED {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}
          <button className={styles.refreshBtn} onClick={refresh} title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button
            className={styles.themeBtn}
            onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to white mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          <button className={styles.themeBtn} onClick={handleLogout} title="Logout">
            <LogOut size={13} />
          </button>
        </div>
      </header>

      <MarketTicker stocks={stocks} />

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <div className={styles.watchlistManager}>
            <div className={styles.managerHead}>MY WATCHLIST ({watchlistSymbols.length}/{watchlistLimit})</div>

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
                    {s.symbol} - {s.name}
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
                placeholder="Type symbol (ex: IBM)"
                maxLength={12}
              />
              <button
                className={styles.managerBtn}
                onClick={handleManualAdd}
                disabled={watchlistSymbols.length >= watchlistLimit}
              >
                Find + Add
              </button>
            </div>

            {watchlistError && <div className={styles.watchlistError}>{watchlistError}</div>}

            <div className={styles.symbolPills}>
              {watchlistSymbols.map((symbol) => (
                <button key={symbol} className={styles.symbolPill} onClick={() => removeSymbol(symbol)} title="Remove from watchlist">
                  {symbol} x
                </button>
              ))}
            </div>
          </div>

          <WatchlistPanel stocks={stocks} selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />
        </aside>

        <main className={styles.center}>
          {watchlistSymbols.length === 0 ? (
            <div className={styles.emptyState}>Add symbols to your watchlist to start live updates.</div>
          ) : (
            selectedStock && (
              <>
                <MarketStats stock={selectedStock} />
                <div className={styles.chartArea}>
                  <div className={styles.chartHeader}>
                    <span className={styles.chartLabel}>
                      {selectedStock.symbol} - {timeframe.toUpperCase()} VIEW
                    </span>
                    <span className={styles.chartSub}>PREV CLOSE: ${selectedStock.prevClose.toFixed(2)}</span>
                  </div>
                  <div className={styles.chartBody}>
                    <StockChart
                      stock={selectedStock}
                      autoRefreshEnabled={autoRefreshEnabled}
                      setAutoRefreshEnabled={setAutoRefreshEnabled}
                      timeframe={timeframe}
                      setTimeframe={setTimeframe}
                      theme={theme}
                    />
                  </div>
                </div>
              </>
            )
          )}
        </main>

        <aside className={styles.rightPanel}>
          <MoverList title="TOP GAINERS" stocks={gainers} type="up" onSelect={setSelectedSymbol} />
          <MoverList title="TOP LOSERS" stocks={losers} type="down" onSelect={setSelectedSymbol} />
          <MarketSummary stocks={stocks} />
        </aside>
      </div>
    </div>
  )
}

function MoverList({
  title,
  stocks,
  type,
  onSelect,
}: {
  title: string
  stocks: StockQuote[]
  type: 'up' | 'down'
  onSelect: (s: string) => void
}) {
  const color = type === 'up' ? 'var(--green)' : 'var(--red)'
  const Icon = type === 'up' ? TrendingUp : TrendingDown

  return (
    <div className={styles.moverBlock}>
      <div className={styles.moverHeader}>
        <Icon size={12} color={color} />
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>{title}</span>
      </div>
      {stocks.map((s) => (
        <button key={s.symbol} className={styles.moverItem} onClick={() => onSelect(s.symbol)}>
          <span className={styles.moverSym}>{s.symbol}</span>
          <div className={styles.moverBar}>
            <div
              className={styles.moverFill}
              style={{
                width: `${Math.min(100, Math.abs(s.changePercent) * 20)}%`,
                background: color,
              }}
            />
          </div>
          <span className={`num ${styles.moverPct}`} style={{ color }}>
            {type === 'up' ? '+' : ''}
            {s.changePercent.toFixed(2)}%
          </span>
        </button>
      ))}
    </div>
  )
}

function MarketSummary({ stocks }: { stocks: StockQuote[] }) {
  const up = stocks.filter((s) => s.changePercent > 0).length
  const down = stocks.filter((s) => s.changePercent < 0).length
  const flat = stocks.length - up - down
  const pctUp = stocks.length > 0 ? ((up / stocks.length) * 100).toFixed(0) : '0'

  return (
    <div className={styles.moverBlock}>
      <div className={styles.moverHeader}>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
          MARKET BREADTH
        </span>
      </div>
      <div className={styles.breadthBar}>
        <div className={styles.breadthUp} style={{ flex: up }} title={`${up} advancing`} />
        <div className={styles.breadthFlat} style={{ flex: flat }} />
        <div className={styles.breadthDown} style={{ flex: down }} title={`${down} declining`} />
      </div>
      <div className={styles.breadthLabels}>
        <span className="num" style={{ color: 'var(--green)', fontSize: 11 }}>
          UP {up}
        </span>
        <span className="num" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
          {pctUp}% advancing
        </span>
        <span className="num" style={{ color: 'var(--red)', fontSize: 11 }}>
          DOWN {down}
        </span>
      </div>
    </div>
  )
}
