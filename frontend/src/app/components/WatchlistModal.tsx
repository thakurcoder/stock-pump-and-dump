"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, ListChecks, AlertCircle, RefreshCw } from "lucide-react";

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase: string;
  onWatchlistUpdated: () => void;
}

export default function WatchlistModal({
  isOpen,
  onClose,
  apiBase,
  onWatchlistUpdated,
}: WatchlistModalProps) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadWatchlist();
      setError(null);
      setSuccess(null);
    }
  }, [isOpen]);

  const loadWatchlist = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/api/watchlist`);
      if (!res.ok) throw new Error("Failed to load watchlist");
      const data = await res.json();
      setTickers(data.tickers || []);
    } catch (err: any) {
      setError(err?.message || "Could not fetch watchlist");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTicker = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTicker.trim().toUpperCase().replace(/\.NS$/, "");
    if (!clean) return;
    if (tickers.includes(clean)) {
      setError(`Ticker ${clean} is already in the watchlist.`);
      return;
    }
    if (tickers.length >= 100) {
      setError("Maximum 100 tickers allowed in watchlist.");
      return;
    }
    setTickers([...tickers, clean]);
    setNewTicker("");
    setError(null);
  };

  const handleRemoveTicker = (tickerToRemove: string) => {
    if (tickers.length <= 1) {
      setError("Watchlist must contain at least 1 ticker.");
      return;
    }
    setTickers(tickers.filter((t) => t !== tickerToRemove));
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${apiBase}/api/watchlist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Failed to update watchlist");
      }
      setSuccess("Watchlist saved successfully!");
      onWatchlistUpdated();
      setTimeout(() => {
        setSuccess(null);
      }, 2500);
    } catch (err: any) {
      setError(err?.message || "Error saving watchlist");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-white/10 shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white tracking-tight">Watchlist Manager</h3>
              <p className="text-xs text-slate-400">Manage tickers screened by PumpWatch ({tickers.length}/100)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <span>{success}</span>
          </div>
        )}

        {/* Add Ticker Input */}
        <form onSubmit={handleAddTicker} className="mt-4 flex gap-2">
          <input
            type="text"
            value={newTicker}
            onChange={(e) => setNewTicker(e.target.value)}
            placeholder="Add NSE Symbol (e.g., TATASTEEL, IDEA)"
            className="flex-1 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-sky-500/50"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </form>

        {/* Ticker List */}
        <div className="mt-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">Active Tickers</p>
          <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin">
            {loading ? (
              <div className="py-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                Loading watchlist...
              </div>
            ) : tickers.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs">No tickers in watchlist.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tickers.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-mono font-medium text-slate-200"
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => handleRemoveTicker(t)}
                      className="text-slate-400 hover:text-rose-400 transition-colors"
                      title={`Remove ${t}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-white/[0.08] flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">Changes update pumpwatch/tickers.txt</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
