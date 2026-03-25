"""
Anomaly Detection Module
=========================
Detects unusual price and volume behaviour using three complementary engines:

1. Isolation Forest   — multivariate anomaly score across all features at once
2. Rolling Z-score    — local contextual deviation per feature, adaptive window
3. CUSUM              — cumulative sum test for structural mean-shift breaks

Output severity: CRITICAL | WARNING | WATCH | NORMAL
Each comes with a score (0–1), which features drove it, and engine-level breakdown.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler
import warnings
warnings.filterwarnings("ignore")


# ─── Feature Engineering ──────────────────────────────────────────────────────

def build_anomaly_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Construct anomaly-relevant features from OHLCV data.

    Features:
    - log_return          : bar-over-bar log return (price velocity)
    - abs_return          : absolute return (magnitude regardless of direction)
    - vol_ratio           : bar volume / rolling 20-bar avg volume (volume surge)
    - price_range_pct     : (High - Low) / Close — intrabar volatility
    - body_pct            : |Close - Open| / (High - Low + ε) — candle body fill
    - upper_wick_pct      : (High - max(Open,Close)) / (High - Low + ε)
    - lower_wick_pct      : (min(Open,Close) - Low) / (High - Low + ε)
    - vwap_deviation      : % deviation of Close from rolling VWAP
    - vol_price_corr      : rolling correlation between |return| and volume
    """
    close  = df["Close"].astype(float)
    high   = df["High"].astype(float)
    low    = df["Low"].astype(float)
    open_  = df["Open"].astype(float)
    volume = df["Volume"].astype(float)

    log_ret    = np.log(close / close.shift(1)).fillna(0)
    abs_ret    = log_ret.abs()
    hl_range   = (high - low).clip(lower=1e-9)

    vol_ma     = volume.rolling(20, min_periods=5).mean().fillna(volume)
    vol_ratio  = (volume / vol_ma.clip(lower=1e-9)).clip(upper=20)  # cap at 20x

    body_pct        = (close - open_).abs() / hl_range
    upper_wick_pct  = (high - pd.concat([close, open_], axis=1).max(axis=1)) / hl_range
    lower_wick_pct  = (pd.concat([close, open_], axis=1).min(axis=1) - low) / hl_range
    price_range_pct = hl_range / close

    # VWAP deviation (rolling 20-bar VWAP)
    typical_price  = (high + low + close) / 3
    cum_tp_vol     = (typical_price * volume).rolling(20, min_periods=5).sum()
    cum_vol        = volume.rolling(20, min_periods=5).sum().clip(lower=1e-9)
    vwap           = cum_tp_vol / cum_vol
    vwap_dev       = ((close - vwap) / vwap.clip(lower=1e-9)).fillna(0)

    # Rolling |return|–volume correlation (trend/anomaly signal)
    vol_price_corr = abs_ret.rolling(10, min_periods=5).corr(volume).fillna(0)

    features = pd.DataFrame({
        "log_return":       log_ret,
        "abs_return":       abs_ret,
        "vol_ratio":        vol_ratio,
        "price_range_pct":  price_range_pct,
        "body_pct":         body_pct,
        "upper_wick_pct":   upper_wick_pct,
        "lower_wick_pct":   lower_wick_pct,
        "vwap_deviation":   vwap_dev,
        "vol_price_corr":   vol_price_corr,
    }, index=df.index)

    return features.fillna(0)


# ─── Engine 1: Isolation Forest ───────────────────────────────────────────────

class IsolationForestDetector:
    """
    Unsupervised multivariate anomaly detector.
    Scores every bar on ALL features simultaneously.
    contamination=0.02 means ~2% of bars are expected to be anomalous.
    """

    def __init__(self, contamination: float = 0.02, n_estimators: int = 200):
        self.model   = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.scaler  = RobustScaler()   # RobustScaler handles fat-tailed finance data better
        self.fitted  = False

    def fit(self, features: pd.DataFrame):
        scaled = self.scaler.fit_transform(features)
        self.model.fit(scaled)
        self.fitted = True
        return self

    def score_series(self, features: pd.DataFrame) -> pd.Series:
        """
        Returns anomaly score in [0, 1] for every bar.
        Higher = more anomalous.
        IsolationForest returns raw scores in (−0.5, 0.5); we rescale to [0,1].
        """
        if not self.fitted:
            raise RuntimeError("Fit the model first.")
        scaled      = self.scaler.transform(features)
        raw_scores  = self.model.score_samples(scaled)            # more negative = more anomalous
        normalised  = 1 - (raw_scores - raw_scores.min()) / (raw_scores.ptp() + 1e-9)
        return pd.Series(normalised, index=features.index)

    def score_latest(self, features: pd.DataFrame) -> float:
        return float(self.score_series(features).iloc[-1])


