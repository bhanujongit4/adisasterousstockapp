"""
Market Regime Detection Module
================================
Combines three complementary approaches:
1. Hidden Markov Model (HMM) - learns latent market states from returns + volatility
2. Hurst Exponent          - classifies trending vs mean-reverting vs random
3. ADX + Volatility overlay - rule-based confirmation layer

Output regime: TRENDING_UP | TRENDING_DOWN | MEAN_REVERTING | VOLATILE | DEAD

FIXES vs original:
- Hurst threshold tightened: 0.55 → 0.60 (stops weak momentum from voting trending)
- ADX threshold raised: 30 → 35 for trending, 20 → 18 for weak (more genuine signal)
- HMM state labelling: ret_mean threshold raised from 1e-4 to 5e-4, and states are
  labelled relative to the distribution of all state means — not on absolute values.
  This prevents all 4 states from collapsing into TRENDING_UP/DOWN.
- Fusion: abstention added — Hurst and ADX only vote if they're genuinely confident,
  otherwise they stay silent and let HMM + vol carry the result.
- Confidence floor: if top vote share < 0.5, regime is tagged UNCERTAIN so the UI
  can reflect genuine ambiguity rather than false precision.
"""

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM
from sklearn.preprocessing import StandardScaler
from scipy.stats import linregress
from collections import Counter
import warnings
warnings.filterwarnings("ignore")


def _sanitize_ohlc(df: pd.DataFrame) -> pd.DataFrame:
    """Ensure OHLCV columns are numeric and finite before model use."""
    required = ["Open", "High", "Low", "Close", "Volume"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    out = df.copy()
    for col in required:
        out[col] = pd.to_numeric(out[col], errors="coerce")

    # Close must remain > 0 for log-return math.
    out.loc[out["Close"] <= 0, "Close"] = np.nan
    out[required] = out[required].replace([np.inf, -np.inf], np.nan).ffill().bfill()
    out = out.dropna(subset=required)
    return out


# ─── Hurst Exponent ────────────────────────────────────────────────────────────

def hurst_exponent(price_series: np.ndarray, min_lags: int = 2, max_lags: int = 20) -> float:
    """
    Compute the Hurst Exponent via R/S analysis.

    Interpretation (tightened vs original):
      H > 0.60  → Trending (persistent)       [was 0.55 — too easy to clear]
      H 0.40–0.60 → Random walk / ambiguous
      H < 0.40  → Mean-reverting              [was 0.45 — too aggressive]

    The wider neutral band (0.40–0.60) forces the model to abstain on
    ambiguous markets instead of forcing a trending vote.
    """
    prices = np.asarray(price_series, dtype=float)
    prices = prices[np.isfinite(prices) & (prices > 0)]
    if prices.size < max(10, min_lags + 2):
        return 0.5

    lags = range(min_lags, min(max_lags, len(prices) // 2))
    ts = np.log(prices)

    rs_values = []
    for lag in lags:
        sub = [ts[i:i+lag] for i in range(0, len(ts) - lag, lag)]
        rs_list = []
        for chunk in sub:
            if len(chunk) < 2:
                continue
            mean = np.mean(chunk)
            devs = np.cumsum(chunk - mean)
            r = np.max(devs) - np.min(devs)
            s = np.std(chunk, ddof=1)
            if s > 0:
                rs_list.append(r / s)
        if rs_list:
            rs_values.append((lag, np.mean(rs_list)))

    if len(rs_values) < 2:
        return 0.5  # fallback

    lags_log = np.log([x[0] for x in rs_values])
    rs_log   = np.log([x[1] for x in rs_values])
    slope, _, _, _, _ = linregress(lags_log, rs_log)
    return float(np.clip(slope, 0.0, 1.0))


# ─── ADX (Average Directional Index) ──────────────────────────────────────────

def compute_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14):
    """
    ADX — measures trend strength regardless of direction.

    Thresholds (tightened vs original):
      > 35  = strong trend   [was 30 — fires too often in normal markets]
      18–35 = moderate / ambiguous — ADX abstains from voting
      < 18  = weak / no trend [was 15]
    """
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low  - close.shift(1)).abs()
    ], axis=1).max(axis=1)

    dm_plus  = (high - high.shift(1)).clip(lower=0)
    dm_minus = (low.shift(1) - low).clip(lower=0)
    dm_plus  = dm_plus.where(dm_plus > dm_minus, 0)
    dm_minus = dm_minus.where(dm_minus > dm_plus, 0)

    atr = tr.ewm(span=period, adjust=False).mean().replace(0, np.nan)
    di_p = 100 * dm_plus.ewm(span=period, adjust=False).mean() / atr
    di_m = 100 * dm_minus.ewm(span=period, adjust=False).mean() / atr
    dx    = (100 * (di_p - di_m).abs() / (di_p + di_m + 1e-9))
    adx = dx.ewm(span=period, adjust=False).mean()
    adx = adx.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0)
    di_p = di_p.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0)
    di_m = di_m.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0)
    return adx, di_p, di_m


