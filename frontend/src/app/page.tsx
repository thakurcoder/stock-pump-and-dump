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

// Fixed widths so server and client render the same skeleton (no hydration warning)
const SKELETON_WIDTHS = [70, 85, 60, 75, 90, 65];

export default function Dashboard() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [hideLiquid, setHideLiquid] = useState(true);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [marketStatus, setMarketStatus] = useState("closed");
  const [disclaimer, setDisclaimer] = useState(
    "Screening tool only. Flags suspicious patterns, not proof of manipulation."
  );
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [universe, setUniverse] = useState<"watchlist" | "nifty50">("watchlist");
  const [analyzingTicker, setAnalyzingTicker] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ ticker: string; name: string; exchange: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

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

    // First check if it's already in our loaded stocks list
    const found = stocks.find((s) => s.ticker.toUpperCase() === clean);
    if (found) {
      setSelectedStock(found);
      setSearchError(null);
      return;
    }

    // Otherwise, fetch on-demand live safety analysis directly from backend
    setAnalyzingTicker(true);
    setSearchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stock/${encodeURIComponent(clean)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`NSE Stock '${clean}' not found or has insufficient history on NSE.`);
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

      // Add to current stocks list if not already present so user can see it in table too
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
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(
        err?.message || "Could not reach screening server. Please verify backend is running."
      );
    } finally {
      setLoading(false);
      setLastRefreshed(new Date().toLocaleTimeString("en-IN"));
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
  const suspiciousCount = stocks.filter((s) => s.is_suspicious).length;
  const demoCount = stocks.filter((s) => s.demo).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div className="leading-tight">
                <p className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white to-sky-400 bg-clip-text text-transparent">
                  SentinelMarket
                </p>
                <p className="text-[10px] font-mono tracking-widest uppercase text-sky-500">Anomaly Surveillance</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  marketStatus === "open"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-slate-800 border-white/10 text-slate-400"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${marketStatus === "open" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                {marketStatus === "open" ? "Market Open" : "Market Closed"}
              </div>

              {lastRefreshed && (
                <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="w-3.5 h-3.5" />
                  {lastRefreshed}
                </div>
              )}

              <Link
                href="/recommendations"
                title="View Trading Recommendations (Options first, then Stocks)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition-all shadow-sm"
              >
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Recommendations</span>
              </Link>

              <button
                onClick={() => setIsWatchlistOpen(true)}
                title="Manage Watchlist"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/20 text-sky-400 hover:text-sky-300 text-xs font-semibold transition-all"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Watchlist</span>
              </button>

              <button
                onClick={() => fetchData()}
                disabled={loading}
                title="Refresh"
                className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Indices ticker */}
          <div className="border-t border-white/[0.04] py-2 flex items-center gap-5 overflow-x-auto scrollbar-none pb-2.5 text-xs whitespace-nowrap">
            <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-600 shrink-0">
              <Activity className="w-3.5 h-3.5 text-sky-500" />
              Indices
            </span>
            {indices.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-7 w-36 rounded-md bg-white/[0.03] animate-pulse" />
                ))
              : indices.map((idx) => (
                  <div
                    key={idx.symbol}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-sky-500/20 transition-colors"
                  >
                    <span className="font-semibold text-slate-200 text-[11px]">{idx.symbol}</span>
                    <span className="font-mono text-slate-300">{idx.value.toLocaleString("en-IN")}</span>
                    <span className={`flex items-center gap-0.5 font-mono font-semibold ${idx.positive ? "text-emerald-400" : "text-rose-400"}`}>
                      {idx.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {idx.positive ? "+" : ""}
                      {idx.change_percent.toFixed(2)}%
                    </span>
                  </div>
                ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-950/60 via-indigo-950/40 to-slate-900/80 border border-sky-500/15 p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-10 w-56 h-56 rounded-full bg-indigo-600/10 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[11px] font-bold uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5" />
                Phase 1 — Surveillance Engine
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                Real-Time Pump &amp; Dump<br className="hidden sm:block" /> Scheme Detection
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Z-score volume analysis, RSI divergence, and Bollinger Band breach detection across NSE/BSE to protect
                retail investors from market manipulation.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0">
              {[
                { label: "Scanned", value: stocks.length, color: "text-sky-400" },
                { label: "Suspicious", value: suspiciousCount, color: "text-rose-400" },
                { label: "Extreme", value: extremeCount, color: "text-purple-400" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center px-4 py-3 rounded-xl bg-white/[0.04] border border-white/10 backdrop-blur-sm"
                >
                  <span className={`text-2xl font-extrabold font-mono ${stat.color}`}>{stat.value}</span>
                  <span className="text-[11px] text-slate-500 mt-0.5 font-medium">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative max-w-md w-full">
              <form onSubmit={(e) => handleDirectSearch(undefined, e)} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
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
                    placeholder="Analyze any NSE Stock (e.g. INFOSYS, ZOMATO, SUZLON)..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all font-mono uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={analyzingTicker || !searchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 shadow-lg shadow-sky-500/20"
                  title="Run real-time safety & manipulation analysis for this stock"
                >
                  {analyzingTicker ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  {analyzingTicker ? "Analyzing..." : "Check Safety"}
                </button>
              </form>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl bg-slate-900 border border-white/10 shadow-2xl overflow-hidden backdrop-blur-xl">
                  <div className="p-1 max-h-64 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin">
                    {suggestions.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => handleDirectSearch(item.ticker)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-white/[0.06] rounded-lg transition-colors flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono font-bold text-white group-hover:text-sky-400 text-sm">
                            {item.ticker}
                          </span>
                          <span className="text-xs text-slate-400 truncate max-w-[200px]">
                            {item.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/10 text-sky-400 shrink-0">
                          {item.exchange}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Universe Selector (Watchlist vs Nifty 50) */}
              <div className="flex items-center bg-white/[0.04] p-0.5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setUniverse("watchlist");
                    fetchData("watchlist");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    universe === "watchlist"
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Watchlist
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUniverse("nifty50");
                    setHideLiquid(false); // In Nifty 50 mode, disable hiding liquid stocks so all 50 show
                    fetchData("nifty50");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    universe === "nifty50"
                      ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  NIFTY 50
                </button>
              </div>

              <button
                onClick={() => setHideLiquid(!hideLiquid)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide border transition-all flex items-center gap-1.5 ${
                  hideLiquid
                    ? "bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-sm shadow-sky-500/20"
                    : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300"
                }`}
                title="Filter out large-cap, highly liquid stocks which can score Medium/High on standard earnings or news"
              >
                <Zap className="w-3.5 h-3.5" />
                Hide Liquid: {hideLiquid ? "ON" : "OFF"}
              </button>

              {(["ALL", "EXTREME", "HIGH", "MEDIUM", "LOW"] as const).map((lvl) => {
                const active = riskFilter === lvl;
                const c =
                  lvl === "EXTREME" ? "text-purple-300 border-purple-500/40 bg-purple-500/15"
                  : lvl === "HIGH" ? "text-rose-300 border-rose-500/40 bg-rose-500/15"
                  : lvl === "MEDIUM" ? "text-amber-300 border-amber-500/40 bg-amber-500/15"
                  : lvl === "LOW" ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/15"
                  : "text-sky-300 border-sky-500/40 bg-sky-500/15";
                return (
                  <button
                    key={lvl}
                    id={`filter-${lvl.toLowerCase()}`}
                    onClick={() => setRiskFilter(lvl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide border transition-all ${
                      active ? c : "bg-white/[0.03] border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20"
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {searchError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                {searchError}
              </span>
              <button
                onClick={() => setSearchError(null)}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Disclaimer Banner */}
        <div className="px-4 py-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="font-medium">{disclaimer}</span>
          </div>
          <span className="text-[11px] text-sky-400 font-mono shrink-0 hidden sm:inline">Engine: PumpWatch v0.1.0</span>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              onClick={() => fetchData()}
              className="px-3 py-1 rounded bg-rose-500/30 hover:bg-rose-500/40 text-xs font-bold text-white transition-all shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {demoCount > 0 && (
          <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
            {demoCount} of {stocks.length} stocks show simulated demo data because live prices could not be fetched. They are marked DEMO.
          </div>
        )}

        {/* Stock Table */}
        <div className="rounded-2xl overflow-hidden bg-slate-900/60 border border-white/[0.07] shadow-2xl shadow-black/40 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {["Stock & Exchange", "Price (₹)", "Change", "Volume", "Risk Score", "Risk Level"].map((h, i) => (
                    <th
                      key={h}
                      className={`px-5 py-3.5 text-[11px] font-bold uppercase tracking-widest text-slate-500 font-mono ${i === 5 ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {/* Skeleton only on first load, so the 30s auto-refresh doesn't blank the table */}
                {loading && stocks.length === 0 ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {SKELETON_WIDTHS.map((w, j) => (
                        <td key={j} className="px-5 py-4">
                          <div className="h-4 rounded-md bg-white/[0.04] animate-pulse" style={{ width: `${w}%` }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-slate-500">
                      <Eye className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      No stocks matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const colors = getRiskColors(stock.risk_level);
                    return (
                      <tr
                        key={stock.ticker}
                        id={`row-${stock.ticker}`}
                        onClick={() => setSelectedStock(stock)}
                        className="group cursor-pointer hover:bg-white/[0.03] transition-all"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-slate-800/80 border border-white/10 group-hover:border-sky-500/30 flex items-center justify-center text-xs font-extrabold text-slate-300 transition-colors shrink-0">
                              {stock.ticker.slice(0, 2)}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-bold text-white group-hover:text-sky-400 transition-colors">
                                  {stock.ticker}
                                  {stock.demo && (
                                    <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold align-middle">
                                      DEMO
                                    </span>
                                  )}
                                </p>
                                <Link
                                  href={`/stock/${stock.ticker}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Open dedicated full page"
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 text-slate-400 hover:text-sky-400 transition-all"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </Link>
                              </div>
                              <p className="text-[11px] text-slate-500 font-mono">{stock.exchange}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 font-mono font-semibold text-slate-200">{stock.price.toLocaleString("en-IN")}</td>

                        <td className="px-5 py-4 font-mono">
                          <span className={`inline-flex items-center gap-1 text-sm font-bold ${stock.price_change_percent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {stock.price_change_percent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {stock.price_change_percent >= 0 ? "+" : ""}
                            {stock.price_change_percent.toFixed(2)}%
                          </span>
                        </td>

                        <td className="px-5 py-4 font-mono text-slate-400 text-xs">{(stock.volume / 1_00_000).toFixed(1)}L</td>

                        <td className="px-5 py-4">
                          <div className="w-32 space-y-1.5">
                            <div className="flex justify-between text-[11px] font-mono">
                              <span className="text-slate-500">Score</span>
                              <span className={`font-bold ${colors.text}`}>{stock.risk_score}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-700 ${colors.bar}`} style={{ width: `${stock.risk_score}%` }} />
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase font-mono ${colors.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
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

          <div className="px-5 py-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] text-slate-600 font-mono">
            <span>
              {filteredStocks.length} of {stocks.length} stocks shown
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5" />
              Click a row for full analysis
            </span>
          </div>
        </div>
      </main>

      <footer className="border-t border-white/[0.05] py-4 text-center text-xs text-slate-700 font-mono">
        SentinelMarket © {new Date().getFullYear()} — AI-Powered Market Surveillance — NSE / BSE
      </footer>

      {/* Watchlist Modal */}
      <WatchlistModal
        isOpen={isWatchlistOpen}
        onClose={() => setIsWatchlistOpen(false)}
        apiBase={API_BASE}
        onWatchlistUpdated={() => fetchData()}
      />

      {/* Detail panel: fetches its own data and stays open on errors */}
      {selectedStock && (
        <StockDetailPanel key={selectedStock.ticker} stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}