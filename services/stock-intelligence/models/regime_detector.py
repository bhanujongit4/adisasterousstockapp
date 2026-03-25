"""
Market Regime Detection Module
================================
Combines three complementary approaches:
1. Hidden Markov Model (HMM) - learns latent market states from returns + volatility
2. Hurst Exponent          - classifies trending vs mean-reverting vs random
3. ADX + Volatility overlay - rule-based confirmation layer

Output regime: TRENDING_UP | TRENDING_DOWN | MEAN_REVERTING | VOLATILE | DEAD
"""

import numpy as np
import pandas as pd
from hmmlearn.hmm import GaussianHMM
from sklearn.preprocessing import StandardScaler
from scipy.stats import linregress
import warnings
warnings.filterwarnings("ignore")


# ─── Hurst Exponent ────────────────────────────────────────────────────────────

def hurst_exponent(price_series: np.ndarray, min_lags: int = 2, max_lags: int = 20) -> float:
    """
    Compute the Hurst Exponent via R/S analysis.
    H > 0.55  → Trending (persistent)
    H ≈ 0.50  → Random walk
    H < 0.45  → Mean-reverting (anti-persistent)
    """
    lags = range(min_lags, min(max_lags, len(price_series) // 2))
    ts = np.log(price_series)
    
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

def compute_adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """ADX — measures trend strength regardless of direction. >25 = strong trend."""
    tr = pd.concat([
        high - low,
        (high - close.shift(1)).abs(),
        (low  - close.shift(1)).abs()
    ], axis=1).max(axis=1)

    dm_plus  = (high - high.shift(1)).clip(lower=0)
    dm_minus = (low.shift(1) - low).clip(lower=0)
    dm_plus  = dm_plus.where(dm_plus > dm_minus, 0)
    dm_minus = dm_minus.where(dm_minus > dm_plus, 0)

    atr   = tr.ewm(span=period, adjust=False).mean()
    di_p  = 100 * dm_plus.ewm(span=period, adjust=False).mean() / atr
    di_m  = 100 * dm_minus.ewm(span=period, adjust=False).mean() / atr
    dx    = (100 * (di_p - di_m).abs() / (di_p + di_m + 1e-9))
    adx   = dx.ewm(span=period, adjust=False).mean()
    return adx, di_p, di_m


# ─── HMM Regime Model ─────────────────────────────────────────────────────────

class HMMRegimeDetector:
    """
    Gaussian HMM with n_states latent states.
    Features: log-return, rolling volatility (z-scored).
    States are post-hoc labelled by mean return and volatility level.
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
        self.scaler   = StandardScaler()
        self.fitted   = False
        self.state_labels: dict[int, str] = {}

    def _build_features(self, df: pd.DataFrame) -> np.ndarray:
        """Returns (N, 2) feature matrix: [log_return, rolling_vol]."""
        close  = df["Close"].astype(float)
        ret    = np.log(close / close.shift(1)).fillna(0)
        vol    = ret.rolling(10).std().fillna(method="bfill").fillna(0)
        feats  = np.column_stack([ret.values, vol.values])
        return feats

    def fit(self, df: pd.DataFrame):
        feats = self._build_features(df)
        scaled = self.scaler.fit_transform(feats)
        self.model.fit(scaled)
        self.fitted = True
        self._label_states(feats)
        return self

    def _label_states(self, feats: np.ndarray):
        """Auto-label states by mean return (sign) and volatility level."""
        scaled  = self.scaler.transform(feats)
        states  = self.model.predict(scaled)
        means   = self.model.means_          # shape (n_states, 2) in scaled space
        # Unscale means back for interpretability
        raw_means = self.scaler.inverse_transform(means)

        for s in range(self.n_states):
            ret_mean = raw_means[s, 0]
            vol_mean = raw_means[s, 1]

            # Relative vol: compare to median across states
            vol_threshold_high = np.percentile([self.scaler.inverse_transform(means)[i, 1] for i in range(self.n_states)], 75)
            vol_threshold_low  = np.percentile([self.scaler.inverse_transform(means)[i, 1] for i in range(self.n_states)], 25)

            if vol_mean >= vol_threshold_high:
                self.state_labels[s] = "VOLATILE"
            elif vol_mean <= vol_threshold_low and abs(ret_mean) < 1e-4:
                self.state_labels[s] = "DEAD"
            elif ret_mean > 1e-4:
                self.state_labels[s] = "TRENDING_UP"
            elif ret_mean < -1e-4:
                self.state_labels[s] = "TRENDING_DOWN"
            else:
                self.state_labels[s] = "MEAN_REVERTING"

    def predict_latest(self, df: pd.DataFrame) -> tuple[str, float]:
        """Returns (regime_label, posterior_probability) for the latest bar."""
        if not self.fitted:
            raise RuntimeError("Model not fitted. Call fit() first.")
        feats  = self._build_features(df)
        scaled = self.scaler.transform(feats)
        state  = self.model.predict(scaled)[-1]
        posteriors = self.model.predict_proba(scaled)[-1]
        label  = self.state_labels.get(state, "UNKNOWN")
        prob   = float(posteriors[state])
        return label, prob

    def predict_sequence(self, df: pd.DataFrame) -> pd.Series:
        """Returns a full regime sequence for the dataframe (useful for backtesting)."""
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
    dict with keys: regime, confidence, hurst, adx, hmm_regime, hmm_prob, components
    """

    result = {}

    # ── 1. Hurst Exponent (on daily closes) ───────────────────────────────────
    prices  = df_daily["Close"].astype(float).values
    hurst   = hurst_exponent(prices[-60:] if len(prices) > 60 else prices)
    result["hurst"] = round(hurst, 4)

    if hurst > 0.55:
        hurst_regime = "TRENDING"
    elif hurst < 0.45:
        hurst_regime = "MEAN_REVERTING"
    else:
        hurst_regime = "RANDOM"

    # ── 2. ADX on intraday (15min or 1hr) ─────────────────────────────────────
    adx_series, di_p, di_m = compute_adx(
        df_intraday["High"], df_intraday["Low"], df_intraday["Close"]
    )
    adx_latest = float(adx_series.iloc[-1])
    di_p_latest = float(di_p.iloc[-1])
    di_m_latest = float(di_m.iloc[-1])
    result["adx"] = round(adx_latest, 2)

    # ── 3. HMM on daily ───────────────────────────────────────────────────────
    if hmm_model is None:
        hmm_model = HMMRegimeDetector(n_states=4)
    if fit_hmm:
        hmm_model.fit(df_daily)

    hmm_regime, hmm_prob = hmm_model.predict_latest(df_daily)
    result["hmm_regime"] = hmm_regime
    result["hmm_prob"]   = round(hmm_prob, 4)

    # ── 4. Recent volatility percentile ───────────────────────────────────────
    close   = df_daily["Close"].astype(float)
    ret     = np.log(close / close.shift(1)).dropna()
    vol_now = float(ret.iloc[-5:].std())
    vol_pct = float(pd.Series(ret.rolling(5).std().dropna()).rank(pct=True).iloc[-1])
    result["vol_percentile"] = round(vol_pct, 4)

    # ── 5. Fusion logic ───────────────────────────────────────────────────────
    votes = []

    # Vote 1: Hurst
    if hurst_regime == "TRENDING":
        direction = "TRENDING_UP" if di_p_latest > di_m_latest else "TRENDING_DOWN"
        votes.append(direction)
    elif hurst_regime == "MEAN_REVERTING":
        votes.append("MEAN_REVERTING")

    # Vote 2: ADX
    if adx_latest > 30:
        direction = "TRENDING_UP" if di_p_latest > di_m_latest else "TRENDING_DOWN"
        votes.append(direction)
    elif adx_latest < 15:
        votes.append("MEAN_REVERTING" if hurst < 0.48 else "DEAD")

    # Vote 3: HMM
    votes.append(hmm_regime)

    # Vote 4: Volatility extreme override
    if vol_pct > 0.90:
        votes.append("VOLATILE")
    elif vol_pct < 0.10:
        votes.append("DEAD")

    # Majority + priority
    from collections import Counter
    vote_counts = Counter(votes)
    final_regime = vote_counts.most_common(1)[0][0]

    # Confidence = agreement ratio
    total_votes = len(votes)
    top_count   = vote_counts.most_common(1)[0][1]
    confidence  = round(top_count / total_votes, 4)

    result["regime"]     = final_regime
    result["confidence"] = confidence
    result["components"] = {
        "hurst_regime": hurst_regime,
        "adx_regime":   "TRENDING" if adx_latest > 25 else ("WEAK" if adx_latest < 15 else "MODERATE"),
        "hmm_regime":   hmm_regime,
        "vol_extreme":  vol_pct > 0.90 or vol_pct < 0.10,
        "votes":        votes,
    }
    result["hmm_model"] = hmm_model  # return fitted model for reuse

    return result