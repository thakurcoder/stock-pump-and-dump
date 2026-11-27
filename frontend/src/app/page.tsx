"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Flame,
  Search,
  RefreshCw,
  Compass,
  ListFilter,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  HelpCircle,
  Activity,
  Layers,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import StockDetailPanel, { type Stock } from "./components/StockDetailPanel";
import WatchlistModal from "./components/WatchlistModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MarketIndex {
  symbol: string;
  value: number;
  change: number;
  change_percent: number;
  positive: boolean;
}

export default function Dashboard() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "SAFE" | "ATTENTION" | "DANGER">("ALL");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [marketStatus, setMarketStatus] = useState("closed");
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [universe, setUniverse] = useState<"nifty50" | "watchlist">("nifty50");
  const [analyzingTicker, setAnalyzingTicker] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Array<{ ticker: string; name: string; exchange: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Search autocomplete
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
      } catch (err) {}
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
        throw new Error(`Stock '${clean}' not found on NSE.`);
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
      }
    } catch (err: any) {
      setError("Failed to connect to stock server. Please verify backend is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 60_000);
    return () => clearInterval(interval);
  }, [universe]);

  // Map 1st-standard friendly risk buckets
  const getSimpleStatus = (level: string) => {
    const l = level.toUpperCase();
    if (l === "LOW") {
      return {
        label: "SAFE TO BUY",
        sub: "Normal trading, genuine buyers",
        badge: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
        traffic: "bg-emerald-400",
        icon: ShieldCheck,
        type: "SAFE",
      };
    } else if (l === "MEDIUM") {
      return {
        label: "WATCH CAREFULLY",
        sub: "Moving fast, keep eyes open",
        badge: "bg-amber-950/80 text-amber-300 border-amber-500/40",
        traffic: "bg-amber-400",
        icon: AlertTriangle,
        type: "ATTENTION",
      };
    } else {
      return {
        label: "DANGER / TRAP",
        sub: "Fake volume or operator pump",
        badge: "bg-rose-950/80 text-rose-300 border-rose-500/40",
        traffic: "bg-rose-500 animate-pulse",
        icon: Flame,
        type: "DANGER",
      };
    }
  };

  const filteredStocks = stocks.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      s.ticker.toLowerCase().includes(q) || s.exchange.toLowerCase().includes(q);

    const status = getSimpleStatus(s.risk_level);
    const matchFilter =
      riskFilter === "ALL" || status.type === riskFilter;

    return matchSearch && matchFilter;
  });

  const safeCount = stocks.filter((s) => s.risk_level.toUpperCase() === "LOW").length;
  const watchCount = stocks.filter((s) => s.risk_level.toUpperCase() === "MEDIUM").length;
  const dangerCount = stocks.filter((s) => ["HIGH", "EXTREME"].includes(s.risk_level.toUpperCase())).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#050b14] text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* ── TOP NAVIGATION BAR ── */}
      <header className="sticky top-0 z-40 border-b border-[#142338] bg-[#081220]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between gap-4">
            {/* Brand Logo & Child-Friendly Title */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#0c1a2e] border-2 border-[#1e3a5f] flex items-center justify-center shadow-lg shadow-black/40">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    Stock Guardian
                  </h1>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    LIVE
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-400">
                  Traffic Light System for Safe vs Dangerous Stocks
                </p>
              </div>
            </div>

            {/* Top Right Action Buttons */}
            <div className="flex items-center gap-3">
              {/* Market Status (Green = Open, Grey = Closed) */}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold ${
                  marketStatus === "open"
                    ? "bg-[#092218] border-emerald-500/40 text-emerald-300"
                    : "bg-[#0c1a2e] border-[#1e3a5f] text-slate-400"
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    marketStatus === "open" ? "bg-emerald-400 animate-ping" : "bg-slate-500"
                  }`}
                />
                <span>{marketStatus === "open" ? "Indian Market Open" : "Market Closed"}</span>
              </div>

              {/* Big Direct Button to Trading Recommendations */}
              <Link
                href="/recommendations"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d223a] hover:bg-[#122e4e] text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-bold shadow-md transition-all hover:scale-[1.02]"
              >
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>NIFTY Options &amp; Ideas &rarr;</span>
              </Link>

              {/* Refresh Button */}
              <button
                onClick={() => fetchData()}
                disabled={loading}
                title="Refresh stock prices"
                aria-label="Refresh stock prices"
                className="p-2.5 rounded-xl bg-[#0c1a2e] hover:bg-[#122846] border border-[#1e3a5f] text-slate-300 hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Indices Bar */}
          <div className="border-t border-[#142338] py-2 flex items-center gap-4 overflow-x-auto text-xs whitespace-nowrap scrollbar-none">
            <span className="flex items-center gap-1.5 font-bold text-slate-400 uppercase tracking-wider text-[11px]">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Live Market Meters:
            </span>
            {indices.map((idx) => (
              <div
                key={idx.symbol}
                className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0c1a2e] border border-[#142944] font-medium"
              >
                <span className="text-slate-300 font-bold">{idx.symbol}</span>
                <span className="font-mono text-white font-bold">{idx.value.toLocaleString("en-IN")}</span>
                <span className={`font-mono font-bold flex items-center gap-0.5 ${idx.positive ? "text-emerald-400" : "text-rose-400"}`}>
                  {idx.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {idx.positive ? "+" : ""}
                  {idx.change_percent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-7">
        
        {/* 1ST-STANDARD SIMPLE TRAFFIC LIGHT EXPLAINER CARD */}
        <div className="rounded-3xl border border-[#162d4c] bg-gradient-to-b from-[#091526] to-[#07111f] p-6 shadow-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest font-mono">
                <Sparkles className="w-4 h-4" />
                <span>Super Simple Rule For Beginners</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                How To Read Any Stock In 3 Seconds
              </h2>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#12243d] text-slate-300 border border-[#1e3a5f] self-start sm:self-auto">
              Follow The Colors Like Traffic Lights 🚦
            </span>
          </div>

          {/* 3 Large Child-Friendly Traffic Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {/* Green / Safe */}
            <div
              onClick={() => setRiskFilter("SAFE")}
              className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                riskFilter === "SAFE"
                  ? "bg-[#082419] border-emerald-400 ring-2 ring-emerald-500/30"
                  : "bg-[#0b1b2d] border-[#183457] hover:border-emerald-500/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-emerald-400 shadow-md shadow-emerald-400/50" />
                  <span className="text-base font-black text-emerald-300">GREEN = SAFE</span>
                </div>
                <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  {safeCount} Stocks
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                Real buyers, honest companies. No fake pump. Good for normal investing.
              </p>
            </div>

            {/* Amber / Watch */}
            <div
              onClick={() => setRiskFilter("ATTENTION")}
              className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                riskFilter === "ATTENTION"
                  ? "bg-[#291e0a] border-amber-400 ring-2 ring-amber-500/30"
                  : "bg-[#0b1b2d] border-[#183457] hover:border-amber-500/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-amber-400 shadow-md shadow-amber-400/50" />
                  <span className="text-base font-black text-amber-300">YELLOW = WATCH</span>
                </div>
                <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                  {watchCount} Stocks
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                Price is running fast. Can give profit, but keep a safety stop loss.
              </p>
            </div>

            {/* Red / Danger */}
            <div
              onClick={() => setRiskFilter("DANGER")}
              className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                riskFilter === "DANGER"
                  ? "bg-[#2a0e14] border-rose-400 ring-2 ring-rose-500/30"
                  : "bg-[#0b1b2d] border-[#183457] hover:border-rose-500/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-4 h-4 rounded-full bg-rose-500 animate-pulse shadow-md shadow-rose-500/50" />
                  <span className="text-base font-black text-rose-300">RED = TRAP / DANGER</span>
                </div>
                <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                  {dangerCount} Stocks
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-2 font-medium leading-relaxed">
                Fake volume trap. People pump price up to dump it later. Do NOT buy blindly!
              </p>
            </div>
          </div>
        </div>

        {/* ── SEARCH & FILTER CONTROLS ── */}
        <div className="p-5 rounded-3xl bg-[#081527] border border-[#152a47] space-y-4 shadow-xl">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <form onSubmit={(e) => handleDirectSearch(undefined, e)} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
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
                    placeholder="Type any stock name: e.g. TATA, RELIANCE, INFOSYS..."
                    className="w-full pl-12 pr-4 py-3 rounded-2xl bg-[#050c17] border-2 border-[#193355] text-white placeholder:text-slate-500 text-sm sm:text-base font-semibold focus:outline-none focus:border-emerald-400 transition"
                  />
                </div>
                <button
                  type="submit"
                  disabled={analyzingTicker || !searchQuery.trim()}
                  className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 shrink-0 disabled:opacity-40"
                >
                  {analyzingTicker ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Test Safety</span>
                </button>
              </form>

              {/* Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-[#071221] border border-[#1b365a] shadow-2xl overflow-hidden">
                  <div className="p-1 max-h-60 overflow-y-auto divide-y divide-[#13253e]">
                    {suggestions.map((item) => (
                      <button
                        key={item.ticker}
                        type="button"
                        onClick={() => handleDirectSearch(item.ticker)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#0c1f38] transition flex items-center justify-between"
                      >
                        <span className="font-bold text-white text-sm">{item.ticker}</span>
                        <span className="text-xs text-slate-400 truncate max-w-[220px]">{item.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Universe Selector */}
            <div className="flex items-center gap-2 bg-[#050c17] p-1.5 rounded-2xl border border-[#193355] self-start md:self-auto">
              <span className="text-xs font-bold text-slate-400 pl-2">Market List:</span>
              <button
                type="button"
                onClick={() => {
                  setUniverse("nifty50");
                  fetchData("nifty50");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  universe === "nifty50"
                    ? "bg-[#102744] text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Top 50 Giants (NIFTY 50)
              </button>
              <button
                type="button"
                onClick={() => {
                  setUniverse("watchlist");
                  fetchData("watchlist");
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                  universe === "watchlist"
                    ? "bg-[#102744] text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                My Saved Watchlist
              </button>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#132742] flex-wrap">
            <span className="text-xs font-bold text-slate-400">Show Only:</span>
            {[
              { id: "ALL", label: "Show Everything" },
              { id: "SAFE", label: "🟢 Safe Stocks Only" },
              { id: "ATTENTION", label: "🟡 Moving Fast (Watch)" },
              { id: "DANGER", label: "🔴 Possible Trap / Dump" },
            ].map((f) => {
              const active = riskFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setRiskFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    active
                      ? "bg-emerald-950 text-emerald-300 border-emerald-500 shadow-sm"
                      : "bg-[#060e1b] text-slate-400 border-[#142944] hover:text-white hover:border-[#1e3d66]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── STOCK LIST TABLE ── */}
        <div className="rounded-3xl border border-[#152a47] bg-[#071324] shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-[#142844] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-white">Stock Inspection List</h3>
              <p className="text-xs text-slate-400 mt-0.5">Click any row below to open deep analysis and safety report</p>
            </div>
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#0a1829] text-slate-300 border border-[#193355]">
              Showing {filteredStocks.length} Stocks
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#142844] bg-[#050e1c] text-xs font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">Company / Stock</th>
                  <th className="py-4 px-6">Price</th>
                  <th className="py-4 px-6">Today's Move</th>
                  <th className="py-4 px-6">Trading Volume</th>
                  <th className="py-4 px-6">Danger Meter (0-100)</th>
                  <th className="py-4 px-6 text-right">What Should You Do?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#10223a]">
                {loading && stocks.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={6} className="py-5 px-6">
                        <div className="h-6 bg-[#0c1a2e] rounded-xl w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      <p className="text-base font-bold">No stocks match your filter.</p>
                      <button
                        onClick={() => {
                          setRiskFilter("ALL");
                          setSearchQuery("");
                        }}
                        className="mt-3 px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                      >
                        Reset Filter
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const status = getSimpleStatus(stock.risk_level);
                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={stock.ticker}
                        onClick={() => setSelectedStock(stock)}
                        className="hover:bg-[#0c1e36] transition-colors cursor-pointer group"
                      >
                        {/* Company / Stock */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <span className={`w-3 h-3 rounded-full shrink-0 ${status.traffic}`} />
                            <div>
                              <p className="font-black text-white text-base group-hover:text-emerald-300 transition-colors">
                                {stock.ticker}
                              </p>
                              <span className="text-[11px] font-mono text-slate-400">{stock.exchange}</span>
                            </div>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-4 px-6 font-mono font-bold text-base text-white">
                          ₹{stock.price.toLocaleString("en-IN")}
                        </td>

                        {/* Today's Move */}
                        <td className="py-4 px-6 font-mono">
                          <span
                            className={`inline-flex items-center gap-1 font-black text-sm px-2.5 py-0.5 rounded-lg border ${
                              stock.price_change_percent >= 0
                                ? "bg-emerald-950/70 text-emerald-300 border-emerald-500/30"
                                : "bg-rose-950/70 text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {stock.price_change_percent >= 0 ? "+" : ""}
                            {stock.price_change_percent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Volume */}
                        <td className="py-4 px-6 font-mono text-slate-300 text-sm">
                          {(stock.volume / 100000).toFixed(1)} Lakh Shares
                        </td>

                        {/* Danger Meter Bar */}
                        <td className="py-4 px-6">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between text-xs font-bold font-mono">
                              <span className="text-slate-400">Score</span>
                              <span className={stock.risk_score > 55 ? "text-rose-400" : stock.risk_score > 35 ? "text-amber-400" : "text-emerald-400"}>
                                {stock.risk_score}/100
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-[#0a1829] overflow-hidden border border-[#193355]">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  stock.risk_score > 55 ? "bg-rose-500" : stock.risk_score > 35 ? "bg-amber-400" : "bg-emerald-400"
                                }`}
                                style={{ width: `${Math.min(100, Math.max(5, stock.risk_score))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Advice Badge */}
                        <td className="py-4 px-6 text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border uppercase font-mono ${status.badge}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{status.label}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#132742] py-6 text-center text-xs text-slate-500 font-mono">
        Stock Guardian © {new Date().getFullYear()} — Traffic Light Surveillance For Retail Investors — NSE India
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
