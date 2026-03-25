"""
Yahoo Finance Data Fetcher (HTTP-based, no yfinance dependency)
================================================================
Uses Yahoo chart/quote endpoints directly for better reliability.
Returns pandas DataFrames expected by model code.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime

import pandas as pd
import requests

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
}

_NEXT_QUOTES_BASE = os.getenv("NEXT_QUOTES_API_BASE", "http://127.0.0.1:3000")

# timeframe -> (interval, range)
TIMEFRAME_CONFIG: dict[str, tuple[str, str]] = {
    "5m": ("5m", "60d"),
    "15m": ("15m", "60d"),
    "1h": ("1h", "2y"),
    "1d": ("1d", "5y"),
}


def _chart_json(ticker: str, interval: str, range_: str) -> dict:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?interval={interval}&range={range_}&includePrePost=false"
    )
    res = requests.get(url, headers=_HEADERS, timeout=20)
    res.raise_for_status()
    payload = res.json()
    result = payload.get("chart", {}).get("result", [])
    if not result:
        error = payload.get("chart", {}).get("error")
        raise ValueError(f"Yahoo chart returned no result for {ticker}: {error}")
    return result[0]


def _fetch_from_next_quotes(ticker: str, timeframe: str) -> pd.DataFrame:
    url = f"{_NEXT_QUOTES_BASE.rstrip('/')}/api/quotes?symbols={ticker}&timeframe={timeframe}"
    res = requests.get(url, headers=_HEADERS, timeout=20)
    res.raise_for_status()
    payload = res.json()

    if not isinstance(payload, list) or not payload:
        raise ValueError(f"Unexpected /api/quotes payload for {ticker}: {payload}")

    item = payload[0]
    history = item.get("history") or []
    if not history:
        raise ValueError(f"No history from /api/quotes for {ticker} at {timeframe}")

    rows: list[dict] = []
    for bar in history:
        ts = bar.get("ts")
        close = bar.get("price")
        if ts is None or close is None:
            continue
        rows.append(
            {
                "Datetime": datetime.utcfromtimestamp(float(ts)),
                "Open": float(bar.get("open", close)),
                "High": float(bar.get("high", close)),
                "Low": float(bar.get("low", close)),
                "Close": float(close),
                "Volume": float(bar.get("volume", 0.0)),
            }
        )

    if not rows:
        raise ValueError(f"No usable rows from /api/quotes for {ticker} at {timeframe}")

    df = pd.DataFrame(rows).set_index("Datetime").sort_index()
    return df[["Open", "High", "Low", "Close", "Volume"]]


def fetch_ohlcv(ticker: str, timeframe: str = "1d") -> pd.DataFrame:
    """
    Fetch OHLCV for a ticker and timeframe.
    Returns DataFrame with DatetimeIndex and columns:
      Open, High, Low, Close, Volume
    """
    if timeframe not in TIMEFRAME_CONFIG:
        raise ValueError(f"Unknown timeframe '{timeframe}'. Choose from: {list(TIMEFRAME_CONFIG)}")

    interval, range_ = TIMEFRAME_CONFIG[timeframe]
    ticker = ticker.upper().strip()

    try:
        # Primary source: your existing Next.js quote endpoint (already working in dashboard).
        return _fetch_from_next_quotes(ticker, timeframe)
    except Exception as exc:
        logger.warning("Next quotes fallback failed for %s %s: %s", ticker, timeframe, exc)

    try:
        # Secondary fallback: direct Yahoo chart API.
        result = _chart_json(ticker, interval, range_)
    except Exception as exc:
        logger.error("Yahoo chart fetch failed for %s %s: %s", ticker, timeframe, exc)
        raise

    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    volumes = quote.get("volume") or []

    if not timestamps:
        raise ValueError(f"No data returned for {ticker} at {timeframe} interval.")

    rows: list[dict] = []
    for i, ts in enumerate(timestamps):
        close = closes[i] if i < len(closes) else None
        if close is None:
            continue
        rows.append(
            {
                "Datetime": datetime.utcfromtimestamp(ts),
                "Open": float(opens[i]) if i < len(opens) and opens[i] is not None else float(close),
                "High": float(highs[i]) if i < len(highs) and highs[i] is not None else float(close),
                "Low": float(lows[i]) if i < len(lows) and lows[i] is not None else float(close),
                "Close": float(close),
                "Volume": float(volumes[i]) if i < len(volumes) and volumes[i] is not None else 0.0,
            }
        )

    if not rows:
        raise ValueError(f"No usable OHLCV bars for {ticker} at {timeframe}.")

    df = pd.DataFrame(rows).set_index("Datetime").sort_index()
    return df[["Open", "High", "Low", "Close", "Volume"]]


def fetch_multi_timeframe(ticker: str) -> dict[str, pd.DataFrame]:
    """
    Fetches all supported timeframes.
    Returns dict keyed by timeframe.
    """
    result: dict[str, pd.DataFrame] = {}
    errors: list[str] = []
    for tf in TIMEFRAME_CONFIG:
        try:
            result[tf] = fetch_ohlcv(ticker, tf)
            logger.info("%s %s: %s bars loaded", ticker, tf, len(result[tf]))
        except Exception as exc:
            errors.append(f"{tf}: {exc}")
            logger.warning("Failed to fetch %s %s: %s", ticker, tf, exc)

    if not result:
        raise RuntimeError(f"All timeframes failed for {ticker}. Errors: {errors}")
    return result


def get_latest_price(ticker: str) -> float:
    """
    Latest regular market price from Yahoo quote endpoint.
    """
    ticker = ticker.upper().strip()

    # Use Next.js quote endpoint only (Python outbound Yahoo may be blocked on some machines).
    url = f"{_NEXT_QUOTES_BASE.rstrip('/')}/api/quotes?symbols={ticker}&timeframe=1d"
    res = requests.get(url, headers=_HEADERS, timeout=20)
    res.raise_for_status()
    payload = res.json()
    if not isinstance(payload, list) or not payload:
        raise ValueError(f"Unexpected /api/quotes payload for {ticker}: {payload}")

    item = payload[0]
    price = item.get("price")
    if price is not None:
        return float(price)

    history = item.get("history") or []
    if not history:
        raise ValueError(f"No latest price data in /api/quotes for {ticker}")

    return float(history[-1].get("price"))
