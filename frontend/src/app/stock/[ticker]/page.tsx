"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Activity,
  AlertTriangle,
  Info,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ExternalLink,
  CheckCircle2,
  ListFilter
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  ReferenceLine
} from "recharts";
import { getRiskColors } from "../../components/StockDetailPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const DETECTORS = [
  {
    key: "volume_spike",
    label: "Volume Spike Intensity",
    desc: "Trading volume expansion relative to the 20-day moving average and statistical Z-score.",
  },
  {
    key: "price_anomaly",
    label: "Price Surge Momentum",
    desc: "Rapid price acceleration across 1-day, 3-day, and 5-day windows.",
  },
  {
    key: "ml_anomaly",
    label: "Overbought (RSI & Bollinger)",
    desc: "Relative Strength Index entering extreme territory and breach of upper standard deviation bands.",
  },
  {
    key: "social_sentiment",
    label: "Confluence Bonus",
    desc: "Simultaneous confluence of aggressive volume expansion with upward price acceleration.",
  },
] as const;

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticker = typeof params?.ticker === "string" ? params.ticker.toUpperCase() : "";

  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "signals" | "chart">("overview");

  const loadStock = async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/stock/${encodeURIComponent(ticker)}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Stock '${ticker}' not found on NSE or insufficient trading data.`);
        }
        throw new Error(`Backend answered HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err?.message || "Failed to load stock analysis");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStock();
  }, [ticker]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
          <p className="text-sm font-mono text-slate-400">Running surveillance telemetry on {ticker}...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center space-y-4">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 max-w-md w-full text-center space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-rose-400" />
          <h2 className="text-lg font-bold text-white">Could not load {ticker}</h2>
          <p className="text-xs text-rose-300/80">{error}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-xs font-bold text-slate-300 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
          <button
            onClick={loadStock}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-bold text-white flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const colors = getRiskColors(data.risk_level || data.level || "LOW");
  const flagged = data.is_suspicious || ["HIGH", "EXTREME"].includes(String(data.risk_level).toUpperCase());
  const chartData = data.chart_data || [];
  const signals = data.signals || {};
  const indScores = data.individual_scores || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Bar */}
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
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black text-white tracking-tight">{data.ticker}</h1>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">NSE</span>
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full font-mono uppercase ${colors.badge}`}>
                    {data.risk_level} · {data.risk_score}/100
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://www.tradingview.com/symbols/NSE-${data.ticker}/`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300"
            >
              TradingView <ExternalLink className="w-3 h-3 text-slate-500" />
            </a>
            <button
              onClick={loadStock}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-sm">
            <p className="text-xs text-slate-500 font-medium">Last Close</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">₹{data.price?.toLocaleString("en-IN")}</p>
            <p className={`text-xs font-mono font-bold mt-1 flex items-center gap-0.5 ${data.price_change_percent >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {data.price_change_percent >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {data.price_change_percent >= 0 ? "+" : ""}{data.price_change_percent?.toFixed(2)}%
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-sm">
            <p className="text-xs text-slate-500 font-medium">Volume Spike</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">{signals.volume_ratio ? `${signals.volume_ratio}x` : "1.0x"}</p>
            <p className="text-xs text-slate-400 font-mono mt-1">Z-Score: +{signals.volume_zscore?.toFixed(2)}σ</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-sm">
            <p className="text-xs text-slate-500 font-medium">RSI (14)</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">{signals.rsi?.toFixed(1) || "N/A"}</p>
            <p className={`text-xs font-mono mt-1 ${signals.rsi >= 70 ? "text-rose-400 font-bold" : "text-slate-400"}`}>
              {signals.rsi >= 80 ? "Extreme Overbought" : signals.rsi >= 70 ? "Overbought" : "Normal"}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.07] backdrop-blur-sm">
            <p className="text-xs text-slate-500 font-medium">Daily Turnover</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">₹{signals.avg_turnover_cr?.toFixed(1)} Cr</p>
            <p className={`text-xs font-mono mt-1 ${signals.thinly_traded ? "text-amber-400 font-semibold" : "text-emerald-400"}`}>
              {signals.thinly_traded ? "Thinly Traded / Illiquid" : "Liquid Stock"}
            </p>
          </div>
        </div>

        {/* Verdict Callout */}
        <div className={`p-6 rounded-2xl border ${flagged ? "bg-rose-500/10 border-rose-500/30" : "bg-emerald-500/10 border-emerald-500/20"}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${flagged ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {flagged ? "Elevated Manipulation Risk Detected" : "Low Manipulation Risk — Normal Trading Pattern"}
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {data.explanation || data.reasons || "Trading indicators are operating within regular baseline thresholds."}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className={`text-3xl font-black font-mono ${colors.text}`}>{data.risk_score}</span>
              <span className="text-xs text-slate-400 block font-mono">/100 RISK SCORE</span>
            </div>
          </div>

          {data.recommendation && (
            <div className="mt-4 pt-4 border-t border-white/[0.08] text-xs text-slate-300 flex items-center gap-2">
              <span className="font-bold text-white uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-white/10">Recommendation</span>
              <span>{data.recommendation}</span>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-white/[0.08] flex gap-6 text-sm font-semibold">
          {[
            { id: "overview", label: "Surveillance Audit" },
            { id: "chart", label: "Interactive 120-Day Chart" },
            { id: "signals", label: "Technical Telemetry" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 relative transition-colors ${
                activeTab === tab.id ? "text-sky-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Detector Scores */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl bg-slate-900/60 border border-white/[0.07] p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Anomaly Detector Decomposition</h3>
                <div className="space-y-4">
                  {DETECTORS.map((d) => {
                    const score = Number(indScores[d.key]) || 0;
                    return (
                      <div key={d.key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-200">{d.label}</span>
                          <span className="font-mono font-bold text-slate-300">{score.toFixed(0)} / 100</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              score >= 80 ? "bg-purple-500" : score >= 60 ? "bg-rose-500" : score >= 40 ? "bg-amber-500" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500">{d.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Red Flags Card */}
              {data.red_flags && data.red_flags.length > 0 && (
                <div className="rounded-2xl bg-slate-900/60 border border-white/[0.07] p-6 space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Detected Flags & Triggers
                  </h3>
                  <div className="space-y-2">
                    {data.red_flags.map((flag: string, i: number) => (
                      <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] text-xs text-slate-300 flex items-center gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Summary Sidebar */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/60 border border-white/[0.07] p-6 space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Stock Specifications</h3>
                <div className="divide-y divide-white/[0.05] text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Exchange</span>
                    <span className="font-mono text-slate-200">NSE (National Stock Exchange)</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">1-Day Change</span>
                    <span className={`font-mono font-bold ${signals.price_change_1d >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {signals.price_change_1d >= 0 ? "+" : ""}{signals.price_change_1d?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">3-Day Change</span>
                    <span className={`font-mono font-bold ${signals.price_change_3d >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {signals.price_change_3d >= 0 ? "+" : ""}{signals.price_change_3d?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">5-Day Change</span>
                    <span className={`font-mono font-bold ${signals.price_change_5d >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {signals.price_change_5d >= 0 ? "+" : ""}{signals.price_change_5d?.toFixed(2)}%
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Bollinger Band Breach</span>
                    <span className={`font-mono font-bold ${signals.bb_breach ? "text-rose-400" : "text-emerald-400"}`}>
                      {signals.bb_breach ? "BREACHED UPPER BAND" : "Within Bands"}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Upper Band</span>
                    <span className="font-mono text-slate-200">₹{signals.bb_upper?.toFixed(2)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400">Lower Band</span>
                    <span className="font-mono text-slate-200">₹{signals.bb_lower?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHART */}
        {activeTab === "chart" && (
          <div className="rounded-2xl bg-slate-900/60 border border-white/[0.07] p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white">120 Trading Days Price History &amp; Bands</h3>
              <p className="text-xs text-slate-400">Includes 20-Day Simple Moving Average (SMA) and Bollinger Bands</p>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="detailPriceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis domain={["auto", "auto"]} stroke="#64748b" fontSize={11} tickLine={false} orientation="right" />
                  <Tooltip
                    contentStyle={{
                      background: "#0f172a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                      color: "#e2e8f0",
                    }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString("en-IN")}`, "Close"]}
                  />
                  <Area type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2} fill="url(#detailPriceGrad)" dot={false} />
                  {chartData[0]?.bb_upper && (
                    <Area type="monotone" dataKey="bb_upper" stroke="#a855f7" strokeWidth={1} strokeDasharray="3 3" fill="none" dot={false} />
                  )}
                  {chartData[0]?.sma20 && (
                    <Area type="monotone" dataKey="sma20" stroke="#f59e0b" strokeWidth={1.5} fill="none" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Volume Sub-chart */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-mono">Volume History</h4>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#0f172a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 10,
                        fontSize: 11,
                        color: "#e2e8f0",
                      }}
                      formatter={(v: any) => [`${(Number(v) / 100000).toFixed(1)} Lakhs`, "Volume"]}
                    />
                    <Bar dataKey="volume" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SIGNALS */}
        {activeTab === "signals" && (
          <div className="rounded-2xl bg-slate-900/60 border border-white/[0.07] p-6 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Raw PumpWatch Signal Matrix</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(signals).map(([k, v]) => (
                <div key={k} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400">{k}</span>
                  <span className="text-xs font-mono font-bold text-white">{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
