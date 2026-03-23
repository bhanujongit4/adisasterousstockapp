'use client'

import { StockQuote, formatVolume, formatMarketCap } from '../lib/stockData'
import styles from './MarketStats.module.css'

const ratingColor: Record<string, string> = {
  'Strong Buy': 'var(--green)',
  'Buy': 'var(--green-dim)',
  'Hold': 'var(--amber)',
  'Sell': 'var(--red-dim)',
  'Strong Sell': 'var(--red)',
}

function val(v: number | undefined, fmt: (n: number) => string, suffix = '') {
  return v !== undefined && v !== null ? `${fmt(v)}${suffix}` : '—'
}
const $ = (n: number) => `$${n.toFixed(2)}`
const pct = (n: number) => `${n.toFixed(2)}%`
const x = (n: number) => `${n.toFixed(1)}x`
const raw = (n: number) => n.toFixed(2)

export default function MarketStats({ stock }: { stock: StockQuote }) {
  const isUp = stock.changePercent >= 0

  const rows: { label: string; value: string; highlight?: string }[][] = [
    // Row 1 — price action
    [
      { label: 'OPEN',       value: val(stock.open,      $) },
      { label: 'PREV CLOSE', value: val(stock.prevClose, $) },
      { label: 'DAY HIGH',   value: val(stock.high,      $) },
      { label: 'DAY LOW',    value: val(stock.low,       $) },
    ],
    // Row 2 — range
    [
      { label: '52W HIGH',   value: val(stock.week52High, $) },
      { label: '52W LOW',    value: val(stock.week52Low,  $) },
      { label: 'VOLUME',     value: formatVolume(stock.volume) },
      { label: 'AVG VOLUME', value: formatVolume(stock.avgVolume) },
    ],
    // Row 3 — fundamentals
    [
      { label: 'MKT CAP',    value: formatMarketCap(stock.marketCap) },
      { label: 'P/E (TTM)',   value: val(stock.pe,        x) },
      { label: 'FWD P/E',    value: val(stock.forwardPe,  x) },
      { label: 'EPS (TTM)',   value: val(stock.eps, (n) => n >= 0 ? `$${n.toFixed(2)}` : `-$${Math.abs(n).toFixed(2)}`) },
    ],
    // Row 4 — risk + income
    [
      { label: 'BETA',       value: val(stock.beta,          raw) },
      { label: 'DIV YIELD',  value: stock.dividendYield ? pct(stock.dividendYield) : '—' },
      { label: 'DIV/SHARE',  value: stock.dividendAmount ? `$${stock.dividendAmount.toFixed(2)}/yr` : '—' },
      { label: 'FLOAT',      value: stock.floatShares ? formatVolume(stock.floatShares) : '—' },
    ],
    // Row 5 — sentiment
    [
      { label: 'SHORT %',    value: stock.shortFloat ? `${stock.shortFloat.toFixed(2)}%` : '—' },
      { label: 'SHORT RATIO',value: stock.shortRatio  ? `${stock.shortRatio.toFixed(1)}d` : '—' },
      { label: 'PT TARGET',  value: stock.priceTarget ? `$${stock.priceTarget}` : '—' },
      { label: 'PT UPSIDE',  value: stock.priceTarget ? `${(((stock.priceTarget - stock.price) / stock.price) * 100).toFixed(1)}%` : '—' },
    ],
  ]

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.stockMeta}>
          <div className={styles.topLine}>
            <span className={styles.symbol}>{stock.symbol}</span>
            <span className={styles.sector}>{stock.sector}</span>
          </div>
          <div className={styles.name}>{stock.name}</div>
        </div>
        <div className={styles.priceBlock}>
          <div className={`${styles.price} num`}>${stock.price.toFixed(2)}</div>
          <div className={`${styles.change} num ${isUp ? styles.up : styles.down}`}>
            {isUp ? '+' : ''}{stock.change.toFixed(2)}&nbsp;
            ({isUp ? '+' : ''}{stock.changePercent.toFixed(2)}%)
          </div>
          {stock.analystRating && (
            <div className={styles.rating} style={{ color: ratingColor[stock.analystRating] ?? 'var(--text-secondary)' }}>
              ● {stock.analystRating}
            </div>
          )}
        </div>
      </div>

      <div className={styles.statsScroll}>
        {rows.map((row, ri) => (
          <div key={ri} className={styles.row}>
            {row.map(s => (
              <div key={s.label} className={styles.stat}>
                <div className={styles.statLabel}>{s.label}</div>
                <div className={`${styles.statValue} num`} style={s.highlight ? { color: s.highlight } : {}}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}