"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, AlertTriangle, Info, RefreshCw, ShieldAlert, X } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types (moved here from page.tsx) ──────────────────────────────────────────

export interface Stock {
  ticker: string;
  exchange: string;
  risk_score: number;
  risk_level: string;
  is_suspicious: boolean;
  price: number;
  price_change_percent: number;
  volume: number;
  last_updated: string;
  demo?: boolean;
  thinly_traded?: boolean;
  reasons?: string;
  volume_ratio?: number;
  volume_zscore?: number;
  price_change_1d?: number;
  price_change_3d?: number;
  price_change_5d?: number;
  rsi?: number;
  avg_turnover_cr?: number;
}

interface Extra {
  row: Partial<Pick<Stock, "risk_score" | "risk_level" | "is_suspicious" | "price" | "price_change_percent" | "volume">>;
  recommendation: string;
  explanation: string;
  red_flags: string[];
  individual_scores: {
    volume_spike: number;
    price_anomaly: number;
    ml_anomaly: number;
    social_sentiment: number;
  };
  chart_data: Array<{ date: string; close: number }>;
}

// ── Helpers (moved here from page.tsx) ────────────────────────────────────────

export function getRiskColors(level: string) {
  switch (level.toUpperCase()) {
    case "EXTREME":
      return {
        badge: "bg-purple-500/20 text-purple-300 border border-purple-500/40 badge-extreme-glow",
        bar: "bg-gradient-to-r from-purple-600 to-fuchsia-500",
        text: "text-purple-300",
        dot: "bg-purple-400",
      };
    case "HIGH":
      return {
        badge: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
        bar: "bg-gradient-to-r from-rose-600 to-red-500",
        text: "text-rose-300",
        dot: "bg-rose-400",
      };
    case "MEDIUM":
      return {
        badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
        bar: "bg-gradient-to-r from-amber-500 to-orange-400",
        text: "text-amber-300",
        dot: "bg-amber-400",
      };
    default:
      return {
        badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
        bar: "bg-gradient-to-r from-emerald-500 to-teal-400",
        text: "text-emerald-400",
        dot: "bg-emerald-400",
      };
  }
}

const levelFor = (v: number) => (v >= 80 ? "EXTREME" : v >= 60 ? "HIGH" : v >= 40 ? "MEDIUM" : "LOW");

// What each detector means, in plain language
const DETECTORS = [
  { key: "volume_spike", label: "Volume spike", why: "Trading volume is far above this stock's 20-day normal level (Z-score & volume ratio)." },
  { key: "price_anomaly", label: "Price surge", why: "Rapid momentum across 1-day, 3-day, and 5-day trading windows." },
  { key: "ml_anomaly", label: "Overbought (RSI/BB)", why: "RSI is in extreme overbought territory or price breached upper Bollinger Band." },
  { key: "social_sentiment", label: "Confluence bonus", why: "Elevated volume spike occurring concurrently with strong price surge." },
] as const;

