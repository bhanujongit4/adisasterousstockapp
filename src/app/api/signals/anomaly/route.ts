import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_TIMEOUT_MS = 30000

function toErrorMessage(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim()) return input
  if (Array.isArray(input)) {
    const parts = input
      .map((item) => (typeof item === 'string' ? item : typeof item === 'object' && item && 'msg' in item ? String((item as { msg?: unknown }).msg ?? '') : ''))
      .filter(Boolean)
    if (parts.length > 0) return parts.join(' | ')
  }
  if (input && typeof input === 'object' && 'msg' in input) {
    const msg = (input as { msg?: unknown }).msg
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

export async function GET(req: NextRequest) {
  const apiBaseUrl = process.env.STOCK_INTEL_API_URL
  if (!apiBaseUrl) {
    return NextResponse.json({ error: 'STOCK_INTEL_API_URL is not configured.' }, { status: 500 })
  }

  const ticker = (req.nextUrl.searchParams.get('ticker') ?? '').trim().toUpperCase()
  const timeframe = (req.nextUrl.searchParams.get('timeframe') ?? '15m').trim()
  const contamination = (req.nextUrl.searchParams.get('contamination') ?? '0.02').trim()

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required.' }, { status: 400 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const endpoint = `${apiBaseUrl.replace(/\/$/, '')}/api/anomaly/${encodeURIComponent(ticker)}?timeframe=${encodeURIComponent(timeframe)}&contamination=${encodeURIComponent(contamination)}`
    const upstream = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })

    const payload = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      const message = toErrorMessage(payload?.detail ?? payload?.error, 'Anomaly upstream failed.')
      return NextResponse.json({ error: message }, { status: upstream.status })
    }

    return NextResponse.json({ anomaly: payload })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({ error: 'Anomaly API timed out.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Unable to reach anomaly API.' }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
