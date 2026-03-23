'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, BarChart, Bar
} from 'recharts'
import { StockQuote } from '../lib/stockData'
import styles from './StockChart.module.css'

interface Props {
  stock: StockQuote
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTime}>{label}</div>
      <div className={styles.tooltipPrice}>${payload[0]?.value?.toFixed(2)}</div>
    </div>
  )
}

export default function StockChart({ stock }: Props) {
  const isUp = stock.changePercent >= 0
  const color = isUp ? 'var(--green)' : 'var(--red)'
  const gradientId = `grad-${stock.symbol}`

  const minPrice = useMemo(() => Math.min(...stock.history.map(h => h.price)) * 0.9995, [stock.history])
  const maxPrice = useMemo(() => Math.max(...stock.history.map(h => h.price)) * 1.0005, [stock.history])

  // Show every ~10th label
  const tickFormatter = (_: string, index: number) => {
    if (index % 10 === 0) return stock.history[index]?.time ?? ''
    return ''
  }

  return (
    <div className={styles.wrapper}>
      {/* Price area chart */}
      <div className={styles.mainChart}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={stock.history} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={tickFormatter}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'IBM Plex Mono' }}
              axisLine={false}
              tickLine={false}
              width={70}
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              orientation="right"
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={stock.prevClose} stroke="var(--text-muted)" strokeDasharray="4 4" strokeOpacity={0.6} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: 'var(--bg-primary)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume bar chart */}
      <div className={styles.volumeChart}>
        <div className={styles.volumeLabel}>VOLUME</div>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stock.history} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <Bar dataKey="volume" fill={color} fillOpacity={0.35} radius={[1, 1, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
