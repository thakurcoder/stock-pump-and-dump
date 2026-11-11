"""
pumpwatch.screen — Core screening orchestration.

Provides run_screen() and run_screen_with_metadata() as the single
source of truth for both the CLI and external callers like the FastAPI backend.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Dict, List, Optional

from . import config, data, scoring, signals

DISCLAIMER = (
    "Screening tool only. Flags suspicious patterns, not proof of manipulation."
)


def run_screen_with_metadata(
    tickers: Optional[List[str]] = None,
    *,
    asof: Optional[str] = None,
    use_cache: bool = True,
) -> Dict[str, Any]:
    """
    Execute full screening pipeline: data -> signals -> scoring.

    Returns:
        dict with:
            - "stocks": list of dicts for each scored stock, sorted by score descending
            - "counts": dict mapping risk level to count
            - "skipped": list of strings for skipped tickers
            - "asof": the asof date used or today's date
            - "total": total number of successfully scored stocks
            - "disclaimer": standard safety disclaimer text
    """
    if tickers is None:
        tickers = data.load_tickers()

    all_data, skipped = data.fetch_all(
        tickers, asof=asof, no_cache=not use_cache
    )

    scored_items: List[Dict[str, Any]] = []

    for ticker, df in all_data.items():
        try:
            sig = signals.compute(ticker, df)
            res = scoring.score_stock(sig)

            comp_dict = (
                res.component_points.to_dict()
                if res.component_points
                else {
                    "volume_spike": 0.0,
                    "price_surge": 0.0,
                    "overbought": 0.0,
                    "low_liquidity": 0.0,
                    "confluence": 0.0,
                }
            )

            scored_items.append({
                "ticker": res.ticker,
                "exchange": "NSE",
                "score": res.score,
                "level": res.level,
                "last_close": round(res.last_close, 2),
                "last_date": sig.last_date,
                "volume_ratio": round(sig.volume_ratio, 2),
                "volume_zscore": round(sig.volume_zscore, 2),
                "price_change_1d": round(sig.price_change_1d, 2),
                "price_change_3d": round(sig.price_change_3d, 2),
                "price_change_5d": round(sig.price_change_5d, 2),
                "rsi": round(sig.rsi, 1),
                "bb_upper": round(sig.bb_upper, 2),
                "bb_lower": round(sig.bb_lower, 2),
                "bb_breach": sig.bb_breach,
                "avg_turnover_cr": round(sig.avg_daily_turnover_cr, 2),
                "thinly_traded": sig.is_thinly_traded,
                "reasons": res.reasons,
                "component_points": comp_dict,
                # Convenience aliases for frontend compatibility
                "price": round(res.last_close, 2),
                "price_change_percent": round(sig.price_change_1d, 2),
                "volume": int(df["Volume"].iloc[-1]) if not df.empty else 0,
                "is_suspicious": res.level in ("High", "Extreme"),
                "risk_score": res.score,
                "risk_level": res.level.upper(),
                "last_updated": sig.last_date,
            })
        except Exception as exc:
            skipped.append(f"{ticker}: calculation error ({exc})")

    # Sort descending by score
    scored_items.sort(key=lambda s: s["score"], reverse=True)

    # Compute risk level counts
    counts = {"Extreme": 0, "High": 0, "Medium": 0, "Low": 0}
    for item in scored_items:
        lvl = item["level"]
        if lvl in counts:
            counts[lvl] += 1

    effective_date = asof or date.today().isoformat()

    return {
        "stocks": scored_items,
        "counts": counts,
        "skipped": skipped,
        "asof": effective_date,
        "total": len(scored_items),
        "disclaimer": DISCLAIMER,
    }


def run_screen(
    tickers: Optional[List[str]] = None,
    *,
    asof: Optional[str] = None,
    use_cache: bool = True,
) -> List[Dict[str, Any]]:
    """
    Run screen and return plain list of dicts.
    """
    return run_screen_with_metadata(tickers=tickers, asof=asof, use_cache=use_cache)["stocks"]
