# SentinelMarket + PumpWatch Integration Guide

This document explains how **PumpWatch** (the Python algorithmic screening engine), the **FastAPI backend**, and the **Next.js frontend** work together as a unified system.

---

## (a) How PumpWatch, the Backend, and the Frontend Connect

```
┌────────────────────────────────┐
│   Next.js 15 Web Frontend      │
│   (Port 3000, React, Tailwind) │
└───────────────┬────────────────┘
                │ HTTP Requests (e.g. GET /api/screen, GET /api/stock/SUZLON)
                ▼
┌────────────────────────────────┐
│      FastAPI Backend           │
│   (Port 8000, Uvicorn, Python) │
└───────────────┬────────────────┘
                │ Direct Python Import:
                │ import pumpwatch
                ▼
┌────────────────────────────────┐
│      PumpWatch Core Engine     │
│  data.py -> signals.py ->      │
│  scoring.py -> screen.py       │
│  (.cache/ daily local cache)   │
└────────────────────────────────┘
```

1. **PumpWatch (`pumpwatch/`)**:
   - The core detection library. It calculates volume ratios, volume Z-scores, multi-day price changes, RSI(14), Bollinger Band breaches, and liquidity (traded value in crore).
   - It computes an overall 0–100 risk score, risk level (`Low`, `Medium`, `High`, `Extreme`), breakdown points, and plain-English reasons.
   - It is installed into the virtual environment in **editable mode** (`pip install -e pumpwatch`), which allows the backend to import it just like any standard Python package (`import pumpwatch`).

2. **Backend (`backend/main.py`)**:
   - A lightweight FastAPI server. It exposes REST API endpoints (`/api/screen`, `/api/stock/{ticker}`, `/api/watchlist`, `/api/config`).
   - Runs screening asynchronously in a thread pool and caches results in memory for 15 minutes per `(tickers, asof)` combination to prevent blocking and rate limits.
   - Handles parameter validation, error mapping (400, 404, 502), and CORS headers.

3. **Frontend (`frontend/src/app/page.tsx` & `StockDetailPanel.tsx`)**:
   - The user-facing dashboard built with Next.js and styled with Tailwind CSS.
   - Polls the backend, displays the screening table, provides search and risk-level filters, includes a "Hide Large Liquid Stocks" toggle, and opens an in-depth stock detail modal with price history charts.

---

## (b) Trace of One Click: From Frontend Through API to Data and Back

Let's trace what happens when you click on **SUZLON** in the dashboard table:

1. **User Action**: You click on the SUZLON row in the table (`onClick={() => setSelectedStock(stock)}`).
2. **Component Mount**: The `<StockDetailPanel stock={selectedStock} onClose={...} />` component opens.
3. **HTTP Fetch**:
   - The modal triggers: `fetch("http://localhost:8000/api/stock/SUZLON")`.
4. **Backend Route**:
   - FastAPI receives the request at `@app.get("/api/stock/{ticker}")`.
   - It offloads the work to a background thread pool executor so the server remains non-blocking:
     `await loop.run_in_executor(executor, _format_detail_response, "SUZLON", None)`.
5. **PumpWatch Execution**:
   - `pumpwatch.fetch_one("SUZLON")` checks `pumpwatch/.cache/SUZLON_<date>.csv`. If cached today, it reads locally from disk. If not, it downloads the daily OHLCV series via `yfinance` and writes it to `.cache/`.
   - `pumpwatch.compute("SUZLON", df)` calculates the volume Z-score, RSI, Bollinger Bands, and liquidity turnover.
   - `pumpwatch.score_stock(sig)` calculates the 0–100 score, component points breakdown, and reasons string.
   - `pumpwatch.get_chart_series(df, days=120)` calculates the 20-day SMA, upper/lower Bollinger Bands, and 20-day average volume for the past 120 trading days.
6. **HTTP Response**:
   - FastAPI serializes the data into the Pydantic schema `StockDetailResponse` and sends back a JSON response.
7. **Frontend Render**:
   - The React state updates (`setDetail(normalizedData)`).
   - The modal renders the risk badge, score bar, explanation, red flags, detector breakdowns, and an interactive SVG price history chart.

---

## (c) Walkthrough of Files Changed or Added

- [`backend/main.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/backend/main.py):
  - Completely rewritten to integrate `pumpwatch` as the engine.
  - Added endpoints:
    - `GET /api/health`: Health status.
    - `GET /api/screen`: Ranked screening results with signals, reasons, counts, and disclaimer.
    - `GET /api/stocks`: Backward-compatible alias for the stock list.
    - `GET /api/stock/{ticker}` & `GET /api/stocks/{ticker}`: Single stock telemetry, detector scores, and 120-day chart series.
    - `GET /api/watchlist` & `PUT /api/watchlist`: Read and write `pumpwatch/tickers.txt` with uppercase, deduplication, and 100-ticker cap.
    - `GET /api/config`: Thresholds and weights from `pumpwatch.config`.
  - Added 15-minute in-memory cache and thread pool execution.

- [`backend/tests/test_api.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/backend/tests/test_api.py):
  - 8 automated unit tests using FastAPI `TestClient` and synthetic test data (100% offline, zero network reliance).

