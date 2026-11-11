"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import StockDetailPanel, { getRiskColors, type Stock } from "./components/StockDetailPanel";

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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [idxRes, screenRes] = await Promise.all([
        fetch(`${API_BASE}/api/market-indices`),
        fetch(`${API_BASE}/api/screen?top=50`),
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
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, []);

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

              <button
                onClick={fetchData}
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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full sm:w-auto flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              id="stock-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search — RELIANCE, TCS…"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-slate-100 placeholder:text-slate-600 text-sm focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
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
              Hide Large Liquid Stocks: {hideLiquid ? "ON" : "OFF"}
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
              onClick={fetchData}
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
                              <p className="font-bold text-white group-hover:text-sky-400 transition-colors">
                                {stock.ticker}
                                {stock.demo && (
                                  <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold align-middle">
                                    DEMO
                                  </span>
                                )}
                              </p>
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

      {/* Detail panel: fetches its own data and stays open on errors */}
      {selectedStock && (
        <StockDetailPanel key={selectedStock.ticker} stock={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}