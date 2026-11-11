"""
pumpwatch.scoring — Turn raw signals into a 0-100 risk score + reasons.

Scoring approach inspired by (but rewritten from) the SentinelMarket-Backend
risk_scorer.py Z-score-to-score mapping and weighted combination.
All thresholds and weights are pulled from config.py.
"""

from __future__ import annotations

from dataclasses import dataclass

from . import config
from .signals import SignalResult


@dataclass
class ComponentPoints:
    volume_spike: float
    price_surge: float
    overbought: float
    low_liquidity: float
    confluence: float

    def to_dict(self) -> dict[str, float]:
        return {
            "volume_spike": self.volume_spike,
            "price_surge": self.price_surge,
            "overbought": self.overbought,
            "low_liquidity": self.low_liquidity,
            "confluence": self.confluence,
        }


@dataclass
class ScoreResult:
    """Final scored result for one ticker."""

    ticker: str
    score: float          # 0–100
    level: str            # Low / Medium / High / Extreme
    last_close: float
    reasons: str          # human-readable summary

    # Keep raw signals for the CSV export
    signals: SignalResult
    component_points: ComponentPoints | None = None


def _scale(value: float, lo: float, hi: float, max_points: float) -> float:
    """
    Linearly scale *value* from [lo, hi] to [0, max_points].
    Below lo → 0.  Above hi → max_points.
    """
    if value <= lo:
        return 0.0
    if value >= hi:
        return max_points
    return max_points * (value - lo) / (hi - lo)


def score_stock(sig: SignalResult) -> ScoreResult:
    """
    Combine signals into a single risk score (0-100) and a reasons string.
    """

    parts: list[str] = []   # reason fragments

    # ── 1. Volume spike (30 pts) ─────────────────────────────────────────
    # Use the better of ratio-based and z-score-based scaling
    vol_ratio_pts = _scale(
        sig.volume_ratio,
        config.VOL_RATIO_LOW,
        config.VOL_RATIO_HIGH,
        config.W_VOLUME_SPIKE,
    )
    vol_zscore_pts = _scale(
        sig.volume_zscore,
        config.VOL_ZSCORE_LOW,
        config.VOL_ZSCORE_HIGH,
        config.W_VOLUME_SPIKE,
    )
    vol_pts = max(vol_ratio_pts, vol_zscore_pts)

    if vol_pts > 0:
        parts.append(f"Volume {sig.volume_ratio:.1f}x 20d avg (z={sig.volume_zscore:.1f})")

    # ── 2. Price surge (30 pts) ──────────────────────────────────────────
    best_change = max(sig.price_change_1d, sig.price_change_3d, sig.price_change_5d)
    price_pts = _scale(
        best_change,
        config.PRICE_CHANGE_LOW,
        config.PRICE_CHANGE_HIGH,
        config.W_PRICE_SURGE,
    )

    if price_pts > 0:
        # Mention the most impressive window
        if best_change == sig.price_change_1d:
            parts.append(f"+{sig.price_change_1d:.1f}% in 1d")
        elif best_change == sig.price_change_3d:
            parts.append(f"+{sig.price_change_3d:.1f}% in 3d")
        else:
            parts.append(f"+{sig.price_change_5d:.1f}% in 5d")

    # ── 3. Overbought — RSI + Bollinger (15 pts) ────────────────────────
    rsi_pts = _scale(
        sig.rsi,
        config.RSI_OB_LOW,
        config.RSI_OB_HIGH,
        config.W_OVERBOUGHT * 0.6,  # RSI gets 60% of the bucket
    )
    bb_pts = config.W_OVERBOUGHT * 0.4 if sig.bb_breach else 0.0
    ob_pts = min(rsi_pts + bb_pts, config.W_OVERBOUGHT)

    if sig.rsi > config.RSI_OB_LOW:
        parts.append(f"RSI {sig.rsi:.0f}")
    if sig.bb_breach:
        parts.append("above Bollinger upper band")

    # ── 4. Low liquidity (15 pts) ────────────────────────────────────────
    if sig.is_thinly_traded:
        # Full weight if below floor, linearly less up to threshold
        liq_pts = _scale(
            config.LIQUIDITY_THRESHOLD_CR - sig.avg_daily_turnover_cr,
            0.0,
            config.LIQUIDITY_THRESHOLD_CR - config.LIQ_PENALTY_FLOOR_CR,
            config.W_LOW_LIQUIDITY,
        )
        # Minimum some points if flagged at all
        liq_pts = max(liq_pts, config.W_LOW_LIQUIDITY * 0.3)
        parts.append(f"thinly traded ({sig.avg_daily_turnover_cr:.1f} cr/day)")
    else:
        liq_pts = 0.0

    # ── 5. Confluence bonus (10 pts) ─────────────────────────────────────
    vol_spike = sig.volume_ratio >= config.CONF_VOL_RATIO_THRESH
    price_spike = best_change >= config.CONF_PRICE_CHANGE_THRESH
    conf_pts = config.W_CONFLUENCE if (vol_spike and price_spike) else 0.0

    if conf_pts > 0:
        parts.append("volume + price surge together")

    # ── Total ────────────────────────────────────────────────────────────
    raw = vol_pts + price_pts + ob_pts + liq_pts + conf_pts
    final = min(max(raw, 0.0), 100.0)
    level = config.risk_level(final)
    reasons = ", ".join(parts) if parts else "no significant flags"

    component_points = ComponentPoints(
        volume_spike=round(vol_pts, 2),
        price_surge=round(price_pts, 2),
        overbought=round(ob_pts, 2),
        low_liquidity=round(liq_pts, 2),
        confluence=round(conf_pts, 2),
    )

    return ScoreResult(
        ticker=sig.ticker,
        score=round(final, 1),
        level=level,
        last_close=sig.last_close,
        reasons=reasons,
        signals=sig,
        component_points=component_points,
    )
