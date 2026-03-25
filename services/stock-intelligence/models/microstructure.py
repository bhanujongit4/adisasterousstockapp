"""
Market Microstructure & Latency Estimation Module
===================================================
Estimates order queue congestion and execution latency proxies
purely from OHLCV data — no L2 order book required.

Four complementary estimators:
1. Amihud Illiquidity Ratio      — price impact per unit of volume
2. Roll's Spread Estimator       — effective bid-ask spread from return autocorrelation
3. Kyle's Lambda (OLS proxy)     — price impact coefficient via tick-rule signed flow
4. Volume Clock Imbalance        — detects thin-queue periods via volume distribution

Output: composite CONGESTION_SCORE (0–1) and LATENCY_REGIME (LOW/MODERATE/HIGH/EXTREME)
"""

import numpy as np
import pandas as pd
from scipy.stats import percentileofscore
import warnings
warnings.filterwarnings("ignore")


# ─── Tick Rule (sign trades without L2) ───────────────────────────────────────

def tick_rule_sign(close: pd.Series) -> pd.Series:
    """
    Assigns +1 (buyer-initiated) or -1 (seller-initiated) to each bar
    using the classic tick rule: sign = sign of price change.
    Ties carry forward the previous sign.
    """
    diff = close.diff()
    sign = diff.apply(lambda x: 1 if x > 0 else (-1 if x < 0 else np.nan))
    sign = sign.fillna(method="ffill").fillna(1)
    return sign


# ─── 1. Amihud Illiquidity ────────────────────────────────────────────────────

def amihud_illiquidity(
    close: pd.Series,
    volume: pd.Series,
    window: int = 20
) -> pd.Series:
    """
    Amihud (2002): ILLIQ_t = |R_t| / Volume_t
    Rolling mean gives average price impact per dollar of volume.
    Higher = more illiquid = orders move price more = congested/thin market.
    Normalised to [0,1] via rolling percentile rank.
    """
    ret    = np.log(close / close.shift(1)).abs()
    illiq  = ret / (volume + 1)                 # +1 avoids div/0
    illiq_roll = illiq.rolling(window).mean()
    # Normalise: percentile rank over lookback
    normalised = illiq_roll.rank(pct=True)
    return normalised.rename("amihud")


# ─── 2. Roll's Spread Estimator ───────────────────────────────────────────────

def roll_spread(
    close: pd.Series,
    window: int = 20
) -> pd.Series:
    """
    Roll (1984): effective spread = 2 * sqrt(-Cov(r_t, r_{t-1}))
    When the covariance is positive (no bid-ask bounce) we get 0 → liquid.
    Normalised to [0,1] via rolling percentile rank.
    """
    ret    = np.log(close / close.shift(1))
    cov    = ret.rolling(window).cov(ret.shift(1))
    # Negative cov is expected (bid-ask bounce); clamp positive to 0
    spread = 2 * np.sqrt((-cov).clip(lower=0))
    normalised = spread.rank(pct=True)
    return normalised.rename("roll_spread")


# ─── 3. Kyle's Lambda ─────────────────────────────────────────────────────────

def kyle_lambda(
    close: pd.Series,
    volume: pd.Series,
    window: int = 20
) -> pd.Series:
    """
    Kyle (1985): price impact = λ * signed_order_flow
    Proxy: regress Δprice on tick_sign * sqrt(volume) in a rolling window.
    Higher λ = thin order book = each order moves price more.
    """
    sign        = tick_rule_sign(close)
    signed_flow = sign * np.sqrt(volume + 1)
    delta_price = close.diff()

    lambdas = []
    idx     = []

    for i in range(window, len(close)):
        x = signed_flow.iloc[i-window:i].values
        y = delta_price.iloc[i-window:i].values
        mask = ~(np.isnan(x) | np.isnan(y))
        if mask.sum() < 5:
            lambdas.append(np.nan)
        else:
            # Simple OLS slope
            x_m, y_m = x[mask] - x[mask].mean(), y[mask]
            denom = np.dot(x_m, x_m)
            lam   = np.dot(x_m, y_m) / denom if denom != 0 else 0
            lambdas.append(abs(lam))
        idx.append(close.index[i])

    series = pd.Series(lambdas, index=idx, name="kyle_lambda")
    series = series.reindex(close.index)
    normalised = series.rank(pct=True)
    return normalised.rename("kyle_lambda")


# ─── 4. Volume Clock Imbalance ────────────────────────────────────────────────

def volume_clock_imbalance(
    close:  pd.Series,
    volume: pd.Series,
    window: int = 30
) -> pd.Series:
    """
    Detects when volume is arriving in very uneven bursts — a sign of 
    order-flow clustering (queue filling up or flushing).
    
    Method: coefficient of variation (CV = std/mean) of volume over rolling window.
    High CV = lumpy volume = queue congestion / algorithmic order batching.
    """
    vol_cv = volume.rolling(window).std() / (volume.rolling(window).mean() + 1)
    normalised = vol_cv.rank(pct=True)
    return normalised.rename("vol_imbalance")


