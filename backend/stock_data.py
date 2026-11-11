"""
Stock Data Fetcher for SentinelMarket
Fetches stock data from Yahoo Finance (one batched request, cached) with demo fallback.
"""

import threading
import time
from typing import Dict, List, Optional

import pandas as pd
import yfinance as yf

CACHE_TTL = 60            # seconds before cached data is refreshed
STALE_OK = 15 * 60        # keep serving the last good data this long if Yahoo fails
RETRY_BACKOFF = 30        # after a failed download, wait this long before trying again
DOWNLOAD_TIMEOUT = 20     # one batched request, so a generous timeout is fine

INDICES = [
    {"symbol": "^NSEI", "name": "NIFTY 50"},
    {"symbol": "^BSESN", "name": "SENSEX"},
    {"symbol": "^NSEBANK", "name": "BANK NIFTY"},
    {"symbol": "^CNXIT", "name": "NIFTY IT"},
]


class StockDataFetcher:
    """Fetches stock data from Yahoo Finance for NSE/BSE stocks"""

    def __init__(self, market_suffix: str = ".NS"):
        self.market_suffix = market_suffix
        self._lock = threading.Lock()
        self._hist_cache: Dict[tuple, tuple] = {}   # (ticker, period) -> (fetched_at, DataFrame)
        self._idx_cache: tuple = (0.0, [])          # (fetched_at, results)
        self._retry_after = 0.0
        self.last_error: Optional[str] = None
        self.last_success: Optional[float] = None

    # ── Yahoo download (batched) ──────────────────────────────────────────────

    def _download(self, symbols: List[str], period: str) -> Dict[str, pd.DataFrame]:
        """One request for all symbols. Returns {symbol: OHLCV DataFrame}; missing symbols are left out."""
        raw = yf.download(
            symbols,
            period=period,
            group_by="ticker",
            auto_adjust=False,      # raw prices, not dividend/split adjusted
            progress=False,
            threads=True,
            timeout=DOWNLOAD_TIMEOUT,
        )
        out: Dict[str, pd.DataFrame] = {}
        if raw is None or raw.empty:
            return out

        multi = isinstance(raw.columns, pd.MultiIndex)
        for sym in symbols:
            try:
                if multi:
                    if sym not in raw.columns.get_level_values(0):
                        continue
                    df = raw[sym].copy()
                else:
                    df = raw.copy()

                df = df.dropna(subset=["Close"])
                if df.empty:
                    continue

                idx = pd.to_datetime(df.index)
                if getattr(idx, "tz", None) is not None:
                    idx = idx.tz_localize(None)
                df.index = idx
                df.index.name = "Date"

                cols = [c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]
                out[sym] = df[cols].reset_index()
            except Exception as e:
                print(f"[StockData] Could not parse {sym}: {e}")
        return out

    def _refresh_history(self, tickers: List[str], period: str) -> None:
        symbols = [f"{t}{self.market_suffix}" for t in tickers]
        try:
            data = self._download(symbols, period)
        except Exception as e:
            data = {}
            self.last_error = f"{type(e).__name__}: {e}"
            print(f"[StockData] Download failed: {self.last_error}")

        now = time.time()
        for t in tickers:
            df = data.get(f"{t}{self.market_suffix}")
            if df is not None:
                self._hist_cache[(t, period)] = (now, df)

        if data:
            self.last_success, self.last_error = now, None
        else:
            self._retry_after = now + RETRY_BACKOFF
            self.last_error = self.last_error or "Yahoo returned no data (rate-limited or blocked?)"

    # ── Public API (same signatures as before) ────────────────────────────────

    def fetch_historical_data(self, ticker: str, period: str = "3mo") -> Optional[pd.DataFrame]:
        """Return OHLCV data for a ticker, or None (caller then uses demo data)."""
        key = (ticker, period)

        def cached(max_age: float) -> Optional[pd.DataFrame]:
            entry = self._hist_cache.get(key)
            if entry and time.time() - entry[0] < max_age:
                return entry[1].copy()
            return None

        df = cached(CACHE_TTL)
        if df is not None:
            return df

        with self._lock:
            df = cached(CACHE_TTL)          # another thread may have refreshed it while we waited
            if df is not None:
                return df
            if time.time() >= self._retry_after:
                # Refresh the whole watchlist in one request instead of 30 separate ones
                batch = POPULAR_NSE_STOCKS if ticker in POPULAR_NSE_STOCKS else [ticker]
                self._refresh_history(batch, period)

        return cached(STALE_OK)

    def fetch_market_indices(self) -> List[Dict]:
        """Real index values. Returns [] if Yahoo is unavailable (caller then uses demo data)."""
        now = time.time()
        ts, cached = self._idx_cache
        if cached and now - ts < CACHE_TTL:
            return list(cached)

        with self._lock:
            ts, cached = self._idx_cache
            if cached and time.time() - ts < CACHE_TTL:
                return list(cached)
            if time.time() < self._retry_after:
                return list(cached) if cached and time.time() - ts < STALE_OK else []

            try:
                # 5d so there are always at least two closes (weekends, holidays)
                data = self._download([i["symbol"] for i in INDICES], "5d")
            except Exception as e:
                data = {}
                self.last_error = f"{type(e).__name__}: {e}"
                print(f"[MarketIndex] Download failed: {self.last_error}")

            results = []
            for index in INDICES:
                df = data.get(index["symbol"])
                if df is None or len(df) < 1:
                    continue
                current = float(df["Close"].iloc[-1])
                prev = float(df["Close"].iloc[-2]) if len(df) >= 2 else float(df["Open"].iloc[-1])
                change = current - prev
                pct = (change / prev) * 100 if prev > 0 else 0
                results.append({
                    "symbol": index["name"],
                    "value": round(current, 2),
                    "change": round(change, 2),
                    "change_percent": round(pct, 2),
                    "positive": pct >= 0,
                })

            if results:
                self._idx_cache = (time.time(), results)
                return list(results)

            self._retry_after = time.time() + RETRY_BACKOFF
            return list(cached) if cached and time.time() - ts < STALE_OK else []

    def status(self) -> Dict:
        """How much of the data is live. Expose this from your API so the UI can show it."""
        now = time.time()
        live = sorted({t for (t, _), (ts, _) in self._hist_cache.items() if now - ts < STALE_OK})
        return {
            "live_tickers": len(live),
            "total_tickers": len(POPULAR_NSE_STOCKS),
            "last_success": self.last_success,
            "last_error": self.last_error,
        }

    @staticmethod
    def get_demo_indices() -> List[Dict]:
        """Generate realistic demo market index data"""
        import random

        demo_indices = [
            {"symbol": "NIFTY 50", "base": 24850, "range": 200},
            {"symbol": "SENSEX", "base": 82100, "range": 500},
            {"symbol": "BANK NIFTY", "base": 53200, "range": 300},
            {"symbol": "NIFTY IT", "base": 44800, "range": 400},
        ]

        results = []
        for idx in demo_indices:
            change_percent = random.uniform(-1.5, 1.5)
            value = idx["base"] + random.uniform(-idx["range"], idx["range"])
            results.append({
                "symbol": idx["symbol"],
                "value": round(value, 2),
                "change": round(value * change_percent / 100, 2),
                "change_percent": round(change_percent, 2),
                "positive": change_percent >= 0,
                "demo": True,
            })

        return results


