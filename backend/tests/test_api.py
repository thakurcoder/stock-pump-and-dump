"""
Backend Unit Tests
Uses FastAPI TestClient and mocked / synthetic pumpwatch data (no network).
"""

from unittest.mock import MagicMock, patch
import pandas as pd
import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def make_synthetic_df(n=50, base_price=100.0, volume_spike=False):
    dates = pd.date_range(end="2026-09-01", periods=n, freq="B")
    close = np.linspace(base_price, base_price * 1.05, n)
    volume = np.full(n, 100000.0)
    if volume_spike:
        volume[-1] = 100000.0 * 8.0
        close[-1] = close[-2] * 1.20
    df = pd.DataFrame(
        {
            "Open": close,
            "High": close * 1.01,
            "Low": close * 0.99,
            "Close": close,
            "Volume": volume,
        },
        index=dates,
    )
    return df


def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "pumpwatch-backend"


def test_config():
    res = client.get("/api/config")
    assert res.status_code == 200
    data = res.json()
    assert "thresholds" in data
    assert "weights" in data
    assert "risk_levels" in data


def test_watchlist_read():
    res = client.get("/api/watchlist")
    assert res.status_code == 200
    data = res.json()
    assert "tickers" in data
    assert isinstance(data["tickers"], list)
    assert data["total"] == len(data["tickers"])


def test_watchlist_update_and_validation():
    # Valid update
    test_tickers = ["TCS", "INFY.NS", " reliance "]
    res = client.put("/api/watchlist", json={"tickers": test_tickers})
    assert res.status_code == 200
    data = res.json()
    assert data["tickers"] == ["TCS", "INFY", "RELIANCE"]

    # Empty validation error
    res_empty = client.put("/api/watchlist", json={"tickers": []})
    assert res_empty.status_code == 400

    # Max limit validation (> 100)
    big_list = [f"STK{i}" for i in range(105)]
    res_big = client.put("/api/watchlist", json={"tickers": big_list})
    assert res_big.status_code in (400, 422)


@patch("backend.main.pumpwatch.run_screen_with_metadata")
def test_screen_endpoint(mock_run_screen):
    calm_df = make_synthetic_df(50, volume_spike=False)
    pump_df = make_synthetic_df(50, volume_spike=True)
    from pumpwatch import compute, score_stock

    p_sig = compute("PUMP", pump_df)
    p_score = score_stock(p_sig)
    c_sig = compute("CALM", calm_df)
    c_score = score_stock(c_sig)

    stocks_data = [
        {
            "ticker": "PUMP",
            "exchange": "NSE",
            "score": p_score.score,
            "level": p_score.level,
            "last_close": 120.0,
            "last_date": "2026-09-01",
            "volume_ratio": 8.0,
            "volume_zscore": 3.5,
            "price_change_1d": 20.0,
            "price_change_3d": 20.0,
            "price_change_5d": 20.0,
            "rsi": 85.0,
            "bb_upper": 115.0,
            "bb_lower": 95.0,
            "bb_breach": True,
            "avg_turnover_cr": 2.0,
            "thinly_traded": True,
            "reasons": "Volume 8.0x",
            "component_points": {"volume_spike": 30.0, "price_surge": 30.0, "overbought": 15.0, "low_liquidity": 15.0, "confluence": 10.0},
            "price": 120.0,
            "price_change_percent": 20.0,
            "volume": 800000,
            "is_suspicious": True,
            "risk_score": 100,
            "risk_level": "EXTREME",
            "last_updated": "2026-09-01",
            "demo": False,
        },
        {
            "ticker": "CALM",
            "exchange": "NSE",
            "score": 0,
            "level": "Low",
            "last_close": 100.0,
            "last_date": "2026-09-01",
            "volume_ratio": 1.0,
            "volume_zscore": 0.0,
            "price_change_1d": 0.0,
            "price_change_3d": 0.0,
            "price_change_5d": 0.0,
            "rsi": 50.0,
            "bb_upper": 105.0,
            "bb_lower": 95.0,
            "bb_breach": False,
            "avg_turnover_cr": 100.0,
            "thinly_traded": False,
            "reasons": "no significant flags",
            "component_points": {"volume_spike": 0.0, "price_surge": 0.0, "overbought": 0.0, "low_liquidity": 0.0, "confluence": 0.0},
            "price": 100.0,
            "price_change_percent": 0.0,
            "volume": 100000,
            "is_suspicious": False,
            "risk_score": 0,
            "risk_level": "LOW",
            "last_updated": "2026-09-01",
            "demo": False,
        },
    ]

    mock_run_screen.return_value = {
        "stocks": stocks_data,
        "counts": {"Extreme": 1, "High": 0, "Medium": 0, "Low": 1},
        "skipped": ["BADTICKER"],
        "asof": "2026-09-01",
        "total": 2,
        "disclaimer": "Screening tool only.",
    }

    res = client.get("/api/screen?refresh=true")
    assert res.status_code == 200
    data = res.json()
    assert "stocks" in data
    assert "counts" in data
    assert "disclaimer" in data
    assert "Screening tool only" in data["disclaimer"]
    assert "BADTICKER" in data["skipped"]

    # Verify ranking
    assert len(data["stocks"]) == 2
    assert data["stocks"][0]["ticker"] == "PUMP"
    assert data["stocks"][1]["ticker"] == "CALM"

    # Test top filter
    res_top = client.get("/api/screen?top=1&refresh=true")
    assert res_top.status_code == 200
    assert len(res_top.json()["stocks"]) == 1


@patch("backend.main.pumpwatch.fetch_one")
def test_stock_detail_success(mock_fetch_one):
    pump_df = make_synthetic_df(50, volume_spike=True)
    mock_fetch_one.return_value = pump_df

    res = client.get("/api/stock/PUMP")
    assert res.status_code == 200
    data = res.json()
    assert data["ticker"] == "PUMP"
    assert "risk_score" in data
    assert "risk_level" in data
    assert "chart_data" in data
    assert len(data["chart_data"]) > 0
    assert "signals" in data
    assert "reasons" in data


@patch("backend.main.pumpwatch.fetch_one")
def test_stock_detail_not_found(mock_fetch_one):
    mock_fetch_one.return_value = None

    res = client.get("/api/stock/UNKNOWN")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_asof_invalid_date():
    res = client.get("/api/screen?asof=invalid-date")
    assert res.status_code == 400
