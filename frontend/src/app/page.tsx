"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Terminal,
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Compass,
  ListFilter,
  ShieldAlert,
  Flame,
  Zap,
  Cpu,
  BarChart2,
  Maximize2,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  SlidersHorizontal,
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

export default function TerminalDashboard() {
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<"ALL" | "EXTREME" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [marketStatus, setMarketStatus] = useState("closed");
  const [isWatchlistOpen, setIsWatchlistOpen] = useState(false);
  const [universe, setUniverse] = useState<"nifty50" | "watchlist">("nifty50");
  const [analyzingTicker, setAnalyzingTicker] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastTickTime, setLastTickTime] = useState<string>("");
  const [suggestions, setSuggestions] = useState<Array<{ ticker: string; name: string; exchange: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Keyboard shortcut listener for terminal efficiency
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") {
        setUniverse("nifty50");
      } else if (e.key === "2") {
        setUniverse("watchlist");
      } else if (e.key === "r" || e.key === "R") {
        fetchData();
      } else if (e.key === "/") {
        e.preventDefault();
        document.getElementById("terminal-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [universe]);

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
    }, 150);

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
        throw new Error(`TICKER '${clean}' REJECTED OR NOT TRADED ON NSE.`);
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
      setSearchError(err?.message || `ERR: UNABLE TO RESOLVE ${clean}`);
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
      setLastTickTime(new Date().toLocaleTimeString("en-IN", { hour12: false }));
    } catch (err: any) {
      setError("COMMUNICATION ERROR: UPSTREAM FEED DOWN");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30_000);
    return () => clearInterval(interval);
  }, [universe]);

  const filteredStocks = stocks.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchSearch =
      s.ticker.toLowerCase().includes(q) || s.exchange.toLowerCase().includes(q);
    const matchFilter =
      riskFilter === "ALL" || s.risk_level.toUpperCase() === riskFilter;
    return matchSearch && matchFilter;
  });

  const extremeCount = stocks.filter((s) => s.risk_level.toUpperCase() === "EXTREME").length;
  const highCount = stocks.filter((s) => s.risk_level.toUpperCase() === "HIGH").length;
  const medCount = stocks.filter((s) => s.risk_level.toUpperCase() === "MEDIUM").length;
  const lowCount = stocks.filter((s) => s.risk_level.toUpperCase() === "LOW").length;

  return (
    <div className="min-h-screen flex flex-col bg-[#070709] text-[#e1e4ea] font-mono selection:bg-[#00f5a0]/30 selection:text-white antialiased">
      {/* ── TOP TERMINAL TICKER / SYSTEM STATUS ── */}
      <header className="border-b border-[#1c1f26] bg-[#0c0d12] sticky top-0 z-40">
        {/* Terminal Header Row 1 */}
        <div className="px-5 py-3 border-b border-[#1c1f26] flex flex-wrap items-center justify-between text-sm gap-3">
          <div className="flex items-center gap-3">
            {/* Terminal Logo */}
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-[#00f5a0] animate-ping" />
              <span className="font-black text-base sm:text-lg tracking-wider text-white uppercase flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#00f5a0]" />
                SENTINEL//TERMINAL <span className="text-xs text-slate-500 font-normal">v2.4 PRO</span>
              </span>
            </div>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300">
              STATUS:{" "}
              <span className={marketStatus === "open" ? "text-[#00f5a0] font-bold" : "text-amber-400 font-bold"}>
                {marketStatus === "open" ? "FEED:LIVE (NSE)" : "FEED:OFFLINE (POST-MARKET)"}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick hotkeys bar */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-300 border border-[#1f222b] px-2.5 py-1 rounded bg-[#101217]">
              <span>KEYS:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-[#1c202a] text-[#00f5a0] font-bold">1</kbd> NIFTY
              <kbd className="px-1.5 py-0.5 rounded bg-[#1c202a] text-[#00f5a0] font-bold">2</kbd> WATCHLIST
              <kbd className="px-1.5 py-0.5 rounded bg-[#1c202a] text-[#00f5a0] font-bold">R</kbd> REFRESH
              <kbd className="px-1.5 py-0.5 rounded bg-[#1c202a] text-[#00f5a0] font-bold">/</kbd> FIND
            </div>

            <span className="text-xs text-slate-300">
              SYS-TIME: <span className="text-white font-bold">{lastTickTime || "SYNCING"}</span>
            </span>

            {/* Direct F&O Desk Button */}
            <Link
              href="/recommendations"
              className="px-3.5 py-1.5 bg-[#101b2a] hover:bg-[#16273e] text-[#00d2ff] border border-[#00d2ff]/40 rounded text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition"
            >
              <Compass className="w-4 h-4 text-[#00d2ff]" />
              <span>F&amp;O Options Desk &rarr;</span>
            </Link>

            {/* Refresh */}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              title="Force Refresh (Key: R)"
              aria-label="Force Refresh"
              className="p-1.5 rounded bg-[#161820] hover:bg-[#202430] border border-[#252a36] text-slate-300 hover:text-white transition disabled:opacity-40"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[#00f5a0]" : ""}`} />
            </button>
          </div>
        </div>

        {/* Live Index Quotes Bar (Bloomberg Ticker Ribbon) */}
        <div className="px-5 py-2 bg-[#08090c] overflow-x-auto flex items-center gap-8 text-xs sm:text-sm whitespace-nowrap scrollbar-none border-b border-[#161820]">
          <span className="text-xs text-slate-400 font-bold tracking-widest uppercase flex items-center gap-1.5 shrink-0">
            <Radio className="w-3.5 h-3.5 text-[#00f5a0] animate-pulse" />
            BENCHMARKS:
          </span>
          {indices.map((idx) => (
            <div key={idx.symbol} className="flex items-center gap-2.5 shrink-0">
              <span className="text-slate-300 font-bold">{idx.symbol}</span>
              <span className="text-white font-bold">{idx.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              <span className={`flex items-center text-xs font-black ${idx.positive ? "text-[#00f5a0]" : "text-[#ff3b69]"}`}>
                {idx.positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {idx.positive ? "+" : ""}
                {idx.change.toFixed(2)} ({idx.change_percent.toFixed(2)}%)
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ── TERMINAL COMMAND & METRICS DECK ── */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 sm:p-5 space-y-4">
        
        {/* Top Summary / Anomaly Counter Banner */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
          {/* Active Universe Box */}
          <div className="p-3.5 bg-[#0d0f14] border border-[#1c1f26] rounded flex flex-col justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">ACTIVE FEED</span>
            <div className="text-base sm:text-lg font-black text-white mt-1">
              {universe === "nifty50" ? "NIFTY 50 (TOP CAPS)" : "CUSTOM WATCHLIST"}
            </div>
            <span className="text-xs text-[#00d2ff] font-bold">SCANNING {stocks.length} SECURITIES</span>
          </div>

          {/* Normal/Safe count */}
          <div className="p-3.5 bg-[#0d0f14] border border-[#1c1f26] rounded flex flex-col justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">NORMAL FLOW</span>
            <div className="text-2xl font-black text-[#00f5a0] mt-1">{lowCount} STOCKS</div>
            <span className="text-xs text-slate-400 font-semibold">INSTITUTIONAL FLOW</span>
          </div>

          {/* Medium count */}
          <div className="p-3.5 bg-[#0d0f14] border border-[#1c1f26] rounded flex flex-col justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">MOMENTUM</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{medCount} STOCKS</div>
            <span className="text-xs text-slate-400 font-semibold">ELEVATED VOL / RSI</span>
          </div>

          {/* High Alert count */}
          <div className="p-3.5 bg-[#0d0f14] border border-[#1c1f26] rounded flex flex-col justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">HIGH ANOMALY</span>
            <div className="text-2xl font-black text-[#ff3b69] mt-1">{highCount} STOCKS</div>
            <span className="text-xs text-[#ff3b69]/90 font-bold">&gt;3.0x VOL RATIO</span>
          </div>

          {/* Extreme Anomaly count */}
          <div className="p-3.5 bg-[#0d0f14] border border-[#1c1f26] rounded flex flex-col justify-between col-span-2 md:col-span-1">
            <span className="text-xs text-slate-400 uppercase tracking-widest font-bold">EXTREME ANOMALY</span>
            <div className="text-2xl font-black text-[#c084fc] mt-1">{extremeCount} STOCKS</div>
            <span className="text-xs text-[#c084fc]/90 font-bold">CRITICAL VOL / BREAK</span>
          </div>
        </div>

        {/* Command Search & Fast Filter Toolbar */}
        <div className="p-3 bg-[#0d0f14] border border-[#1c1f26] rounded flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-sm">
          {/* Terminal Search */}
          <div className="relative flex-1 max-w-xl">
            <form onSubmit={(e) => handleDirectSearch(undefined, e)} className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">&gt;</span>
                <input
                  id="terminal-search"
                  type="text"
                  value={searchQuery}
                  onFocus={() => setShowSuggestions(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                    if (searchError) setSearchError(null);
                  }}
                  placeholder="QUERY TICKER (e.g. RELIANCE, TCS, ZOMATO)..."
                  className="w-full pl-9 pr-3 py-2 bg-[#050608] border border-[#252833] text-white placeholder:text-slate-500 text-sm font-mono uppercase focus:outline-none focus:border-[#00f5a0]"
                />
              </div>
              <button
                type="submit"
                disabled={analyzingTicker || !searchQuery.trim()}
                className="px-4 py-2 bg-[#162a22] hover:bg-[#1f3f33] text-[#00f5a0] border border-[#00f5a0]/40 font-black uppercase text-xs sm:text-sm transition disabled:opacity-40"
              >
                {analyzingTicker ? "SCANNING..." : "EXEC_INSPECT"}
              </button>
            </form>

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0d0f14] border border-[#2d313d] shadow-2xl">
                {suggestions.map((item) => (
                  <button
                    key={item.ticker}
                    type="button"
                    onClick={() => handleDirectSearch(item.ticker)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-[#181b22] text-sm flex items-center justify-between border-b border-[#161820]"
                  >
                    <span className="font-bold text-[#00f5a0]">{item.ticker}</span>
                    <span className="text-slate-300 text-xs truncate max-w-[200px]">{item.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Universe Selector & Risk Filters */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center border border-[#1f222b] bg-[#050608] rounded p-0.5">
              <button
                onClick={() => {
                  setUniverse("nifty50");
                  fetchData("nifty50");
                }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold ${
                  universe === "nifty50" ? "bg-[#161922] text-[#00f5a0] border border-[#2e3442]" : "text-slate-400 hover:text-white"
                }`}
              >
                [1] NIFTY 50
              </button>
              <button
                onClick={() => {
                  setUniverse("watchlist");
                  fetchData("watchlist");
                }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold ${
                  universe === "watchlist" ? "bg-[#161922] text-[#00f5a0] border border-[#2e3442]" : "text-slate-400 hover:text-white"
                }`}
              >
                [2] WATCHLIST
              </button>
            </div>

            {/* Risk Filters */}
            <div className="flex items-center gap-1.5">
              {(["ALL", "EXTREME", "HIGH", "MEDIUM", "LOW"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  className={`px-2.5 py-1.5 text-xs font-bold uppercase border ${
                    riskFilter === r
                      ? "bg-[#1a2332] text-[#00d2ff] border-[#00d2ff]/50"
                      : "bg-[#050608] text-slate-400 border-[#1f222b] hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── HIGH-DENSITY TERMINAL DATA TABLE ── */}
        <div className="border border-[#1c1f26] bg-[#090a0d] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#0d0f14] border-b border-[#1c1f26] flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 font-bold text-slate-200">
              <SlidersHorizontal className="w-4 h-4 text-[#00f5a0]" />
              <span>LIVE SECURITIES SURVEILLANCE MATRIX</span>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              DISPLAYING {filteredStocks.length} OF {stocks.length} RECORDS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1c1f26] bg-[#0d0f14] text-xs uppercase tracking-wider text-slate-300 font-black">
                  <th className="py-3 px-4">TICKER</th>
                  <th className="py-3 px-4 text-right">LTP (₹)</th>
                  <th className="py-3 px-4 text-right">1D CHG</th>
                  <th className="py-3 px-4 text-right">VOL RATIO</th>
                  <th className="py-3 px-4 text-right">Z-SCORE</th>
                  <th className="py-3 px-4 text-right">RSI (14)</th>
                  <th className="py-3 px-4 text-right">ANOMALY SCORE</th>
                  <th className="py-3 px-4 text-center">SURVEILLANCE STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#13151c]">
                {loading && stocks.length === 0 ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={9} className="py-4 px-4">
                        <div className="h-5 bg-[#141720] rounded w-full" />
                      </td>
                    </tr>
                  ))
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 text-sm">
                      NO RECORDS MATCH CRITERIA. HIT &apos;ALL&apos; TO RESET.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const isExtreme = stock.risk_level === "EXTREME";
                    const isHigh = stock.risk_level === "HIGH";
                    const isMed = stock.risk_level === "MEDIUM";

                    const rowBg = isExtreme
                      ? "bg-[#200c14]/30 hover:bg-[#200c14]/50"
                      : isHigh
                      ? "bg-[#1c0d10]/20 hover:bg-[#1c0d10]/40"
                      : "hover:bg-[#11131a]";

                    const statusBadge = isExtreme ? (
                      <span className="px-2.5 py-1 rounded bg-[#4c0519] text-[#ff3b69] border border-[#ff3b69]/40 font-black text-xs animate-pulse">
                        ● CRITICAL_PUMP
                      </span>
                    ) : isHigh ? (
                      <span className="px-2.5 py-1 rounded bg-[#330810] text-[#ff6b8b] border border-[#ff6b8b]/40 font-black text-xs">
                        ▲ VOL_SPIKE
                      </span>
                    ) : isMed ? (
                      <span className="px-2.5 py-1 rounded bg-[#2e1d05] text-amber-400 border border-amber-500/40 font-bold text-xs">
                        ■ MOMENTUM
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-[#072418] text-[#00f5a0] border border-[#00f5a0]/40 font-bold text-xs">
                        ✔ CLEAN_FLOW
                      </span>
                    );

                    return (
                      <tr
                        key={stock.ticker}
                        onClick={() => setSelectedStock(stock)}
                        className={`cursor-pointer transition-colors ${rowBg}`}
                      >
                        {/* Ticker */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-bold text-white text-base">
                            <span className="text-[#00d2ff]">{stock.ticker}</span>
                            <span className="text-xs text-slate-400 font-normal">{stock.exchange}</span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-black text-white text-base">
                          ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>

                        {/* 1D Change */}
                        <td className="py-3 px-4 text-right">
                          <span className={`font-black text-sm ${stock.price_change_percent >= 0 ? "text-[#00f5a0]" : "text-[#ff3b69]"}`}>
                            {stock.price_change_percent >= 0 ? "+" : ""}
                            {stock.price_change_percent.toFixed(2)}%
                          </span>
                        </td>

                        {/* Vol Ratio */}
                        <td className="py-3 px-4 text-right font-mono text-slate-200 text-sm font-semibold">
                          {stock.volume_ratio ? `${stock.volume_ratio.toFixed(2)}x` : "-"}
                        </td>

                        {/* Z-score */}
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          <span className={stock.volume_zscore && stock.volume_zscore > 3 ? "text-[#ff3b69] font-black" : "text-slate-300"}>
                            {stock.volume_zscore ? stock.volume_zscore.toFixed(1) : "-"}
                          </span>
                        </td>

                        {/* RSI */}
                        <td className="py-3 px-4 text-right font-mono text-sm">
                          <span className={stock.rsi && stock.rsi > 70 ? "text-amber-400 font-black" : "text-slate-300"}>
                            {stock.rsi ? stock.rsi.toFixed(1) : "-"}
                          </span>
                        </td>

                        {/* Anomaly Score Bar */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className={`font-black text-base ${isExtreme ? "text-[#c084fc]" : isHigh ? "text-[#ff3b69]" : isMed ? "text-amber-400" : "text-[#00f5a0]"}`}>
                              {stock.risk_score}
                            </span>
                            <div className="w-20 h-2 bg-[#161820] overflow-hidden rounded">
                              <div
                                className={`h-full ${isExtreme ? "bg-[#c084fc]" : isHigh ? "bg-[#ff3b69]" : isMed ? "bg-amber-400" : "bg-[#00f5a0]"}`}
                                style={{ width: `${Math.min(100, Math.max(5, stock.risk_score))}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Surveillance Status */}
                        <td className="py-3 px-4 text-center">
                          {statusBadge}
                        </td>

                        {/* Action link */}
                        <td className="py-3 px-4 text-right">
                          <span className="text-xs text-[#00d2ff] hover:underline font-black">
                            INSPECT &rarr;
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer Stats */}
          <div className="px-4 py-2.5 bg-[#0c0d12] border-t border-[#1c1f26] flex items-center justify-between text-xs text-slate-400 font-semibold">
            <span>DATA SOURCE: NSE LIVE REAL-TIME TELEMETRY FEED</span>
            <span>PRESS TICKET ROW OR HIT &apos;/&apos; FOR DEEP METRICS INSPECTOR</span>
          </div>
        </div>
      </main>

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
