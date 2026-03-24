import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, hashPassword, setSessionCookie } from '../../../lib/server/auth'
import { sql } from '../../../lib/server/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const password = String(body?.password ?? '')

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }

    const existing = await sql`select id from app_user where email = ${email} limit 1`
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)
    const inserted = await sql`
      insert into app_user (email, password_hash)
      values (${email}, ${passwordHash})
      returning id, email
    `

    const user = inserted[0]
    const token = await createSessionToken({ userId: Number(user.id), email: String(user.email) })

    const res = NextResponse.json({
      user: { id: Number(user.id), email: String(user.email) },
    })
    setSessionCookie(res, token)
    return res
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed.'
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? message : 'Signup failed.' },
      { status: 500 },
    )
  }
}