- [`pumpwatch/pumpwatch/screen.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/pumpwatch/pumpwatch/screen.py):
  - Added `run_screen()` and `run_screen_with_metadata()` as the single source of truth for both the CLI and external backend callers.

- [`pumpwatch/pumpwatch/data.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/pumpwatch/pumpwatch/data.py):
  - Made paths (`CACHE_DIR`, `DEFAULT_TICKERS_PATH`, `DEFAULT_OUTPUT_DIR`) resolve reliably regardless of working directory.
  - Added `get_chart_series()` and `save_tickers()`.

- [`pumpwatch/pumpwatch/scoring.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/pumpwatch/pumpwatch/scoring.py):
  - Added `ComponentPoints` breakdown to return individual component points alongside the total score.

- [`pumpwatch/pumpwatch/config.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/pumpwatch/pumpwatch/config.py):
  - Added `WEIGHTS` and `THRESHOLDS` dictionaries for external API consumption.

- [`pumpwatch/pumpwatch/cli.py`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/pumpwatch/pumpwatch/cli.py):
  - Refactored to call `run_screen_with_metadata()`, sharing the same engine as the web API.

- [`frontend/src/app/page.tsx`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/frontend/src/app/page.tsx):
  - Connected to `process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"`.
  - Added disclaimer banner: *"Screening tool only. Flags suspicious patterns, not proof of manipulation."*
  - Added a "Hide Large Liquid Stocks" toggle filter (default ON).
  - Added loading, empty, and error retry states.

- [`frontend/src/app/components/StockDetailPanel.tsx`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/frontend/src/app/components/StockDetailPanel.tsx):
  - Configured to display real pumpwatch detector points (Volume spike, Price surge, Overbought RSI/BB, Confluence bonus).

- [`dev.ps1`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/dev.ps1):
  - One-click PowerShell startup script to run both servers concurrently.

- [`.gitignore`](file:///C:/Users/Aman%20Kumar%20Singh/Desktop/project/.gitignore):
  - Configured to ignore `.venv`, `pumpwatch/venv`, `.cache`, `output`, `node_modules`, and `.next`.

---

## (d) How to Add One New Field to the API and Show It in the Frontend

Example: Suppose you want to expose a new metric called `delivery_percent` (percentage of volume resulting in actual delivery).

1. **Step 1: Compute or Extract the Value in PumpWatch (`signals.py`)**:
   In `signals.py`, add `delivery_percent: float = 0.0` to the `SignalResult` dataclass, and compute it in `compute()`:
   ```python
   # Inside SignalResult
   delivery_percent: float = 0.0

   # Inside compute()
   deliv = float(df.get("Delivery", 0.0)) # example
   ```

2. **Step 2: Include Field in the Screen Output (`screen.py`)**:
   In `screen.py` under `scored_items.append(...)`:
   ```python
   "delivery_percent": round(sig.delivery_percent, 2),
   ```

3. **Step 3: Update FastAPI Pydantic Models (`backend/main.py`)**:
   Add the field to `StockScreenItem` and `StockDetailResponse`:
   ```python
   class StockScreenItem(BaseModel):
       ...
       delivery_percent: float = 0.0
   ```

4. **Step 4: Update TypeScript Types & Display in Frontend**:
   In `frontend/src/app/components/StockDetailPanel.tsx`:
   ```typescript
   export interface Stock {
     ...
     delivery_percent?: number;
   }
   ```
   Render it in the JSX wherever you'd like:
   ```tsx
   <p className="text-xs text-slate-400">
     Delivery: {stock.delivery_percent ?? 0}%
   </p>
   ```

---

## (e) Honest Limitations & Three Next-Step Improvements

### Limitations:
1. **Daily OHLCV Data Only**:
   - The screener operates on end-of-day or delayed daily data from Yahoo Finance. It does not inspect real-time tick-by-tick order books, market depth, or intra-minute price jumps.
2. **False Positives on Genuine Catalysts**:
   - Legitimate corporate announcements (quarterly earnings beats, acquisitions, FDA approvals) cause sudden volume surges and multi-day rallies that can trigger high risk scores. The "Hide Large Liquid Stocks" toggle helps mitigate this for large caps, but small caps can still trigger flags on genuine positive news.
3. **No Social / Promoter Network Graphing**:
   - Real-world pump-and-dump operations often coordinate via Telegram or WhatsApp channels. PumpWatch monitors mathematical telemetry, not chat networks or regulatory filings.

### Three Next-Step Improvements:
1. **Corporate Announcements & Earnings Calendar Filter**:
   - Integrate an NSE corporate filings feed (or Google News API). When a stock spikes on an official earnings release date, automatically damp the risk score.
2. **Intraday Upper/Lower Circuit Lock Counter**:
   - Track consecutive 5% or 10% upper-circuit freeze days. Repeated circuit locks with near-zero sellers are one of the most reliable signatures of operator manipulation.
3. **Automated Backtesting & Historical Replay**:
   - Use the existing `--asof` CLI/API capability to build a visual backtesting page in the frontend that lets users step back in time and evaluate historical pump-and-dump incidents against SEBI regulatory action logs.