# ─── Engine 2: Rolling Z-Score ────────────────────────────────────────────────

def rolling_zscore_anomaly(
    features: pd.DataFrame,
    window: int = 30,
    top_n: int = 4,
) -> pd.Series:
    """
    For each bar, compute the z-score of each feature within a rolling window.
    Take the mean of the top_n absolute z-scores as the composite anomaly score.
    Normalise to [0, 1] using a sigmoid-like squash so extreme outliers don't dominate.

    window  : lookback for rolling mean + std (30 bars = ~1.5 months on daily)
    top_n   : use the worst N features per bar (avoids dilution by stable features)
    """
    z_scores = pd.DataFrame(index=features.index)

    for col in features.columns:
        roll_mean = features[col].rolling(window, min_periods=10).mean()
        roll_std  = features[col].rolling(window, min_periods=10).std().clip(lower=1e-9)
        z_scores[col] = (features[col] - roll_mean) / roll_std

    z_abs = z_scores.abs().fillna(0)

    # Per-bar: average of worst top_n z-scores
    composite = z_abs.apply(
        lambda row: row.nlargest(top_n).mean(), axis=1
    )

    # Squash: tanh-based mapping so a z=2 → ~0.48, z=4 → ~0.75, z=8 → ~0.96
    squashed = np.tanh(composite / 4.0)
    return pd.Series(squashed.values, index=features.index)


# ─── Engine 3: CUSUM ──────────────────────────────────────────────────────────

def cusum_anomaly(
    series: pd.Series,
    drift: float = 0.5,
    threshold: float = 5.0,
    window: int = 60,
) -> pd.Series:
    """
    CUSUM (Cumulative Sum control chart) detects when the mean of `series`
    has shifted beyond what normal variation can explain.

    Works on a single series — we run it on both log_return and vol_ratio
    and take the max.

    drift     : allowance for natural variation (in std units); 0.5 is standard
    threshold : control limit (in std units); 5.0 = alert when 5σ cumulative shift
    window    : rolling window for computing adaptive std
    """
    roll_std  = series.rolling(window, min_periods=20).std().clip(lower=1e-9)
    roll_mean = series.rolling(window, min_periods=20).mean()
    z         = (series - roll_mean) / roll_std

    cusum_pos = pd.Series(0.0, index=series.index)
    cusum_neg = pd.Series(0.0, index=series.index)

    for i in range(1, len(z)):
        cusum_pos.iloc[i] = max(0, cusum_pos.iloc[i-1] + z.iloc[i] - drift)
        cusum_neg.iloc[i] = max(0, cusum_neg.iloc[i-1] - z.iloc[i] - drift)

    # Combine both arms; normalise by threshold so 1.0 = alarm level
    raw_score = (cusum_pos + cusum_neg) / threshold
    squashed  = np.tanh(raw_score / 2.0)
    return pd.Series(squashed.values, index=series.index)


# ─── Severity Classification ──────────────────────────────────────────────────

SEVERITY_LEVELS = ["CRITICAL", "WARNING", "WATCH", "NORMAL"]

def score_to_severity(score: float) -> str:
    if score >= 0.85:
        return "CRITICAL"
    elif score >= 0.65:
        return "WARNING"
    elif score >= 0.45:
        return "WATCH"
    else:
        return "NORMAL"


# ─── Master Anomaly Detector ──────────────────────────────────────────────────