# ─── 5. Intraday Volume Profile Deviation ────────────────────────────────────

def intraday_volume_deviation(df: pd.DataFrame) -> pd.Series:
    """
    For intraday data: compare current bar's volume to typical volume
    at that time-of-day (removes the open/close surge effect).
    High deviation above typical = unusual order flow = potential congestion.
    
    Works on DataFrames with DatetimeIndex.
    Falls back to simple rolling z-score if no time structure is present.
    """
    if not isinstance(df.index, pd.DatetimeIndex):
        vol = df["Volume"].astype(float)
        z = (vol - vol.rolling(20).mean()) / (vol.rolling(20).std() + 1)
        return z.rank(pct=True).rename("intraday_vol_dev")

    vol = df["Volume"].astype(float).copy()
    df2 = df.copy()
    df2["_vol"]  = vol
    df2["_time"] = df2.index.time

    # Average volume per time-of-day slot
    avg_by_time  = df2.groupby("_time")["_vol"].transform("mean")
    std_by_time  = df2.groupby("_time")["_vol"].transform("std").fillna(1)
    z_score      = (vol - avg_by_time) / (std_by_time + 1)
    normalised   = z_score.rank(pct=True)
    return normalised.rename("intraday_vol_dev")


# ─── Composite Congestion Score ───────────────────────────────────────────────

LATENCY_THRESHOLDS = {
    "LOW":      (0.00, 0.35),
    "MODERATE": (0.35, 0.60),
    "HIGH":     (0.60, 0.80),
    "EXTREME":  (0.80, 1.01),
}

WEIGHTS = {
    "amihud":          0.30,
    "roll_spread":     0.20,
    "kyle_lambda":     0.30,
    "vol_imbalance":   0.10,
    "intraday_vol_dev":0.10,
}


def estimate_congestion(
    df_intraday: pd.DataFrame,
    window_short: int = 20,
    window_long:  int = 40,
) -> dict:
    """
    Master function — returns congestion score and latency regime for the latest bar.

    Parameters
    ----------
    df_intraday : OHLCV DataFrame (5-min or 15-min recommended), DatetimeIndex
    window_short: lookback for fast estimators (default 20 bars)
    window_long : lookback for slow estimators (default 40 bars)

    Returns
    -------
    dict: congestion_score, latency_regime, components, series (for charting)
    """
    close  = df_intraday["Close"].astype(float)
    volume = df_intraday["Volume"].astype(float)

    amihud   = amihud_illiquidity(close, volume, window=window_short)
    roll     = roll_spread(close, window=window_short)
    kyle     = kyle_lambda(close, volume, window=window_short)
    vol_imb  = volume_clock_imbalance(close, volume, window=window_long)
    vol_dev  = intraday_volume_deviation(df_intraday)

    # Align all series
    combined = pd.DataFrame({
        "amihud":           amihud,
        "roll_spread":      roll,
        "kyle_lambda":      kyle,
        "vol_imbalance":    vol_imb,
        "intraday_vol_dev": vol_dev,
    }).dropna(how="all")

    # Composite score at latest bar
    latest = combined.iloc[-1]
    score  = sum(
        latest.get(k, 0.5) * w
        for k, w in WEIGHTS.items()
        if not pd.isna(latest.get(k))
    )
    score = float(np.clip(score, 0, 1))

    # Regime label
    regime = "UNKNOWN"
    for label, (lo, hi) in LATENCY_THRESHOLDS.items():
        if lo <= score < hi:
            regime = label
            break

    # Trend: is congestion rising or falling? (5-bar slope)
    if len(combined) >= 5:
        recent_scores = combined.iloc[-5:].fillna(0.5)
        composite_recent = (recent_scores * pd.Series(WEIGHTS)).sum(axis=1)
        slope = float(np.polyfit(range(len(composite_recent)), composite_recent.values, 1)[0])
        trend = "WORSENING" if slope > 0.01 else ("IMPROVING" if slope < -0.01 else "STABLE")
    else:
        trend = "STABLE"

    return {
        "congestion_score": round(score, 4),
        "latency_regime":   regime,
        "congestion_trend": trend,
        "components": {
            "amihud":           round(float(latest.get("amihud", np.nan)), 4),
            "roll_spread":      round(float(latest.get("roll_spread", np.nan)), 4),
            "kyle_lambda":      round(float(latest.get("kyle_lambda", np.nan)), 4),
            "vol_imbalance":    round(float(latest.get("vol_imbalance", np.nan)), 4),
            "intraday_vol_dev": round(float(latest.get("intraday_vol_dev", np.nan)), 4),
        },
        "series": combined,  # full timeseries, useful for charting
    }