// Backend responses can miss fields; never let that crash the panel
function normalize(d: any): Extra {
  const s = d?.individual_scores ?? {};
  return {
    row: Object.fromEntries(
      (["risk_score", "risk_level", "is_suspicious", "price", "price_change_percent", "volume"] as const)
        .filter((k) => d?.[k] !== undefined && d?.[k] !== null)
        .map((k) => [k, d[k]])
    ),
    recommendation: String(d?.recommendation ?? ""),
    explanation: String(d?.explanation ?? ""),
    red_flags: Array.isArray(d?.red_flags) ? d.red_flags.map(String) : [],
    individual_scores: {
      volume_spike: Number(s.volume_spike) || 0,
      price_anomaly: Number(s.price_anomaly) || 0,
      ml_anomaly: Number(s.ml_anomaly) || 0,
      social_sentiment: Number(s.social_sentiment) || 0,
    },
    chart_data: Array.isArray(d?.chart_data) ? d.chart_data : [],
  };
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function StockDetailPanel({ stock: row, onClose }: { stock: Stock; onClose: () => void }) {
  const [detail, setDetail] = useState<Extra | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/stocks/${encodeURIComponent(row.ticker)}`, { signal });
        if (!res.ok) throw new Error(`The API answered ${res.status} for /api/stocks/${row.ticker}.`);
        setDetail(normalize(await res.json()));
      } catch (e: any) {
        if (signal?.aborted) return;
        setError(
          e instanceof TypeError
            ? `Could not reach ${API_BASE}. Check that the backend is running and allows CORS from this site.`
            : e?.message ?? "Request failed."
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [row.ticker]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The detail response is the source of truth once loaded, so header, verdict and explanation agree
  const stock: Stock = { ...row, ...(detail?.row ?? {}) };
  const colors = getRiskColors(stock.risk_level);
  const flagged = stock.is_suspicious || ["HIGH", "EXTREME"].includes(stock.risk_level.toUpperCase());
  const triggered = detail
    ? DETECTORS.map((d) => ({ ...d, score: detail.individual_scores[d.key] }))
        .filter((d) => d.score >= 60)
        .sort((a, b) => b.score - a.score)
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-2xl h-full sm:h-[calc(100vh-2rem)] sm:my-4 sm:mr-4 flex flex-col bg-slate-900 sm:rounded-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden">
        {/* Header: always rendered from the row we already have */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.07] flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-800 border border-white/10">
              <Activity className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-extrabold text-white">{stock.ticker}</h3>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-400">{stock.exchange}</span>
                <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full font-mono uppercase ${colors.badge}`}>
                  {stock.risk_level} · {stock.risk_score}/100
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                ₹{stock.price.toLocaleString("en-IN")} &nbsp;
                <span className={stock.price_change_percent >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {stock.price_change_percent >= 0 ? "+" : ""}
                  {stock.price_change_percent.toFixed(2)}%
                </span>
                &nbsp; · Vol {(stock.volume / 1_00_000).toFixed(1)}L
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Verdict */}
          <div className={`rounded-xl border p-4 ${flagged ? "bg-rose-500/10 border-rose-500/25" : "bg-emerald-500/10 border-emerald-500/20"}`}>
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <ShieldAlert className={`w-4 h-4 ${flagged ? "text-rose-400" : "text-emerald-400"}`} />
              {flagged ? "Flagged as a possible pump & dump" : "No strong sign of manipulation"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Combined risk score {stock.risk_score}/100 ({stock.risk_level.toLowerCase()}).
            </p>
          </div>

          {row.demo && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-px" />
              <span>Demo data: live prices for {row.ticker} could not be fetched, so this score is simulated and is not a real signal.</span>
            </div>
          )}

          {detail && row.risk_level.toUpperCase() !== stock.risk_level.toUpperCase() && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
              <Info className="w-4 h-4 shrink-0 mt-px" />
              <span>
                The table showed {row.risk_level} ({row.risk_score}), but the detailed analysis scores this stock {stock.risk_level} ({stock.risk_score}).
                The list and detail APIs calculate scores separately, so the backend should reuse one cached score.
              </span>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 text-sm text-slate-400 py-6 justify-center">
              <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
              Loading full analysis…
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-amber-200">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Couldn't load the analysis</p>
                  <p className="text-xs text-amber-200/80 mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={() => load()}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-100 text-xs font-bold transition-all"
              >
                Try again
              </button>
            </div>
          )}

          {detail && (
            <>
              {/* Why it was flagged */}
              <section className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
                <h4 className="text-sm font-bold text-white">Why this stock is flagged</h4>
                {detail.explanation && <p className="text-sm text-slate-300 leading-relaxed">{detail.explanation}</p>}

                {triggered.length > 0 ? (
                  <ul className="space-y-2">
                    {triggered.map((t) => (
                      <li key={t.key} className="text-xs text-slate-300">
                        <span className="font-bold text-white">{t.label}</span>
                        <span className={`font-mono ml-2 ${getRiskColors(levelFor(t.score)).text}`}>{t.score.toFixed(0)}/100</span>
                        <span className="block text-slate-400 mt-0.5">{t.why}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400">
                    No single detector is above 60. Any elevated score comes from several weaker signals combined.
                  </p>
                )}

                {detail.recommendation && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs">
                    <Info className="w-4 h-4 shrink-0 mt-px" />
                    <span>
                      <span className="font-bold">Recommendation:</span> {detail.recommendation}
                    </span>
                  </div>
                )}
              </section>

              {/* Red flags */}
              {flagged && detail.red_flags.length > 0 && (
                <section className="space-y-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-bold text-white">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Red flags
                  </h4>
                  <div className="space-y-1.5">
                    {detail.red_flags.map((flag, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
                        {flag}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* All detector scores */}
              <section className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-3">
                <h4 className="text-sm font-bold text-white">Detector scores</h4>
                {DETECTORS.map((d) => {
                  const v = detail.individual_scores[d.key];
                  return (
                    <div key={d.key} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{d.label}</span>
                        <span className="font-mono font-bold text-slate-200">{v.toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${getRiskColors(levelFor(v)).bar}`}
                          style={{ width: `${Math.min(v, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </section>

              {/* Price chart */}
              {detail.chart_data.length > 0 && (
                <section className="space-y-2">
                  <h4 className="text-sm font-bold text-white">Price history</h4>
                  <div className="h-44 rounded-xl bg-white/[0.02] border border-white/[0.06] p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detail.chart_data}>
                        <defs>
                          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" hide />
                        <YAxis domain={["auto", "auto"]} hide />
                        <Tooltip
                          contentStyle={{
                            background: "#0f172a",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 10,
                            fontSize: 12,
                            color: "#e2e8f0",
                          }}
                          formatter={(v) => [`₹${Number(v).toLocaleString("en-IN")}`, "Close"]}
                        />
                        <Area type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2} fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: "#38bdf8" }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/[0.07] flex justify-end shrink-0 bg-slate-900/80">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm transition-all shadow-lg shadow-sky-500/20 active:scale-95"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}