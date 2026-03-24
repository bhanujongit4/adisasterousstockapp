import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, setSessionCookie, verifyPassword } from '../../../lib/server/auth'
import { sql } from '../../../lib/server/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const rows = await sql`
      select id, email, password_hash
      from app_user
      where email = ${email}
      limit 1
    `

    const user = rows[0]
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
    }

    const ok = await verifyPassword(password, String(user.password_hash))
    if (!ok) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 })
    }

    const token = await createSessionToken({ userId: Number(user.id), email: String(user.email) })
    const res = NextResponse.json({ user: { id: Number(user.id), email: String(user.email) } })
    setSessionCookie(res, token)
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Login failed.' },
      { status: 500 },
    )
  }
}

