"""
pumpwatch.data — Download and cache daily OHLCV data from yfinance.

* Downloads ~6 months of daily data per ticker.
* Caches to .cache/ (CSV) so reruns the same day skip the download.
* Skips tickers that fail, return empty data, or have < MIN_TRADING_DAYS rows.
* Supports --asof date filtering and --no-cache.
* Stable path resolution ensures cache and tickers.txt work from any CWD.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Optional, Union

import numpy as np
import pandas as pd
import yfinance as yf

from . import config

logger = logging.getLogger("pumpwatch.data")

# Absolute root directory of pumpwatch package
PACKAGE_DIR = Path(__file__).resolve().parent
PUMPWATCH_ROOT = PACKAGE_DIR.parent

# Cache directory (defaults to pumpwatch/.cache)
CACHE_DIR = Path(os.environ.get("PUMPWATCH_CACHE_DIR", PUMPWATCH_ROOT / ".cache"))
DEFAULT_TICKERS_PATH = PUMPWATCH_ROOT / "tickers.txt"
DEFAULT_OUTPUT_DIR = PUMPWATCH_ROOT / "output"


def _cache_path(ticker: str, today: str) -> Path:
    """Return the path for a cached CSV: .cache/<TICKER>_<YYYY-MM-DD>.csv"""
    safe = ticker.replace(".", "_")
    return CACHE_DIR / f"{safe}_{today}.csv"


def _download_one(yf_ticker: str) -> pd.DataFrame:
    """Download one ticker's history. Returns empty DF on any error."""
    try:
        t = yf.Ticker(yf_ticker)
        df = t.history(period=config.HISTORY_PERIOD, auto_adjust=True)
        if df is None or df.empty:
            return pd.DataFrame()
        # Keep only OHLCV columns and drop timezone from index
        df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
        df.index = df.index.tz_localize(None)
        return df
    except Exception as exc:
        logger.warning("yfinance error for %s: %s", yf_ticker, exc)
        return pd.DataFrame()


