"""
pumpwatch.signals — Compute screening indicators from daily OHLCV data.

All calculations are as-of the last row of the DataFrame (the latest or
--asof trading day).  The DataFrame index must be a DatetimeIndex sorted
ascending with columns: Open, High, Low, Close, Volume.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from . import config


@dataclass
class SignalResult:
    """Container for all computed signals for one ticker."""

    ticker: str
    last_close: float
    last_date: str

    # Volume
    volume_ratio: float          # today vol / 20d avg (excl today)
    volume_zscore: float         # z-score of today vol vs 20d (excl today)

    # Price momentum
    price_change_1d: float       # percent
    price_change_3d: float       # percent
    price_change_5d: float       # percent

    # RSI
    rsi: float                   # 0–100

    # Bollinger Bands
    bb_upper: float
    bb_lower: float
    bb_breach: bool              # close > upper band

    # Liquidity
    avg_daily_turnover_cr: float # ₹ crore
    is_thinly_traded: bool

    error: Optional[str] = None


def compute(ticker: str, df: pd.DataFrame) -> SignalResult:
    """Compute all signals for *ticker* from its OHLCV DataFrame."""

    close = df["Close"].values.astype(float)
    volume = df["Volume"].values.astype(float)
    n = len(close)

    last_close = float(close[-1])
    last_date = str(df.index[-1].date())

    # ── Volume ratio & z-score ───────────────────────────────────────────
    w = config.VOLUME_WINDOW
    if n > w:
        hist_vol = volume[-(w + 1):-1]  # 20 days excluding today
    else:
        hist_vol = volume[:-1] if n > 1 else np.array([1.0])

    mean_vol = float(np.mean(hist_vol)) if len(hist_vol) > 0 else 1.0
    std_vol = float(np.std(hist_vol, ddof=0)) if len(hist_vol) > 1 else 0.0
    today_vol = float(volume[-1])

    volume_ratio = today_vol / mean_vol if mean_vol > 0 else 0.0
    if std_vol > 0:
        volume_zscore = (today_vol - mean_vol) / std_vol
    elif today_vol > mean_vol and mean_vol > 0:
        volume_zscore = (today_vol - mean_vol) / (0.01 * mean_vol)
    else:
        volume_zscore = 0.0

    # ── Price changes ────────────────────────────────────────────────────
    def _pct(days: int) -> float:
        if n > days and close[-1 - days] != 0:
            return ((close[-1] - close[-1 - days]) / close[-1 - days]) * 100
        return 0.0

    price_change_1d = _pct(1)
    price_change_3d = _pct(3)
    price_change_5d = _pct(5)

    # ── RSI (Wilder-style smoothed) ──────────────────────────────────────
    # Adapted threshold logic from SentinelMarket-Backend risk_scorer.py
    # (RSI calculation approach). Written fresh with Wilder smoothing.
    rsi = _compute_rsi(close, config.RSI_PERIOD)

    # ── Bollinger Bands ──────────────────────────────────────────────────
    bb_upper, bb_lower, bb_breach = _compute_bollinger(
        close, config.BB_WINDOW, config.BB_NUM_STD
    )

    # ── Liquidity ────────────────────────────────────────────────────────
    lw = config.LIQUIDITY_WINDOW
    recent_tv = (close[-lw:] * volume[-lw:]) if n >= lw else (close * volume)
    avg_daily_turnover_cr = float(np.mean(recent_tv)) / 1e7  # 1 cr = 1e7
    is_thinly_traded = avg_daily_turnover_cr < config.LIQUIDITY_THRESHOLD_CR

    return SignalResult(
        ticker=ticker,
        last_close=last_close,
        last_date=last_date,
        volume_ratio=volume_ratio,
        volume_zscore=volume_zscore,
        price_change_1d=price_change_1d,
        price_change_3d=price_change_3d,
        price_change_5d=price_change_5d,
        rsi=rsi,
        bb_upper=bb_upper,
        bb_lower=bb_lower,
        bb_breach=bb_breach,
        avg_daily_turnover_cr=avg_daily_turnover_cr,
        is_thinly_traded=is_thinly_traded,
    )


# ── Helpers ──────────────────────────────────────────────────────────────────


def _compute_rsi(close: np.ndarray, period: int) -> float:
    """RSI with Wilder exponential smoothing."""
    if len(close) < period + 1:
        return 50.0  # neutral if not enough data

    deltas = np.diff(close)
    gains = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)

    # Seed with SMA of first `period` changes
    avg_gain = float(np.mean(gains[:period]))
    avg_loss = float(np.mean(losses[:period]))

    # Wilder smoothing for the rest
    for i in range(period, len(gains)):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period

    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100.0 - (100.0 / (1.0 + rs))


def _compute_bollinger(
    close: np.ndarray, window: int, num_std: float
) -> tuple[float, float, bool]:
    """Return (upper_band, lower_band, breach_flag)."""
    if len(close) < window:
        return 0.0, 0.0, False

    sma = float(np.mean(close[-window:]))
    std = float(np.std(close[-window:], ddof=0))

    upper = sma + num_std * std
    lower = sma - num_std * std
    breach = float(close[-1]) > upper

    return upper, lower, breach
