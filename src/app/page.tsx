'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Home.module.css'

const TICKERS = [
  { sym: 'AAPL', price: '213.49', change: '+1.24', up: true },
  { sym: 'NVDA', price: '137.62', change: '+3.87', up: true },
  { sym: 'TSLA', price: '248.50', change: '-4.12', up: false },
  { sym: 'MSFT', price: '421.90', change: '+0.78', up: true },
  { sym: 'GOOG', price: '178.25', change: '+2.11', up: true },
  { sym: 'AMZN', price: '224.18', change: '-1.03', up: false },
  { sym: 'META', price: '623.44', change: '+5.33', up: true },
  { sym: 'BRK.B', price: '472.90', change: '+0.22', up: true },
  { sym: 'JPM', price: '257.11', change: '-0.89', up: false },
  { sym: 'V', price: '340.67', change: '+1.55', up: true },
  { sym: 'SPY', price: '591.80', change: '+0.47', up: true },
  { sym: 'QQQ', price: '510.33', change: '+1.02', up: true },
  { sym: 'GLD', price: '238.45', change: '-0.31', up: false },
  { sym: 'BTC', price: '103,240', change: '+2.88', up: true },
  { sym: 'ETH', price: '3,412', change: '-1.14', up: false },
]

const FEATURES = [
  {
    icon: '*',
    title: 'Live Market Stream',
    desc: 'Real-time quotes filtered to your active watchlist. Zero noise, pure signal.',
  },
  {
    icon: '[]',
    title: 'Smart Watchlists',
    desc: 'Build and manage symbol lists with manual symbol add, quick remove, and fast switching.',
  },
  {
    icon: '/\\',
    title: 'Chart Workspace',
    desc: 'Candles, indicators, panes, overlays, and annotation tools built for active analysis.',
  },
  {
    icon: '+',
    title: 'Signal Models',
    desc: 'Regime, microstructure, and anomaly engines with interpretable outputs.',
  },
]

const INFO_SECTIONS = [
  {
    title: 'Platform Overview',
    points: [
      'IN$JAM is a single-screen market analysis terminal that combines watchlists, live quotes, charting, indicators, and model-generated signals.',
      'The product is built for speed of decision: symbol discovery, chart analysis, and model interpretation happen in one flow.',
      'Design goal: reduce context-switching and keep high-value market information visible without opening multiple tools.',
    ],
  },
  {
    title: 'How To Use',
    points: [
      '1) Add symbols from top picks or manual symbol input in the watchlist manager.',
      '2) Select a symbol to refresh the stats panel, chart area, and signal lab.',
      '3) Change timeframe and chart type, then layer technical indicators based on your strategy.',
      '4) Open fullscreen for drawing trendlines, marker placement, and note annotations.',
      '5) Run Regime, Microstructure, and Anomaly modules to get context-aware model outputs.',
    ],
  },
  {
    title: 'Model Layer',
    points: [
      'Regime model combines HMM latent-state inference, Hurst exponent persistence, ADX trend strength, and volatility percentile voting.',
      'Microstructure model estimates congestion score, latency regime, and directional congestion trend from intraday behavior.',
      'Anomaly model uses an ensemble (Isolation Forest, rolling z-score, CUSUM) and returns severity, composite score, top drivers, and candle markers.',
      'Outputs are explainable by design so traders can inspect confidence and component breakdowns before acting.',
    ],
  },
  {
    title: 'Indicators And Chart System',
    points: [
      'Chart types: Candlestick, Line, Area, OHLC Bar, Baseline.',
      'Indicators: SMA, EMA, WMA, Bollinger Bands, VWAP, PSAR, Keltner, Ichimoku, RSI, MACD, Stochastic, Williams %R, CCI, ADX, ATR, ROC, TRIX, MFI, OBV, ADL, Force Index, Awesome Oscillator.',
      'Volume and oscillator panes are resizable and persist visual proportions while data updates.',
      'Anomaly overlays are rendered directly on chart context for immediate non-hover visibility.',
    ],
  },
  {
    title: 'Architecture And Build Stack',
    points: [
      'Frontend: Next.js App Router, React, TypeScript, CSS Modules.',
      'Charts: lightweight-charts with custom controls, pane overlays, and annotation state handling.',
      'Backend routes: Next.js API handlers for auth, watchlist, symbols, quotes, and signal proxy endpoints.',
      'Database/Auth: Neon Postgres + secure signed-cookie sessions.',
      'Intelligence service: Python FastAPI with pandas, numpy, scikit-learn, hmmlearn, scipy.',
      'Data sources: Yahoo Finance quote/history endpoints normalized into a shared payload for chart and stats.',
    ],
  },
]

