"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  ArrowRight, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  Zap,
  Target,
  BarChart2,
  RefreshCw,
  Terminal,
  Cpu,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface NoTradeRule {
  rule: string;
  status: string;
  triggered: boolean;
  detail: string;
}

interface NiftyStrategy {
  spot_price: number;
  spot_change_pct: number;
  india_vix: number;
  vix_direction: string;
  historical_volatility: number;
  max_pain_strike: number;
  pre_trade_setup: {
    intraday: {
      support_strike: number;
      support_chg_oi: number;
      resistance_strike: number;
      resistance_chg_oi: number;
    };
    positional: {
      support_strike: number;
      support_total_oi: number;
      resistance_strike: number;
      resistance_total_oi: number;
    };
  };
  range_filter: {
    strike_distance: number;
    threshold_pts: number;
    is_wide_range: boolean;
    range_verdict: string;
  };
  panic_unwinding_override: {
    type: string;
    action: string;
    detail: string;
  } | null;
  market_direction: string;
  trade_recommendation: {
    strategy_name: string;
    execution_type: string;
    legs: string[];
    rationale: string;
  };
  naked_alternative: {
    action: string;
    condition: string;
  } | null;
  no_trade_rules: NoTradeRule[];
  chain_rows?: Array<{
    strike: number;
    call_oi: number;
    call_chg_oi: number;
    call_volume?: number;
    call_iv?: number;
    call_ltp: number;
    put_ltp: number;
    put_iv?: number;
    put_volume?: number;
    put_chg_oi: number;
    put_oi: number;
    is_atm?: boolean;
    is_call_itm?: boolean;
    is_put_itm?: boolean;
  }>;
}

interface OptionRecommendation {
  instrument?: string;
  underlying_price?: number;
  bias?: string;
  recommended_action?: string;
  action?: string;
  strike?: number;
  contract_name?: string;
  estimated_premium?: number;
  target_premium?: number;
  stop_loss_premium?: number;
  strategy?: string;
  risk_profile?: string;
  expiry?: string;
  symbol?: string;
  entry_price_range?: string;
  target?: number;
  stop_loss?: number;
  rationale?: string;
}

interface StockRecommendation {
  ticker?: string;
  symbol?: string;
  category?: string;
  action?: string;
  price?: number;
  current_price?: number;
  change_1d?: number;
  target_price?: number;
  stop_loss_price?: number;
  stop_loss?: number;
  risk_reward?: string;
  risk_score?: number;
  risk_level?: string;
  reason?: string;
  company_name?: string;
  catalyst?: string;
  upside_percentage?: number;
}