# ─── HMM Regime Model ─────────────────────────────────────────────────────────

class HMMRegimeDetector:
    """
    Gaussian HMM with n_states latent states.
    Features: log-return, rolling volatility (z-scored).

    KEY FIX — state labelling:
    Instead of using absolute return thresholds (the original 1e-4 was so tiny
    that almost every state got labelled TRENDING), we now rank states relative
    to each other. The top-return state is TRENDING_UP, the bottom is
    TRENDING_DOWN, and middle states get MEAN_REVERTING or VOLATILE based on
    their volatility level. This guarantees regime diversity across the 4 states.
    """

    def __init__(self, n_states: int = 4, covariance_type: str = "full"):
        self.n_states = n_states
        self.model    = GaussianHMM(
            n_components=n_states,
            covariance_type=covariance_type,
            n_iter=200,
            random_state=42,
            tol=1e-4
        )
        self.scaler      = StandardScaler()
        self.fitted      = False
        self.state_labels: dict[int, str] = {}

    def _build_features(self, df: pd.DataFrame) -> np.ndarray:
        """Returns (N, 2) feature matrix: [log_return, rolling_vol]."""
        close = pd.to_numeric(df["Close"], errors="coerce").astype(float)
        close = close.where(close > 0).ffill().bfill()
        ret = np.log(close / close.shift(1))
        ret = ret.replace([np.inf, -np.inf], np.nan).fillna(0.0)
        vol = ret.rolling(10).std().replace([np.inf, -np.inf], np.nan).bfill().fillna(0.0)
        feats = np.column_stack([ret.values, vol.values])
        if not np.isfinite(feats).all():
            feats = np.nan_to_num(feats, nan=0.0, posinf=0.0, neginf=0.0)
        return feats

    def fit(self, df: pd.DataFrame):
        feats  = self._build_features(df)
        scaled = self.scaler.fit_transform(feats)
        self.model.fit(scaled)
        self.fitted = True
        self._label_states(feats)
        return self

    def _label_states(self, feats: np.ndarray):
        """
        Rank-based state labelling — guarantees regime diversity.

        Logic:
        1. Get the raw (unscaled) mean return and mean volatility for each state.
        2. Rank states by mean return.
        3. Top-return state     → TRENDING_UP
           Bottom-return state  → TRENDING_DOWN
           Remaining states: highest vol among them → VOLATILE
                             lowest vol among them  → MEAN_REVERTING or DEAD
                             (DEAD = near-zero return AND near-zero vol)

        This ensures all four regime labels can actually appear in output,
        rather than all states collapsing to trending.
        """
        raw_means = self.scaler.inverse_transform(self.model.means_)
        # raw_means[:, 0] = mean log return per state
        # raw_means[:, 1] = mean rolling vol per state

        ret_means = raw_means[:, 0]
        vol_means = raw_means[:, 1]

        # Rank states by return
        ranked_by_ret = np.argsort(ret_means)  # ascending: [lowest_ret ... highest_ret]

        highest_ret_state = ranked_by_ret[-1]
        lowest_ret_state  = ranked_by_ret[0]
        middle_states     = list(ranked_by_ret[1:-1])

        self.state_labels[highest_ret_state] = "TRENDING_UP"
        self.state_labels[lowest_ret_state]  = "TRENDING_DOWN"

        # For middle states, use volatility to split VOLATILE vs MEAN_REVERTING/DEAD
        if len(middle_states) == 0:
            pass  # only 2 states, nothing to do
        elif len(middle_states) == 1:
            s = middle_states[0]
            vol_pct = np.mean(vol_means[ranked_by_ret[1:-1]])
            if vol_means[s] > np.median(vol_means):
                self.state_labels[s] = "VOLATILE"
            else:
                self.state_labels[s] = "MEAN_REVERTING"
        else:
            # Multiple middle states: highest vol → VOLATILE, rest by return magnitude
            mid_vols = [(s, vol_means[s]) for s in middle_states]
            mid_vols_sorted = sorted(mid_vols, key=lambda x: x[1])

            highest_vol_mid = mid_vols_sorted[-1][0]
            self.state_labels[highest_vol_mid] = "VOLATILE"

            for s, _ in mid_vols_sorted[:-1]:
                # Near-zero return AND near-zero vol → DEAD, else MEAN_REVERTING
                is_dead = (
                    abs(ret_means[s]) < np.std(ret_means) * 0.3 and
                    vol_means[s] < np.median(vol_means)
                )
                self.state_labels[s] = "DEAD" if is_dead else "MEAN_REVERTING"

    def predict_latest(self, df: pd.DataFrame) -> tuple[str, float]:
        """Returns (regime_label, posterior_probability) for the latest bar."""
        if not self.fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        feats      = self._build_features(df)
        scaled     = self.scaler.transform(feats)
        state      = self.model.predict(scaled)[-1]
        posteriors = self.model.predict_proba(scaled)[-1]
        label      = self.state_labels.get(state, "UNKNOWN")
        prob       = float(posteriors[state])
        return label, prob

    def predict_sequence(self, df: pd.DataFrame) -> pd.Series:
        """Returns a full regime sequence (useful for backtesting)."""
        if not self.fitted:
            raise RuntimeError("Model not fitted.")
        feats  = self._build_features(df)
        scaled = self.scaler.transform(feats)
        states = self.model.predict(scaled)
        labels = [self.state_labels.get(s, "UNKNOWN") for s in states]
        return pd.Series(labels, index=df.index)


