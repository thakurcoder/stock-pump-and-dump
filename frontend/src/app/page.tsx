"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Activity,
  Search,
  RefreshCw,
  Zap,
  BarChart2,
  Clock,
  Eye,
  ListFilter,
  Maximize2,
  Compass,
  Info,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import StockDetailPanel, { getRiskColors, type Stock } from "./components/StockDetailPanel";
import WatchlistModal from "./components/WatchlistModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MarketIndex {
  symbol: string;
  value: number;
  change: number;
  change_percent: number;
  positive: boolean;
  demo?: boolean;
}

const SKELETON_WIDTHS = [70, 85, 60, 75, 90, 65];

export default function Dashboard() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [hideLiquid, setHideLiquid] = useState(false); // default false so beginner sees all stocks
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [marketStatus, setMarketStatus] = useState("closed");
  const [disclaimer, setDisclaimer] = useState(
    "AI Surveillance Engine: Flags abnormal volume spikes and price breakouts for investor safety."
  );
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [universe, setUniverse] = useState<"watchlist" | "nifty50">("nifty50"); // default to Nifty 50 so data is instantly visible
  const [analyzingTicker, setAnalyzingTicker] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ ticker: string; name: string; exchange: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Debounced search suggestions
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 1) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const d = await res.json();
          setSuggestions(d.results || []);
        }
      } catch (err) {
        // Ignore background suggestion errors
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleDirectSearch = async (targetTicker?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setShowSuggestions(false);
    const clean = (targetTicker || searchQuery).trim().toUpperCase().replace(/\.NS$/, "");
    if (!clean) return;

    const found = stocks.find((s) => s.ticker.toUpperCase() === clean);
    if (found) {
      setSelectedStock(found);
      setSearchError(null);
      return;
    }

    setAnalyzingTicker(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stock/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Stock '${clean}' not found on NSE.`);
        }
        throw new Error(`Server returned error ${res.status} checking ${clean}`);
      }
      const data = await res.json();
      const syntheticStock: Stock = {
        ticker: data.ticker,
        exchange: data.exchange || "NSE",
        risk_score: data.risk_score ?? data.score ?? 0,
        risk_level: (data.risk_level ?? data.level ?? "LOW").toUpperCase(),
        is_suspicious: Boolean(data.is_suspicious),
        price: data.price ?? 0,
        price_change_percent: data.price_change_percent ?? 0,
        volume: data.volume ?? 0,
        last_updated: data.last_updated ?? "",
        demo: Boolean(data.demo),
        thinly_traded: Boolean(data.signals?.thinly_traded),
        reasons: data.reasons ?? "",
        volume_ratio: data.signals?.volume_ratio,
        volume_zscore: data.signals?.volume_zscore,
        price_change_1d: data.signals?.price_change_1d,
        price_change_3d: data.signals?.price_change_3d,
        price_change_5d: data.signals?.price_change_5d,
        rsi: data.signals?.rsi,
        avg_turnover_cr: data.signals?.avg_turnover_cr,
      };

      setStocks((prev) => [syntheticStock, ...prev.filter((s) => s.ticker !== syntheticStock.ticker)]);
      setSelectedStock(syntheticStock);
      setSearchQuery("");
    } catch (err: any) {
      setSearchError(err?.message || `Failed to analyze stock ${clean}`);
    } finally {
      setAnalyzingTicker(false);
    }
  };

  const fetchData = async (targetUniverse?: "watchlist" | "nifty50") => {
    const selectedUniverse = targetUniverse || universe;
    setLoading(true);
    setError(null);
    try {
      const [idxRes, screenRes] = await Promise.all([
        fetch(`${API_BASE}/api/market-indices`),
        fetch(`${API_BASE}/api/screen?top=50&universe=${selectedUniverse}`),
      ]);
      if (idxRes.ok) {
        const d = await idxRes.json();
        setIndices(d.indices || []);
        setMarketStatus(d.market_status || "closed");
      }
      if (screenRes.ok) {
        const d = await screenRes.json();
        setStocks(d.stocks || []);
        if (d.disclaimer) setDisclaimer(d.disclaimer);
      } else {
        throw new Error(`Screening service answered HTTP ${screenRes.status}`);
      }
      setLastRefreshed(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch (err: any) {
      setError(err?.message || "Failed to load live market data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 60_000);
    return () => clearInterval(interval);
  }, [universe]);

  const filteredStocks = stocks.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      s.ticker.toLowerCase().includes(q) || s.exchange.toLowerCase().includes(q);
    const matchFilter =
      riskFilter === "ALL" || s.risk_level.toUpperCase() === riskFilter;
    const matchLiquid = hideLiquid ? s.thinly_traded !== false : true;
    return matchSearch && matchFilter && matchLiquid;
  });

  const extremeCount = stocks.filter((s) => s.risk_level === "EXTREME").length;
  const highCount = stocks.filter((s) => s.risk_level === "HIGH").length;
  const mediumCount = stocks.filter((s) => s.risk_level === "MEDIUM").length;
  const lowCount = stocks.filter((s) => s.risk_level === "LOW").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-sky-500/30">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-3.5 shrink-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-cyan-400 p-0.5 shadow-xl shadow-sky-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-sky-400" />
                </div>
              </div>
              <div className="leading-tight">
                <h1 className="font-extrabold text-xl sm:text-2xl tracking-tight bg-gradient-to-r from-white via-sky-200 to-sky-400 bg-clip-text text-transparent">
                  SentinelMarket
                </h1>
                <p className="text-xs font-semibold text-slate-400 tracking-wide mt-0.5">
                  AI Stock Anomaly &amp; Pump-Dump Detector
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              {/* Market Status Pill */}
              <div
                className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold border ${
                  marketStatus === "open"
                    ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-300"
                    : "bg-slate-800/80 border-slate-700 text-slate-300"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${marketStatus === "open" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                {marketStatus === "open" ? "NSE Market Open" : "NSE Market Closed"}
              </div>

              {/* Trading Recommendations Branch Link */}
              <Link
                href="/recommendations"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-sm font-bold shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02]"
              >
                <Compass className="w-4 h-4 text-cyan-200" />
                <span>Trading Recommendations</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-mono uppercase">New</span>
              </Link>

              {/* Watchlist Button */}
              <button
                onClick={() => setIsWatchlistOpen(true)}
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-all"
              >
                <ListFilter className="w-4 h-4 text-sky-400" />
                <span>Watchlist</span>
              </button>

              {/* Refresh Button */}
              <button
                onClick={() => fetchData()}
                disabled={loading}
                title="Refresh Live Data"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Indices Live Ticker Bar */}
          <div className="border-t border-slate-800/80 py-2.5 flex items-center gap-4 overflow-x-auto scrollbar-none text-sm whitespace-nowrap">
            <span className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wider text-slate-400 shrink-0">
              <Activity className="w-4 h-4 text-cyan-400" />
              Live Indices:
            </span>
            {indices.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-8 w-44 rounded-lg bg-slate-800/60 animate-pulse" />
                ))
              : indices.map((idx) => (
                  <div
                    key={idx.symbol}
                    className="flex items-center gap-2.5 px-3 py-1 rounded-lg bg-slate-800/50 border border-slate-700/60 text-xs font-medium"
                  >
                    <span className="font-bold text-slate-200">{idx.symbol}</span>
                    <span className="font-mono font-bold text-slate-100">{idx.value.toLocaleString("en-IN")}</span>
                    <span className={`flex items-center gap-1 font-mono font-bold ${idx.positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {idx.positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {idx.positive ? "+" : ""}
                      {idx.change_percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Beginner How It Works Guide Toggle */}
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">How SentinelMarket Works (Beginner Guide)</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Protecting retail traders by detecting abnormal volume traps and false price rallies.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-xs font-bold text-indigo-300 transition-all self-start sm:self-auto"
            >
              {showGuide ? "Hide Guide ▲" : "Explain Risk Levels ▼"}
            </button>
          </div>

          {showGuide && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800 text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>LOW RISK (Score &lt; 35)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Healthy institutional trading. High liquidity, normal volumes, and no suspicious manipulation signs. Safe for standard investing.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>MEDIUM (35 - 55)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Moderate volume spike or high RSI momentum. Could be a legitimate earnings move or early rally. Keep a trailing stop loss.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-400 text-sm">
                  <ShieldAlert className="w-4 h-4" />
                  <span>HIGH RISK (55 - 75)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Unusual volume surge (3x - 5x) combined with steep price rises. High probability of operator pump. Avoid fresh buying.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-purple-300 text-sm">
                  <Zap className="w-4 h-4 text-purple-400" />
                  <span>EXTREME (Score &gt; 75)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Extreme anomalous volume spike (&gt;6x), thinly traded liquidity, and Bollinger Band breach. Classic pump &amp; dump signature. Danger zone.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hero Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Total Tracked</span>
              <span className="text-2xl font-extrabold font-mono text-white mt-1 block">{stocks.length}</span>
              <span className="text-[11px] text-slate-500">{universe === "nifty50" ? "NIFTY 50 Universe" : "Active Watchlist"}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Eye className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Safe / Low Risk</span>
              <span className="text-2xl font-extrabold font-mono text-emerald-400 mt-1 block">{lowCount}</span>
              <span className="text-[11px] text-emerald-500 font-medium">Healthy stocks</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">High Alert</span>
              <span className="text-2xl font-extrabold font-mono text-rose-400 mt-1 block">{highCount}</span>
              <span className="text-[11px] text-rose-500 font-medium">Abnormal volume</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">Extreme Anomaly</span>
              <span className="text-2xl font-extrabold font-mono text-purple-400 mt-1 block">{extremeCount}</span>
              <span className="text-[11px] text-purple-400 font-medium">Immediate caution</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Search, Filter & Universe Switcher Bar */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-lg">
              <form onSubmit={(e) => handleDirectSearch(undefined, e)} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    id="stock-search"
                    type="text"
                    value={searchQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                      if (searchError) setSearchError(null);
                    }}
                    placeholder="Search stock ticker (e.g. RELIANCE, TCS, HDFCBANK)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-cyan-500 font-mono uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={analyzingTicker || !searchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-md shadow-cyan-600/20"
                >
                  {analyzingTicker ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  <span>Check Safety</span>
                </button>
              </form>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
                  <div className="p-1 max-h-64 overflow-y-auto divide-y divide-slate-800">
                    {suggestions.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => handleDirectSearch(item.ticker)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-800 rounded-lg transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-white group-hover:text-cyan-400 text-sm">
                            {item.ticker}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[200px]">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 shrink-0">
                          {item.exchange}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Universe Selector (NIFTY 50 vs Watchlist) */}
            <div className="flex items-center gap-2 self-start md:self-auto">
              <span className="text-xs font-semibold text-slate-400">Universe:</span>
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setUniverse("nifty50");
                    setHideLiquid(false);
                    fetchData("nifty50");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    universe === "nifty50"
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  NIFTY 50 (Official)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUniverse("watchlist");
                    fetchData("watchlist");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    universe === "watchlist"
                      ? "bg-cyan-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  My Watchlist
                </button>
              </div>
            </div>
          </div>

          {/* Risk Filter Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/80 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-400">Filter By Risk:</span>
              {(["ALL", "EXTREME", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
                const active = riskFilter === lvl;
                const c =
                  lvl === "EXTREME" ? "text-purple-300 border-purple-500/60 bg-purple-950/60"
                  : lvl === "HIGH" ? "text-rose-300 border-rose-500/60 bg-rose-950/60"
                  : lvl === "MEDIUM" ? "text-amber-300 border-amber-500/60 bg-amber-950/60"
                  : lvl === "LOW" ? "text-emerald-300 border-emerald-500/60 bg-emerald-950/60"
                  : "text-cyan-300 border-cyan-500/60 bg-cyan-950/60";
                return (
                  <button
                    key={lvl}
                    id={`filter-${lvl.toLowerCase()}`}
                    onClick={() => setRiskFilter(lvl)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                      active ? c : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>

            {/* Liquid Filter Switch */}
            <button
              onClick={() => setHideLiquid(!hideLiquid)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                hideLiquid
                  ? "bg-amber-950/70 border-amber-500/40 text-amber-300"
                  : "bg-slate-950 border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Hide Large Liquid Caps: {hideLiquid ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => fetchData()}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stock Surveillance Table */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Live Stock Surveillance Table</h2>
              <p className="text-xs text-slate-400 mt-0.5">Click any stock row to open detailed signals, charts &amp; manipulation breakdown</p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              Showing {filteredStocks.length} of {stocks.length} stocks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  <th className="py-3.5 px-5">Stock Ticker</th>
                  <th className="py-3.5 px-5">Current Price</th>
                  <th className="py-3.5 px-5">1-Day Change</th>
                  <th className="py-3.5 px-5">Volume</th>
                  <th className="py-3.5 px-5">Manipulation Score</th>
                  <th className="py-3.5 px-5 text-right">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {loading && stocks.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {SKELETON_WIDTHS.map((w, j) => (
                        <td key={j} className="py-4 px-5">
                          <div className="h-4 rounded bg-slate-800 animate-pulse" style={{ width: `${w}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 px-5 text-center text-slate-400">
                      <Eye className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                      <p className="text-sm font-semibold">No stocks found matching the active filter.</p>
                      <button
                        onClick={() => {
                          setRiskFilter("ALL");
                          setHideLiquid(false);
                          setSearchQuery("");
                        }}
                        className="mt-3 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-400 border border-slate-700"
                      >
                        Reset All Filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const colors = getRiskColors(stock.risk_level);
                    return (
                      <tr
                        key={stock.ticker}
                        onClick={() => setSelectedStock(stock)}
                        className="hover:bg-slate-800/60 cursor-pointer transition-colors group"
                      >
                        {/* Stock & Exchange */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold font-mono text-cyan-400 text-sm group-hover:border-cyan-500 transition-colors">
                              {stock.ticker.slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-white text-base group-hover:text-cyan-300 font-mono transition-colors">
                                  {stock.ticker}
                                </span>
                                {stock.demo && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[10px] font-bold border border-amber-800">
                                    DEMO
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-slate-400 font-mono">{stock.exchange}</span>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-4 px-5 font-mono font-bold text-base text-slate-100">
                          ₹{stock.price.toLocaleString("en-IN")}
                        </td>

                        {/* Price Change */}
                        <td className="py-4 px-5 font-mono">
                          <span
                            className={`inline-flex items-center gap-1 text-sm font-extrabold px-2 py-0.5 rounded-md ${
                              stock.price_change_percent >= 0
                                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
                                : "bg-rose-950/60 text-rose-300 border border-rose-800"
                            }`}
                          >
                            {stock.price_change_percent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {stock.price_change_percent >= 0 ? "+" : ""}
                            {stock.price_change_percent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Volume */}
                        <td className="py-4 px-5 font-mono text-slate-300 text-sm">
                          {(stock.volume / 100000).toFixed(1)}L
                        </td>

                        {/* Risk Score Progress Bar */}
                        <td className="py-4 px-5">
                          <div className="w-36 space-y-1.5">
                            <div className="flex justify-between text-xs font-mono">
                              <span className="text-slate-400">Risk Score</span>
                              <span className={`font-bold ${colors.text}`}>{stock.risk_score} / 100</span>
                            </div>
                            <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                                style={{ width: `${Math.min(100, Math.max(5, stock.risk_score))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Risk Level Badge */}
                        <td className="py-4 px-5 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase font-mono border ${colors.badge}`}>
                            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                            {stock.risk_level}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
            <span>{disclaimer}</span>
            <span className="flex items-center gap-1.5 font-mono text-cyan-400">
              <BarChart2 className="w-4 h-4" />
              Click any stock to see full technical radar &amp; signals
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 font-mono">
        SentinelMarket © {new Date().getFullYear()} — Institutional Market Surveillance &amp; AI Anomaly Engine — NSE India
      </footer>

      {/* Watchlist Modal */}
      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        apiBase={API_BASE}
        onWatchlistUpdated={() => fetchData()}
      />

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetailPanel key={selectedStock.ticker} stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}
