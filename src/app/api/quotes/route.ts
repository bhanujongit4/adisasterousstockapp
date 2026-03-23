import { NextRequest, NextResponse } from 'next/server'

// This route proxies Yahoo Finance's free quote endpoint.
// No API key needed — it uses the same endpoint the Yahoo Finance website uses.
// Rate limit: ~2000 req/hour per IP.

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get('symbols')
  if (!symbols) return NextResponse.json({ error: 'No symbols' }, { status: 400 })

  const syms = symbols.split(',').slice(0, 20).join(',')

  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${syms}&fields=shortName,regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow,regularMarketPreviousClose,regularMarketVolume,marketCap,trailingPE,fiftyTwoWeekHigh,fiftyTwoWeekLow`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
      next: { revalidate: 10 }, // cache 10s
    })

    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`)

    const data = await res.json()
    const results = data?.quoteResponse?.result ?? []

    const quotes = results.map((q: any) => ({
      symbol: q.symbol,
      name: q.shortName ?? q.symbol,
      price: q.regularMarketPrice ?? 0,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      open: q.regularMarketOpen ?? 0,
      high: q.regularMarketDayHigh ?? 0,
      low: q.regularMarketDayLow ?? 0,
      prevClose: q.regularMarketPreviousClose ?? 0,
      volume: q.regularMarketVolume ?? 0,
      marketCap: q.marketCap,
      pe: q.trailingPE,
      week52High: q.fiftyTwoWeekHigh,
      week52Low: q.fiftyTwoWeekLow,
      history: [], // history fetched separately
    }))

    return NextResponse.json(quotes)
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 500 })
  }
}