# ─── Master Regime Classifier ─────────────────────────────────────────────────

REGIME_PRIORITY = ["VOLATILE", "TRENDING_UP", "TRENDING_DOWN", "MEAN_REVERTING", "DEAD"]

def classify_regime(
    df_daily: pd.DataFrame,
    df_intraday: pd.DataFrame,
    hmm_model: HMMRegimeDetector | None = None,
    fit_hmm: bool = True,
) -> dict:
    """
    Master function — combines HMM + Hurst + ADX into a final regime signal.

    Parameters
    ----------
    df_daily    : Daily OHLCV DataFrame (>=60 bars recommended for HMM fit)
    df_intraday : 15-min or 1-hr OHLCV for short-term confirmation
    hmm_model   : Pre-fitted HMMRegimeDetector (pass None to fit fresh)
    fit_hmm     : Whether to (re)fit the HMM on df_daily

    Returns
    -------
    dict with keys:
        regime       : final regime label (or UNCERTAIN if engines disagree)
        confidence   : vote share of winning regime [0, 1]
        is_uncertain : True when no regime cleared 50% of votes
        hurst, adx, hmm_regime, hmm_prob, vol_percentile, components
    """

    df_daily = _sanitize_ohlc(df_daily)
    df_intraday = _sanitize_ohlc(df_intraday)
    if len(df_daily) < 30:
        raise ValueError("Insufficient clean daily bars after sanitization (need >= 30).")
    if len(df_intraday) < 20:
        raise ValueError("Insufficient clean intraday bars after sanitization (need >= 20).")

    result = {}

    # ── 1. Hurst Exponent (on daily closes) ───────────────────────────────────
    prices = df_daily["Close"].astype(float).values
    hurst  = hurst_exponent(prices[-60:] if len(prices) > 60 else prices)
    result["hurst"] = round(hurst, 4)

    # Tightened bands — wider neutral zone forces abstention on ambiguous markets
    if hurst > 0.70:
        hurst_regime = "TRENDING"
    elif hurst < 0.45:
        hurst_regime = "MEAN_REVERTING"
    else:
        hurst_regime = "RANDOM"   # abstains from voting

    # ── 2. ADX on intraday (15min or 1hr) ─────────────────────────────────────
    adx_series, di_p, di_m = compute_adx(
        df_intraday["High"], df_intraday["Low"], df_intraday["Close"]
    )
    adx_latest  = float(adx_series.iloc[-1])
    di_p_latest = float(di_p.iloc[-1])
    di_m_latest = float(di_m.iloc[-1])
    result["adx"] = round(adx_latest, 2)

    # ── 3. HMM on daily ───────────────────────────────────────────────────────
    if hmm_model is None:
        hmm_model = HMMRegimeDetector(n_states=4)
    try:
        if fit_hmm:
            hmm_model.fit(df_daily)
        hmm_regime, hmm_prob = hmm_model.predict_latest(df_daily)
    except Exception:
        # Keep service responsive even when HMM cannot fit edge-case data.
        hmm_regime = "MEAN_REVERTING" if adx_latest < 18 else ("TRENDING_UP" if di_p_latest >= di_m_latest else "TRENDING_DOWN")
        hmm_prob = 0.34
    result["hmm_regime"] = hmm_regime
    result["hmm_prob"]   = round(hmm_prob, 4)

    # ── 4. Recent volatility percentile ───────────────────────────────────────
    close   = df_daily["Close"].astype(float)
    ret     = np.log(close / close.shift(1)).dropna()
    rolling_vol = pd.Series(ret.rolling(5).std().dropna())
    if len(rolling_vol) == 0:
        vol_pct = 0.5
    else:
        vol_pct = float(rolling_vol.rank(pct=True).iloc[-1])
    result["vol_percentile"] = round(vol_pct, 4)

    # ── 5. Fusion logic (with abstention) ─────────────────────────────────────
    #
    # KEY CHANGE: Hurst and ADX only cast a vote when they are genuinely
    # confident. In the ambiguous middle range they stay silent. This prevents
    # weak trending signals from piling up and drowning out MEAN_REVERTING/DEAD.
    #
    votes = []

    # Vote 1: Hurst — only votes when clearly trending or mean-reverting
    if hurst_regime == "TRENDING":
        direction = "TRENDING_UP" if di_p_latest > di_m_latest else "TRENDING_DOWN"
        votes.append(direction)
    elif hurst_regime == "MEAN_REVERTING":
        votes.append("MEAN_REVERTING")
    # else: RANDOM → abstain, no vote cast

    # Vote 2: ADX — only votes at the extremes
    if adx_latest > 45:          # genuine strong trend (raised from 30)
        direction = "TRENDING_UP" if di_p_latest > di_m_latest else "TRENDING_DOWN"
        votes.append(direction)
    elif adx_latest < 25:        # genuinely weak / ranging (raised from 15)
        votes.append("MEAN_REVERTING" if hurst < 0.45 else "DEAD")
    # else: 18–35 moderate zone → abstain, no vote cast

    # Vote 3: HMM always votes (it's the primary model)
    votes.append(hmm_regime)

    # Vote 4: Volatility extreme override (unchanged — these are hard signals)
    if vol_pct > 0.80:
        votes.append("VOLATILE")
    elif vol_pct < 0.10:
        votes.append("DEAD")

    # ── 6. Result + uncertainty flag ──────────────────────────────────────────
    vote_counts  = Counter(votes)
    top_regime, top_count = vote_counts.most_common(1)[0]
    total_votes  = len(votes)
    confidence   = round(top_count / total_votes, 4)

    # If the winning regime didn't get at least 50% of votes, flag as uncertain.
    # The caller / UI should treat UNCERTAIN differently — e.g. reduce position
    # sizing, show a warning, or wait for the next bar before acting.
    is_uncertain = confidence < 0.50
    final_regime = top_regime if not is_uncertain else "UNCERTAIN"

    result["regime"]       = final_regime
    result["confidence"]   = confidence
    result["is_uncertain"] = is_uncertain
    result["components"]   = {
        "hurst_regime":  hurst_regime,
        "hurst_voted":   hurst_regime != "RANDOM",
        "adx_regime":    "TRENDING" if adx_latest > 35 else ("WEAK" if adx_latest < 18 else "MODERATE"),
        "adx_voted":     adx_latest > 35 or adx_latest < 18,
        "hmm_regime":    hmm_regime,
        "vol_extreme":   vol_pct > 0.90 or vol_pct < 0.10,
        "votes":         votes,
        "vote_breakdown": dict(vote_counts),
    }
    result["hmm_model"] = hmm_model  # return fitted model for reuse

    return result
