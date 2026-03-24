import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../lib/server/auth'
import { sql } from '../../lib/server/db'

export const runtime = 'nodejs'

type Kind = 'trendline' | 'marker' | 'note'
const VALID_KINDS: Kind[] = ['trendline', 'marker', 'note']

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const symbol = String(req.nextUrl.searchParams.get('symbol') ?? '').trim().toUpperCase()
  if (!symbol) return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })

  try {
    const rows = await sql`
      select id, kind, payload
      from user_annotation
      where user_id = ${session.userId} and symbol = ${symbol}
      order by created_at asc, id asc
    `

    const trendlines: any[] = []
    const markers: any[] = []
    const notes: any[] = []

    for (const row of rows) {
      const id = String(row.id)
      const kind = String(row.kind) as Kind
      const payload = row.payload ?? {}

      if (kind === 'trendline') trendlines.push({ id, ...payload })
      if (kind === 'marker') markers.push({ id, ...payload })
      if (kind === 'note') notes.push({ id, ...payload })
    }

    return NextResponse.json({ trendlines, markers, notes })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load annotations.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to load annotations.' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const symbol = String(body?.symbol ?? '').trim().toUpperCase()
    const kind = String(body?.kind ?? '').trim() as Kind
    const payload = body?.payload

    if (!symbol) return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })
    if (!VALID_KINDS.includes(kind)) return NextResponse.json({ error: 'Invalid annotation type.' }, { status: 400 })
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Invalid annotation payload.' }, { status: 400 })

    const inserted = await sql`
      insert into user_annotation (user_id, symbol, kind, payload)
      values (${session.userId}, ${symbol}, ${kind}, ${JSON.stringify(payload)}::jsonb)
      returning id, kind, payload
    `

    const row = inserted[0]
    return NextResponse.json({
      annotation: {
        id: String(row.id),
        kind: String(row.kind),
        ...row.payload,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save annotation.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to save annotation.' },
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
    const id = body?.id != null ? Number(body.id) : null

    if (!symbol) return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })

    if (id != null && Number.isFinite(id)) {
      await sql`
        delete from user_annotation
        where id = ${id} and user_id = ${session.userId} and symbol = ${symbol}
      `
      return NextResponse.json({ ok: true })
    }

    await sql`
      delete from user_annotation
      where user_id = ${session.userId} and symbol = ${symbol}
    `
    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete annotation.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to delete annotation.' },
      { status: 500 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const symbol = String(body?.symbol ?? '').trim().toUpperCase()
    const id = Number(body?.id)
    const payload = body?.payload

    if (!symbol) return NextResponse.json({ error: 'Symbol is required.' }, { status: 400 })
    if (!Number.isFinite(id)) return NextResponse.json({ error: 'Valid annotation id is required.' }, { status: 400 })
    if (!payload || typeof payload !== 'object') return NextResponse.json({ error: 'Invalid annotation payload.' }, { status: 400 })

    const updated = await sql`
      update user_annotation
      set payload = ${JSON.stringify(payload)}::jsonb
      where id = ${id} and user_id = ${session.userId} and symbol = ${symbol}
      returning id, kind, payload
    `

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Annotation not found.' }, { status: 404 })
    }

    const row = updated[0]
    return NextResponse.json({
      annotation: {
        id: String(row.id),
        kind: String(row.kind),
        ...row.payload,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update annotation.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Failed to update annotation.' },
      { status: 500 },
    )
  }
}
