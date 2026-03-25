'use client'

import { FormEvent, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Home.module.css'

const TICKERS = [
  { sym: 'AAPL',  price: '213.49',   change: '+1.24', up: true },
  { sym: 'NVDA',  price: '137.62',   change: '+3.87', up: true },
  { sym: 'TSLA',  price: '248.50',   change: '-4.12', up: false },
  { sym: 'MSFT',  price: '421.90',   change: '+0.78', up: true },
  { sym: 'GOOG',  price: '178.25',   change: '+2.11', up: true },
  { sym: 'AMZN',  price: '224.18',   change: '-1.03', up: false },
  { sym: 'META',  price: '623.44',   change: '+5.33', up: true },
  { sym: 'BRK.B', price: '472.90',   change: '+0.22', up: true },
  { sym: 'JPM',   price: '257.11',   change: '-0.89', up: false },
  { sym: 'V',     price: '340.67',   change: '+1.55', up: true },
  { sym: 'SPY',   price: '591.80',   change: '+0.47', up: true },
  { sym: 'QQQ',   price: '510.33',   change: '+1.02', up: true },
  { sym: 'GLD',   price: '238.45',   change: '-0.31', up: false },
  { sym: 'BTC',   price: '103,240',  change: '+2.88', up: true },
  { sym: 'ETH',   price: '3,412',    change: '-1.14', up: false },
]

const FEATURES = [
  { icon: '◈', title: 'Live Market Stream',    desc: 'Real-time quotes filtered to only your watchlist. Zero noise, pure signal.' },
  { icon: '⬡', title: 'Smart Watchlists',      desc: 'Build, organize, and share symbol lists with custom alerts and price targets.' },
  { icon: '⌖', title: 'Chart Annotations',     desc: 'Draw trendlines, place markers, and attach timestamped notes per symbol.' },
  { icon: '⊞', title: 'Portfolio Analytics',   desc: 'P&L tracking, sector exposure, and performance attribution in one view.' },
]

function Sparkline({ up }: { up: boolean }) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const noise = (Math.sin(i * 2.3 + (up ? 1 : 3)) + Math.random() * 0.6) * 18
    return `${i * 18},${40 - (up ? noise : -noise)}`
  }).join(' ')
  const color = up ? '#00ff80' : '#ff4d6a'
  return (
    <svg width="100" height="40" viewBox="0 0 198 60" fill="none" style={{ display: 'block' }}>
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
        if (!cancelled && data?.user) { router.replace('/dashboard'); return }
      } finally {
        if (!cancelled) setSessionChecking(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let animId: number
    let t = 0
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
    resize()
    window.addEventListener('resize', resize)
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const isDark = theme === 'dark'
      const lineColor = isDark ? 'rgba(0,255,128,0.045)' : 'rgba(0,100,60,0.06)'
      const glowColor = isDark ? 'rgba(0,255,128,0.18)'  : 'rgba(0,160,80,0.18)'
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      const gs = 48
      for (let x = 0; x < canvas.width;  x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() }
      for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() }
      ctx.strokeStyle = glowColor
      ctx.lineWidth = 2.5
      ctx.shadowBlur = 12
      ctx.shadowColor = glowColor
      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += 2) {
        const y = canvas.height * 0.55
          + Math.sin(x * 0.012 + t) * 40
          + Math.sin(x * 0.03  + t * 1.4) * 18
          + Math.cos(x * 0.007 + t * 0.7) * 28
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      t += 0.008
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
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
        <span>INITIALIZING MKTS</span>
      </div>
    )
  }

  // Compose root class — apply both .root (always) and .rootLight (when light)
  const rootClass = theme === 'light'
    ? `${styles.root} ${styles.rootLight}`
    : styles.root

  return (
    <div className={rootClass}>
      <canvas ref={canvasRef} className={styles.bgCanvas} />

      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.navLogoMark}>▲</span>
          <span className={styles.navLogoText}>MKTS</span>
          <span className={styles.navLogoBadge}>TERMINAL</span>
        </div>
        <div className={styles.navRight}>
          <button
            className={styles.themeToggle}
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '◑' : '◐'}
          </button>
        </div>
      </nav>

      {/* Ticker tape */}
      <div className={styles.tickerWrap}>
        <div className={styles.tickerTrack}>
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <span key={i} className={styles.tickerItem}>
              <span className={styles.tickerSym}>{t.sym}</span>
              <span className={styles.tickerPrice}>{t.price}</span>
              <span className={`${styles.tickerChange} ${t.up ? styles.tickerUp : styles.tickerDown}`}>
                {t.change}%
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <main className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowDot} />
            LIVE MARKETS · REAL-TIME DATA
          </div>
          <h1 className={styles.heroHeadline}>
            Trade with<br />
            <span className={styles.heroAccent}>terminal</span><br />
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
                  <span className={`${styles.chartCardChange} ${t.up ? styles.chartCardUp : styles.chartCardDown}`}>
                    {t.change}%
                  </span>
                </div>
                <Sparkline up={t.up} />
                <span className={styles.chartCardPrice}>${t.price}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Auth */}
        <div className={styles.authWrap}>
          <div className={styles.authGlow} />
          <form className={styles.authCard} onSubmit={handleAuthSubmit}>
            <div className={styles.authTopBar}>
              <span className={styles.authDotRed} />
              <span className={styles.authDotYellow} />
              <span className={styles.authDotGreen} />
            </div>

            <div className={styles.authTitle}>
              {authMode === 'login' ? 'Welcome back' : 'Create account'}
            </div>
            <div className={styles.authSub}>
              {authMode === 'login'
                ? 'Sign in to your MKTS Terminal.'
                : 'Join thousands of traders on MKTS.'}
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
              {authBusy
                ? 'Please wait...'
                : authMode === 'signup'
                ? '→ Create Account'
                : '→ Enter Terminal'}
            </button>

            <button
              className={styles.authSwitch}
              type="button"
              onClick={() => { setAuthMode(p => p === 'login' ? 'signup' : 'login'); setAuthError(''); setHorrorMode(false) }}
            >
              {authMode === 'login' ? 'New here? Sign up free' : 'Have an account? Login'}
            </button>
          </form>
        </div>
      </main>

      {/* Features */}
      <section className={styles.features}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <span className={styles.featureIcon}>{f.icon}</span>
            <div className={styles.featureTitle}>{f.title}</div>
            <div className={styles.featureDesc}>{f.desc}</div>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>© 2025 MKTS Terminal</span>
        <span className={styles.footerDot}>·</span>
        <span>Markets data is 15 min delayed for display purposes</span>
      </footer>
      {horrorMode && (
        <div className={styles.horrorOverlay}>
          <div className={styles.horrorBackdrop} />
          <div className={styles.horrorLayout}>
            <div className={styles.horrorMessage}>
              <p className={styles.horrorKicker}>Login failed.</p>
              <h1 className={styles.horrorHeadline}>NEVER DO THAT AGAIN</h1>
              <p className={styles.horrorLine}>Will Spin On Your Block,</p>
              <p className={styles.horrorLine}>No PASSWORD, so we OPPS.</p>
              <button
                type="button"
                className={styles.horrorClose}
                onClick={() => setHorrorMode(false)}
              >
                Back to normal screen
              </button>
            </div>

            <form className={`${styles.authCard} ${styles.horrorAuthCard}`} onSubmit={handleAuthSubmit}>
              <div className={styles.authTopBar}>
                <span className={styles.authDotRed} />
                <span className={styles.authDotYellow} />
                <span className={styles.authDotGreen} />
              </div>

              <div className={styles.authTitle}>
                {authMode === 'login' ? 'Try that again.' : 'Create account'}
              </div>
              <div className={styles.authSub}>
                {authMode === 'login'
                  ? 'Enter correct credentials to continue.'
                  : 'Sign up and enter the terminal.'}
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
                {authBusy
                  ? 'Please wait...'
                  : authMode === 'signup'
                  ? 'â†’ Create Account'
                  : 'â†’ Enter Terminal'}
              </button>

              <button
                className={styles.authSwitch}
                type="button"
                onClick={() => { setAuthMode(p => p === 'login' ? 'signup' : 'login'); setAuthError('') }}
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
