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
  Compass
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
    call_ltp: number;
    put_oi: number;
    put_chg_oi: number;
    put_ltp: number;
  }>;
}

interface OptionRecommendation {
  type: string;
  symbol: string;
  action: string;
  strike: number;
  expiry: string;
  entry_price_range: string;
  target: number;
  stop_loss: number;
  sentiment: string;
  rationale: string;
  risk_level: string;
}

interface StockRecommendation {
  symbol: string;
  company_name: string;
  action: string;
  current_price: number;
  target_price: number;
  stop_loss: number;
  upside_percentage: number;
  timeframe: string;
  catalyst: string;
  risk_level: string;
}

export default function RecommendationsPage() {
  const [niftyStrategy, setNiftyStrategy] = useState<NiftyStrategy | null>(null);
  const [options, setOptions] = useState<OptionRecommendation[]>([]);
  const [stocks, setStocks] = useState<StockRecommendation[]>([]);
  const [disclaimer, setDisclaimer] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/recommendations");
      if (!res.ok) throw new Error("Failed to fetch recommendation feed");
      const data = await res.json();
      setNiftyStrategy(data.nifty_options_strategy);
      setOptions(data.options_recommendations || []);
      setStocks(data.stocks_recommendations || []);
      setDisclaimer(data.disclaimer || "");
    } catch (err: any) {
      setError(err.message || "Failed to load live recommendations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-white">
              Trading Recommendations
            </h1>
            <p className="text-xs text-slate-400">Institutional NIFTY 50 OI & Market Playbook</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchRecommendations}
            className="flex items-center space-x-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            <span>Refresh Chain</span>
          </button>
          <Link
            href="/"
            className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm"
          >
            Sentinel Dashboard &rarr;
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        {/* Banner */}
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <Compass className="w-6 h-6 text-indigo-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-indigo-200">
                Institutional NIFTY 50 OI Strategy Active
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evaluates Intraday / Positional Open Interest (OI), Trapped Writer Panic Unwinding, Strike Range Width, and INDIAVIX Regime.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800/80 text-cyan-400 border border-slate-700">
              NIFTY Spot: {niftyStrategy ? niftyStrategy.spot_price.toLocaleString("en-IN") : "..."}
            </span>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-slate-800/80 text-amber-400 border border-slate-700">
              INDIA VIX: {niftyStrategy ? `${niftyStrategy.india_vix} (${niftyStrategy.vix_direction})` : "..."}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm text-slate-400 animate-pulse">
              Parsing live NIFTY 50 Option Chain, Strike Distributions & VIX Regimes...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 space-y-2">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <h3 className="text-sm font-semibold">Error Loading Strategy Feed</h3>
            </div>
            <p className="text-xs text-rose-300/80">{error}</p>
          </div>
        ) : (
          <>
            {/* SECTION 1: NIFTY 50 INSTITUTIONAL OPTIONS STRATEGY */}
            {niftyStrategy && (
              <section className="space-y-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <BarChart2 className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-bold text-white tracking-wide">
                      NIFTY 50 Option Chain Strategy Matrix
                    </h2>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-300 font-mono">
                    NSE Live Rules Active
                  </span>
                </div>

                {/* STEP 1: PRE-TRADE SETUP (OI Battleground) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Intraday Battleground */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        1. Intraday Battleground (Change in OI)
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        Fast Dynamics
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10">
                        <span className="text-[11px] text-emerald-400 font-medium">Intraday Support (Max PE Chg)</span>
                        <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                          {niftyStrategy.pre_trade_setup.intraday.support_strike} PE
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          +{(niftyStrategy.pre_trade_setup.intraday.support_chg_oi / 100000).toFixed(2)}L OI Added
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-950/10">
                        <span className="text-[11px] text-rose-400 font-medium">Intraday Resistance (Max CE Chg)</span>
                        <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                          {niftyStrategy.pre_trade_setup.intraday.resistance_strike} CE
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          +{(niftyStrategy.pre_trade_setup.intraday.resistance_chg_oi / 100000).toFixed(2)}L OI Added
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Positional Battleground */}
                  <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Positional & Swing Trend (Total OI)
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                        Monthly Trend
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/10">
                        <span className="text-[11px] text-emerald-400 font-medium">Positional Support (Max PE OI)</span>
                        <div className="text-xl font-bold font-mono text-emerald-300 mt-1">
                          {niftyStrategy.pre_trade_setup.positional.support_strike} PE
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {(niftyStrategy.pre_trade_setup.positional.support_total_oi / 100000).toFixed(2)}L Total OI
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-950/10">
                        <span className="text-[11px] text-rose-400 font-medium">Positional Resistance (Max CE OI)</span>
                        <div className="text-xl font-bold font-mono text-rose-300 mt-1">
                          {niftyStrategy.pre_trade_setup.positional.resistance_strike} CE
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {(niftyStrategy.pre_trade_setup.positional.resistance_total_oi / 100000).toFixed(2)}L Total OI
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 2: CORE ENTRY CHECKS & EXECUTION */}
                <div className="p-6 rounded-xl border border-slate-800 bg-gradient-to-b from-slate-900/80 to-slate-950 space-y-6">
                  {/* Step A Panic alert if active */}
                  {niftyStrategy.panic_unwinding_override && (
                    <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 flex items-start space-x-3 text-amber-200">
                      <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-bold text-amber-300">
                          Step A: Panic Unwinding Override Active ({niftyStrategy.panic_unwinding_override.type})
                        </h4>
                        <p className="text-xs text-amber-200/90 mt-1 leading-relaxed">
                          {niftyStrategy.panic_unwinding_override.detail}
                        </p>
                        <span className="inline-block mt-2 font-mono text-xs font-semibold px-2.5 py-1 rounded bg-amber-900/60 border border-amber-700 text-amber-100">
                          Action: {niftyStrategy.panic_unwinding_override.action}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Step B: Range Filter */}
                  <div className="p-4 rounded-lg border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Step B: Strike Range Filter
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          !niftyStrategy.range_filter.is_wide_range
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800"
                            : "bg-amber-950/80 text-amber-400 border border-amber-800"
                        }`}>
                          {niftyStrategy.range_filter.range_verdict}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Distance between MAX CHG IN OI PE and CE. Threshold is approx ~1.65% of spot.
                      </p>
                    </div>

                    <div className="flex items-center space-x-4 shrink-0 text-right">
                      <div>
                        <div className="text-xs text-slate-400">Spread Distance</div>
                        <div className="text-sm font-mono font-bold text-slate-200">
                          {niftyStrategy.range_filter.strike_distance} pts
                        </div>
                      </div>
                      <div className="border-l border-slate-700 pl-4">
                        <div className="text-xs text-slate-400">Max Threshold</div>
                        <div className="text-sm font-mono font-bold text-cyan-400">
                          ≤ {niftyStrategy.range_filter.threshold_pts} pts
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step C: Recommended Strategy Box */}
                  <div className="p-5 rounded-xl border border-cyan-500/30 bg-cyan-950/10 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-cyan-800/40 pb-3">
                      <div>
                        <span className="text-[11px] font-semibold tracking-wider text-cyan-400 uppercase">
                          Step C: Direction + Volatility Strategy
                        </span>
                        <h3 className="text-xl font-bold text-white flex items-center space-x-2 mt-0.5">
                          <span>{niftyStrategy.trade_recommendation.strategy_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                            niftyStrategy.market_direction === "BULLISH"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}>
                            {niftyStrategy.market_direction}
                          </span>
                        </h3>
                      </div>

                      <div className="flex items-center space-x-3 text-xs">
                        <span className="text-slate-400">INDIAVIX Regime:</span>
                        <span className="font-semibold text-amber-300 font-mono">
                          {niftyStrategy.vix_direction} ({niftyStrategy.india_vix})
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {niftyStrategy.trade_recommendation.rationale}
                    </p>

                    {/* Legs execution */}
                    <div className="space-y-2 pt-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                        Exact Strategy Legs ({niftyStrategy.trade_recommendation.execution_type})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {niftyStrategy.trade_recommendation.legs.map((leg, i) => (
                          <div
                            key={i}
                            className="p-3 rounded-lg border border-slate-800 bg-slate-900/90 flex items-center justify-between"
                          >
                            <div className="flex items-center space-x-2.5">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  leg.toUpperCase().includes("BUY")
                                    ? "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                                    : "bg-rose-900/60 text-rose-300 border border-rose-700"
                                }`}
                              >
                                {leg.split(" ")[0]}
                              </span>
                              <span className="font-mono font-bold text-white text-sm">
                                {leg.substring(leg.indexOf(" ") + 1)}
                              </span>
                            </div>
                            <span className="text-xs font-mono text-cyan-400 font-medium">
                              Active Leg
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Naked Alternative */}
                    {niftyStrategy.naked_alternative && (
                      <div className="p-3 rounded-lg border border-indigo-500/20 bg-indigo-950/20 text-xs text-indigo-300 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold text-indigo-200">Single-Leg Alternative:</span>{" "}
                          {niftyStrategy.naked_alternative.action}
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">
                          {niftyStrategy.naked_alternative.condition}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* STEP 3: STRICT NO-TRADE & EXIT RULES CHECKLIST */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="w-4 h-4 text-rose-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        3. Strict Institutional No-Trade & Exit Gates
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {niftyStrategy.no_trade_rules.map((rule, idx) => (
                        <div key={idx} className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-300">{rule.rule}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                              rule.triggered
                                ? "bg-amber-950/80 text-amber-300 border border-amber-800"
                                : "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                            }`}>
                              {rule.status}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] leading-relaxed">
                            {rule.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* SECTION 2: OTHER OPTIONS RECOMMENDATIONS */}
            {options.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Target className="w-4 h-4 text-indigo-400" />
                    <h2 className="text-base font-bold text-white tracking-wide">
                      Additional Options Strategies
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">BankNIFTY & High Beta</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {options.map((opt, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                            opt.action.toUpperCase() === "BUY" ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-rose-950 text-rose-400 border border-rose-800"
                          }`}>
                            {opt.action}
                          </span>
                          <span className="font-bold text-white font-mono">{opt.symbol} {opt.strike}</span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400">{opt.expiry}</span>
                      </div>
                      <p className="text-xs text-slate-300">{opt.rationale}</p>
                      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 block">Entry</span>
                          <span className="text-slate-200">{opt.entry_price_range}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Target</span>
                          <span className="text-emerald-400">₹{opt.target}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Stop Loss</span>
                          <span className="text-rose-400">₹{opt.stop_loss}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* SECTION 3: TOP STOCKS TO TAKE */}
            {stocks.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-base font-bold text-white tracking-wide">
                      Top Equity Cash / Swing Ideas
                    </h2>
                  </div>
                  <span className="text-xs text-slate-400">Institutional Breakout Filters</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stocks.map((stk, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white font-mono">{stk.symbol}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                            +{stk.upside_percentage}% Upside
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{stk.company_name}</div>
                        <p className="text-xs text-slate-300 mt-2 leading-relaxed">{stk.catalyst}</p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 block">Current</span>
                          <span className="text-slate-200">₹{stk.current_price}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Target</span>
                          <span className="text-emerald-400">₹{stk.target_price}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Stop</span>
                          <span className="text-rose-400">₹{stk.stop_loss}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Disclaimer */}
            {disclaimer && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/30 text-[11px] text-slate-500 leading-relaxed">
                <span className="font-semibold text-slate-400">Regulatory Disclaimer:</span> {disclaimer}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
