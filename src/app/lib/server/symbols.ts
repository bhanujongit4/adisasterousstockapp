export async function lookupSymbol(symbolRaw: string) {
  const symbol = symbolRaw.trim().toUpperCase()
  if (!symbol) return { found: false, symbol, name: null }

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 10 },
    })
    if (!res.ok) throw new Error(`quote status ${res.status}`)

    const data = await res.json()
    const quote = data?.quoteResponse?.result?.[0]
    if (quote?.symbol) {
      return {
        found: true,
        symbol: String(quote.symbol).toUpperCase(),
        name: quote.shortName ?? quote.longName ?? String(quote.symbol).toUpperCase(),
      }
    }
  } catch {
    // Fall through to chart endpoint validation.
  }

  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false`
  try {
    const res = await fetch(chartUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 10 },
    })
    if (!res.ok) return { found: false, symbol, name: null }
    const data = await res.json()
    const result = data?.chart?.result?.[0]
    const metaSymbol = result?.meta?.symbol
    if (!metaSymbol) return { found: false, symbol, name: null }
    return {
      found: true,
      symbol: String(metaSymbol).toUpperCase(),
      name: result?.meta?.shortName ?? result?.meta?.longName ?? String(metaSymbol).toUpperCase(),
    }
  } catch {
    return { found: false, symbol, name: null }
  }
}
