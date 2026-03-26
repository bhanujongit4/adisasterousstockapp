import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../lib/server/auth'
import { sql } from '../../lib/server/db'
import { lookupSymbol } from '../../lib/server/symbols'
import { TOP_32_STOCKS, TOP_32_SYMBOLS } from '../../lib/stockData'

export const runtime = 'nodejs'
const WATCHLIST_LIMIT = 10
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.-]{0,11}$/

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await sql`
    select symbol
    from user_watchlist
    where user_id = ${session.userId}
    order by created_at asc
  `

  return NextResponse.json({
    symbols: rows.map((r) => String(r.symbol).toUpperCase()),
    available: TOP_32_STOCKS,
    limit: WATCHLIST_LIMIT,
  })
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    let symbol = String(body?.symbol ?? '').trim().toUpperCase()
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })
    }
    if (!SYMBOL_PATTERN.test(symbol)) {
      return NextResponse.json({ error: 'Invalid symbol format.' }, { status: 400 })
    }

    const countRows = await sql`
      select count(*)::int as count
      from user_watchlist
      where user_id = ${session.userId}
    `
    if (Number(countRows[0]?.count ?? 0) >= WATCHLIST_LIMIT) {
      return NextResponse.json({ error: `Watchlist limit is ${WATCHLIST_LIMIT}.` }, { status: 400 })
    }

    const inTop32 = TOP_32_SYMBOLS.includes(symbol)
    if (!inTop32) {
      const lookup = await lookupSymbol(symbol)
      if (lookup.found && lookup.symbol) {
        symbol = String(lookup.symbol).toUpperCase()
      }
    }

    const existsRows = await sql`
      select 1
      from user_watchlist
      where user_id = ${session.userId} and symbol = ${symbol}
      limit 1
    `
    if (existsRows.length > 0) {
      return NextResponse.json({ error: 'Symbol already in your watchlist.' }, { status: 409 })
    }

    await sql`
      insert into user_watchlist (user_id, symbol)
      values (${session.userId}, ${symbol})
    `

    const rows = await sql`
      select symbol
      from user_watchlist
      where user_id = ${session.userId}
      order by created_at asc
    `

    return NextResponse.json({
      symbols: rows.map((r) => String(r.symbol).toUpperCase()),
      available: TOP_32_STOCKS,
      limit: WATCHLIST_LIMIT,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update watchlist.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to update watchlist.' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const symbol = String(body?.symbol ?? '').trim().toUpperCase()
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })
    }

    await sql`
      delete from user_watchlist
      where user_id = ${session.userId} and symbol = ${symbol}
    `

    const rows = await sql`
      select symbol
      from user_watchlist
      where user_id = ${session.userId}
      order by created_at asc
    `

    return NextResponse.json({
      symbols: rows.map((r) => String(r.symbol).toUpperCase()),
      available: TOP_32_STOCKS,
      limit: WATCHLIST_LIMIT,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove symbol.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to remove symbol.' },
      { status: 500 },
    )
  }
}

