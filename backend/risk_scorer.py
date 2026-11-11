"""
Risk Scoring Engine for SentinelMarket
Detects anomalies using volume spikes, price analysis, and ML (Isolation Forest)
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List


class RiskScorer:
    """
    Calculates risk scores (0-100) for stocks based on:
    - Volume spike detection (Z-score analysis)
    - Price anomaly detection (RSI, Bollinger Bands)
    - Combined weighted scoring
    """

    def __init__(self):
        self.ml_enabled = False  # ML model not loaded in Phase 1

    def calculate_risk_score(self, data: pd.DataFrame, ticker: str) -> Dict[str, Any]:
        """
        Calculate comprehensive risk score for a stock.

        Args:
            data: DataFrame with OHLCV data
            ticker: Stock ticker symbol

        Returns:
            Dict with risk_score, risk_level, explanation, red_flags, etc.
        """
        if data is None or data.empty or len(data) < 10:
            return self._default_result(ticker)

        try:
            # Calculate individual scores
            volume_score = self._volume_spike_score(data)
            price_score = self._price_anomaly_score(data)

            # Weighted combination
            risk_score = (volume_score * 0.5) + (price_score * 0.5)
            risk_score = min(max(risk_score, 0), 100)  # Clamp 0-100

            # Determine risk level
            risk_level = self._get_risk_level(risk_score)

            # Generate explanation and red flags
            red_flags = self._get_red_flags(data, volume_score, price_score)
            explanation = self._get_explanation(ticker, risk_level, red_flags)
            recommendation = self._get_recommendation(risk_level)

            return {
                "risk_score": round(risk_score, 2),
                "risk_level": risk_level,
                "is_suspicious": risk_level in ["HIGH", "EXTREME"],
                "recommendation": recommendation,
                "explanation": explanation,
                "red_flags": red_flags,
                "individual_scores": {
                    "volume_spike": round(volume_score, 2),
                    "price_anomaly": round(price_score, 2),
                    "ml_anomaly": 0,
                    "social_sentiment": 0,
                },
                "ml_status": {"enabled": self.ml_enabled, "score": 0},
                "details": {
                    "volume_z_score": round(self._latest_volume_zscore(data), 2),
                    "rsi": round(self._calculate_rsi(data), 2),
                    "price_volatility": round(self._price_volatility(data), 4),
                },
            }

        except Exception as e:
            print(f"[RiskScorer] Error scoring {ticker}: {e}")
            return self._default_result(ticker)

    def _volume_spike_score(self, data: pd.DataFrame) -> float:
        """Detect volume spikes using Z-score analysis"""
        volumes = data["Volume"].values.astype(float)

        if len(volumes) < 5:
            return 0.0

        mean_vol = np.mean(volumes[:-1])  # Exclude latest
        std_vol = np.std(volumes[:-1])
        latest_vol = volumes[-1]

        if std_vol == 0:
            return 0.0

        z_score = (latest_vol - mean_vol) / std_vol

        # Map Z-score to 0-100 risk score
        # Z > 3 = very suspicious, Z > 2 = suspicious, Z > 1 = slightly elevated
        if z_score > 4:
            return min(95, 70 + z_score * 5)
        elif z_score > 3:
            return 60 + (z_score - 3) * 10
        elif z_score > 2:
            return 40 + (z_score - 2) * 20
        elif z_score > 1:
            return 20 + (z_score - 1) * 20
        else:
            return max(0, z_score * 20)

    def _price_anomaly_score(self, data: pd.DataFrame) -> float:
        """Detect price anomalies using RSI and Bollinger Bands"""
        closes = data["Close"].values.astype(float)

        if len(closes) < 14:
            return 0.0

        # RSI component
        rsi = self._calculate_rsi(data)
        rsi_score = 0.0
        if rsi > 80:
            rsi_score = 50 + (rsi - 80) * 2.5  # Overbought
        elif rsi < 20:
            rsi_score = 50 + (20 - rsi) * 2.5  # Oversold
        elif rsi > 70:
            rsi_score = 20 + (rsi - 70) * 3
        elif rsi < 30:
            rsi_score = 20 + (30 - rsi) * 3

        # Bollinger Band component
        bb_score = self._bollinger_score(closes)

        # Price volatility component
        volatility = self._price_volatility(data)
        vol_score = min(30, volatility * 500)  # High volatility = more risk

        # Combine
        score = (rsi_score * 0.4) + (bb_score * 0.35) + (vol_score * 0.25)
        return min(100, max(0, score))

    def _calculate_rsi(self, data: pd.DataFrame, period: int = 14) -> float:
        """Calculate RSI (Relative Strength Index)"""
        closes = data["Close"].values.astype(float)

        if len(closes) < period + 1:
            return 50.0  # Neutral

        deltas = np.diff(closes)
        gains = np.where(deltas > 0, deltas, 0)
        losses = np.where(deltas < 0, -deltas, 0)

        avg_gain = np.mean(gains[-period:])
        avg_loss = np.mean(losses[-period:])

        if avg_loss == 0:
            return 100.0

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        return rsi

    def _bollinger_score(self, closes: np.ndarray, window: int = 20) -> float:
        """Check if price is outside Bollinger Bands"""
        if len(closes) < window:
            return 0.0

        sma = np.mean(closes[-window:])
        std = np.std(closes[-window:])

        if std == 0:
            return 0.0

        upper_band = sma + 2 * std
        lower_band = sma - 2 * std
        current = closes[-1]

        if current > upper_band:
            deviation = (current - upper_band) / std
            return min(80, 30 + deviation * 20)
        elif current < lower_band:
            deviation = (lower_band - current) / std
            return min(80, 30 + deviation * 20)
        else:
            # How close to the bands
            band_width = upper_band - lower_band
            if band_width > 0:
                position = (current - lower_band) / band_width
                # Score higher if near edges
                return abs(position - 0.5) * 20
            return 0.0

    def _price_volatility(self, data: pd.DataFrame) -> float:
        """Calculate recent price volatility"""
        closes = data["Close"].values.astype(float)

        if len(closes) < 5:
            return 0.0

        returns = np.diff(closes[-20:]) / closes[-20:-1]
        return float(np.std(returns))

    def _latest_volume_zscore(self, data: pd.DataFrame) -> float:
        """Get the Z-score of the latest volume"""
        volumes = data["Volume"].values.astype(float)
        if len(volumes) < 5:
            return 0.0
        mean_vol = np.mean(volumes[:-1])
        std_vol = np.std(volumes[:-1])
        if std_vol == 0:
            return 0.0
        return (volumes[-1] - mean_vol) / std_vol

    def _get_risk_level(self, score: float) -> str:
        if score >= 80:
            return "EXTREME"
        elif score >= 60:
            return "HIGH"
        elif score >= 40:
            return "MEDIUM"
        else:
            return "LOW"

    def _get_red_flags(self, data: pd.DataFrame, vol_score: float, price_score: float) -> List[str]:
        flags = []
        if vol_score > 60:
            flags.append("Unusual volume spike detected")
        if vol_score > 40:
            flags.append("Volume significantly above average")
        if price_score > 60:
            flags.append("Price showing extreme movement")
        if price_score > 40:
            flags.append("Technical indicators showing overbought/oversold")

        rsi = self._calculate_rsi(data)
        if rsi > 75:
            flags.append(f"RSI extremely high ({rsi:.1f}) - overbought territory")
        elif rsi < 25:
            flags.append(f"RSI extremely low ({rsi:.1f}) - oversold territory")

        volatility = self._price_volatility(data)
        if volatility > 0.04:
            flags.append("High price volatility detected")

        return flags if flags else ["No significant red flags detected"]

    def _get_explanation(self, ticker: str, risk_level: str, red_flags: List[str]) -> str:
        explanations = {
            "LOW": f"{ticker} shows normal trading patterns with no significant anomalies.",
            "MEDIUM": f"{ticker} shows some unusual activity that warrants monitoring.",
            "HIGH": f"{ticker} shows suspicious patterns consistent with potential manipulation.",
            "EXTREME": f"{ticker} shows extreme anomalies — high probability of pump-and-dump activity!",
        }
        return explanations.get(risk_level, f"{ticker} analysis completed.")

    def _get_recommendation(self, risk_level: str) -> str:
        recs = {
            "LOW": "Standard monitoring. No immediate action required.",
            "MEDIUM": "Increased monitoring recommended. Watch for further unusual activity.",
            "HIGH": "Caution advised. Avoid new positions. Consider reducing exposure.",
            "EXTREME": "HIGH ALERT. Do not trade. Possible pump-and-dump in progress.",
        }
        return recs.get(risk_level, "Monitor the stock.")

    def _default_result(self, ticker: str) -> Dict[str, Any]:
        return {
            "risk_score": 0,
            "risk_level": "LOW",
            "is_suspicious": False,
            "recommendation": "Insufficient data for analysis.",
            "explanation": f"Not enough data available for {ticker}.",
            "red_flags": ["Insufficient data for analysis"],
            "individual_scores": {
                "volume_spike": 0,
                "price_anomaly": 0,
                "ml_anomaly": 0,
                "social_sentiment": 0,
            },
            "ml_status": {"enabled": False, "score": 0},
            "details": {},
        }
