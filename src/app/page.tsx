'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './Home.module.css'

const TICKERS = [
  { sym: 'AAPL',  price: '213.49',   change: '+1.24', up: true  },
  { sym: 'NVDA',  price: '137.62',   change: '+3.87', up: true  },
  { sym: 'TSLA',  price: '248.50',   change: '-4.12', up: false },
  { sym: 'MSFT',  price: '421.90',   change: '+0.78', up: true  },
  { sym: 'GOOG',  price: '178.25',   change: '+2.11', up: true  },
  { sym: 'AMZN',  price: '224.18',   change: '-1.03', up: false },
  { sym: 'META',  price: '623.44',   change: '+5.33', up: true  },
  { sym: 'BRK.B', price: '472.90',   change: '+0.22', up: true  },
  { sym: 'JPM',   price: '257.11',   change: '-0.89', up: false },
  { sym: 'V',     price: '340.67',   change: '+1.55', up: true  },
  { sym: 'SPY',   price: '591.80',   change: '+0.47', up: true  },
  { sym: 'QQQ',   price: '510.33',   change: '+1.02', up: true  },
  { sym: 'GLD',   price: '238.45',   change: '-0.31', up: false },
  { sym: 'BTC',   price: '103,240',  change: '+2.88', up: true  },
  { sym: 'ETH',   price: '3,412',    change: '-1.14', up: false },
]

// ── Info panel data ────────────────────────────────────────────────────────────

const STACK_LAYERS = [
  { label: 'Frontend',    tech: 'Next.js · React · TypeScript · CSS Modules',   color: '#00ff80' },
  { label: 'Charts',      tech: 'lightweight-charts · custom pane overlays',     color: '#00cc66' },
  { label: 'API Routes',  tech: 'Next.js handlers · auth · watchlist · signals', color: '#009944' },
  { label: 'Database',    tech: 'Neon Postgres · signed-cookie sessions',         color: '#006630' },
  { label: 'Intelligence',tech: 'Python · FastAPI · pandas · scikit-learn · hmmlearn', color: '#004422' },
  { label: 'Data',        tech: 'Yahoo Finance · normalised OHLCV payload',      color: '#002211' },
]

const INDICATORS = [
  { name: 'SMA',    cat: 'Trend'      },
  { name: 'EMA',    cat: 'Trend'      },
  { name: 'WMA',    cat: 'Trend'      },
  { name: 'VWAP',   cat: 'Trend'      },
  { name: 'PSAR',   cat: 'Trend'      },
  { name: 'Ichimoku', cat: 'Trend'    },
  { name: 'Keltner',  cat: 'Volatility'},
  { name: 'Bollinger Bands', cat: 'Volatility'},
  { name: 'ATR',    cat: 'Volatility' },
  { name: 'RSI',    cat: 'Momentum'   },
  { name: 'MACD',   cat: 'Momentum'   },
  { name: 'Stochastic', cat: 'Momentum'},
  { name: 'Williams %R', cat: 'Momentum'},
  { name: 'CCI',    cat: 'Momentum'   },
  { name: 'ROC',    cat: 'Momentum'   },
  { name: 'TRIX',   cat: 'Momentum'   },
  { name: 'ADX',    cat: 'Momentum'   },
  { name: 'Awesome Oscillator', cat: 'Momentum'},
  { name: 'OBV',    cat: 'Volume'     },
  { name: 'ADL',    cat: 'Volume'     },
  { name: 'MFI',    cat: 'Volume'     },
  { name: 'Force Index', cat: 'Volume'},
]