def load_tickers(path: Optional[Union[str, Path]] = None) -> list[str]:
    """Read tickers.txt and return a list of bare tickers (no suffix)."""
    target = Path(path) if path else DEFAULT_TICKERS_PATH
    if not target.exists():
        return []
    tickers: list[str] = []
    with open(target, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            tickers.append(line.upper().replace(".NS", ""))
    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for t in tickers:
        if t not in seen:
            seen.add(t)
            deduped.append(t)
    return deduped


def save_tickers(tickers: list[str], path: Optional[Union[str, Path]] = None) -> list[str]:
    """Save cleaned tickers list (no suffix, uppercase, unique, max 100) to tickers.txt."""
    target = Path(path) if path else DEFAULT_TICKERS_PATH
    cleaned: list[str] = []
    seen = set()
    for t in tickers:
        clean_t = t.strip().upper().replace(".NS", "")
        if clean_t and clean_t not in seen:
            seen.add(clean_t)
            cleaned.append(clean_t)
        if len(cleaned) >= 100:
            break

    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        f.write("# NSE Watchlist for PumpWatch Screen\n")
        for t in cleaned:
            f.write(f"{t}\n")
    return cleaned


def fetch_one(
    ticker: str,
    *,
    asof: Optional[str] = None,
    no_cache: bool = False,
) -> pd.DataFrame:
    """Fetch clean, validated historical DataFrame for a single ticker."""
    bare = ticker.upper().replace(".NS", "")
    today_str = date.today().isoformat()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    cache = _cache_path(bare, today_str)
    df = pd.DataFrame()

    if not no_cache and cache.exists():
        try:
            df = pd.read_csv(cache, index_col=0, parse_dates=True)
        except Exception:
            df = pd.DataFrame()

    if df.empty:
        yf_ticker = bare + config.TICKER_SUFFIX
        df = _download_one(yf_ticker)
        if not df.empty:
            try:
                df.to_csv(cache)
            except Exception as exc:
                logger.warning("Could not write cache for %s: %s", bare, exc)

    if df.empty:
        return pd.DataFrame()

    if asof:
        try:
            cutoff = pd.Timestamp(asof)
            df = df.loc[df.index <= cutoff]
        except Exception:
            pass

    df = df.dropna(subset=["Close"])
    df = df[df["Volume"] > 0]
    return df


def fetch_all(
    tickers: list[str],
    *,
    asof: Optional[str] = None,
    no_cache: bool = False,
) -> tuple[Dict[str, pd.DataFrame], list[str]]:
    """
    Download / load cached data for every ticker.

    Returns:
        (data_dict, skipped_list)
        data_dict maps bare ticker -> DataFrame (already trimmed to asof).
        skipped_list contains "TICKER: reason" strings.
    """
    data: Dict[str, pd.DataFrame] = {}
    skipped: list[str] = []

    for raw_ticker in tickers:
        bare = raw_ticker.upper().replace(".NS", "")
        df = fetch_one(bare, asof=asof, no_cache=no_cache)

        if df.empty:
            skipped.append(f"{bare}: no data returned")
            continue

        if len(df) < config.MIN_TRADING_DAYS:
            skipped.append(
                f"{bare}: only {len(df)} trading days (need {config.MIN_TRADING_DAYS})"
            )
            continue

        data[bare] = df

    return data, skipped


def get_chart_series(
    ticker_or_df: Union[str, pd.DataFrame],
    *,
    asof: Optional[str] = None,
    days: int = 120,
    use_cache: bool = True,
) -> dict:
    """
    Return ~120 trading days of OHLCV plus 20-day SMA, Bollinger Bands,
    and 20-day average volume for charting.
    Returns both parallel lists and records (list of dicts).
    """
    if isinstance(ticker_or_df, pd.DataFrame):
        df = ticker_or_df
    else:
        bare = ticker_or_df.upper().replace(".NS", "")
        df = fetch_one(bare, asof=asof, no_cache=not use_cache)
    if df.empty or len(df) < 5:
        return {
            "dates": [],
            "open": [],
            "high": [],
            "low": [],
            "close": [],
            "volume": [],
            "sma_20": [],
            "bb_upper": [],
            "bb_lower": [],
            "avg_volume_20": [],
            "records": [],
        }

    df = df.copy()
    close_s = df["Close"]
    vol_s = df["Volume"]

    sma_20 = close_s.rolling(window=config.BB_WINDOW).mean()
    std_20 = close_s.rolling(window=config.BB_WINDOW).std(ddof=0)
    bb_upper = sma_20 + config.BB_NUM_STD * std_20
    bb_lower = sma_20 - config.BB_NUM_STD * std_20
    avg_vol_20 = vol_s.rolling(window=config.VOLUME_WINDOW).mean()

    sub_df = df.tail(days)
    sub_sma = sma_20.tail(days)
    sub_bbu = bb_upper.tail(days)
    sub_bbl = bb_lower.tail(days)
    sub_av = avg_vol_20.tail(days)

    dates = [
        d.strftime("%Y-%m-%d") if hasattr(d, "strftime") else str(d)[:10]
        for d in sub_df.index
    ]
    opens = [round(float(x), 2) for x in sub_df["Open"]]
    highs = [round(float(x), 2) for x in sub_df["High"]]
    lows = [round(float(x), 2) for x in sub_df["Low"]]
    closes = [round(float(x), 2) for x in sub_df["Close"]]
    volumes = [int(x) for x in sub_df["Volume"]]
    smas = [round(float(x), 2) if pd.notna(x) else None for x in sub_sma]
    bb_uppers = [round(float(x), 2) if pd.notna(x) else None for x in sub_bbu]
    bb_lowers = [round(float(x), 2) if pd.notna(x) else None for x in sub_bbl]
    avg_vols = [int(x) if pd.notna(x) else None for x in sub_av]

    records = []
    for i in range(len(dates)):
        records.append({
            "date": dates[i],
            "open": opens[i],
            "high": highs[i],
            "low": lows[i],
            "close": closes[i],
            "volume": volumes[i],
            "sma_20": smas[i],
            "bb_upper": bb_uppers[i],
            "bb_lower": bb_lowers[i],
            "avg_volume_20": avg_vols[i],
        })

    return {
        "dates": dates,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
        "sma_20": smas,
        "bb_upper": bb_uppers,
        "bb_lower": bb_lowers,
        "avg_volume_20": avg_vols,
        "records": records,
    }
