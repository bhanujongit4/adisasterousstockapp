import { NextRequest, NextResponse } from 'next/server'

// Single endpoint that returns both quote metadata AND continuous price history.
// Call:  GET /api/quotes?symbols=AAPL,MSFT&timeframe=5m
//
// Timeframe → what Yahoo chart interval/range we pull
// The history array is one continuous stream: oldest bar → current price.
// The very last point is always overwritten with the live quote price
// so there is no gap or jump between historical data and "now".
//
// Timeframe  Interval  Range   ~Points   Server cache
// 5m         5m        5d      ~390      60s
// 15m        15m       1mo     ~170      120s
// 1h         1h        3mo     ~390      300s
// 1d         1d        2y      ~500      3600s

const TIMEFRAME_MAP: Record<string, { interval: string; range: string; cache: number }> = {
  '5m':  { interval: '5m',  range: '5d',  cache: 60   },
  '15m': { interval: '15m', range: '1mo', cache: 120  },
  '1h':  { interval: '1h',  range: '3mo', cache: 300  },
  '1d':  { interval: '1d',  range: '2y',  cache: 3600 },
}

const QUOTE_FIELDS = [
  'shortName',
  'regularMarketPrice',
  'regularMarketChange',
  'regularMarketChangePercent',
  'regularMarketOpen',
  'regularMarketDayHigh',
  'regularMarketDayLow',
  'regularMarketPreviousClose',
  'regularMarketVolume',
  'averageDailyVolume30Day',
  'marketCap',
  'trailingPE',
  'forwardPE',
  'trailingEps',
  'beta',
  'trailingAnnualDividendYield',
  'trailingAnnualDividendRate',
  'fiftyTwoWeekHigh',
  'fiftyTwoWeekLow',
  'floatShares',
  'shortRatio',
  'shortPercentOfFloat',
  'targetMeanPrice',
  'averageAnalystRating',
].join(',')

export async function GET(req: NextRequest) {
  const symbols   = req.nextUrl.searchParams.get('symbols')
  const timeframe = req.nextUrl.searchParams.get('timeframe') ?? '1d'

  if (!symbols) return NextResponse.json({ error: 'No symbols' }, { status: 400 })

  const symList = symbols.split(',').slice(0, 20)
  const config  = TIMEFRAME_MAP[timeframe] ?? TIMEFRAME_MAP['1d']

  // Fire quote batch + all history requests in parallel
  const [quoteRes, ...historyResults] = await Promise.allSettled([
    fetchQuotes(symList),
    ...symList.map(s => fetchHistory(s, config)),
  ])

  const quoteMap: Record<string, any> =
    quoteRes.status === 'fulfilled' ? quoteRes.value : {}

  const historyMap: Record<string, any[]> = {}
  symList.forEach((sym, i) => {
    const r = historyResults[i]
    historyMap[sym] = r.status === 'fulfilled' ? r.value : []
  })

  const result = symList.map(sym => {
    const hasQuote = Boolean(quoteMap[sym])
    const q = quoteMap[sym] ?? {}
    const livePrice: number = q.price ?? 0

    // Stitch: take historical bars, force the last point to the live price
    // so the line runs continuously up to right now with no jump.
    const history = historyMap[sym]
    if (history.length > 0 && livePrice > 0) {
      history[history.length - 1].price = livePrice
    }

    return { ...q, symbol: sym, found: hasQuote, history }
  })

  return NextResponse.json(result, {
    headers: { 'Cache-Control': `s-maxage=${config.cache}, stale-while-revalidate` },
  })
}

// ─── Quote fetcher ────────────────────────────────────────────────────────────

async function fetchQuotes(symbols: string[]): Promise<Record<string, any>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=${QUOTE_FIELDS}`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    next: { revalidate: 10 },
  })
  if (!res.ok) throw new Error(`Quote fetch failed: ${res.status}`)

  const data    = await res.json()
  const results = data?.quoteResponse?.result ?? []
  const map: Record<string, any> = {}

  for (const q of results) {
    map[q.symbol] = {
      symbol:        q.symbol,
      name:          q.shortName ?? q.symbol,
      price:         q.regularMarketPrice       ?? 0,
      change:        q.regularMarketChange       ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      open:          q.regularMarketOpen          ?? 0,
      high:          q.regularMarketDayHigh       ?? 0,
      low:           q.regularMarketDayLow        ?? 0,
      prevClose:     q.regularMarketPreviousClose ?? 0,
      volume:        q.regularMarketVolume        ?? 0,
      avgVolume:     q.averageDailyVolume30Day,
      marketCap:     q.marketCap,
      pe:            q.trailingPE,
      forwardPe:     q.forwardPE,
      eps:           q.trailingEps,
      beta:          q.beta,
      dividendYield: q.trailingAnnualDividendYield != null
                       ? q.trailingAnnualDividendYield * 100 : undefined,
      dividendAmount: q.trailingAnnualDividendRate,
      week52High:    q.fiftyTwoWeekHigh,
      week52Low:     q.fiftyTwoWeekLow,
      floatShares:   q.floatShares,
      shortRatio:    q.shortRatio,
      shortFloat:    q.shortPercentOfFloat != null
                       ? q.shortPercentOfFloat * 100 : undefined,
      priceTarget:   q.targetMeanPrice,
      analystRating: parseRating(q.averageAnalystRating),
    }
  }
  return map
}

// ─── History fetcher ──────────────────────────────────────────────────────────

async function fetchHistory(
  symbol: string,
  config: { interval: string; range: string; cache: number }
): Promise<any[]> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${config.interval}&range=${config.range}&includePrePost=false`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    next: { revalidate: config.cache },
  })
  if (!res.ok) throw new Error(`Chart fetch failed: ${res.status}`)

  const data   = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) return []

  const timestamps: number[] = result.timestamp                        ?? []
  const quote                = result.indicators?.quote?.[0]           ?? {}
  const closes:  number[]    = quote.close  ?? []
  const opens:   number[]    = quote.open   ?? []
  const highs:   number[]    = quote.high   ?? []
  const lows:    number[]    = quote.low    ?? []
  const volumes: number[]    = quote.volume ?? []

  return timestamps
    .map((ts, i) => ({
      time:   formatTs(ts, config.interval),
      ts,
      price:  r(closes[i]),
      open:   r(opens[i]),
      high:   r(highs[i]),
      low:    r(lows[i]),
      volume: volumes[i] ?? 0,
    }))
    .filter(p => p.price != null && !isNaN(p.price))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r(n: number | null | undefined): number {
  if (n == null || isNaN(n)) return NaN
  return Math.round(n * 100) / 100
}

function formatTs(ts: number, interval: string): string {
  const d = new Date(ts * 1000)
  if (interval === '1d') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  if (interval === '1h') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
           ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  // 5m / 15m — time only; date lives in the raw `ts` field for tooltip use
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function parseRating(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const s = raw.toLowerCase()
  if (s.includes('strong buy')  || s.startsWith('1')) return 'Strong Buy'
  if (s.includes('buy')         || s.startsWith('2')) return 'Buy'
  if (s.includes('hold')        || s.startsWith('3')) return 'Hold'
  if (s.includes('strong sell') || s.startsWith('5')) return 'Strong Sell'
  if (s.includes('sell')        || s.startsWith('4')) return 'Sell'
  return undefined
}
