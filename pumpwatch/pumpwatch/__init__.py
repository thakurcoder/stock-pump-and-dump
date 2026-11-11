"""pumpwatch — NSE Pump-and-Dump Screening Engine."""

from . import config, data, scoring, signals
from .data import (
    CACHE_DIR,
    DEFAULT_TICKERS_PATH,
    DEFAULT_OUTPUT_DIR,
    fetch_all,
    fetch_one,
    get_chart_series,
    load_tickers,
    save_tickers,
)
from .scoring import ComponentPoints, ScoreResult, score_stock
from .signals import SignalResult, compute
from .screen import DISCLAIMER, run_screen, run_screen_with_metadata

__all__ = [
    "config",
    "data",
    "signals",
    "scoring",
    "run_screen",
    "run_screen_with_metadata",
    "get_chart_series",
    "load_tickers",
    "save_tickers",
    "fetch_all",
    "fetch_one",
    "compute",
    "score_stock",
    "ComponentPoints",
    "ScoreResult",
    "SignalResult",
    "DISCLAIMER",
    "CACHE_DIR",
    "DEFAULT_TICKERS_PATH",
    "DEFAULT_OUTPUT_DIR",
]