POPULAR_NSE_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "HINDUNILVR", "ICICIBANK",
    "BHARTIARTL", "SBIN", "BAJFINANCE", "LICI", "ITC", "SUNPHARMA",
    "HCLTECH", "AXISBANK", "KOTAKBANK", "LT", "ASIANPAINT", "MARUTI",
    "TITAN", "ULTRACEMCO", "NESTLEIND", "WIPRO", "ONGC", "POWERGRID",
    "NTPC", "TECHM", "JSWSTEEL", "ADANIENT", "TMPV", "HDFCLIFE"
]

DEMO_PRICES = {
    "RELIANCE": 2450.50, "TCS": 3850.25, "HDFCBANK": 1650.75, "INFY": 1520.00,
    "HINDUNILVR": 2650.00, "ICICIBANK": 1050.50, "BHARTIARTL": 1250.25,
    "SBIN": 650.75, "BAJFINANCE": 7200.00, "LICI": 850.50, "ITC": 450.25,
    "SUNPHARMA": 1250.00, "HCLTECH": 1650.50, "AXISBANK": 1150.75,
    "KOTAKBANK": 1850.00, "LT": 3650.25, "ASIANPAINT": 3250.50,
    "MARUTI": 11250.00, "TITAN": 3850.75, "ULTRACEMCO": 8750.25,
    "NESTLEIND": 2450.00, "WIPRO": 450.50, "ONGC": 250.75,
    "POWERGRID": 280.25, "NTPC": 320.50, "TECHM": 1250.00,
    "JSWSTEEL": 850.75, "ADANIENT": 2850.25, "TMPV": 400.00,
    "HDFCLIFE": 650.00,
}