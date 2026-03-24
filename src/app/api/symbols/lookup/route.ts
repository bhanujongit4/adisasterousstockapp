import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '../../../lib/server/auth'
import { lookupSymbol } from '../../../lib/server/symbols'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const session = await getSessionUser(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const symbol = req.nextUrl.searchParams.get('symbol') ?? ''
  const result = await lookupSymbol(symbol)
  if (!result.found) {
    return NextResponse.json({ found: false, symbol: result.symbol, message: `No match found for ${result.symbol || 'input'}.` })
  }

  return NextResponse.json(result)
}
