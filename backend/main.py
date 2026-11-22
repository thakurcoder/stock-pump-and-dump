"""
SentinelMarket / Pumpwatch Backend API
FastAPI backend powered by pumpwatch as the screening engine.
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import pytz
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pumpwatch
from pumpwatch import config as pw_config

# ── App Definition ────────────────────────────────────────────────────────────

app = FastAPI(
    title="SentinelMarket / Pumpwatch API",
    description="Real-Time Pump & Dump Scheme Detection powered by pumpwatch",
    version="2.0.0",
)

# Allow requests from frontend (Next.js typically runs on 3000, 3001, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

executor = ThreadPoolExecutor(max_workers=4)

# 15-minute in-memory cache for screen results: (tuple(tickers), asof) -> (timestamp, data)
SCREEN_CACHE_TTL = 15 * 60  # 15 minutes
_screen_cache: Dict[tuple, tuple[float, Dict[str, Any]]] = {}

# 5-minute cache for market indices
INDEX_CACHE_TTL = 5 * 60
_indices_cache: tuple[float, List[Dict[str, Any]]] = (0.0, [])


# ── Pydantic Models ───────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "pumpwatch-backend"
    timestamp: str
    version: str = "2.0.0"


class ComponentPointsModel(BaseModel):
    volume_spike: float = 0.0
    price_surge: float = 0.0
    overbought: float = 0.0
    low_liquidity: float = 0.0
    confluence: float = 0.0


class StockScreenItem(BaseModel):
    ticker: str
    exchange: str = "NSE"
    score: float
    level: str
    last_close: float
    last_date: str
    volume_ratio: float
    volume_zscore: float
    price_change_1d: float
    price_change_3d: float
    price_change_5d: float
    rsi: float
    bb_upper: float
    bb_lower: float
    bb_breach: bool
    avg_turnover_cr: float
    thinly_traded: bool
    reasons: str
    component_points: ComponentPointsModel
    # Frontend aliases
    price: float
    price_change_percent: float
    volume: int
    is_suspicious: bool
    risk_score: float
    risk_level: str
    last_updated: str
    demo: bool = False


class ScreenResponse(BaseModel):
    stocks: List[StockScreenItem]
    counts: Dict[str, int]
    skipped: List[str]
    asof: str
    total: int
    disclaimer: str


class ChartPoint(BaseModel):
    date: str
    close: float
    volume: int
    sma20: Optional[float] = None
    bb_upper: Optional[float] = None
    bb_lower: Optional[float] = None
    avg_volume20: Optional[float] = None


class StockDetailResponse(BaseModel):
    ticker: str
    exchange: str = "NSE"
    risk_score: float
    risk_level: str
    score: float
    level: str
    is_suspicious: bool
    price: float
    price_change_percent: float
    volume: int
    last_updated: str
    demo: bool = False
    reasons: str
    recommendation: str
    explanation: str
    red_flags: List[str]
    individual_scores: Dict[str, float]
    component_points: ComponentPointsModel
    signals: Dict[str, Any]
    chart_data: List[ChartPoint]


class WatchlistResponse(BaseModel):
    tickers: List[str]
    total: int
    file_path: str


class WatchlistUpdatePayload(BaseModel):
    tickers: List[str] = Field(..., max_length=100)


class ConfigResponse(BaseModel):
    thresholds: Dict[str, Any]
    weights: Dict[str, Any]
    risk_levels: List[Any]


NIFTY_50_TICKERS = [
    "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
    "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BPCL",
    "BHARTIARTL", "BRITANNIA", "CIPLA", "COALINDIA", "DRREDDY",
    "EICHERMOT", "GRASIM", "HCLTECH", "HDFCBANK", "HDFCLIFE",
    "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK", "INDUSINDBK",
    "INFY", "ITC", "JSWSTEEL", "KOTAKBANK", "LT",
    "M&M", "MARUTI", "NESTLEIND", "NTPC", "ONGC",
    "POWERGRID", "RELIANCE", "SBILIFE", "SHRIRAMFIN", "SBIN",
    "SUNPHARMA", "TCS", "TATACONSUM", "TATAMOTORS", "TATASTEEL",
    "TECHM", "TITAN", "TRENT", "ULTRACEMCO", "WIPRO"
]


# ── Helper Functions ──────────────────────────────────────────────────────────

def _run_screening_sync(tickers: Optional[List[str]], asof: Optional[str], refresh: bool) -> Dict[str, Any]:
    if tickers is None:
        raw_tickers = pumpwatch.load_tickers()
    else:
        raw_tickers = tickers

    cache_key = (tuple(sorted(raw_tickers)), asof or "")
    now = time.time()

    if not refresh and cache_key in _screen_cache:
        cached_time, cached_res = _screen_cache[cache_key]
        if now - cached_time < SCREEN_CACHE_TTL:
            return cached_res

    # Run pumpwatch screening pipeline
    result = pumpwatch.run_screen_with_metadata(
        raw_tickers, asof=asof, use_cache=(not refresh)
    )
    _screen_cache[cache_key] = (now, result)
    return result


def _format_detail_response(ticker: str, asof: Optional[str] = None) -> Dict[str, Any]:
    clean_ticker = ticker.upper().replace(".NS", "").strip()
    df = pumpwatch.fetch_one(clean_ticker, asof=asof)
    if df is None or len(df) < 5:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stock '{clean_ticker}' not found or insufficient trading history.",
        )

    sig = pumpwatch.compute(clean_ticker, df)
    score_res = pumpwatch.score_stock(sig)

    comp_dict = (
        score_res.component_points.to_dict()
        if score_res.component_points
        else {
            "volume_spike": 0.0,
            "price_surge": 0.0,
            "overbought": 0.0,
            "low_liquidity": 0.0,
            "confluence": 0.0,
        }
    )

    # Individual scores scaled 0-100 for the frontend radar/gauge detectors
    w = pw_config.WEIGHTS
    ind_scores = {
        "volume_spike": round((comp_dict["volume_spike"] / w["volume_spike"]) * 100, 1) if w.get("volume_spike") else 0.0,
        "price_anomaly": round((comp_dict["price_surge"] / w["price_surge"]) * 100, 1) if w.get("price_surge") else 0.0,
        "ml_anomaly": round((comp_dict["overbought"] / w["overbought"]) * 100, 1) if w.get("overbought") else 0.0,
        "social_sentiment": round((comp_dict["confluence"] / w["confluence"]) * 100, 1) if w.get("confluence") else 0.0,
    }

    # Red flags based on signals
    red_flags: List[str] = []
    if sig.volume_ratio >= 3.0:
        red_flags.append(f"Abnormal volume spike: {sig.volume_ratio:.1f}x 20-day average")
    if sig.volume_zscore >= 3.0:
        red_flags.append(f"Volume statistical anomaly (Z-score: +{sig.volume_zscore:.2f}σ)")
    if sig.price_change_3d >= 15.0:
        red_flags.append(f"Aggressive 3-day rally (+{sig.price_change_3d:.1f}%)")
    if sig.bb_breach:
        red_flags.append(f"Price breached upper Bollinger Band (₹{sig.bb_upper:.2f})")
    if sig.rsi >= 75.0:
        red_flags.append(f"Extreme RSI overbought condition (RSI: {sig.rsi:.1f})")
    if sig.is_thinly_traded:
        red_flags.append(f"Thinly traded / illiquid: ₹{sig.avg_daily_turnover_cr:.2f} Cr/day")
    if not red_flags:
        red_flags.append("Trading telemetry within baseline expectations")

    flagged = score_res.level in ("High", "Extreme")
    rec = (
        "High caution — Elevated pump-and-dump probability. Avoid opening long positions."
        if flagged
        else "Standard monitoring recommended — No severe anomaly cluster detected."
    )
    explanation = score_res.reasons or f"{clean_ticker} is trading within normal volume and price limits."

    # Chart series
    series = pumpwatch.get_chart_series(df, days=120)
    chart_data = []
    dates = series.get("dates", [])
    closes = series.get("close", [])
    vols = series.get("volume", [])
    smas = series.get("sma_20", [])
    bb_u = series.get("bb_upper", [])
    bb_l = series.get("bb_lower", [])
    avg_v = series.get("avg_volume_20", [])

    for i in range(len(dates)):
        chart_data.append({
            "date": dates[i],
            "close": closes[i],
            "volume": vols[i],
            "sma20": smas[i] if i < len(smas) else None,
            "bb_upper": bb_u[i] if i < len(bb_u) else None,
            "bb_lower": bb_l[i] if i < len(bb_l) else None,
            "avg_volume20": avg_v[i] if i < len(avg_v) else None,
        })

    last_vol = int(df["Volume"].iloc[-1]) if not df.empty else 0

    return {
        "ticker": clean_ticker,
        "exchange": "NSE",
        "risk_score": score_res.score,
        "risk_level": score_res.level.upper(),
        "score": score_res.score,
        "level": score_res.level,
        "is_suspicious": flagged,
        "price": round(score_res.last_close, 2),
        "price_change_percent": round(sig.price_change_1d, 2),
        "volume": last_vol,
        "last_updated": sig.last_date,
        "demo": False,
        "reasons": score_res.reasons,
        "recommendation": rec,
        "explanation": explanation,
        "red_flags": red_flags,
        "individual_scores": ind_scores,
        "component_points": comp_dict,
        "signals": {
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
        },
        "chart_data": chart_data,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.api_route("/", methods=["GET", "HEAD"])
async def root():
    return {
        "service": "SentinelMarket / Pumpwatch API",
        "status": "healthy",
        "version": "2.0.0",
        "disclaimer": pumpwatch.DISCLAIMER,
    }


@app.api_route("/health", methods=["GET", "HEAD"], response_model=HealthResponse)
@app.api_route("/api/health", methods=["GET", "HEAD"], response_model=HealthResponse)
async def health():
    return {
        "status": "healthy",
        "service": "pumpwatch-backend",
        "timestamp": datetime.now(pytz.utc).isoformat(),
        "version": "2.0.0",
    }


def _fetch_indices_sync() -> List[Dict[str, Any]]:
    global _indices_cache
    cached_time, cached_data = _indices_cache
    now = time.time()
    if cached_data and (now - cached_time < INDEX_CACHE_TTL):
        return cached_data

    index_map = [
        ("^NSEI", "NIFTY 50"),
        ("^NSEBANK", "NIFTY BANK"),
        ("^CNXIT", "NIFTY IT"),
    ]
    results = []
    try:
        import yfinance as yf
        for symbol, name in index_map:
            try:
                t = yf.Ticker(symbol)
                h = t.history(period="5d")
                if len(h) >= 2:
                    c_last = float(h["Close"].iloc[-1])
                    c_prev = float(h["Close"].iloc[-2])
                    chg = c_last - c_prev
                    chg_pct = (chg / c_prev) * 100 if c_prev != 0 else 0.0
                    results.append({
                        "symbol": name,
                        "value": round(c_last, 2),
                        "change": round(chg, 2),
                        "change_percent": round(chg_pct, 2),
                        "positive": chg >= 0,
                    })
                elif len(h) == 1:
                    c_last = float(h["Close"].iloc[-1])
                    results.append({
                        "symbol": name,
                        "value": round(c_last, 2),
                        "change": 0.0,
                        "change_percent": 0.0,
                        "positive": True,
                    })
            except Exception:
                continue
    except Exception:
        pass

    if not results and cached_data:
        return cached_data
    elif results:
        _indices_cache = (now, results)
        return results

    return []


@app.get("/api/market-indices")
async def get_market_indices():
    """
    Market status and live market index telemetry from Yahoo Finance.
    """
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.now(ist)
    minutes = now_ist.hour * 60 + now_ist.minute
    is_open = now_ist.weekday() < 5 and (9 * 60 + 15 <= minutes < 15 * 60 + 30)

    loop = asyncio.get_running_loop()
    indices = await loop.run_in_executor(executor, _fetch_indices_sync)

    return {
        "indices": indices,
        "timestamp": now_ist.isoformat(),
        "market_status": "open" if is_open else "closed",
    }


@app.get("/api/screen", response_model=ScreenResponse)
async def screen_stocks(
    top: Optional[int] = Query(None, ge=1, le=500, description="Limit to top N stocks"),
    min_score: int = Query(0, ge=0, le=100, description="Minimum risk score"),
    asof: Optional[str] = Query(None, description="As-of date in YYYY-MM-DD format"),
    refresh: bool = Query(False, description="Bypass in-memory and disk cache"),
    hide_liquid: bool = Query(False, description="Hide large liquid stocks (show only thinly traded)"),
    universe: str = Query("watchlist", description="Stock universe: 'watchlist' or 'nifty50'"),
):
    if asof:
        try:
            datetime.strptime(asof, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid asof format. Expected YYYY-MM-DD.",
            )

    target_tickers = NIFTY_50_TICKERS if universe.lower() == "nifty50" else None

    try:
        loop = asyncio.get_running_loop()
        data = await loop.run_in_executor(executor, _run_screening_sync, target_tickers, asof, refresh)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Screening engine encountered an upstream error: {exc}",
        )

    stocks = data["stocks"]
    if min_score > 0:
        stocks = [s for s in stocks if s["score"] >= min_score]
    if hide_liquid:
        stocks = [s for s in stocks if s.get("thinly_traded", False)]
    if top is not None:
        stocks = stocks[:top]

    return {
        "stocks": stocks,
        "counts": data.get("counts", {}),
        "skipped": data.get("skipped", []),
        "asof": data.get("asof", str(date.today())),
        "total": len(stocks),
        "disclaimer": data.get("disclaimer", pumpwatch.DISCLAIMER),
    }


@app.get("/api/stocks", response_model=Dict[str, Any])
async def get_stocks_compat(
    exchange: Optional[str] = Query(None),
    risk_level: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    refresh: bool = Query(False),
):
    """
    Backward-compatible endpoint matching the frontend's original /api/stocks shape,
    backed by real pumpwatch screening.
    """
    loop = asyncio.get_running_loop()
    try:
        data = await loop.run_in_executor(executor, _run_screening_sync, None, None, refresh)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Upstream stock data error: {exc}",
        )

    stocks = data["stocks"]
    if risk_level:
        stocks = [s for s in stocks if s["risk_level"].lower() == risk_level.lower()]

    paginated = stocks[offset : offset + limit]
    return {
        "stocks": paginated,
        "total": len(stocks),
        "demo_count": 0,
        "exchange": "NSE",
        "limit": limit,
        "offset": offset,
        "disclaimer": pumpwatch.DISCLAIMER,
    }


@app.get("/api/stock/{ticker}", response_model=StockDetailResponse)
@app.get("/api/stocks/{ticker}", response_model=StockDetailResponse)
async def get_stock_detail(
    ticker: str,
    asof: Optional[str] = Query(None, description="As-of date in YYYY-MM-DD format"),
):
    """
    Detailed pumpwatch telemetry and chart series for a single ticker.
    """
    if asof:
        try:
            datetime.strptime(asof, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid asof format. Expected YYYY-MM-DD.",
            )

    loop = asyncio.get_running_loop()
    try:
        detail = await loop.run_in_executor(executor, _format_detail_response, ticker, asof)
        return detail
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch stock telemetry: {exc}",
        )


@app.get("/api/watchlist", response_model=WatchlistResponse)
async def get_watchlist():
    """
    Reads pumpwatch tickers.txt.
    """
    tickers = pumpwatch.load_tickers()
    return {
        "tickers": tickers,
        "total": len(tickers),
        "file_path": str(pumpwatch.DEFAULT_TICKERS_PATH),
    }


@app.put("/api/watchlist", response_model=WatchlistResponse)
async def update_watchlist(payload: WatchlistUpdatePayload):
    """
    Updates pumpwatch/tickers.txt with validation:
    - Uppercase
    - Strips '.NS'
    - Deduplicates
    - Max 100 tickers
    """
    cleaned: List[str] = []
    seen = set()

    for raw in payload.tickers:
        item = re.sub(r"\.NS$", "", raw.strip().upper())
        if item and item not in seen:
            seen.add(item)
            cleaned.append(item)

    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Watchlist cannot be empty.",
        )

    if len(cleaned) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Watchlist cannot exceed 100 tickers.",
        )

    pumpwatch.save_tickers(cleaned)
    # Clear screen cache so the next request reflects the new watchlist
    _screen_cache.clear()

    return {
        "tickers": cleaned,
        "total": len(cleaned),
        "file_path": str(pumpwatch.DEFAULT_TICKERS_PATH),
    }


@app.get("/api/config", response_model=ConfigResponse)
async def get_config():
    """
    Read-only view of pumpwatch thresholds and weights from config.py.
    """
    return {
        "thresholds": pw_config.THRESHOLDS,
        "weights": pw_config.WEIGHTS,
        "risk_levels": pw_config.RISK_LEVELS,
    }


def _search_symbols_sync(query: str) -> List[Dict[str, str]]:
    clean_q = query.strip().upper()
    if not clean_q:
        return []

    results = []
    seen = set()

    # 1. First check local watchlist symbols for instant match
    watchlist = pumpwatch.load_tickers()
    for sym in watchlist:
        if clean_q in sym:
            results.append({
                "ticker": sym,
                "name": f"{sym} (Watchlist)",
                "exchange": "NSE"
            })
            seen.add(sym)
            if len(results) >= 8:
                return results

    # 2. Query yfinance Search for broader NSE universe
    try:
        import yfinance as yf
        search_res = yf.Search(clean_q, max_results=12)
        quotes = getattr(search_res, "quotes", [])
        for q in quotes:
            sym = str(q.get("symbol", ""))
            exch = str(q.get("exchange", "")).upper()
            shortname = str(q.get("shortname") or q.get("longname") or sym)

            # Match Indian / NSE symbols
            if sym.endswith(".NS") or exch in ("NSI", "NSE"):
                clean_sym = sym.replace(".NS", "").upper()
                if clean_sym not in seen:
                    seen.add(clean_sym)
                    results.append({
                        "ticker": clean_sym,
                        "name": shortname,
                        "exchange": "NSE"
                    })
            if len(results) >= 8:
                break
    except Exception:
        pass

    return results


@app.get("/api/search")
async def search_stocks(q: str = Query(..., min_length=1, description="Symbol or company name")):
    """
    Autocomplete search suggestions for NSE stocks.
    """
    loop = asyncio.get_running_loop()
    matches = await loop.run_in_executor(executor, _search_symbols_sync, q)
    return {"query": q, "results": matches}


def _get_recommendations_sync() -> Dict[str, Any]:
    # 1. Fetch live Nifty 50 and Bank Nifty for Options suggestion
    import yfinance as yf

    option_recs = []
    try:
        nifty = yf.Ticker("^NSEI")
        h = nifty.history(period="5d")
        if len(h) >= 2:
            c_last = float(h["Close"].iloc[-1])
            c_prev = float(h["Close"].iloc[-2])
            chg_pct = ((c_last - c_prev) / c_prev) * 100
            atm_strike = round(c_last / 50) * 50

            bias = "BULLISH" if chg_pct >= 0.2 else "BEARISH" if chg_pct <= -0.2 else "NEUTRAL"
            rec_type = "CALL (CE)" if bias == "BULLISH" else "PUT (PE)" if bias == "BEARISH" else "STRADDLE / IRON CONDOR"
            target_strike = atm_strike if bias != "NEUTRAL" else atm_strike
            strategy = (
                f"Buy NIFTY {target_strike} CE — Momentum rally (+{chg_pct:.2f}%)."
                if bias == "BULLISH"
                else f"Buy NIFTY {target_strike} PE — Bearish pressure ({chg_pct:.2f}%)."
                if bias == "BEARISH"
                else f"Rangebound market ({chg_pct:+.2f}%). Non-directional option selling or hedging recommended."
            )

            # Targets and Stop-Loss estimates based on ATM option standard behavior
            entry_est = round(c_last * 0.007, 1)  # Approximate weekly ATM premium ~0.7% of spot
            sl_est = round(entry_est * 0.65, 1)
            tgt_est = round(entry_est * 1.5, 1)

            option_recs.append({
                "instrument": "NIFTY 50 Options",
                "underlying_price": round(c_last, 2),
                "bias": bias,
                "recommended_action": rec_type,
                "strike": target_strike,
                "contract_name": f"NIFTY {target_strike} {rec_type.split()[0]}",
                "estimated_premium": entry_est,
                "target_premium": tgt_est,
                "stop_loss_premium": sl_est,
                "strategy": strategy,
                "risk_profile": "High Risk / High Reward (Hedging / Momentum)",
                "expiry": "Current Weekly Expiry"
            })
    except Exception:
        pass

    try:
        bank = yf.Ticker("^NSEBANK")
        hb = bank.history(period="5d")
        if len(hb) >= 2:
            cb_last = float(hb["Close"].iloc[-1])
            cb_prev = float(hb["Close"].iloc[-2])
            chgb_pct = ((cb_last - cb_prev) / cb_prev) * 100
            atm_bank = round(cb_last / 100) * 100

            bias_b = "BULLISH" if chgb_pct >= 0.3 else "BEARISH" if chgb_pct <= -0.3 else "NEUTRAL"
            rec_b = "CALL (CE)" if bias_b == "BULLISH" else "PUT (PE)" if bias_b == "BEARISH" else "RANGEBOUND"
            entry_b = round(cb_last * 0.008, 1)
            option_recs.append({
                "instrument": "BANK NIFTY Options",
                "underlying_price": round(cb_last, 2),
                "bias": bias_b,
                "recommended_action": rec_b,
                "strike": atm_bank,
                "contract_name": f"BANKNIFTY {atm_bank} {rec_b.split()[0]}",
                "estimated_premium": entry_b,
                "target_premium": round(entry_b * 1.5, 1),
                "stop_loss_premium": round(entry_b * 0.65, 1),
                "strategy": f"Banking Index moving {chgb_pct:+.2f}%. Suggested strike: {atm_bank} {rec_b}.",
                "risk_profile": "High Volatility (Intraday / Weekly)",
                "expiry": "Current Weekly Expiry"
            })
    except Exception:
        pass

    # 2. Stock Recommendations: Screen Nifty 50 + Watchlist for High-Confidence Opportunities
    stock_candidates = []
    try:
        screen_data = _run_screening_sync(NIFTY_50_TICKERS, None, False)
        stocks = screen_data.get("stocks", [])

        # Filter Safe Momentum Buys (Low Risk Score, Positive Price Momentum, Healthy Volume)
        safe_momentum = [
            s for s in stocks
            if s.get("score", 100) < 35
            and s.get("price_change_1d", 0) > 0.5
            and not s.get("thinly_traded", True)
        ]

        # Breakout candidates (Clean volume ratio 1.5x - 3.0x with healthy liquidity)
        breakouts = [
            s for s in stocks
            if 1.4 <= s.get("volume_ratio", 0) <= 3.5
            and s.get("score", 100) < 45
            and not s.get("thinly_traded", True)
        ]

        for s in safe_momentum[:3]:
            entry_p = s["price"]
            sl_p = round(entry_p * 0.965, 1)   # 3.5% stop loss
            tgt_p = round(entry_p * 1.07, 1)    # 7.0% target (1:2 risk reward)
            stock_candidates.append({
                "ticker": s["ticker"],
                "category": "SAFE BLUECHIP MOMENTUM",
                "action": "BUY / ACCUMULATE",
                "price": entry_p,
                "change_1d": s["price_change_1d"],
                "target_price": tgt_p,
                "stop_loss_price": sl_p,
                "risk_reward": "1 : 2.0",
                "risk_score": s["score"],
                "risk_level": s["level"],
                "reason": f"Low manipulation score ({s['score']}/100) with strong +{s['price_change_1d']:.1f}% 1-day momentum and institutional liquidity."
            })

        for s in breakouts[:2]:
            if s["ticker"] not in [c["ticker"] for c in stock_candidates]:
                entry_p = s["price"]
                sl_p = round(entry_p * 0.95, 1)     # 5.0% stop loss
                tgt_p = round(entry_p * 1.10, 1)    # 10.0% target (1:2 risk reward)
                stock_candidates.append({
                    "ticker": s["ticker"],
                    "category": "VOLUME BREAKOUT",
                    "action": "SWING TRADING",
                    "price": entry_p,
                    "change_1d": s["price_change_1d"],
                    "target_price": tgt_p,
                    "stop_loss_price": sl_p,
                    "risk_reward": "1 : 2.0",
                    "risk_score": s["score"],
                    "risk_level": s["level"],
                    "reason": f"Healthy volume surge ({s['volume_ratio']:.1f}x) without entering extreme overbought levels."
                })
    except Exception:
        pass

    return {
        "options_recommendations": option_recs,
        "stocks_recommendations": stock_candidates,
        "disclaimer": "Educational and quantitative reference only. Consult a SEBI-registered advisor before executing financial trades."
    }


@app.get("/api/recommendations")
async def get_trading_recommendations():
    """
    Trading recommendations: Index Options strategies (Nifty/BankNifty)
    and High-Conviction safe momentum stock candidates.
    """
    loop = asyncio.get_running_loop()
    recs = await loop.run_in_executor(executor, _get_recommendations_sync)
    return recs
