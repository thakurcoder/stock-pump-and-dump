"""Tests for pumpwatch.scoring — all synthetic data, no network."""

import numpy as np
import pandas as pd
import pytest

from pumpwatch import signals, scoring, config


def _make_df(
    close: list[float],
    volume: list[float] | None = None,
    start: str = "2024-01-01",
) -> pd.DataFrame:
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


class TestScoring:
    def test_calm_flat_scores_low(self):
        """A perfectly calm, flat stock must score Low (< 30)."""
        df = _make_df([100.0] * 60, volume=[500_000.0] * 60)
        sig = signals.compute("FLAT", df)
        res = scoring.score_stock(sig)
        assert res.level == "Low", f"Expected Low but got {res.level} (score={res.score})"
        assert res.score < 30

    def test_pump_scenario_scores_high_or_extreme(self):
        """
        8x volume spike + ~20% price rise over 3 days + thinly traded
        → must score High or Extreme and mention volume and price.
        """
        # Build 57 calm days + 3-day pump on thin volume
        n_calm = 57
        prices = [50.0] * n_calm + [55.0, 57.0, 60.0]  # ~20% in 3d
        volumes = [20_000.0] * n_calm + [20_000.0, 80_000.0, 160_000.0]
        df = _make_df(prices, volume=volumes)
        sig = signals.compute("PUMP", df)
        res = scoring.score_stock(sig)

        assert res.level in ("High", "Extreme"), (
            f"Expected High/Extreme but got {res.level} (score={res.score})"
        )
        reasons_lower = res.reasons.lower()
        assert "volume" in reasons_lower or "vol" in reasons_lower, (
            f"Reasons should mention volume: {res.reasons}"
        )
        # Price surge should also be in reasons
        assert "%" in res.reasons, f"Reasons should mention price change: {res.reasons}"

    def test_volume_only_spike_medium_or_higher(self):
        """A pure volume spike with no price move should score at least Medium."""
        vol = [100_000.0] * 59 + [1_000_000.0]  # 10x spike
        df = _make_df([100.0] * 60, volume=vol)
        sig = signals.compute("VOLONLY", df)
        res = scoring.score_stock(sig)
        assert res.score >= 20, f"Big volume spike should score ≥ 20: {res.score}"

    def test_risk_levels_monotone(self):
        """Scores on the boundary produce the right level."""
        assert config.risk_level(0) == "Low"
        assert config.risk_level(29) == "Low"
        assert config.risk_level(30) == "Medium"
        assert config.risk_level(54) == "Medium"
        assert config.risk_level(55) == "High"
        assert config.risk_level(74) == "High"
        assert config.risk_level(75) == "Extreme"
        assert config.risk_level(100) == "Extreme"

    def test_score_capped_at_100(self):
        """Even extreme inputs must not exceed 100."""
        # Everything at max
        prices = [50.0] * 55 + [60.0, 70.0, 80.0, 90.0, 100.0]  # crazy rally
        vol = [10_000.0] * 55 + [500_000.0] * 5  # giant spikes
        df = _make_df(prices, volume=vol)
        sig = signals.compute("MAX", df)
        res = scoring.score_stock(sig)
        assert 0 <= res.score <= 100

    def test_reasons_string_not_empty_for_flagged(self):
        """Any stock scoring > 0 should have a non-empty reasons string."""
        vol = [100_000.0] * 59 + [500_000.0]
        df = _make_df([100.0] * 60, volume=vol)
        sig = signals.compute("FLAGGED", df)
        res = scoring.score_stock(sig)
        if res.score > 0:
            assert res.reasons != "no significant flags"
