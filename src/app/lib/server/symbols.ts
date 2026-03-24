export async function lookupSymbol(symbolRaw: string) {
  const symbol = symbolRaw.trim().toUpperCase()
  if (!symbol) return { found: false, symbol, name: null }

  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      next: { revalidate: 10 },
    })
    if (!res.ok) return { found: false, symbol, name: null }

    const data = await res.json()
    const quote = data?.quoteResponse?.result?.[0]
    if (!quote?.symbol) return { found: false, symbol, name: null }

    return {
      found: true,
      symbol: String(quote.symbol).toUpperCase(),
      name: quote.shortName ?? quote.longName ?? String(quote.symbol).toUpperCase(),
    }
  } catch {
    return { found: false, symbol, name: null }
  }
}
