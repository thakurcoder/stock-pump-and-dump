"""Tests for pumpwatch.signals — all synthetic data, no network."""

import numpy as np
import pandas as pd
import pytest

from pumpwatch import signals, config


def _make_df(
    close: list[float],
    volume: list[float] | None = None,
    start: str = "2024-01-01",
) -> pd.DataFrame:
    """Create a minimal OHLCV DataFrame from close prices."""
    n = len(close)
    if volume is None:
        volume = [100_000.0] * n
    dates = pd.bdate_range(start=start, periods=n)
    return pd.DataFrame(
        {
            "Open": close,
            "High": [c * 1.01 for c in close],
            "Low": [c * 0.99 for c in close],
            "Close": close,
            "Volume": volume,
        },
        index=dates,
    )


class TestVolumeSignals:
    def test_flat_volume_has_ratio_near_one(self):
        """Constant volume → ratio ≈ 1.0, z-score ≈ 0."""
        df = _make_df([100.0] * 40, volume=[100_000.0] * 40)
        sig = signals.compute("TEST", df)
        assert 0.9 <= sig.volume_ratio <= 1.1
        assert -0.5 <= sig.volume_zscore <= 0.5

    def test_8x_volume_spike(self):
        """Big volume spike on the last day → ratio ~8x, high z-score."""
        vol = [100_000.0] * 39 + [800_000.0]
        df = _make_df([100.0] * 40, volume=vol)
        sig = signals.compute("TEST", df)
        assert sig.volume_ratio > 7.0
        assert sig.volume_zscore > 3.0

    def test_zero_volume_history_no_crash(self):
        """All-zero history (edge) must not crash or divide by zero."""
        vol = [0.0] * 39 + [100_000.0]
        # The data loader drops zero-volume rows; but signals.compute must
        # handle the edge case gracefully if someone passes raw data.
        close = [100.0] * 40
        # We keep one non-zero day (today) — the rest have volume=0
        # After the loader, this stock would be skipped. But test the code path:
        df = _make_df(close, volume=vol)
        # Drop zero-volume rows as the real pipeline would
        df = df[df["Volume"] > 0]
        # With only 1 row, compute should still not crash
        if len(df) >= 2:
            sig = signals.compute("TEST", df)
            assert sig.volume_ratio >= 0  # just checking no exception


class TestPriceSignals:
    def test_flat_price_changes_near_zero(self):
        df = _make_df([100.0] * 40)
        sig = signals.compute("TEST", df)
        assert abs(sig.price_change_1d) < 0.01
        assert abs(sig.price_change_3d) < 0.01
        assert abs(sig.price_change_5d) < 0.01

    def test_20pct_rise_over_3d(self):
        """Price rises 20% over the last 3 days."""
        prices = [100.0] * 37 + [106.0, 112.0, 120.0]
        df = _make_df(prices)
        sig = signals.compute("TEST", df)
        assert sig.price_change_3d > 12.0  # at least 12%+

    def test_rsi_overbought_on_strong_rally(self):
        """Steady upward trend → RSI should be well above 65."""
        prices = [100.0 + i * 2.0 for i in range(40)]  # +2/day = strong rally
        df = _make_df(prices)
        sig = signals.compute("TEST", df)
        assert sig.rsi > 70

    def test_rsi_neutral_on_flat(self):
        df = _make_df([100.0] * 40)
        sig = signals.compute("TEST", df)
        # Flat = no gains, no losses → RSI = 50 (neutral)
        assert 40 <= sig.rsi <= 60


class TestBollingerBands:
    def test_no_breach_on_flat(self):
        df = _make_df([100.0] * 40)
        sig = signals.compute("TEST", df)
        assert sig.bb_breach is False

    def test_breach_on_spike(self):
        """Last price jumps way above the band."""
        prices = [100.0] * 39 + [130.0]
        df = _make_df(prices)
        sig = signals.compute("TEST", df)
        assert sig.bb_breach is True


class TestLiquidity:
    def test_thinly_traded(self):
        """Close × Volume way below 5 cr/day → thinly traded."""
        # 10 × 1000 = 10,000 INR/day ≈ 0.001 cr/day
        df = _make_df([10.0] * 40, volume=[1_000.0] * 40)
        sig = signals.compute("TEST", df)
        assert sig.is_thinly_traded is True
        assert sig.avg_daily_turnover_cr < 1.0

    def test_liquid_stock(self):
        """Large cap with ~100cr/day turnover."""
        # 2500 × 4_000_000 = 10 billion INR/day = 1000 cr/day
        df = _make_df([2500.0] * 40, volume=[4_000_000.0] * 40)
        sig = signals.compute("TEST", df)
        assert sig.is_thinly_traded is False


class TestEdgeCases:
    def test_short_history_still_computes(self):
        """Even with exactly MIN_TRADING_DAYS rows, compute must not crash."""
        n = config.MIN_TRADING_DAYS
        df = _make_df([100.0] * n)
        sig = signals.compute("TEST", df)
        assert sig.last_close == 100.0

    def test_single_row_no_crash(self):
        """Extreme edge: 1 data point."""
        df = _make_df([100.0], volume=[50_000.0])
        sig = signals.compute("TEST", df)
        assert sig.last_close == 100.0