function Sparkline({ up }: { up: boolean }) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const noise = (Math.sin(i * 2.3 + (up ? 1 : 3)) + Math.random() * 0.6) * 18
    return `${i * 18},${40 - (up ? noise : -noise)}`
  }).join(' ')
  const color = up ? '#00ff80' : '#ff4d6a'

  return (
    <svg width="100" height="40" viewBox="0 0 198 60" fill="none" style={{ display: 'block' }}>
      <polyline points={pts} stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function Home() {
  const router = useRouter()
  const [sessionChecking, setSessionChecking] = useState(true)
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [horrorMode, setHorrorMode] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMounted(true)
    let cancelled = false
    const init = async () => {
      try {
        const res = await fetch('/api/auth/session')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data?.user) {
          router.replace('/dashboard')
          return
        }
      } finally {
        if (!cancelled) setSessionChecking(false)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [router])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let t = 0
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const isDark = theme === 'dark'
      const lineColor = isDark ? 'rgba(0,255,128,0.045)' : 'rgba(0,100,60,0.06)'
      const glowColor = isDark ? 'rgba(0,255,128,0.18)' : 'rgba(0,160,80,0.18)'
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      const gs = 48
      for (let x = 0; x < canvas.width; x += gs) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }
      for (let y = 0; y < canvas.height; y += gs) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(canvas.width, y)
        ctx.stroke()
      }

      ctx.strokeStyle = glowColor
      ctx.lineWidth = 2.5
      ctx.shadowBlur = 12
      ctx.shadowColor = glowColor
      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += 2) {
        const y =
          canvas.height * 0.55 +
          Math.sin(x * 0.012 + t) * 40 +
          Math.sin(x * 0.03 + t * 1.4) * 18 +
          Math.cos(x * 0.007 + t * 0.7) * 28
        if (x === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      t += 0.008
      animId = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  async function handleAuthSubmit(e: FormEvent) {
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
        const isWrongLogin = authMode === 'login' && res.status === 401
        if (isWrongLogin) {
          setHorrorMode(true)
          setAuthError('No password, we opps.')
        } else {
          setAuthError(data?.error ?? 'Authentication failed.')
        }
        return
      }
      setHorrorMode(false)
      setPassword('')
      router.push('/dashboard')
    } catch {
      setAuthError('Authentication failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  if (sessionChecking || !mounted) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingRing} />
        <span>INITIALIZING IN$JAM</span>
      </div>
    )
  }

  const rootClass = theme === 'light' ? `${styles.root} ${styles.rootLight}` : styles.root

  return (
    <div className={rootClass}>
      <canvas ref={canvasRef} className={styles.bgCanvas} />

      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.navLogoMark}>▲</span>
          <span className={styles.navLogoText}>IN$JAM</span>
          <span className={styles.navLogoBadge}>I NEVER $ JOKE ABOUT MONEY</span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.infoBtn} onClick={() => setInfoOpen(true)} aria-label="Open project info">
            INFO
          </button>
          <button className={styles.themeToggle} onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Toggle theme">
            {theme === 'dark' ? '◑' : '◐'}
          </button>
        </div>
      </nav>

      <div className={styles.tickerWrap}>
        <div className={styles.tickerTrack}>
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.tickerSym}>{t.sym}</span>
              <span className={styles.tickerPrice}>{t.price}</span>
              <span className={`${styles.tickerChange} ${t.up ? styles.tickerUp : styles.tickerDown}`}>{t.change}%</span>
            </span>
          ))}
        </div>
      </div>

      <main className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowDot} />
            LIVE MARKETS - REAL-TIME DATA
          </div>
          <h1 className={styles.heroHeadline}>
            Trade with
            <br />
            <span className={styles.heroAccent}>IN$JAM</span>
            <br />
            precision.
          </h1>
          <p className={styles.heroCopy}>
            Stream only your symbols. Annotate every chart. Build the workspace serious traders actually need.
          </p>

          <div className={styles.statsRow}>
            <div className={styles.statItem}>
              <span className={styles.statNum}>2.4ms</span>
              <span className={styles.statLabel}>avg latency</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>18k+</span>
              <span className={styles.statLabel}>symbols tracked</span>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <span className={styles.statNum}>99.9%</span>
              <span className={styles.statLabel}>uptime</span>
            </div>
          </div>

          <div className={styles.chartCards}>
            {TICKERS.slice(0, 3).map((t) => (
              <div key={t.sym} className={styles.chartCard}>
                <div className={styles.chartCardTop}>
                  <span className={styles.chartCardSym}>{t.sym}</span>
                  <span className={`${styles.chartCardChange} ${t.up ? styles.chartCardUp : styles.chartCardDown}`}>{t.change}%</span>
                </div>
                <Sparkline up={t.up} />
                <span className={styles.chartCardPrice}>${t.price}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.authWrap}>
          <div className={styles.authGlow} />
          <form className={styles.authCard} onSubmit={handleAuthSubmit}>
            <div className={styles.authTopBar}>
              <span className={styles.authDotRed} />
              <span className={styles.authDotYellow} />
              <span className={styles.authDotGreen} />
            </div>

            <div className={styles.authTitle}>{authMode === 'login' ? 'Welcome back' : 'Create account'}</div>
            <div className={styles.authSub}>
              {authMode === 'login' ? 'Sign in to your IN$JAM workspace.' : 'Join thousands of traders on IN$JAM.'}
            </div>

            <div className={styles.authField}>
              <label className={styles.authLabel}>EMAIL</label>
              <input
                className={styles.authInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className={styles.authField}>
              <label className={styles.authLabel}>PASSWORD</label>
              <input
                className={styles.authInput}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                type="password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                required
              />
            </div>

            {authError && <div className={styles.authError}>{authError}</div>}

            <button className={styles.authPrimary} type="submit" disabled={authBusy}>
              {authBusy ? 'Please wait...' : authMode === 'signup' ? '-> Create Account' : '-> Enter IN$JAM'}
            </button>

            <button
              className={styles.authSwitch}
              type="button"
              onClick={() => {
                setAuthMode((p) => (p === 'login' ? 'signup' : 'login'))
                setAuthError('')
                setHorrorMode(false)
              }}
            >
              {authMode === 'login' ? 'New here? Sign up free' : 'Have an account? Login'}
            </button>
          </form>
        </div>
      </main>

      <section className={styles.features}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <div className={styles.featureTitle}>{f.title}</div>
            <div className={styles.featureDesc}>{f.desc}</div>
          </div>
        ))}
      </section>

      <footer className={styles.footer}>
        <span>© 2025 IN$JAM</span>
        <span className={styles.footerDot}>·</span>
        <span>Markets data is 15 min delayed for display purposes</span>
      </footer>

      {infoOpen && (
        <div className={styles.infoOverlay}>
          <div className={styles.infoBackdrop} onClick={() => setInfoOpen(false)} />
          <section className={styles.infoPanel}>
            <div className={styles.infoHeader}>
              <div>
                <div className={styles.infoKicker}>IN$JAM Project Brief</div>
                <h2 className={styles.infoTitle}>I NEVER $ JOKE ABOUT MONEY</h2>
              </div>
              <button className={styles.infoClose} onClick={() => setInfoOpen(false)}>
                CLOSE
              </button>
            </div>
            <div className={styles.infoGrid}>
              {INFO_SECTIONS.map((section) => (
                <article key={section.title} className={styles.infoCard}>
                  <h3 className={styles.infoCardTitle}>{section.title}</h3>
                  <div className={styles.infoList}>
                    {section.points.map((point) => (
                      <p key={point} className={styles.infoPoint}>
                        {point}
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {horrorMode && (
        <div className={styles.horrorOverlay}>
          <div className={styles.horrorBackdrop} />
          <div className={styles.horrorLayout}>
            <div className={styles.horrorMessage}>
              <p className={styles.horrorKicker}>Login failed.</p>
              <h1 className={styles.horrorHeadline}>NEVER DO THAT AGAIN</h1>
              <p className={styles.horrorLine}>Will Spin On Your Block,</p>
              <p className={styles.horrorLine}>No PASSWORD, so we OPPS.</p>
              <button type="button" className={styles.horrorClose} onClick={() => setHorrorMode(false)}>
                Back to normal screen
              </button>
            </div>

            <form className={`${styles.authCard} ${styles.horrorAuthCard}`} onSubmit={handleAuthSubmit}>
              <div className={styles.authTopBar}>
                <span className={styles.authDotRed} />
                <span className={styles.authDotYellow} />
                <span className={styles.authDotGreen} />
              </div>

              <div className={styles.authTitle}>{authMode === 'login' ? 'Try that again.' : 'Create account'}</div>
              <div className={styles.authSub}>
                {authMode === 'login' ? 'Enter correct credentials to continue.' : 'Sign up and enter IN$JAM.'}
              </div>

              <div className={styles.authField}>
                <label className={styles.authLabel}>EMAIL</label>
                <input
                  className={styles.authInput}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>

              <div className={styles.authField}>
                <label className={styles.authLabel}>PASSWORD</label>
                <input
                  className={styles.authInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === 'signup' ? 'Min. 8 characters' : 'Enter password'}
                  type="password"
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  required
                />
              </div>

              {authError && <div className={styles.authError}>{authError}</div>}

              <button className={styles.authPrimary} type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait...' : authMode === 'signup' ? '-> Create Account' : '-> Enter IN$JAM'}
              </button>

              <button
                className={styles.authSwitch}
                type="button"
                onClick={() => {
                  setAuthMode((p) => (p === 'login' ? 'signup' : 'login'))
                  setAuthError('')
                }}
              >
                {authMode === 'login' ? 'New here? Sign up free' : 'Have an account? Login'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
