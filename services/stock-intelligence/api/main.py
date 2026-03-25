"""
Stock Intelligence API
========================
FastAPI microservice exposing regime detection and microstructure endpoints.
Your Next.js app calls these endpoints via REST.

Endpoints:
  GET  /health                         → health check
  GET  /api/regime/{ticker}            → market regime signal
  GET  /api/microstructure/{ticker}    → latency / congestion signal
  GET  /api/signal/{ticker}            → combined intelligence snapshot

Run with:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import logging
import traceback

from utils.data_fetcher import fetch_multi_timeframe, get_latest_price
from models.regime_detector import classify_regime, HMMRegimeDetector
from models.microstructure import estimate_congestion
from models.anomalydetecion import AnomalyDetector

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Stock Intelligence API",
    description="Regime detection + microstructure analysis for live trading",
    version="1.0.0",
)

# CORS — allows your Next.js app (localhost:3000) to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        # Add your production domain here, e.g. "https://yourstockapp.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory HMM cache (avoid refitting on every request) ────────────────────
# Key: ticker → fitted HMMRegimeDetector
_hmm_cache: dict[str, HMMRegimeDetector] = {}


# ── Response Models ───────────────────────────────────────────────────────────

class RegimeResponse(BaseModel):
    ticker:     str
    regime:     str         # TRENDING_UP | TRENDING_DOWN | MEAN_REVERTING | VOLATILE | DEAD
    confidence: float       # 0–1, agreement between sub-models
    hurst:      float       # 0–1, Hurst exponent
    adx:        float       # 0–100
    hmm_regime: str
    hmm_prob:   float
    vol_percentile: float
    components: dict


class MicrostructureResponse(BaseModel):
    ticker:            str
    congestion_score:  float   # 0–1 composite
    latency_regime:    str     # LOW | MODERATE | HIGH | EXTREME
    congestion_trend:  str     # WORSENING | STABLE | IMPROVING
    components:        dict


class SignalResponse(BaseModel):
    ticker:       str
    price:        Optional[float]
    regime:       RegimeResponse
    microstructure: MicrostructureResponse
    trading_note: str          # plain-English interpretation
    timestamp:    str


class AnomalyResponse(BaseModel):
    ticker: str
    timeframe: str
    latest_timestamp: int
    latest_price: float
    severity: str
    composite_score: float
    anomaly_note: str
    engine_scores: dict
    top_features: list
    components: dict
    recent_markers: list


# ── Helpers ───────────────────────────────────────────────────────────────────

def _trading_note(regime: str, latency: str, congestion: float, confidence: float) -> str:
    """Generate a plain-English trading note from signal combination."""
    notes = []

    if regime == "TRENDING_UP":
        notes.append("Momentum is bullish — trend-following strategies preferred.")
    elif regime == "TRENDING_DOWN":
        notes.append("Bearish trend in progress — avoid longs, consider shorts or flat.")
    elif regime == "MEAN_REVERTING":
        notes.append("Price is oscillating around a mean — mean-reversion strategies apply.")
    elif regime == "VOLATILE":
        notes.append("High volatility regime — widen stops, reduce position size.")
    elif regime == "DEAD":
        notes.append("Low volatility, no clear direction — avoid overtrading.")

    if latency == "EXTREME":
        notes.append(f"⚠️ Queue is highly congested (score {congestion:.2f}) — expect significant slippage, delay entry.")
    elif latency == "HIGH":
        notes.append(f"Order queue is busy (score {congestion:.2f}) — use limit orders where possible.")
    elif latency == "LOW":
        notes.append(f"Market is liquid (score {congestion:.2f}) — execution risk is low.")

    if confidence < 0.5:
        notes.append("⚠️ Low model agreement — treat regime signal with caution.")

    return " ".join(notes)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "stock-intelligence-api"}


@app.get("/api/regime/{ticker}", response_model=RegimeResponse)
def get_regime(
    ticker: str,
    refit_hmm: bool = Query(False, description="Force refit HMM (slower but fresh)"),
    timeframe: str = Query("1h", description="Intraday regime timeframe: 5m, 15m, 1h"),
):
    """
    Returns the current market regime for a stock.
    HMM is cached per ticker — pass ?refit_hmm=true to force a fresh fit.
    """
    ticker = ticker.upper()
    try:
        data = fetch_multi_timeframe(ticker)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data fetch failed: {str(e)}")

    df_daily = data.get("1d")
    tf = timeframe if timeframe in ("5m", "15m", "1h") else "1h"
    df_intraday = data.get(tf)
    if df_intraday is None:
        df_intraday = data.get("1h")
    if df_intraday is None:
        df_intraday = data.get("15m")

    if df_daily is None or len(df_daily) < 30:
        raise HTTPException(status_code=400, detail="Insufficient daily data (need ≥30 bars).")
    if df_intraday is None or len(df_intraday) < 20:
        raise HTTPException(status_code=400, detail="Insufficient intraday data.")

    cached_hmm  = _hmm_cache.get(ticker)
    fit_fresh   = refit_hmm or (cached_hmm is None)

    try:
        result = classify_regime(
            df_daily=df_daily,
            df_intraday=df_intraday,
            hmm_model=cached_hmm,
            fit_hmm=fit_fresh,
        )
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Regime computation failed: {str(e)}")

    # Cache fitted model
    if "hmm_model" in result:
        _hmm_cache[ticker] = result.pop("hmm_model")

    return RegimeResponse(ticker=ticker, **{k: v for k, v in result.items() if k != "hmm_model"})


@app.get("/api/microstructure/{ticker}", response_model=MicrostructureResponse)
def get_microstructure(
    ticker: str,
    timeframe: str = Query("5m", description="Intraday timeframe: 5m or 15m")
):
    """
    Returns congestion score and latency regime for a stock.
    Use 5m for highest resolution, 15m for more stable signals.
    """
    ticker = ticker.upper()
    if timeframe not in ("5m", "15m"):
        raise HTTPException(status_code=400, detail="timeframe must be '5m' or '15m'")

    try:
        df = fetch_ohlcv_single(ticker, timeframe)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data fetch failed: {str(e)}")

    if len(df) < 25:
        raise HTTPException(status_code=400, detail="Insufficient intraday data (need ≥25 bars).")

    try:
        result = estimate_congestion(df)
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Microstructure computation failed: {str(e)}")

    # Remove non-serialisable series from result
    result.pop("series", None)

    return MicrostructureResponse(ticker=ticker, **result)


def _feature_plain_english(name: str) -> str:
    mapping = {
        "body_pct": "candle body expansion",
        "upper_wick_pct": "upper-wick rejection pressure",
        "lower_wick_pct": "lower-wick absorption",
        "vwap_deviation": "distance from VWAP benchmark",
        "vol_ratio": "volume surge versus normal",
        "log_return": "abrupt directional return",
        "abs_return": "unusually large bar move",
        "price_range_pct": "intrabar volatility expansion",
        "vol_price_corr": "return-volume coupling shift",
    }
    return mapping.get(name, name)


def _anomaly_so_what(severity: str, top_features: list, percentile: float) -> str:
    lead = {
        "CRITICAL": "Statistically extreme bar: institutional activity footprint is likely.",
        "WARNING": "Strong anomaly: this bar is uncommon and may signal a local regime shift.",
        "WATCH": "Mild anomaly: watch follow-through before taking conviction.",
        "NORMAL": "No statistical anomaly: bar behavior is within normal profile.",
    }.get(severity, "Anomaly score computed.")

    drivers = ", ".join(_feature_plain_english(str(item[0])) for item in top_features[:3]) if top_features else "no dominant driver"
    pct = f"{percentile * 100:.1f}%"
    return f"{lead} Key drivers: {drivers}. This bar is more unusual than {pct} of recent history."


@app.get("/api/anomaly/{ticker}", response_model=AnomalyResponse)
def get_anomaly(
    ticker: str,
    timeframe: str = Query("15m", description="Anomaly timeframe: 5m, 15m, 1h, 1d"),
    contamination: float = Query(0.02, ge=0.001, le=0.2, description="Expected outlier fraction"),
):
    """
    Runs anomaly model (IsolationForest + rolling z-score + CUSUM) on selected timeframe.
    """
    ticker = ticker.upper()
    if timeframe not in ("5m", "15m", "1h", "1d"):
        raise HTTPException(status_code=400, detail="timeframe must be one of 5m, 15m, 1h, 1d")

    try:
        df = fetch_ohlcv_single(ticker, timeframe)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data fetch failed: {str(e)}")

    if df is None or len(df) < 60:
        raise HTTPException(status_code=400, detail="Insufficient bars for anomaly model (need >= 60 bars).")

    try:
        detector = AnomalyDetector(contamination=contamination)
        detector.fit(df)
        result = detector.detect_latest(df)
        sequence = detector.detect_sequence(df)
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Anomaly computation failed: {str(e)}")

    latest_ts = int(df.index[-1].timestamp())
    latest_price = float(df["Close"].iloc[-1])
    score_percentile = float(result.get("components", {}).get("score_percentile", 0.0))
    anomaly_note = _anomaly_so_what(result["severity"], result.get("top_features", []), score_percentile)

    sequence_joined = sequence.join(df[["Close"]], how="left")
    flagged = sequence_joined[sequence_joined["severity"] != "NORMAL"].tail(120)
    recent_markers = [
        {
            "timestamp": int(idx.timestamp()),
            "severity": str(row["severity"]),
            "composite_score": round(float(row["composite"]), 4),
            "price": round(float(row["Close"]), 4) if "Close" in row and row["Close"] == row["Close"] else None,
        }
        for idx, row in flagged.iterrows()
    ]

    return AnomalyResponse(
        ticker=ticker,
        timeframe=timeframe,
        latest_timestamp=latest_ts,
        latest_price=latest_price,
        severity=result["severity"],
        composite_score=result["composite_score"],
        anomaly_note=anomaly_note,
        engine_scores=result["engine_scores"],
        top_features=result["top_features"],
        components=result["components"],
        recent_markers=recent_markers,
    )


@app.get("/api/signal/{ticker}", response_model=SignalResponse)
def get_full_signal(ticker: str):
    """
    Master endpoint — returns regime + microstructure + trading note in one call.
    This is the main endpoint your Next.js dashboard should use.
    """
    from datetime import datetime, timezone

    ticker = ticker.upper()

    # Fetch once, share across both models
    try:
        data = fetch_multi_timeframe(ticker)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data fetch failed: {str(e)}")

    df_daily = data.get("1d")
    df_intraday_1h = data.get("1h")
    if df_intraday_1h is None:
        df_intraday_1h = data.get("15m")

    df_intraday_5m = data.get("5m")
    if df_intraday_5m is None:
        df_intraday_5m = data.get("15m")

    if df_daily is None or df_intraday_1h is None:
        raise HTTPException(status_code=400, detail="Missing required timeframes.")

    # ── Regime ────────────────────────────────────────────────────────────────
    cached_hmm = _hmm_cache.get(ticker)
    try:
        regime_result = classify_regime(
            df_daily=df_daily,
            df_intraday=df_intraday_1h,
            hmm_model=cached_hmm,
            fit_hmm=(cached_hmm is None),
        )
        if "hmm_model" in regime_result:
            _hmm_cache[ticker] = regime_result.pop("hmm_model")
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Regime failed: {str(e)}")

    # ── Microstructure ────────────────────────────────────────────────────────
    try:
        ms_result = estimate_congestion(df_intraday_5m)
        ms_result.pop("series", None)
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Microstructure failed: {str(e)}")

    # ── Latest price ──────────────────────────────────────────────────────────
    try:
        price = get_latest_price(ticker)
    except Exception:
        price = float(df_daily["Close"].iloc[-1])

    note = _trading_note(
        regime_result["regime"],
        ms_result["latency_regime"],
        ms_result["congestion_score"],
        regime_result["confidence"],
    )

    regime_resp = RegimeResponse(ticker=ticker, **regime_result)
    ms_resp     = MicrostructureResponse(ticker=ticker, **ms_result)

    return SignalResponse(
        ticker=ticker,
        price=price,
        regime=regime_resp,
        microstructure=ms_resp,
        trading_note=note,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ── Local import fix for microstructure endpoint ──────────────────────────────
def fetch_ohlcv_single(ticker: str, timeframe: str):
    from utils.data_fetcher import fetch_ohlcv
    return fetch_ohlcv(ticker, timeframe)
