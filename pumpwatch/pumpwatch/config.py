"""
pumpwatch.config — All thresholds, weights, and constants in one place.

Edit the values below to make the screener stricter or looser.
"""

# ── Data Settings ────────────────────────────────────────────────────────────

TICKER_SUFFIX = ".NS"                 # yfinance suffix for NSE tickers
HISTORY_PERIOD = "6mo"                # how far back to download
MIN_TRADING_DAYS = 30                 # skip tickers with fewer rows

# ── Indicator Windows ────────────────────────────────────────────────────────

VOLUME_WINDOW = 20                    # days for volume average / z-score
RSI_PERIOD = 14                       # standard RSI lookback
BB_WINDOW = 20                        # Bollinger Band simple-moving-average
BB_NUM_STD = 2.0                      # number of standard deviations

# ── Liquidity ────────────────────────────────────────────────────────────────

LIQUIDITY_WINDOW = 20                 # days for average daily traded value
LIQUIDITY_THRESHOLD_CR = 5.0          # ₹ crore/day — below = "thinly traded"

# ── Scoring Weights (must sum to 100) ────────────────────────────────────────

W_VOLUME_SPIKE = 30                   # volume anomaly
W_PRICE_SURGE = 30                    # multi-day price momentum
W_OVERBOUGHT = 15                     # RSI + Bollinger overbought
W_LOW_LIQUIDITY = 15                  # thin trading penalty
W_CONFLUENCE = 10                     # vol + price spiking together

# ── Scaling Thresholds ───────────────────────────────────────────────────────
# Each component is scaled linearly from 0 to its max weight.

# Volume ratio: 1x = normal. Score starts rising > 1.5x, maxes at 8x.
VOL_RATIO_LOW = 1.5
VOL_RATIO_HIGH = 8.0

# Volume z-score: score starts rising > 1.0, maxes at 4.0
VOL_ZSCORE_LOW = 1.0
VOL_ZSCORE_HIGH = 4.0

# Price change (best of 1d/3d/5d): starts at 3%, maxes at 25%
PRICE_CHANGE_LOW = 3.0                # percent
PRICE_CHANGE_HIGH = 25.0              # percent

# RSI overbought: starts at 65, maxes at 90
RSI_OB_LOW = 65.0
RSI_OB_HIGH = 90.0

# Liquidity penalty: full penalty if avg turnover < 1 cr, zero at threshold
LIQ_PENALTY_FLOOR_CR = 1.0           # below this = full penalty

# Confluence bonus: both volume ratio > 2x AND best price change > 5%
CONF_VOL_RATIO_THRESH = 2.0
CONF_PRICE_CHANGE_THRESH = 5.0       # percent

# ── Risk Levels ──────────────────────────────────────────────────────────────

RISK_LEVELS = [
    (75, "Extreme"),
    (55, "High"),
    (30, "Medium"),
    (0,  "Low"),
]

# Standard dictionaries for API/client consumers
WEIGHTS = {
    "volume_spike": W_VOLUME_SPIKE,
    "price_surge": W_PRICE_SURGE,
    "overbought": W_OVERBOUGHT,
    "low_liquidity": W_LOW_LIQUIDITY,
    "confluence": W_CONFLUENCE,
}

THRESHOLDS = {
    "volume_ratio": {"low": VOL_RATIO_LOW, "high": VOL_RATIO_HIGH},
    "volume_zscore": {"low": VOL_ZSCORE_LOW, "high": VOL_ZSCORE_HIGH},
    "price_change": {"low": PRICE_CHANGE_LOW, "high": PRICE_CHANGE_HIGH},
    "rsi": {"low": RSI_OB_LOW, "high": RSI_OB_HIGH},
    "liquidity_threshold_cr": LIQUIDITY_THRESHOLD_CR,
    "liquidity_penalty_floor_cr": LIQ_PENALTY_FLOOR_CR,
    "confluence_volume_ratio": CONF_VOL_RATIO_THRESH,
    "confluence_price_change": CONF_PRICE_CHANGE_THRESH,
}

def risk_level(score: float) -> str:
    """Return the human-readable risk level for a given score."""
    for threshold, label in RISK_LEVELS:
        if score >= threshold:
            return label
    return "Low"
