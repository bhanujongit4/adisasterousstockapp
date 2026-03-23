'use client'

import { StockQuote } from '../lib/stockData'
import styles from './MarketTicker.module.css'

export default function MarketTicker({ stocks }: { stocks: StockQuote[] }) {
  const items = [...stocks, ...stocks] // duplicate for seamless loop

  return (
    <div className={styles.tickerWrap}>
      <div className={styles.tickerLabel}>LIVE</div>
      <div className={styles.tickerTrack}>
        <div className={styles.tickerInner}>
          {items.map((s, i) => (
            <span key={`${s.symbol}-${i}`} className={styles.tickerItem}>
              <span className={styles.sym}>{s.symbol}</span>
              <span className={`${styles.price} num`}>${s.price.toFixed(2)}</span>
              <span className={`${styles.change} ${s.changePercent >= 0 ? styles.up : styles.down}`}>
                {s.changePercent >= 0 ? '▲' : '▼'} {Math.abs(s.changePercent).toFixed(2)}%
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
