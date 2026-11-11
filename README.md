# SentinelMarket — PumpWatch Integration Guide

Real-Time Pump & Dump Scheme Detection for Indian (NSE) equities, powered by the **PumpWatch** screening engine.

---

## 🏗 Architecture & Overview

This repository combines three components into one clean system without external databases, auth, or ML overhead:

```
project/
├── pumpwatch/        # Core detection engine & CLI
│   ├── config.py     # All mathematical thresholds & scoring weights
│   ├── data.py       # yfinance fetching + daily CSV caching (.cache/)
│   ├── signals.py    # Volume Z-score, RSI, Bollinger Bands, Liquidity
│   ├── scoring.py    # 0-100 risk scoring & human-readable reasons
│   ├── screen.py     # Batch screening pipeline (single source of truth)
│   └── tickers.txt   # ~40 NSE stock tickers (editable by user)
│
├── backend/          # FastAPI web service
│   ├── main.py       # Endpoints: /api/screen, /api/stock/{ticker}, /api/watchlist
│   └── tests/        # 8 automated test cases using TestClient
│
└── frontend/         # Next.js 15 + Tailwind CSS dashboard
    └── src/app/      # Real-time table, filters, charts, and detail modal
```

---

## ⚡ Quickstart (Windows PowerShell)

### 1. Prerequisites
- Python 3.11+ (or Python 3.14)
- Node.js 18+ & npm

### 2. Environment Setup (One Shared Virtualenv)
Run these commands from the project root:

```powershell
# 1. Create shared venv inside pumpwatch/venv (or reuse existing)
python -m venv pumpwatch\venv

# 2. Install pumpwatch in editable mode into the shared venv
.\pumpwatch\venv\Scripts\python.exe -m pip install -e pumpwatch

# 3. Install backend dependencies into the same shared venv
.\pumpwatch\venv\Scripts\python.exe -m pip install -r backend\requirements.txt

# 4. Install frontend npm dependencies
cd frontend
npm install
cd ..
```

---

## 🚀 Running the System

### Option A: One-Click Startup Script (Recommended)
```powershell
.\dev.ps1
```
This automatically starts:
- **FastAPI Backend**: `http://localhost:8000` (docs at `http://localhost:8000/docs`)
- **Next.js Frontend**: `http://localhost:3000`

### Option B: Manual Terminal Execution

**Terminal 1 (Backend):**
```powershell
.\pumpwatch\venv\Scripts\python.exe -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 (Frontend):**
```powershell
cd frontend
npm run dev
```

### Option C: Standalone CLI
You can also run the PumpWatch screener directly in your terminal at any time:
```powershell
.\pumpwatch\venv\Scripts\python.exe -m pumpwatch.cli --top 10
```

---

## 🧪 Testing

Both test suites run completely offline using synthetic data (no network calls):

```powershell
# Run PumpWatch mathematical engine tests (19 tests)
.\pumpwatch\venv\Scripts\python.exe -m pytest pumpwatch\tests -v

# Run FastAPI backend API tests (8 tests)
.\pumpwatch\venv\Scripts\python.exe -m pytest backend\tests -v
```

---

## 🛡 Disclaimer
*Screening tool only. Flags suspicious patterns, not proof of manipulation.*
