import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_TIMEOUT_MS = 30000

export async function GET(req: NextRequest) {
  const apiBaseUrl = process.env.STOCK_INTEL_API_URL
  if (!apiBaseUrl) {
    return NextResponse.json({ error: 'STOCK_INTEL_API_URL is not configured.' }, { status: 500 })
  }

  const tickerParam = req.nextUrl.searchParams.get('ticker')
  const symbolsParam = req.nextUrl.searchParams.get('symbols')
  const ticker = (tickerParam ?? symbolsParam?.split(',').find(Boolean) ?? '').trim().toUpperCase()

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required.' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const upstream = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/signal/${encodeURIComponent(ticker)}`, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })

    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      return NextResponse.json({ error: payload?.error ?? 'Signals upstream failed.' }, { status: upstream.status })
    }

    return NextResponse.json({ signal: payload })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Stock Intelligence API timed out.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach Stock Intelligence API.' }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
