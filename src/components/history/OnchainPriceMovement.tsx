"use client";

import { useEffect, useState } from "react";
import type { IssuerDailyRangeSummary } from "@/lib/paperLab/dailyRanges";

type IssuerMovement = IssuerDailyRangeSummary & { currentFrictionPct: number | null; frictionAt: number | null };
type Response = { issuers: IssuerMovement[]; quoteSizeUsd: number; capturedAt: number | null };

function price(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 3 }).format(value);
}
function percent(value: number | null) {
  return value === null || !Number.isFinite(value) ? "—" : `${value.toFixed(2)}%`;
}
function utcTime(value: number | null) {
  return value === null ? "—" : new Date(value).toLocaleString("en-IE", { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) + " UTC";
}

export default function OnchainPriceMovement({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    setError(null);
    async function load() {
      try {
        const response = await fetch(`/api/stock-movement?ticker=${encodeURIComponent(ticker)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load movement");
        if (active) setData(result as Response);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : String(e));
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 15 * 60 * 1000 + 30 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [ticker]);

  return (
    <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">Historical execution</div>
      <h2 className="mt-1 text-xl font-black md:text-2xl">On-chain price movement</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-400">Today’s sampled $1,000 BUY and SELL prices for each issuer, plus the average range across completed UTC days. Based on stored history; no additional Jupiter quotes.</p>
      {!data && !error && <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading price movement…</p>}
      {error && <p className="mt-5 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {data && data.issuers.length === 0 && <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Not enough $1,000 history yet.</p>}
      {data && data.issuers.length > 0 && <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {data.issuers.map((row) => <article key={`${row.issuer}:${row.symbol}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black">{row.issuer} · {row.symbol}</h3><p className="text-xs text-gray-500 dark:text-slate-400">{row.latest.dateUtc} UTC · {row.latest.samples} captures{row.latest.completeDay ? " · complete day" : " · partial day"}</p></div><span className="rounded-lg bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-300">Recent friction {percent(row.currentFrictionPct)}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white p-3 dark:bg-slate-950"><p className="text-xs text-gray-500 dark:text-slate-400">Today’s BUY range</p><p className="mt-1 text-xl font-black">{percent(row.latest.buyRangePct)}</p><p className="mt-1 text-xs">Low {price(row.latest.buyLow)} · High {price(row.latest.buyHigh)}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Low: {utcTime(row.latest.buyLowAt)}<br />High: {utcTime(row.latest.buyHighAt)}</p></div>
            <div className="rounded-xl bg-white p-3 dark:bg-slate-950"><p className="text-xs text-gray-500 dark:text-slate-400">Today’s SELL range</p><p className="mt-1 text-xl font-black">{percent(row.latest.sellRangePct)}</p><p className="mt-1 text-xs">Low {price(row.latest.sellLow)} · High {price(row.latest.sellHigh)}</p><p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">Low: {utcTime(row.latest.sellLowAt)}<br />High: {utcTime(row.latest.sellHighAt)}</p></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-200 pt-3 text-sm dark:border-slate-700"><div><p className="text-xs text-gray-500 dark:text-slate-400">Average daily SELL range</p><p className="font-black">{percent(row.avgSellRangePct)}</p><p className="text-[11px] text-gray-500 dark:text-slate-400">{row.completedDays} completed UTC {row.completedDays === 1 ? "day" : "days"}</p></div><div><p className="text-xs text-gray-500 dark:text-slate-400">Average daily BUY range</p><p className="font-black">{percent(row.avgBuyRangePct)}</p><p className="text-[11px] text-gray-500 dark:text-slate-400">Friction quote: {utcTime(row.frictionAt)}</p></div></div>
        </article>)}
      </div>}
      <p className="mt-4 text-xs leading-5 text-gray-500 dark:text-slate-400">15-minute sampled ranges are not intraday highs/lows or achievable profits. BUY and SELL are effective $1,000 quote prices; recent friction estimates the immediate round-trip break-even move from a stored quote no more than 30 minutes old. Quotes and liquidity can change, and network fees and realised execution slippage may be additional.</p>
    </section>
  );
}