const MODELS = [
  {
    id:       'regime',
    name:     'Regime Model',
    badge:    'HMM + Hurst + ADX',
    tagline:  'What state is the market in right now?',
    outputs:  ['TRENDING_UP', 'TRENDING_DOWN', 'MEAN_REVERTING', 'VOLATILE', 'DEAD', 'UNCERTAIN'],
    engines: [
      { name: 'HMM',            desc: 'Latent-state inference on returns + volatility' },
      { name: 'Hurst Exponent', desc: 'Persistence vs mean-reversion classification' },
      { name: 'ADX',            desc: 'Trend strength + directional confirmation' },
      { name: 'Vol Percentile', desc: 'Extreme volatility override signal' },
    ],
  },
  {
    id:       'anomaly',
    name:     'Anomaly Model',
    badge:    'Isolation Forest + CUSUM + Z',
    tagline:  'Which candles are statistically impossible?',
    outputs:  ['CRITICAL', 'WARNING', 'WATCH', 'NORMAL'],
    engines: [
      { name: 'Isolation Forest', desc: 'Multivariate outlier scoring across all features' },
      { name: 'Rolling Z-Score',  desc: 'Local contextual deviation, adaptive window' },
      { name: 'CUSUM',            desc: 'Cumulative-sum structural mean-shift detection' },
      { name: 'Score Fusion',     desc: 'Weighted ensemble → percentile → severity' },
    ],
  },
  {
    id:       'micro',
    name:     'Microstructure',
    badge:    'Congestion + Latency',
    tagline:  'How is the order flow behaving intraday?',
    outputs:  ['CONGESTED', 'FLOWING', 'DIRECTIONAL', 'LATENT'],
    engines: [
      { name: 'Congestion Score', desc: 'Intraday spread + range compression index' },
      { name: 'Latency Regime',   desc: 'Pace-of-trade relative to historical norms' },
      { name: 'Directional Flow', desc: 'Signed volume imbalance trend detection' },
    ],
  },
]

const INFO_TABS = ['Overview', 'How To Use', 'Models', 'Indicators', 'Stack'] as const
type InfoTab = typeof INFO_TABS[number]

// ── Sparkline ─────────────────────────────────────────────────────────────────

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

// ── Info Panel ────────────────────────────────────────────────────────────────

function InfoPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<InfoTab>('Overview')
  const [indicatorFilter, setIndicatorFilter] = useState<string>('All')
  const [expandedModel, setExpandedModel] = useState<string | null>('regime')
  const [hoveredLayer, setHoveredLayer] = useState<number | null>(null)

  const cats = ['All', 'Trend', 'Momentum', 'Volatility', 'Volume']
  const filteredIndicators = indicatorFilter === 'All'
    ? INDICATORS
    : INDICATORS.filter(i => i.cat === indicatorFilter)

  return (
    <div className={styles.infoOverlay}>
      <div className={styles.infoBackdrop} onClick={onClose} />
      <div className={styles.infoPage}>

        {/* ── Header ── */}
        <header className={styles.infoPageHeader}>
          <div className={styles.infoPageHeaderLeft}>
            <span className={styles.infoPageKicker}>IN$JAM — Platform Documentation</span>
            <h2 className={styles.infoPageTitle}>Platform Guide</h2>
          </div>
          <button className={styles.infoPageClose} onClick={onClose} aria-label="Close">
            ✕ Close
          </button>
        </header>

        {/* ── Tab bar ── */}
        <nav className={styles.infoTabBar}>
          {INFO_TABS.map(tab => (
            <button
              key={tab}
              className={`${styles.infoTab} ${activeTab === tab ? styles.infoTabActive : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </nav>

        {/* ── Tab content ── */}
        <div className={styles.infoContent}>

          {/* OVERVIEW */}
          {activeTab === 'Overview' && (
            <div className={styles.infoSection}>
              <div className={styles.overviewGrid}>
                <div className={styles.overviewHero}>
                  <p className={styles.overviewLead}>
                    IN$JAM is a single-screen market analysis terminal. Watchlists, live quotes, charting, technical indicators, and three machine-learning signal models — all in one flow, zero context switching.
                  </p>
                  <p className={styles.overviewBody}>
                    Built for traders who are tired of juggling five tabs. Every design decision prioritises speed of decision: you should be able to go from symbol discovery to chart analysis to model interpretation without ever leaving the screen.
                  </p>
                </div>
                <div className={styles.overviewStats}>
                  {[
                    { n: '21+',    l: 'Technical indicators' },
                    { n: '3',      l: 'ML signal models'     },
                    { n: '18k+',   l: 'Symbols tracked'      },
                    { n: '2.4ms',  l: 'Avg data latency'     },
                  ].map(s => (
                    <div key={s.l} className={styles.overviewStat}>
                      <span className={styles.overviewStatN}>{s.n}</span>
                      <span className={styles.overviewStatL}>{s.l}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.overviewPillars}>
                {[
                  { icon: '◈', title: 'Live Stream',    body: 'Real-time quotes filtered to your watchlist. Zero noise, pure signal.' },
                  { icon: '⊞', title: 'Watchlists',     body: 'Build symbol lists with manual entry, quick remove, and instant switching.' },
                  { icon: '⌇', title: 'Chart Workspace',body: 'Candles, indicators, overlays, and annotation tools built for active analysis.' },
                  { icon: '⬡', title: 'Signal Models',  body: 'Regime, microstructure, and anomaly engines with interpretable outputs.' },
                ].map(p => (
                  <div key={p.title} className={styles.pillarCard}>
                    <span className={styles.pillarIcon}>{p.icon}</span>
                    <span className={styles.pillarTitle}>{p.title}</span>
                    <span className={styles.pillarBody}>{p.body}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HOW TO USE */}
          {activeTab === 'How To Use' && (
            <div className={styles.infoSection}>
              <div className={styles.stepsGrid}>
                {[
                  { n: '01', title: 'Build your watchlist',   body: 'Add symbols from the top-32 dropdown or type any ticker manually. Your list persists across sessions.' },
                  { n: '02', title: 'Select a symbol',         body: 'Click any symbol in the watchlist panel. Stats, chart, and signal card all update to that symbol instantly.' },
                  { n: '03', title: 'Configure your chart',    body: 'Change timeframe and chart type from the toolbar. Layer any combination of the 21+ technical indicators.' },
                  { n: '04', title: 'Annotate in fullscreen',  body: 'Open fullscreen mode for trendlines, marker placement, and note annotations. Everything saves to state.' },
                  { n: '05', title: 'Run signal models',       body: 'Open the signal card for the selected symbol. Run Regime, Microstructure, and Anomaly modules independently.' },
                  { n: '06', title: 'Read the outputs',        body: 'Each model returns a labelled regime/severity, confidence score, engine breakdown, and the drivers behind the call.' },
                ].map((step, i) => (
                  <div key={step.n} className={styles.stepCard} style={{ animationDelay: `${i * 60}ms` }}>
                    <span className={styles.stepNum}>{step.n}</span>
                    <div>
                      <div className={styles.stepTitle}>{step.title}</div>
                      <div className={styles.stepBody}>{step.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MODELS */}
          {activeTab === 'Models' && (
            <div className={styles.infoSection}>
              <p className={styles.modelsLead}>
                Three independent ML engines. Each can be run on-demand for the selected symbol. Outputs are designed to be interpretable — you see the confidence, the component votes, and which features drove the call.
              </p>
              <div className={styles.modelsList}>
                {MODELS.map(model => (
                  <div
                    key={model.id}
                    className={`${styles.modelCard} ${expandedModel === model.id ? styles.modelCardOpen : ''}`}
                  >
                    <button
                      className={styles.modelCardHead}
                      onClick={() => setExpandedModel(expandedModel === model.id ? null : model.id)}
                    >
                      <div className={styles.modelCardHeadLeft}>
                        <span className={styles.modelName}>{model.name}</span>
                        <span className={styles.modelBadge}>{model.badge}</span>
                      </div>
                      <div className={styles.modelCardHeadRight}>
                        <span className={styles.modelTagline}>{model.tagline}</span>
                        <span className={styles.modelChevron}>{expandedModel === model.id ? '−' : '+'}</span>
                      </div>
                    </button>

                    {expandedModel === model.id && (
                      <div className={styles.modelCardBody}>
                        <div className={styles.modelEngines}>
                          {model.engines.map(e => (
                            <div key={e.name} className={styles.engineRow}>
                              <span className={styles.engineDot} />
                              <div>
                                <span className={styles.engineName}>{e.name}</span>
                                <span className={styles.engineDesc}>{e.desc}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className={styles.modelOutputs}>
                          <span className={styles.modelOutputsLabel}>Possible outputs</span>
                          <div className={styles.modelOutputPills}>
                            {model.outputs.map(o => (
                              <span key={o} className={styles.outputPill}>{o}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INDICATORS */}
          {activeTab === 'Indicators' && (
            <div className={styles.infoSection}>
              <div className={styles.indicatorHeader}>
                <p className={styles.indicatorLead}>21 indicators across trend, momentum, volatility, and volume. All render in resizable panes that persist proportions during live data updates.</p>
                <div className={styles.filterRow}>
                  {cats.map(c => (
                    <button
                      key={c}
                      className={`${styles.filterBtn} ${indicatorFilter === c ? styles.filterBtnActive : ''}`}
                      onClick={() => setIndicatorFilter(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.indicatorGrid}>
                {filteredIndicators.map(ind => (
                  <div key={ind.name} className={styles.indicatorChip}>
                    <span className={styles.indicatorName}>{ind.name}</span>
                    <span className={`${styles.indicatorCat} ${styles[`cat${ind.cat}`]}`}>{ind.cat}</span>
                  </div>
                ))}
              </div>
              <div className={styles.chartTypeRow}>
                <span className={styles.chartTypeLabel}>Chart types</span>
                {['Candlestick', 'Line', 'Area', 'OHLC Bar', 'Baseline'].map(t => (
                  <span key={t} className={styles.chartTypeChip}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* STACK */}
          {activeTab === 'Stack' && (
            <div className={styles.infoSection}>
              <p className={styles.stackLead}>Six layers from browser to data source. Hover any layer to see what it does.</p>
              <div className={styles.stackDiagram}>
                {STACK_LAYERS.map((layer, i) => (
                  <div
                    key={layer.label}
                    className={`${styles.stackLayer} ${hoveredLayer === i ? styles.stackLayerHovered : ''}`}
                    onMouseEnter={() => setHoveredLayer(i)}
                    onMouseLeave={() => setHoveredLayer(null)}
                    style={{ '--layer-color': layer.color } as React.CSSProperties}
                  >
                    <div className={styles.stackLayerLeft}>
                      <span className={styles.stackLayerIndex}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={styles.stackLayerLabel}>{layer.label}</span>
                    </div>
                    <span className={styles.stackLayerTech}>{layer.tech}</span>
                    <div className={styles.stackLayerBar} style={{ width: `${100 - i * 10}%`, background: layer.color }} />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

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
      const glowColor = isDark ? 'rgba(0,255,128,0.18)' : 'rgba(0,160,80,0.18)'
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1
      const gs = 48
      for (let x = 0; x < canvas.width; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke() }
      for (let y = 0; y < canvas.height; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke() }
      ctx.strokeStyle = glowColor
      ctx.lineWidth = 2.5
      ctx.shadowBlur = 12
      ctx.shadowColor = glowColor
      ctx.beginPath()
      for (let x = 0; x <= canvas.width; x += 2) {
        const y = canvas.height * 0.55 + Math.sin(x * 0.012 + t) * 40 + Math.sin(x * 0.03 + t * 1.4) * 18 + Math.cos(x * 0.007 + t * 0.7) * 28
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
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
        if (authMode === 'login' && res.status === 401) {
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

      {/* NAV */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.navLogoMark}>▲</span>
          <span className={styles.navLogoText}>IN$JAM</span>
        </div>
        <div className={styles.navRight}>
          <button className={styles.themeToggle} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
            {theme === 'dark' ? '◑' : '◐'}
          </button>
        </div>
      </nav>

      {/* TICKER */}
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

      {/* HERO */}
      <main className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.heroEyebrow}>
            <span className={styles.eyebrowDot} />
            LIVE MARKETS — REAL-TIME DATA
          </div>

          <h1 className={styles.heroHeadline}>
            Trade with<br />
            <span className={styles.heroAccent}>IN$JAM</span><br />
            precision.
          </h1>

          <p className={styles.heroCopy}>
            Stream only your symbols. Annotate every chart. Build the workspace serious traders actually need.
          </p>

          <button className={styles.heroInfoCta} onClick={() => setInfoOpen(true)}>
            <span className={styles.heroInfoCtaBadge}>Platform Guide</span>
            <span className={styles.heroInfoCtaIcon}>⬡</span>
            <span className={styles.heroInfoCtaText}>
              <span className={styles.heroInfoCtaTitle}>Open the full platform guide</span>
              <span className={styles.heroInfoCtaSub}>Models · Indicators · Architecture · How it works</span>
            </span>
            <span className={styles.heroInfoCtaArrow}>→</span>
          </button>

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
            {TICKERS.slice(0, 3).map(t => (
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

        {/* AUTH CARD */}
        <div className={styles.authWrap}>
          <div className={styles.authGlow} />
          <form className={styles.authCard} onSubmit={handleAuthSubmit}>
            <div className={styles.authTopBar}>
              <span className={styles.authDotRed} />
              <span className={styles.authDotYellow} />
              <span className={styles.authDotGreen} />
            </div>
            <div className={styles.authTitle}>{authMode === 'login' ? 'Welcome back' : 'Create account'}</div>
            <div className={styles.authSub}>{authMode === 'login' ? 'Sign in to your IN$JAM workspace.' : 'Join thousands of traders on IN$JAM.'}</div>
            <div className={styles.authField}>
              <label className={styles.authLabel}>EMAIL</label>
              <input className={styles.authInput} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />
            </div>
            <div className={styles.authField}>
              <label className={styles.authLabel}>PASSWORD</label>
              <input className={styles.authInput} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required />
            </div>
            {authError && <div className={styles.authError}>{authError}</div>}
            <button className={styles.authPrimary} type="submit" disabled={authBusy}>
              {authBusy ? 'Please wait...' : authMode === 'signup' ? '-> Create Account' : '-> Enter IN$JAM'}
            </button>
            <button className={styles.authSwitch} type="button" onClick={() => { setAuthMode(p => p === 'login' ? 'signup' : 'login'); setAuthError(''); setHorrorMode(false) }}>
              {authMode === 'login' ? 'New here? Sign up free' : 'Have an account? Login'}
            </button>
          </form>
        </div>
      </main>

      {/* FEATURES */}
      <section className={styles.features}>
        {[
          { icon: '*',   title: 'Live Market Stream', desc: 'Real-time quotes filtered to your active watchlist. Zero noise, pure signal.' },
          { icon: '[]',  title: 'Smart Watchlists',   desc: 'Build and manage symbol lists with manual symbol add, quick remove, and fast switching.' },
          { icon: '/\\', title: 'Chart Workspace',    desc: 'Candles, indicators, panes, overlays, and annotation tools built for active analysis.' },
          { icon: '+',   title: 'Signal Models',      desc: 'Regime, microstructure, and anomaly engines with interpretable outputs.' },
        ].map(f => (
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

      {/* INFO PANEL */}
      {infoOpen && <InfoPanel onClose={() => setInfoOpen(false)} />}

      {/* HORROR MODE */}
      {horrorMode && (
        <div className={styles.horrorOverlay}>
          <div className={styles.horrorBackdrop} />
          <div className={styles.horrorLayout}>
            <div className={styles.horrorMessage}>
              <p className={styles.horrorKicker}>Login failed.</p>
              <h1 className={styles.horrorHeadline}>NEVER DO THAT AGAIN</h1>
              <p className={styles.horrorLine}>Will Spin On Your Block,</p>
              <p className={styles.horrorLine}>No PASSWORD, so we OPPS.</p>
              <button type="button" className={styles.horrorClose} onClick={() => setHorrorMode(false)}>Back to normal screen</button>
            </div>
            <form className={`${styles.authCard} ${styles.horrorAuthCard}`} onSubmit={handleAuthSubmit}>
              <div className={styles.authTopBar}>
                <span className={styles.authDotRed} /><span className={styles.authDotYellow} /><span className={styles.authDotGreen} />
              </div>
              <div className={styles.authTitle}>{authMode === 'login' ? 'Try that again.' : 'Create account'}</div>
              <div className={styles.authSub}>{authMode === 'login' ? 'Enter correct credentials to continue.' : 'Sign up and enter IN$JAM.'}</div>
              <div className={styles.authField}>
                <label className={styles.authLabel}>EMAIL</label>
                <input className={styles.authInput} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" type="email" autoComplete="email" required />
              </div>
              <div className={styles.authField}>
                <label className={styles.authLabel}>PASSWORD</label>
                <input className={styles.authInput} value={password} onChange={e => setPassword(e.target.value)} placeholder={authMode === 'signup' ? 'Min. 8 characters' : 'Enter password'} type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required />
              </div>
              {authError && <div className={styles.authError}>{authError}</div>}
              <button className={styles.authPrimary} type="submit" disabled={authBusy}>
                {authBusy ? 'Please wait...' : authMode === 'signup' ? '-> Create Account' : '-> Enter IN$JAM'}
              </button>
              <button className={styles.authSwitch} type="button" onClick={() => { setAuthMode(p => p === 'login' ? 'signup' : 'login'); setAuthError('') }}>
                {authMode === 'login' ? 'New here? Sign up free' : 'Have an account? Login'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
