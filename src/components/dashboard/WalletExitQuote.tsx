"use client";

import { useState } from "react";

type ExactQuote = { usdcAmount: number; quotedAt: number; priceImpactPct: number | null };

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

/** On-demand quote to avoid consuming Jupiter free-tier requests on every page refresh. */
export default function WalletExitQuote({ ticker, mint, tokenAmount }: {
  ticker: string;
  mint: string;
  tokenAmount: number;
}) {
  const [quote, setQuote] = useState<ExactQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setQuote(null);
    setError(null);
    try {
      const response = await fetch("/api/wallet/exit-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, mint, tokenAmount }),
      });
      const result = await response.json();
      if (!response.ok || result.status !== "ok" || !Number.isFinite(result.usdcAmount)) {
        throw new Error(result.error ?? "Unable to obtain a SELL quote.");
      }
      setQuote({ usdcAmount: result.usdcAmount, quotedAt: result.quotedAt, priceImpactPct: result.priceImpactPct });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/70 dark:bg-violet-950/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black text-slate-800 dark:text-slate-200">Your exact balance · estimated SELL proceeds</div>
          {quote ? (
            <div className="mt-1 text-lg font-black text-slate-950 dark:text-white">{money(quote.usdcAmount)}</div>
          ) : (
            <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">Get a live Jupiter quote for {tokenAmount.toFixed(6)} tokens.</div>
          )}
        </div>
        <button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">
          {busy ? "Quoting…" : quote ? "Refresh SELL quote" : "Get exact SELL quote"}
        </button>
      </div>
      {quote && <p className="mt-2 text-[11px] leading-5 text-slate-600 dark:text-slate-400">Quoted {new Date(quote.quotedAt).toLocaleTimeString("en-IE")}. Indicative proceeds only, not guaranteed execution; may exclude network/priority fees. Refresh before selling.</p>}
      {error && <p className="mt-2 text-xs font-semibold text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}
