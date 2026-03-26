import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'stockanalysis',
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