class AnomalyDetector:
    """
    Three-engine anomaly detector for price + volume.

    Usage:
        detector = AnomalyDetector()
        detector.fit(df_train)
        result   = detector.detect_latest(df)   # single-bar result dict
        series   = detector.detect_sequence(df) # full historical anomaly series
    """

    # Engine weights (must sum to 1.0)
    WEIGHTS = {
        "isolation_forest": 0.45,
        "rolling_zscore":   0.35,
        "cusum":            0.20,
    }

    def __init__(self, contamination: float = 0.02):
        self.if_detector = IsolationForestDetector(contamination=contamination)
        self.fitted      = False

    def fit(self, df: pd.DataFrame):
        """Fit the Isolation Forest on training data (at least 60 bars recommended)."""
        features = build_anomaly_features(df)
        self.if_detector.fit(features)
        self.fitted = True
        return self

    def _compute_all_scores(self, df: pd.DataFrame) -> pd.DataFrame:
        """Returns a DataFrame with per-bar scores from all three engines."""
        features = build_anomaly_features(df)

        if_scores   = self.if_detector.score_series(features)
        z_scores    = rolling_zscore_anomaly(features)

        # CUSUM on both log_return and vol_ratio; take the max (worst case)
        cusum_ret   = cusum_anomaly(features["log_return"])
        cusum_vol   = cusum_anomaly(features["vol_ratio"])
        cusum_score = pd.concat([cusum_ret, cusum_vol], axis=1).max(axis=1)

        scores = pd.DataFrame({
            "isolation_forest": if_scores,
            "rolling_zscore":   z_scores,
            "cusum":            cusum_score,
        }, index=df.index)

        scores["composite"] = (
            scores["isolation_forest"] * self.WEIGHTS["isolation_forest"] +
            scores["rolling_zscore"]   * self.WEIGHTS["rolling_zscore"]   +
            scores["cusum"]            * self.WEIGHTS["cusum"]
        )

        return scores

    def detect_latest(self, df: pd.DataFrame) -> dict:
        """
        Full anomaly analysis for the latest (most recent) bar.

        Returns
        -------
        dict with keys:
            severity          : CRITICAL | WARNING | WATCH | NORMAL
            composite_score   : float [0, 1]
            engine_scores     : dict of per-engine scores
            top_features      : list of (feature_name, z_score) sorted by severity
            components        : detailed breakdown
        """
        if not self.fitted:
            raise RuntimeError("Call fit() first.")

        scores   = self._compute_all_scores(df)
        features = build_anomaly_features(df)

        composite = float(scores["composite"].iloc[-1])
        severity  = score_to_severity(composite)

        # Top contributing features (by rolling z-score for interpretability)
        window    = 30
        z_latest  = {}
        for col in features.columns:
            roll_mean = features[col].rolling(window, min_periods=10).mean().iloc[-1]
            roll_std  = features[col].rolling(window, min_periods=10).std().clip(lower=1e-9).iloc[-1]
            z_latest[col] = abs((features[col].iloc[-1] - roll_mean) / roll_std)

        top_features = sorted(z_latest.items(), key=lambda x: x[1], reverse=True)[:3]

        return {
            "severity":        severity,
            "composite_score": round(composite, 4),
            "engine_scores": {
                "isolation_forest": round(float(scores["isolation_forest"].iloc[-1]), 4),
                "rolling_zscore":   round(float(scores["rolling_zscore"].iloc[-1]),   4),
                "cusum":            round(float(scores["cusum"].iloc[-1]),             4),
            },
            "top_features": [(f, round(z, 2)) for f, z in top_features],
            "components": {
                "feature_snapshot": {
                    col: round(float(features[col].iloc[-1]), 6)
                    for col in features.columns
                },
                "engine_weights":   self.WEIGHTS,
                "score_percentile": round(
                    float((scores["composite"] <= composite).mean()), 4
                ),
            },
        }

    def detect_sequence(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Full anomaly scores for every bar — useful for backtesting and charting.

        Returns DataFrame with columns:
            composite_score, severity, isolation_forest, rolling_zscore, cusum
        """
        if not self.fitted:
            raise RuntimeError("Call fit() first.")

        scores = self._compute_all_scores(df)
        scores["severity"] = scores["composite"].apply(score_to_severity)
        return scores