# PumpWatch 🔍
> **A lightweight, transparent screening tool for detecting early-stage pump-and-dump candidates across NSE (India) stocks using daily price and volume data.**

---

## Disclaimer
> **Screening tool only.** Flags suspicious statistical patterns, not proof of market manipulation. Always conduct thorough fundamental, corporate governance, and regulatory research before making investment decisions.

---

## Features
- **Pure Python & Statistical Logic**: No heavy ML dependencies, black-box models, or complex infrastructure.
- **NSE Indian Market Focused**: Works out of the box with National Stock Exchange `.NS` tickers.
- **Transparent 5-Factor Scoring (0–100)**: Every score point is tied directly to volume spikes, price momentum, overbought conditions, liquidity limits, or confluence.
- **Smart Local Caching**: Downloads ~6 months of daily OHLCV data using `yfinance` and caches to `.cache/` (CSV) for instant reruns.
- **Historical Backtesting Support (`--asof`)**: Screen any historical date using data available up to that cutoff day.
- **Grounded Human-Readable Reasons**: Explains exactly why a stock was flagged (e.g., `Volume 3.7x 20d avg (z=5.8), +5.5% in 5d, above Bollinger upper band, volume + price surge together`).
- **Terminal UI & CSV Export**: Beautiful color-coded Rich tables and full-detail CSV output saved under `output/`.

---

## Project Structure
```text
pumpwatch/
├── README.md               # Documentation and guides
├── requirements.txt        # Pinned dependencies (yfinance, pandas, numpy, rich, pytest)
├── tickers.txt             # User-editable list of NSE symbols (~40 large, mid, and small caps)
├── .cache/                 # Local daily OHLCV CSV cache (git-ignored)
├── output/                 # Exported screening runs (CSV)
├── pumpwatch/
│   ├── __init__.py         # Package root
│   ├── __main__.py         # Entrypoint for python -m pumpwatch
│   ├── config.py           # ALL weights, thresholds, and risk bounds
│   ├── data.py             # Data fetching, validation, and disk caching
│   ├── signals.py          # Indicator calculations (Volume ratio/z-score, RSI, Bollinger, Liquidity)
│   ├── scoring.py          # Smooth scoring engine & reason generator
│   └── cli.py              # Rich CLI interface and CSV exporter
└── tests/
    ├── test_signals.py     # Pure synthetic unit tests for indicators
    └── test_scoring.py     # Pure synthetic unit tests for scoring & edge cases
```

---

## Quickstart

### 1. Requirements
- Python 3.10+ (tested on Python 3.11 / 3.14)
- Internet connection (for initial Yahoo Finance download)

### 2. Setup Virtual Environment
```bash
# Navigate to the pumpwatch directory
cd pumpwatch

# Create and activate virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run Unit Tests
```bash
python -m pytest -v
```

### 4. Run the Screener
```bash
# Run default screen on tickers.txt (Top 20)
python -m pumpwatch.cli

# Show top 10 stocks with risk score >= 30
python -m pumpwatch.cli --top 10 --min-score 30

# Screen as of a past date (e.g., September 1, 2026)
python -m pumpwatch.cli --asof 2026-09-01 --top 10

# Force fresh data download (bypass .cache/)
python -m pumpwatch.cli --no-cache

# Screen a custom ticker file
python -m pumpwatch.cli --tickers my_watchlist.txt
```

---

## Signal Explanations & Scoring Engine

Every stock receives a composite risk score between **0 and 100**, categorized into four distinct alert tiers:
- **0 – 29: Low** — Normal trading behavior.
- **30 – 54: Medium** — Noticeable volume or price anomaly requiring monitoring.
- **55 – 74: High** — Simultaneous volume spike, price run-up, or overbought state.
- **75 – 100: Extreme** — High-conviction pump-and-dump profile (thin liquidity, explosive volume, rapid surge).

### Scoring Weights (Sum = 100 Points)

| Component | Weight | Underlying Signals | Description & Mechanics |
| :--- | :---: | :--- | :--- |
| **Volume Spike** | **30 pts** | Volume Ratio & Z-Score | Compares today's volume to the prior 20-day average and standard deviation (excluding today). Scaled linearly from 1.5x up to 8.0x, or Z-score 1.0 to 4.0. |
| **Price Surge** | **30 pts** | 1-Day, 3-Day, 5-Day % Return | Evaluates the strongest multi-day price momentum. Scaled linearly from a 3% threshold up to 25%. |
| **Overbought** | **15 pts** | RSI(14) & Bollinger Bands | RSI Wilder smoothing above 65 scaled up to 90 (up to 9 pts), plus breach of the upper Bollinger Band (20, 2.0 std) (6 pts). |
| **Low Liquidity** | **15 pts** | 20-Day Traded Value | Average daily traded value `(Close * Volume) / 10,000,000` in INR Crore. Stocks below 5.0 cr/day receive a penalty; stocks below 1.0 cr/day receive full 15 pts. |
| **Confluence** | **10 pts** | Simultaneous Volume + Price | Bonus awarded only when both volume ratio $\ge 2.0\times$ **and** price surge $\ge 5.0\%$ fire on the same trading day. |

---

## How to Customize Thresholds in `config.py`

All operational parameters are isolated inside [`pumpwatch/config.py`](pumpwatch/config.py). You never have to modify algorithmic code to change sensitivity:

```python
# In pumpwatch/config.py:

# 1. To make volume detection stricter (require higher spikes):
VOL_RATIO_LOW = 2.5       # Default: 1.5
VOL_RATIO_HIGH = 10.0     # Default: 8.0

# 2. To change the liquidity threshold for mid caps:
LIQUIDITY_THRESHOLD_CR = 10.0   # Default: 5.0 cr

# 3. To alter scoring weights (must sum to 100):
W_VOLUME_SPIKE = 25
W_PRICE_SURGE = 25
W_OVERBOUGHT = 20
W_LOW_LIQUIDITY = 20
W_CONFLUENCE = 10
```

---

## Known Limitations & Best Practices
1. **Corporate News & Earnings**: Legitimate catalyst events (quarterly earnings beats, corporate acquisitions, index inclusions) exhibit identical price and volume spikes. The screener detects anomalies, not investor intent.
2. **Unofficial Data Source (`yfinance`)**: Free Yahoo Finance data may exhibit rate limits, delayed updates, or adjusted-price anomalies. For production institutional screening, connect a direct broker feed (e.g., Zerodha Kite Connect, Upstox, or NSE Bhavcopy).
3. **Delivery Percentage Data**: True pump schemes typically feature low delivery percentages (high intraday churn). Daily OHLCV lacks separate delivery volume; incorporating NSE delivery metrics is the logical next enhancement.
