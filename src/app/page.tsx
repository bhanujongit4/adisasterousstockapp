'use client'

import { useRef } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { StockQuote } from './lib/stockData'
import { useStockData } from './hooks/useStockData'
import MarketTicker from './components/MarketTicker'
import WatchlistPanel from './components/WatchlistPanel'
import StockChart from './components/StockChart'
import MarketStats from './components/MarketStats'
import styles from './Page.module.css'

export default function Home() {
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
  } = useStockData()

  const gainers = [...stocks].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3)
  const losers  = [...stocks].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3)

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingDot} />
        <span>INITIALIZING TERMINAL</span>
      </div>
    )
  }

  return (
    <div className={styles.root}>
      {/* Top nav */}
      <header className={styles.nav}>
        <div className={styles.logo}>
          <Activity size={16} strokeWidth={2.5} color="var(--green)" />
          <span className={styles.logoText}>MKTS</span>
          <span className={styles.logoBadge}>TERMINAL</span>
        </div>
        <div className={styles.navMeta}>
          <span className={styles.metaItem}>
            <span className={styles.metaDot} />
            SIMULATED DATA
          </span>
          {lastUpdated && (
            <span className={styles.metaItem}>
              UPDATED {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          )}
          <button className={styles.refreshBtn} onClick={refresh} title="Refresh">
            <RefreshCw size={13} />
          </button>
        </div>
      </header>

      {/* Ticker tape */}
      <MarketTicker stocks={stocks} />

      {/* Main layout */}
      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <WatchlistPanel
            stocks={stocks}
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
        </aside>

        {/* Center: chart + stats */}
        <main className={styles.center}>
          {selectedStock && (
            <>
              <MarketStats stock={selectedStock} />
              <div className={styles.chartArea}>
                <div className={styles.chartHeader}>
                  <span className={styles.chartLabel}>
                    {selectedStock.symbol} — INTRADAY (5 MIN)
                  </span>
                  <span className={styles.chartSub}>PREV CLOSE: ${selectedStock.prevClose.toFixed(2)}</span>
                </div>
                <div className={styles.chartBody}>
                  <StockChart
                    stock={selectedStock}
                    autoRefreshEnabled={autoRefreshEnabled}
                    setAutoRefreshEnabled={setAutoRefreshEnabled}
                  />
                </div>
              </div>
            </>
          )}
        </main>

        {/* Right panel: movers */}
        <aside className={styles.rightPanel}>
          <MoverList title="TOP GAINERS" stocks={gainers} type="up" onSelect={setSelectedSymbol} />
          <MoverList title="TOP LOSERS"  stocks={losers}  type="down" onSelect={setSelectedSymbol} />
          <MarketSummary stocks={stocks} />
        </aside>
      </div>
    </div>
  )
}

function MoverList({ title, stocks, type, onSelect }: {
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
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
          {title}
        </span>
      </div>
      {(stocks as any[]).map((s: any) => (
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
            {type === 'up' ? '+' : ''}{s.changePercent.toFixed(2)}%
          </span>
        </button>
      ))}
    </div>
  )
}

function MarketSummary({ stocks }: { stocks: any[] }) {
  const up = stocks.filter(s => s.changePercent > 0).length
  const down = stocks.filter(s => s.changePercent < 0).length
  const flat = stocks.length - up - down
  const pctUp = ((up / stocks.length) * 100).toFixed(0)

  return (
    <div className={styles.moverBlock}>
      <div className={styles.moverHeader}>
        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
          MARKET BREADTH
        </span>
      </div>
      <div className={styles.breadthBar}>
        <div className={styles.breadthUp}   style={{ flex: up }} title={`${up} advancing`} />
        <div className={styles.breadthFlat} style={{ flex: flat }} />
        <div className={styles.breadthDown} style={{ flex: down }} title={`${down} declining`} />
      </div>
      <div className={styles.breadthLabels}>
        <span className="num" style={{ color: 'var(--green)', fontSize: 11 }}>▲ {up}</span>
        <span className="num" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{pctUp}% advancing</span>
        <span className="num" style={{ color: 'var(--red)', fontSize: 11 }}>▼ {down}</span>
      </div>
    </div>
  )
}
