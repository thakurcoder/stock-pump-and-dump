"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Compass,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Zap,
  Info,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  BarChart2
} from "lucide-react";
import { getRiskColors } from "../components/StockDetailPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RecommendationsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/recommendations`);
      if (!res.ok) throw new Error(`Backend answered HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const options = data?.options_recommendations || [];
  const stocks = data?.stocks_recommendations || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/20">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-white tracking-tight">Trading Recommendations</h1>
                <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Algorithmic Options &amp; Stock Picks</p>
              </div>
            </div>
          </div>

          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-white/10 relative overflow-hidden">
          <div className="relative z-10 space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Priority Decision Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              1. First Take: Index Options Direction &middot; 2. Then: Conviction Stocks
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Before stock picking, evaluate broader market direction via NIFTY &amp; BANK NIFTY options. Then deploy capital into stocks with proven momentum and low manipulation risk.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchRecommendations} className="px-3 py-1 rounded bg-rose-500/30 text-xs font-bold text-white">
              Retry
            </button>
          </div>
        )}

        {/* SECTION 1: OPTIONS RECOMMENDATIONS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono text-xs font-black">1</span>
            <h3 className="text-base font-bold text-white tracking-tight">Index Options Strategies (First Step)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {options.map((opt: any, i: number) => {
              const isBull = opt.bias === "BULLISH";
              const isBear = opt.bias === "BEARISH";
              return (
                <div key={i} className="rounded-2xl bg-slate-900/60 border border-white/[0.08] p-5 space-y-4 backdrop-blur-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-slate-400">{opt.expiry}</span>
                      <h4 className="text-lg font-black text-white">{opt.instrument}</h4>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-mono font-black border ${
                        isBull
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : isBear
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                          : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                      }`}
                    >
                      {opt.recommended_action}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
                    <div>
                      <p className="text-slate-500">Underlying Index</p>
                      <p className="font-mono font-bold text-white mt-0.5">₹{opt.underlying_price.toLocaleString("en-IN")}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Suggested Strike</p>
                      <p className="font-mono font-bold text-sky-400 mt-0.5">{opt.strike} {opt.recommended_action.split(" ")[0]}</p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{opt.strategy}</p>

                  <div className="pt-3 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{opt.risk_profile}</span>
                    <span className="flex items-center gap-1 text-sky-400 font-semibold">
                      Bias: {opt.bias}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: STOCK CANDIDATES */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 font-mono text-xs font-black">2</span>
            <h3 className="text-base font-bold text-white tracking-tight">Conviction Stock Opportunities (Next Step)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stocks.map((stk: any, i: number) => {
              const colors = getRiskColors(stk.risk_level || "LOW");
              return (
                <div key={i} className="rounded-2xl bg-slate-900/60 border border-white/[0.08] p-5 space-y-4 backdrop-blur-sm flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold">{stk.category}</span>
                        <h4 className="text-xl font-black text-white">{stk.ticker}</h4>
                      </div>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full uppercase ${colors.badge}`}>
                        Risk: {stk.risk_score}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs font-mono">
                      <div>
                        <span className="text-slate-500 block text-[10px]">PRICE</span>
                        <span className="font-bold text-white">₹{stk.price.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">1D MOMENTUM</span>
                        <span className={stk.change_1d >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          {stk.change_1d >= 0 ? "+" : ""}{stk.change_1d.toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">ACTION</span>
                        <span className="text-sky-400 font-bold">{stk.action}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{stk.reason}</p>
                  </div>

                  <div className="pt-4 border-t border-white/[0.05] flex items-center justify-between">
                    <Link
                      href={`/stock/${stk.ticker}`}
                      className="text-xs font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                    >
                      Audit Safety Profile <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-slate-500 text-[11px] leading-relaxed font-mono">
          {data?.disclaimer || "Disclaimer: Quantitative screening information only. Not SEBI registered investment advice."}
        </div>
      </main>
    </div>
  );
}