export default function RecommendationsPage() {
  const [niftyStrategy, setNiftyStrategy] = useState<NiftyStrategy | null>(null);
  const [options, setOptions] = useState<OptionRecommendation[]>([]);
  const [stocks, setStocks] = useState<StockRecommendation[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh states
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(60);
  const [secondsLeft, setSecondsLeft] = useState<number>(60);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Option chain strike filter view
  const [chainStrikeFilter, setChainStrikeFilter] = useState<"all" | "near">("near");
  const [showFullChain, setShowFullChain] = useState<boolean>(true);

  const fetchRecommendations = async (isBackground: boolean = false) => {
    if (!isBackground) setLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/recommendations");
      if (!res.ok) throw new Error("Failed to fetch recommendation feed");
      const data = await res.json();
      setNiftyStrategy(data.nifty_options_strategy);
      setOptions(data.options_recommendations || []);
      setStocks(data.stocks_recommendations || []);
      setDisclaimer(data.disclaimer || "");
      setLastRefreshedAt(new Date().toLocaleTimeString("en-IN", { hour12: false }));
      setSecondsLeft(refreshInterval);
    } catch (err: any) {
      if (!isBackground) {
        setError(err.message || "Failed to load live recommendations.");
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecommendations(false);
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchRecommendations(true);
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval]);

  const handleIntervalChange = (newInterval: number) => {
    setRefreshInterval(newInterval);
    setSecondsLeft(newInterval);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-slate-100 flex flex-col font-mono selection:bg-[#00f5a0]/30 antialiased">
      {/* Top Bloomberg Ribbon */}
      <div className="bg-[#0c0d12] border-b border-[#1c1f26] text-xs sm:text-sm px-5 py-2 flex items-center justify-between overflow-x-auto whitespace-nowrap">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 text-[#00f5a0] font-black">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00f5a0] animate-pulse"></span>
            <span>FEED:LIVE (NSE DERIVATIVES DESK)</span>
          </div>
          {niftyStrategy && (
            <>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-semibold">NIFTY SPOT:</span>
                <span className="text-white font-black text-sm">{niftyStrategy.spot_price.toLocaleString("en-IN")}</span>
                <span className={`text-xs font-black ${niftyStrategy.spot_change_pct >= 0 ? "text-[#00f5a0]" : "text-[#ff3b69]"}`}>
                  {niftyStrategy.spot_change_pct >= 0 ? "+" : ""}{niftyStrategy.spot_change_pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-semibold">INDIA VIX:</span>
                <span className="text-[#fbbf24] font-black text-sm">{niftyStrategy.india_vix} ({niftyStrategy.vix_direction})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-semibold">MAX PAIN:</span>
                <span className="text-[#c084fc] font-black text-sm">{niftyStrategy.max_pain_strike}</span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center space-x-4 text-slate-300 text-xs">
          <span>LAST SYNC: <strong className="text-white">{lastRefreshedAt || "--:--:--"}</strong></span>
          <span className="text-[#1c1f26]">|</span>
          <span className="text-[#00d2ff] font-bold">DESK 02 // F&amp;O STRATEGY</span>
        </div>
      </div>

      {/* Terminal Main Header */}
      <header className="border-b border-[#1c1f26] bg-[#0c0d12]/95 sticky top-0 z-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-9 h-9 rounded border border-[#252833] bg-[#12141c] flex items-center justify-center text-[#00f5a0]">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-base sm:text-lg font-black tracking-wider text-white uppercase">
                INSTITUTIONAL F&amp;O PLAYBOOK &amp; MATRIX
              </h1>
              <span className="text-xs px-2 py-0.5 rounded bg-[#00f5a0]/10 text-[#00f5a0] border border-[#00f5a0]/30 font-bold">
                PRO-DESK
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">REAL-TIME OI ENGINE &bull; TRAPPED WRITER PANIC DETECTION &bull; GAMMA MATRIX</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5 text-xs sm:text-sm">
          <div className="flex items-center space-x-2 bg-[#12141c] border border-[#252833] px-3 py-1.5 rounded">
            <label className="flex items-center cursor-pointer space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 accent-[#00f5a0] bg-[#070709] border-[#252833] rounded"
              />
              <span className="text-slate-200 font-bold text-xs sm:text-sm">AUTO-PULL</span>
            </label>

            <select
              value={refreshInterval}
              disabled={!autoRefresh}
              onChange={(e) => handleIntervalChange(Number(e.target.value))}
              aria-label="Refresh Interval"
              className="bg-[#070709] border border-[#252833] rounded px-2 py-1 text-xs sm:text-sm text-[#00f5a0] font-bold focus:outline-none"
            >
              <option value={15}>15s (RAPID)</option>
              <option value={30}>30s (ACTIVE)</option>
              <option value={60}>60s (NORMAL)</option>
              <option value={180}>180s (BATCH)</option>
            </select>

            {autoRefresh && (
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-[#00f5a0]/15 text-[#00f5a0] border border-[#00f5a0]/30">
                {secondsLeft}s
              </span>
            )}
          </div>

          <button
            onClick={() => fetchRecommendations(false)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#12141c] hover:bg-[#1a1d28] border border-[#252833] text-slate-200 rounded font-bold text-xs sm:text-sm transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-[#00f5a0]" : ""}`} />
            <span>PULL [R]</span>
          </button>

          <Link
            href="/"
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#00f5a0]/15 hover:bg-[#00f5a0]/25 text-[#00f5a0] border border-[#00f5a0]/30 rounded font-bold text-xs sm:text-sm transition"
          >
            <span>&larr; SURVEILLANCE DESK</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full p-4 space-y-4 max-w-[1600px] mx-auto">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-[#0c0d12] border border-[#1c1f26] rounded">
            <RefreshCw className="w-7 h-7 text-[#00d2ff] animate-spin" />
            <p className="text-xs text-slate-400 font-mono tracking-wider">
              FETCHING LIVE DERIVATIVES CONTRACTS &amp; PARSING STRIKE DISTRIBUTIONS...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded border border-[#ff3b69]/40 bg-[#ff3b69]/10 text-[#ff3b69] space-y-1">
            <div className="flex items-center space-x-2 text-xs font-bold">
              <AlertTriangle className="w-4 h-4" />
              <span>TERMINAL TELEMETRY INTERRUPTED</span>
            </div>
            <p className="text-[11px] text-slate-300">{error}</p>
          </div>
        ) : (
          <>
            {/* SECTION 1: NIFTY 50 INSTITUTIONAL OPTIONS STRATEGY */}
            {niftyStrategy && (
              <div className="space-y-4">
                {/* PRE-TRADE SETUP: INTRADAY VS POSITIONAL BATTLEGROUND */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Intraday Battleground */}
                  <div className="p-3.5 rounded border border-[#1c1f26] bg-[#0c0d12] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1c1f26] pb-2">
                      <div className="flex items-center space-x-2">
                        <Activity className="w-3.5 h-3.5 text-[#00d2ff]" />
                        <span className="text-xs font-bold text-white tracking-wider">
                          1. INTRADAY BATTLEGROUND (CHANGE IN OI)
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161820] text-[#00d2ff] border border-[#252833]">
                        HIGH VELOCITY
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded border border-[#00f5a0]/25 bg-[#00f5a0]/5">
                        <span className="text-[10px] text-[#00f5a0] block font-bold tracking-wider">
                          SUPPORT [MAX PE WRITING]
                        </span>
                        <div className="text-xl font-black text-white mt-1">
                          {niftyStrategy.pre_trade_setup?.intraday?.support_strike} PE
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          +{((niftyStrategy.pre_trade_setup?.intraday?.support_chg_oi || 0) / 100000).toFixed(2)}L OI ADDED
                        </div>
                      </div>

                      <div className="p-3 rounded border border-[#ff3b69]/25 bg-[#ff3b69]/5">
                        <span className="text-[10px] text-[#ff3b69] block font-bold tracking-wider">
                          RESISTANCE [MAX CE WRITING]
                        </span>
                        <div className="text-xl font-black text-white mt-1">
                          {niftyStrategy.pre_trade_setup?.intraday?.resistance_strike} CE
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          +{((niftyStrategy.pre_trade_setup?.intraday?.resistance_chg_oi || 0) / 100000).toFixed(2)}L OI ADDED
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Positional Battleground */}
                  <div className="p-3.5 rounded border border-[#1c1f26] bg-[#0c0d12] space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1c1f26] pb-2">
                      <div className="flex items-center space-x-2">
                        <Layers className="w-3.5 h-3.5 text-[#fbbf24]" />
                        <span className="text-xs font-bold text-white tracking-wider">
                          POSITIONAL &amp; EXPIRY TREND (TOTAL OI CUMULATIVE)
                        </span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161820] text-[#fbbf24] border border-[#252833]">
                        EXPIRY ANCHOR
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded border border-[#00f5a0]/25 bg-[#00f5a0]/5">
                        <span className="text-[10px] text-[#00f5a0] block font-bold tracking-wider">
                          POSITIONAL WALL [MAX PE]
                        </span>
                        <div className="text-xl font-black text-white mt-1">
                          {niftyStrategy.pre_trade_setup?.positional?.support_strike} PE
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {((niftyStrategy.pre_trade_setup?.positional?.support_total_oi || 0) / 100000).toFixed(2)}L TOTAL OI
                        </div>
                      </div>

                      <div className="p-3 rounded border border-[#ff3b69]/25 bg-[#ff3b69]/5">
                        <span className="text-[10px] text-[#ff3b69] block font-bold tracking-wider">
                          POSITIONAL CAP [MAX CE]
                        </span>
                        <div className="text-xl font-black text-white mt-1">
                          {niftyStrategy.pre_trade_setup?.positional?.resistance_strike} CE
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          {((niftyStrategy.pre_trade_setup?.positional?.resistance_total_oi || 0) / 100000).toFixed(2)}L TOTAL OI
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STRATEGY EXECUTION ENGINE */}
                <div className="p-4 rounded border border-[#1c1f26] bg-[#0c0d12] space-y-4">
                  {/* Step A Panic alert if active */}
                  {niftyStrategy.panic_unwinding_override && (
                    <div className="p-3 rounded border border-[#fbbf24]/50 bg-[#fbbf24]/10 flex items-start space-x-3 text-[#fbbf24]">
                      <Zap className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-black uppercase">
                          STEP A OVERRIDE: TRAPPED WRITER PANIC UNWINDING ({niftyStrategy.panic_unwinding_override.type})
                        </div>
                        <p className="text-[11px] text-slate-300 mt-1">
                          {niftyStrategy.panic_unwinding_override.detail}
                        </p>
                        <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24]">
                          ACTION: {niftyStrategy.panic_unwinding_override.action}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Step B: Range Filter */}
                  <div className="p-3 rounded border border-[#1c1f26] bg-[#070709] flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-black text-white uppercase">
                          STEP B: SPREAD WIDTH RANGE FILTER
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          !niftyStrategy.range_filter?.is_wide_range
                            ? "bg-[#00f5a0]/15 text-[#00f5a0] border border-[#00f5a0]/30"
                            : "bg-[#fbbf24]/15 text-[#fbbf24] border border-[#fbbf24]/30"
                        }`}>
                          {niftyStrategy.range_filter?.range_verdict}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Distance between highest OI Change PE and CE strikes. Safe bounds threshold ~1.65% of spot.
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0 text-right">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">SPREAD DISTANCE</div>
                        <div className="text-xs font-bold text-slate-200">
                          {niftyStrategy.range_filter?.strike_distance} PTS
                        </div>
                      </div>
                      <div className="border-l border-[#1c1f26] pl-4">
                        <div className="text-[10px] text-slate-500 uppercase">MAX THRESHOLD</div>
                        <div className="text-xs font-bold text-[#00d2ff]">
                          &le; {niftyStrategy.range_filter?.threshold_pts} PTS
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step C: Recommended Strategy Order Deck */}
                  <div className="p-4 rounded border border-[#00d2ff]/30 bg-[#00d2ff]/5 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[#1c1f26] pb-2.5">
                      <div>
                        <span className="text-[10px] font-bold tracking-wider text-[#00d2ff] uppercase">
                          STEP C: DIRECTIONAL &amp; VOLATILITY PLAYBOOK
                        </span>
                        <h3 className="text-base font-black text-white flex items-center space-x-2 mt-0.5">
                          <span>{niftyStrategy.trade_recommendation?.strategy_name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            niftyStrategy.market_direction === "BULLISH"
                              ? "bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40"
                              : "bg-[#ff3b69]/20 text-[#ff3b69] border border-[#ff3b69]/40"
                          }`}>
                            {niftyStrategy.market_direction}
                          </span>
                        </h3>
                      </div>

                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-slate-400">INDIA VIX REGIME:</span>
                        <span className="font-bold text-[#fbbf24]">
                          {niftyStrategy.vix_direction} ({niftyStrategy.india_vix})
                        </span>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {niftyStrategy.trade_recommendation?.rationale}
                    </p>

                    {/* Legs execution */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        EXECUTABLE LEGS MATRIX ({niftyStrategy.trade_recommendation?.execution_type})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {niftyStrategy.trade_recommendation?.legs?.map((leg, i) => (
                          <div
                            key={i}
                            className="p-2.5 rounded border border-[#252833] bg-[#070709] flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  leg.toUpperCase().includes("BUY")
                                    ? "bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40"
                                    : "bg-[#ff3b69]/20 text-[#ff3b69] border border-[#ff3b69]/40"
                                }`}
                              >
                                {leg.split(" ")[0]}
                              </span>
                              <span className="font-bold text-white text-xs">
                                {leg.substring(leg.indexOf(" ") + 1)}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#00d2ff] font-bold">
                              TARGET LEG
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Naked Alternative */}
                    {niftyStrategy.naked_alternative && (
                      <div className="p-2.5 rounded border border-[#c084fc]/30 bg-[#c084fc]/10 text-xs text-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-1">
                        <div>
                          <span className="font-bold text-[#c084fc]">NAKED ALTERNATIVE:</span>{" "}
                          <span>{niftyStrategy.naked_alternative.action}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {niftyStrategy.naked_alternative.condition}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* STEP 3: STRICT NO-TRADE GATES */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-[#ff3b69]" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        3. INSTITUTIONAL RISK &amp; NO-TRADE GATES
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {niftyStrategy.no_trade_rules?.map((rule, idx) => (
                        <div key={idx} className="p-2.5 rounded border border-[#1c1f26] bg-[#070709] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-200 text-[11px]">{rule.rule}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                              rule.triggered
                                ? "bg-[#ff3b69]/20 text-[#ff3b69] border border-[#ff3b69]/40"
                                : "bg-[#00f5a0]/15 text-[#00f5a0] border border-[#00f5a0]/30"
                            }`}>
                              {rule.status}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[10px] leading-relaxed">
                            {rule.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* STEP 4: COMPLETE NIFTY 50 LIVE OPTION CHAIN MATRIX */}
                  {niftyStrategy.chain_rows && niftyStrategy.chain_rows.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-[#1c1f26]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <BarChart2 className="w-3.5 h-3.5 text-[#00d2ff]" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            4. LIVE NIFTY 50 OPTION CHAIN ORDERBOOK MATRIX
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#161820] text-slate-400 border border-[#252833]">
                            {niftyStrategy.chain_rows.length} STRIKES
                          </span>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center space-x-2 text-[11px]">
                          <div className="flex items-center bg-[#070709] rounded p-0.5 border border-[#252833]">
                            <button
                              onClick={() => setChainStrikeFilter("near")}
                              className={`px-2 py-0.5 rounded font-bold ${
                                chainStrikeFilter === "near" ? "bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/40" : "text-slate-400 hover:text-white"
                              }`}
                            >
                              NEAR ATM (±500)
                            </button>
                            <button
                              onClick={() => setChainStrikeFilter("all")}
                              className={`px-2 py-0.5 rounded font-bold ${
                                chainStrikeFilter === "all" ? "bg-[#00d2ff]/20 text-[#00d2ff] border border-[#00d2ff]/40" : "text-slate-400 hover:text-white"
                              }`}
                            >
                              FULL CHAIN ({niftyStrategy.chain_rows.length})
                            </button>
                          </div>

                          <button
                            onClick={() => setShowFullChain(!showFullChain)}
                            className="text-[10px] font-bold text-slate-400 hover:text-white px-2 py-1 rounded bg-[#12141c] border border-[#252833] transition"
                          >
                            {showFullChain ? "COLLAPSE" : "EXPAND"}
                          </button>
                        </div>
                      </div>

                      {showFullChain && (
                        <div className="overflow-x-auto rounded border border-[#1c1f26] bg-[#070709]">
                          <table className="w-full text-xs sm:text-sm text-left border-collapse">
                            <thead>
                              <tr className="border-b border-[#1c1f26] text-xs font-black uppercase">
                                <th colSpan={5} className="py-2.5 px-3 text-center bg-[#0c1a24] text-[#00d2ff] border-r border-[#1c1f26]">
                                  CALLS (CE) — BULLISH WRITERS
                                </th>
                                <th className="py-2.5 px-3 text-center bg-[#161820] text-[#fbbf24] border-r border-[#1c1f26]">
                                  STRIKE
                                </th>
                                <th colSpan={5} className="py-2.5 px-3 text-center bg-[#141224] text-[#c084fc]">
                                  PUTS (PE) — BEARISH WRITERS
                                </th>
                              </tr>
                              <tr className="border-b border-[#1c1f26] text-xs text-slate-300 bg-[#0c0d12] font-black uppercase tracking-wider">
                                <th className="py-2 px-3 text-right">OI</th>
                                <th className="py-2 px-3 text-right">CHG IN OI</th>
                                <th className="py-2 px-3 text-right">VOLUME</th>
                                <th className="py-2 px-2.5 text-right">IV%</th>
                                <th className="py-2 px-3.5 text-right text-[#00d2ff] border-r border-[#1c1f26]">LTP (₹)</th>
                                
                                <th className="py-2 px-4 text-center font-black text-white bg-[#12141c] border-r border-[#1c1f26]">
                                  PRICE
                                </th>

                                <th className="py-2 px-3.5 text-left text-[#c084fc]">LTP (₹)</th>
                                <th className="py-2 px-2.5 text-right">IV%</th>
                                <th className="py-2 px-3 text-right">VOLUME</th>
                                <th className="py-2 px-3 text-right">CHG IN OI</th>
                                <th className="py-2 px-3 text-right">OI</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#161820]">
                              {niftyStrategy.chain_rows
                                .filter((row) => {
                                  if (chainStrikeFilter === "near") {
                                    const atm = Math.round(niftyStrategy.spot_price / 50) * 50;
                                    return Math.abs(row.strike - atm) <= 500;
                                  }
                                  return true;
                                })
                                .map((row) => {
                                  const isAtm = row.is_atm || Math.abs(row.strike - niftyStrategy.spot_price) < 25;
                                  const isCallSupport = row.strike === niftyStrategy.pre_trade_setup?.intraday?.resistance_strike;
                                  const isPutSupport = row.strike === niftyStrategy.pre_trade_setup?.intraday?.support_strike;
                                  const isMaxPain = row.strike === niftyStrategy.max_pain_strike;

                                  const callBg = row.is_call_itm
                                    ? "bg-[#00d2ff]/10"
                                    : "bg-transparent";
                                  const putBg = row.is_put_itm
                                    ? "bg-[#c084fc]/10"
                                    : "bg-transparent";

                                  return (
                                    <tr
                                      key={row.strike}
                                      className={`hover:bg-[#12141c] transition-colors ${
                                        isAtm ? "bg-[#fbbf24]/15 ring-1 ring-inset ring-[#fbbf24]/40" : ""
                                      }`}
                                    >
                                      {/* CALLS */}
                                      <td className={`py-2 px-3 text-right font-bold ${callBg} ${
                                        isCallSupport ? "font-black text-[#ff3b69]" : "text-slate-200"
                                      }`}>
                                        {row.call_oi.toLocaleString("en-IN")}
                                      </td>
                                      <td className={`py-2 px-3 text-right font-black ${callBg} ${
                                        row.call_chg_oi > 0
                                          ? "text-[#00f5a0]"
                                          : row.call_chg_oi < 0
                                          ? "text-[#ff3b69]"
                                          : "text-slate-400"
                                      }`}>
                                        {row.call_chg_oi > 0 ? `+${row.call_chg_oi.toLocaleString("en-IN")}` : row.call_chg_oi.toLocaleString("en-IN")}
                                      </td>
                                      <td className={`py-2 px-3 text-right text-slate-300 ${callBg}`}>
                                        {(row.call_volume || 0).toLocaleString("en-IN")}
                                      </td>
                                      <td className={`py-2 px-2.5 text-right text-slate-300 ${callBg}`}>
                                        {row.call_iv ? `${row.call_iv}%` : "-"}
                                      </td>
                                      <td className={`py-2 px-3.5 text-right font-black text-sm text-[#00d2ff] border-r border-[#1c1f26] ${callBg}`}>
                                        ₹{row.call_ltp.toFixed(2)}
                                      </td>

                                      {/* STRIKE */}
                                      <td className={`py-2 px-4 text-center font-black text-base border-r border-[#1c1f26] ${
                                        isAtm
                                          ? "bg-[#fbbf24]/20 text-[#fbbf24]"
                                          : "bg-[#0c0d12] text-white"
                                      }`}>
                                        <div className="flex items-center justify-center space-x-1.5">
                                          <span>{row.strike}</span>
                                          {isAtm && (
                                            <span className="text-[10px] px-1 rounded bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40 font-bold">
                                              ATM
                                            </span>
                                          )}
                                          {isCallSupport && (
                                            <span className="text-[10px] px-1 rounded bg-[#ff3b69]/20 text-[#ff3b69] border border-[#ff3b69]/40 font-bold">
                                              RES
                                            </span>
                                          )}
                                          {isPutSupport && (
                                            <span className="text-[10px] px-1 rounded bg-[#00f5a0]/20 text-[#00f5a0] border border-[#00f5a0]/40 font-bold">
                                              SUP
                                            </span>
                                          )}
                                          {isMaxPain && (
                                            <span className="text-[10px] px-1 rounded bg-[#c084fc]/20 text-[#c084fc] border border-[#c084fc]/40 font-bold">
                                              PAIN
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* PUTS */}
                                      <td className={`py-2 px-3.5 text-left font-black text-sm text-[#c084fc] ${putBg}`}>
                                        ₹{row.put_ltp.toFixed(2)}
                                      </td>
                                      <td className={`py-2 px-2.5 text-right text-slate-300 ${putBg}`}>
                                        {row.put_iv ? `${row.put_iv}%` : "-"}
                                      </td>
                                      <td className={`py-2 px-3 text-right text-slate-300 ${putBg}`}>
                                        {(row.put_volume || 0).toLocaleString("en-IN")}
                                      </td>
                                      <td className={`py-2 px-3 text-right font-black ${putBg} ${
                                        row.put_chg_oi > 0
                                          ? "text-[#00f5a0]"
                                          : row.put_chg_oi < 0
                                          ? "text-[#ff3b69]"
                                          : "text-slate-400"
                                      }`}>
                                        {row.put_chg_oi > 0 ? `+${row.put_chg_oi.toLocaleString("en-IN")}` : row.put_chg_oi.toLocaleString("en-IN")}
                                      </td>
                                      <td className={`py-2 px-3 text-right font-bold ${putBg} ${
                                        isPutSupport ? "font-black text-[#00f5a0]" : "text-slate-200"
                                      }`}>
                                        {row.put_oi.toLocaleString("en-IN")}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>

                          <div className="p-3 bg-[#0c0d12] border-t border-[#1c1f26] flex flex-wrap items-center justify-between text-xs text-slate-300 font-semibold gap-2">
                            <div className="flex items-center space-x-4">
                              <span className="flex items-center space-x-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#00d2ff]/20 border border-[#00d2ff]/50"></span>
                                <span>IN-THE-MONEY CALLS (ITM)</span>
                              </span>
                              <span className="flex items-center space-x-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#c084fc]/20 border border-[#c084fc]/50"></span>
                                <span>IN-THE-MONEY PUTS (ITM)</span>
                              </span>
                              <span className="flex items-center space-x-1.5">
                                <span className="w-2.5 h-2.5 rounded-sm bg-[#fbbf24]/30 border border-[#fbbf24]"></span>
                                <span>AT-THE-MONEY (ATM SPOT)</span>
                              </span>
                            </div>
                            <span>SOURCE: LIVE NSE INDIA OPTION CHAIN CONTRACTS</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 2: OTHER OPTIONS STRATEGIES */}
            {options.length > 0 && (
              <div className="p-4 rounded border border-[#1c1f26] bg-[#0c0d12] space-y-3">
                <div className="flex items-center justify-between border-b border-[#1c1f26] pb-2">
                  <div className="flex items-center space-x-2">
                    <Target className="w-3.5 h-3.5 text-[#00d2ff]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      ADDITIONAL DERIVATIVE TACTICAL STRATEGIES
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">INDEX &amp; HIGH-LIQUIDITY EQUITIES</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {options.map((opt, i) => {
                    const actionLabel = (opt.recommended_action || opt.action || opt.bias || "BUY").toUpperCase();
                    const isBuy = actionLabel.includes("BUY") || actionLabel.includes("CALL") || actionLabel.includes("SPREAD");
                    const title = opt.contract_name || `${opt.instrument || opt.symbol || "OPTION"} ${opt.strike || ""}`;
                    const entryPrice = opt.estimated_premium != null ? `₹${opt.estimated_premium}` : (opt.entry_price_range || "Market");
                    const targetPrice = opt.target_premium != null ? `₹${opt.target_premium}` : (opt.target != null ? `₹${opt.target}` : "N/A");
                    const stopPrice = opt.stop_loss_premium != null ? `₹${opt.stop_loss_premium}` : (opt.stop_loss != null ? `₹${opt.stop_loss}` : "N/A");
                    const rationaleText = opt.strategy || opt.rationale || "";

                    return (
                      <div
                        key={i}
                        className="p-3 rounded border border-[#252833] bg-[#070709] space-y-2 hover:border-[#00d2ff]/40 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isBuy ? "bg-[#00f5a0]/15 text-[#00f5a0] border border-[#00f5a0]/30" : "bg-[#ff3b69]/15 text-[#ff3b69] border border-[#ff3b69]/30"
                            }`}>
                              {actionLabel}
                            </span>
                            <span className="font-bold text-white text-xs">{title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{opt.expiry || "WEEKLY"}</span>
                        </div>
                        {rationaleText && (
                          <p className="text-[11px] text-slate-300 leading-relaxed">{rationaleText}</p>
                        )}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[#1c1f26] text-[10px]">
                          <div>
                            <span className="text-slate-500 block">EST. ENTRY</span>
                            <span className="text-slate-200 font-bold">{entryPrice}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">TARGET</span>
                            <span className="text-[#00f5a0] font-bold">{targetPrice}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">STOP LOSS</span>
                            <span className="text-[#ff3b69] font-bold">{stopPrice}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECTION 3: TOP STOCKS TO TAKE */}
            {stocks.length > 0 && (
              <div className="p-4 rounded border border-[#1c1f26] bg-[#0c0d12] space-y-3">
                <div className="flex items-center justify-between border-b border-[#1c1f26] pb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[#00f5a0]" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      EQUITY CASH SCREENER &bull; LOW RISK CLEAN FLOW BREAKOUTS
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">MOMENTUM CANDIDATES</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {stocks.map((stk, i) => {
                    const symbol = stk.ticker || stk.symbol || "";
                    const price = stk.price != null ? stk.price : stk.current_price;
                    const change = stk.change_1d != null ? stk.change_1d : (stk.upside_percentage || 0);
                    const reason = stk.reason || stk.catalyst || "";
                    const category = stk.category || "MOMENTUM";
                    const stop = stk.stop_loss_price != null ? stk.stop_loss_price : stk.stop_loss;

                    return (
                      <div
                        key={i}
                        className="p-3 rounded border border-[#252833] bg-[#070709] hover:border-[#00f5a0]/40 transition flex flex-col justify-between space-y-2"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-black text-white text-xs">{symbol}</span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00f5a0]/15 text-[#00f5a0] border border-[#00f5a0]/30">
                              {change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#00d2ff] mt-0.5 font-bold uppercase">{category}</div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{reason}</p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1c1f26] text-[10px]">
                          <div>
                            <span className="text-slate-500 block">ENTRY</span>
                            <span className="text-slate-200 font-bold">{price ? `₹${price}` : "Market"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">TARGET</span>
                            <span className="text-[#00f5a0] font-bold">{stk.target_price ? `₹${stk.target_price}` : "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">STOP</span>
                            <span className="text-[#ff3b69] font-bold">{stop ? `₹${stop}` : "N/A"}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Regulatory Disclaimer */}
            {disclaimer && (
              <div className="p-3 rounded border border-[#1c1f26] bg-[#0c0d12] text-[10px] text-slate-500 leading-relaxed">
                <span className="font-bold text-slate-400">REGULATORY DISCLAIMER:</span> {disclaimer}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
