'use client'

import { StockQuote } from '../lib/stockData'
import styles from './WatchlistPanel.module.css'

interface Props {
  stocks: StockQuote[]
  selectedSymbol: string
  onSelect: (symbol: string) => void
}

export default function WatchlistPanel({ stocks, selectedSymbol, onSelect }: Props) {
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>WATCHLIST</span>
        <span className={styles.count}>{stocks.length}</span>
      </div>
      <div className={styles.list}>
        {stocks.map(s => {
          const isUp = s.changePercent >= 0
          const isSelected = s.symbol === selectedSymbol
          return (
            <button
              key={s.symbol}
              className={`${styles.item} ${isSelected ? styles.selected : ''}`}
              onClick={() => onSelect(s.symbol)}
            >
              <div className={styles.left}>
                <div className={styles.symbol}>{s.symbol}</div>
                <div className={styles.name}>{s.name.split(' ').slice(0, 2).join(' ')}</div>
              </div>
              <div className={styles.right}>
                <div className={`${styles.price} num`}>${s.price.toFixed(2)}</div>
                <div className={`${styles.change} num ${isUp ? styles.up : styles.down}`}>
                  {isUp ? '+' : ''}{s.changePercent.toFixed(2)}%
                </div>
              </div>
              {/* Mini sparkbar */}
              <div className={styles.sparkbar}>
                {s.history.slice(-20).map((h, i) => {
                  const max = Math.max(...s.history.slice(-20).map(x => x.price))
                  const min = Math.min(...s.history.slice(-20).map(x => x.price))
                  const pct = max === min ? 0.5 : (h.price - min) / (max - min)
                  return (
                    <div
                      key={i}
                      className={styles.bar}
                      style={{
                        height: `${Math.max(10, pct * 100)}%`,
                        background: isUp ? 'var(--green)' : 'var(--red)',
                        opacity: isSelected ? 0.7 : 0.4,
                      }}
                    />
                  )
                })}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
