"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/shell/AppShell";
import type {
  PaperLabDashboard,
  PaperLabObservation,
  PaperStrategyType,
  PaperTrade,
  PaperTradeDirection,
} from "@/types/paperLab";

function money(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function pct(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function number(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function when(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-IE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function durationMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function pnlClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "text-slate-500 dark:text-slate-400";
  if (value > 0) return "text-emerald-700 dark:text-emerald-300";
  if (value < 0) return "text-red-700 dark:text-red-300";
  return "text-slate-700 dark:text-slate-300";
}

function SignalBadge({ status }: { status: PaperLabObservation["longSignalStatus"] }) {
  const classes = status === "candidate"
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
    : status === "watch"
      ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${classes}`}>
      {status === "no_setup" ? "No setup" : status}
    </span>
  );
}

function SideBadge({ direction }: { direction: PaperTradeDirection }) {
  const classes = direction === "long"
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
    : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${classes}`}>{direction}</span>;
}

function StrategyBadge({ strategyType }: { strategyType: PaperStrategyType }) {
  const classes = strategyType === "momentum"
    ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
    : "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${classes}`}>{strategyType}</span>;
}

function StatCard({ label, value, detail, valueClass = "" }: { label: string; value: string; detail?: string; valueClass?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white ${valueClass}`}>{value}</div>
      {detail ? <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{detail}</div> : null}
    </div>
  );
}

function TradeRow({ trade, open }: { trade: PaperTrade; open: boolean }) {
  const holdMinutes = ((trade.closedAt ?? Date.now()) - trade.openedAt) / 60000;
  const pnlUsd = open ? trade.currentPnlUsd : trade.realisedPnlUsd;
  const pnlPct = open ? trade.currentPnlPct : trade.realisedPnlPct;

  return (
    <tr className="border-t border-slate-200 align-top dark:border-slate-800">
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-black text-slate-950 dark:text-white">{trade.ticker}</div>
          <StrategyBadge strategyType={trade.strategyType} />
          <SideBadge direction={trade.direction} />
        </div>
        <div className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{trade.issuer} · {trade.symbol}</div>
      </td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{when(trade.openedAt)}</td>
      <td className="px-3 py-3">
        <div className="text-sm font-black text-slate-950 dark:text-white">{money(trade.entryCostUsd)}</div>
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{trade.direction === "long" ? "Entry buy" : "Entry short proceeds"} · {number(trade.tokenAmount, 6)} tokens</div>
        {trade.strategyType === "momentum" && trade.entryMomentum ? (
          <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Wrapper 1h {pct(trade.entryMomentum.wrapperMove1hPct)} · Wall St context {pct(trade.entryMomentum.benchmarkMove1hPct)}</div>
        ) : null}
      </td>
      <td className="px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">{money(open ? trade.currentExitUsd : trade.realisedExitUsd)}</td>
      <td className={`px-3 py-3 text-sm font-black ${pnlClass(pnlUsd)}`}>
        <div>{money(pnlUsd)}</div>
        <div className="text-xs">{pct(pnlPct)}</div>
      </td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{pct(trade.maxFavourablePct)}</td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{pct(trade.maxAdversePct)}</td>
      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{durationMinutes(holdMinutes)}</td>
      <td className="px-3 py-3">
        {open ? (
          <span className="text-xs font-black uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">Open</span>
        ) : (
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">{trade.exitReason ?? "Closed"}</span>
        )}
      </td>
    </tr>
  );
}

type SignalMetric = { label: string; value: string };
type SignalCardData = {
  key: string;
  strategyType: PaperStrategyType;
  direction: PaperTradeDirection;
  status: PaperLabObservation["longSignalStatus"];
  reason: string;
  ticker: string;
  issuer: string;
  symbol: string;
  timestamp: number;
  metrics: SignalMetric[];
};

function signalCardsFromObservation(row: PaperLabObservation): SignalCardData[] {
  const cards: SignalCardData[] = [];

  if (row.momentumLongSignalStatus !== "no_setup") {
    cards.push({
      key: `${row.id}:momentum:long`, strategyType: "momentum", direction: "long", status: row.momentumLongSignalStatus,
      reason: row.momentumLongSignalReasons?.[0] ?? "", ticker: row.ticker, issuer: row.issuer, symbol: row.symbol, timestamp: row.timestamp,
      metrics: [
        { label: "Wrapper 1h", value: pct(row.momentum.wrapperMove1hPct) },
        { label: "Wall St (context)", value: pct(row.momentum.benchmarkMove1hPct) },
        { label: "Rising steps", value: `${row.momentum.wrapperPositiveSteps}/${row.momentum.trendStepsAvailable || 0}` },
        { label: "Break-even friction", value: pct(row.approxBreakEvenMovePct) },
      ],
    });
  }

  if (row.longSignalStatus !== "no_setup") {
    cards.push({
      key: `${row.id}:convergence:long`, strategyType: "convergence", direction: "long", status: row.longSignalStatus,
      reason: row.longSignalReasons?.[0] ?? "", ticker: row.ticker, issuer: row.issuer, symbol: row.symbol, timestamp: row.timestamp,
      metrics: [
        { label: "Executable BUY gap", value: pct(row.buyGapPct) },
        { label: "Room after friction", value: pct(row.longTheoreticalConvergencePct) },
        { label: "Break-even friction", value: pct(row.approxBreakEvenMovePct) },
        { label: "Persistence", value: `${row.longPersistentCaptures} captures` },
      ],
    });
  }

  return cards;
}

export default function PaperLabClient() {
  const [data, setData] = useState<PaperLabDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/lab", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Unable to load Paper Lab");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const signalCards = useMemo(() => {
    const cards = (data?.latestObservations ?? []).flatMap(signalCardsFromObservation);
    return cards.sort((a, b) => {
      const rank = (status: SignalCardData["status"]) => status === "candidate" ? 0 : status === "watch" ? 1 : 2;
      const strategyRank = (strategyType: PaperStrategyType) => strategyType === "momentum" ? 0 : 1;
      return rank(a.status) - rank(b.status) || strategyRank(a.strategyType) - strategyRank(b.strategyType) || b.timestamp - a.timestamp;
    });
  }, [data]);

  const candidateCount = useMemo(() => signalCards.filter((card) => card.status === "candidate").length, [signalCards]);
  const watchCount = useMemo(() => signalCards.filter((card) => card.status === "watch").length, [signalCards]);

  return (
    <AppShell>
      <main className="app-shell py-8 md:py-10">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">Private admin · Research only</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">Paper Trading Lab</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">Forward-tests long-only convergence and 24/7 on-chain momentum using existing $1,000 history BUY/SELL quotes. No real trades are placed. Legacy short trades remain visible and continue to be marked until they close; no new synthetic shorts are entered.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/stocks" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Stocks</Link>
              <Link href="/admin/competitions" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">Competitions</Link>
              <button type="button" onClick={load} disabled={loading} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
            </div>
          </div>
        </section>

        {error ? <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}
        {!data && loading ? <div className="py-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">Loading Paper Lab…</div> : null}

        {data ? (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="All-time paper P&L" value={money(data.summary.combinedPnlUsd)} detail={`${money(data.summary.realisedPnlUsd)} realised · ${money(data.summary.unrealisedPnlUsd)} open`} valueClass={pnlClass(data.summary.combinedPnlUsd)} />
              <StatCard label="Paper trades · all versions" value={`${data.summary.openTrades + data.summary.completedTrades}`} detail={`${data.summary.completedTrades} completed · ${data.summary.openTrades} open (${data.summary.openLongTrades} long · ${data.summary.openShortTrades} short)`} />
              <StatCard label="Target hits · saved rules" value={data.summary.targetHitRatePct === null ? "—" : `${data.summary.targetHitRatePct.toFixed(1)}%`} detail={`${data.summary.targetHits} of ${data.summary.completedTrades} completed`} />
              <StatCard label="Average completed P&L" value={money(data.summary.averagePnlUsd)} detail={data.summary.averagePnlPct === null ? "No completed trades yet" : `${pct(data.summary.averagePnlPct)} per trade`} valueClass={pnlClass(data.summary.averagePnlUsd)} />
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Strategy scoreboard</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Results are separated by strategy version, direction and entry setup. Historical $50 trades are not mixed with the $1,000 experiment. All-time headline cards combine versions; use the strategy scoreboard for version-specific results. The current V4.4 target is +{data.rules.targetPct.toFixed(2)}%.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {data.strategyPerformance.map((row) => (
                  <div key={`${row.strategyVersion}:${row.strategyType}:${row.direction}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="flex flex-wrap items-center gap-2"><StrategyBadge strategyType={row.strategyType} /><SideBadge direction={row.direction} /></div>
                    <div className="mt-3 text-lg font-black text-slate-950 dark:text-white">{row.label}</div><div className="text-xs text-slate-500 dark:text-slate-400">{row.strategyVersion}</div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div><div className="text-xs font-bold text-slate-500 dark:text-slate-400">Completed</div><div className="font-black text-slate-950 dark:text-white">{row.completedTrades}</div></div>
                      <div><div className="text-xs font-bold text-slate-500 dark:text-slate-400">Open</div><div className="font-black text-slate-950 dark:text-white">{row.openTrades}</div></div>
                      <div><div className="text-xs font-bold text-slate-500 dark:text-slate-400">Target hit rate</div><div className="font-black text-slate-950 dark:text-white">{row.targetHitRatePct === null ? "—" : `${row.targetHitRatePct.toFixed(1)}%`}</div></div>
                      <div><div className="text-xs font-bold text-slate-500 dark:text-slate-400">Avg P&L</div><div className={`font-black ${pnlClass(row.averagePnlPct)}`}>{pct(row.averagePnlPct)}</div></div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">24/7 discovery observations</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Patterns are recorded even when no paper entry qualifies. Closed-market gap changes are research context only, not confirmed Wall Street divergence.</p>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(data.discoveryObservations ?? []).slice(0, 18).map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="font-black text-slate-950 dark:text-white">{row.ticker} · {row.issuer}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{when(row.timestamp)} · {row.discovery?.gapReferenceFresh ? "Fresh regular reference" : "Underlying reference unverified"}</div>
                    <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">{row.discovery?.events.join(" · ")}</div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Wrapper 1h {pct(row.momentum?.wrapperMove1hPct)} · BUY gap {pct(row.buyGapPct)}</div>
                  </div>
                ))}
                {!(data.discoveryObservations ?? []).length ? <div className="text-sm text-slate-500 dark:text-slate-400">No discovery events in the latest captures yet. Observations continue every capture.</div> : null}
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">Daily $1,000 executable quote ranges</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Per stock and issuer: today's sampled BUY/SELL lows and highs, with the average daily range across completed UTC days. No additional Jupiter requests. The current UTC day is partial and never included in the historical average.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1120px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300"><tr>{["Stock / issuer", "Latest UTC day", "BUY low → high", "BUY range", "SELL low → high", "SELL range", "Avg BUY range", "Avg SELL range", "Best later SELL vs earlier BUY"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead>
                  <tbody>
                    {(data.dailyIssuerRanges ?? []).map((row) => (
                      <tr key={`${row.ticker}:${row.issuer}:${row.symbol}`} className="border-t border-slate-200 align-top dark:border-slate-800">
                        <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">{row.ticker}<div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{row.issuer} · {row.symbol}</div></td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{row.latest.dateUtc}<div className="text-xs text-slate-500 dark:text-slate-400">{row.latest.completeDay ? "Complete UTC day" : "Partial UTC day"} · {row.latest.samples} captures</div></td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{money(row.latest.buyLow)} → {money(row.latest.buyHigh)}<div className="text-xs text-slate-500 dark:text-slate-400">Low {when(row.latest.buyLowAt)} · high {when(row.latest.buyHighAt)}</div></td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">{pct(row.latest.buyRangePct)}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{money(row.latest.sellLow)} → {money(row.latest.sellHigh)}<div className="text-xs text-slate-500 dark:text-slate-400">Low {when(row.latest.sellLowAt)} · high {when(row.latest.sellHighAt)}</div></td>
                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">{pct(row.latest.sellRangePct)}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{pct(row.avgBuyRangePct)}<div className="text-xs text-slate-500 dark:text-slate-400">{row.completedDays} completed day(s)</div></td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{pct(row.avgSellRangePct)}</td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{pct(row.latest.bestChronologicalLongPct)}</td>
                      </tr>
                    ))}
                    {!(data.dailyIssuerRanges ?? []).length ? <tr><td colSpan={9} className="px-3 py-7 text-center text-slate-500 dark:text-slate-400">Waiting for valid $1,000 history quotes.</td></tr> : null}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">These are sampled 15-minute prices, not true intraday extremes. The chronological BUY-to-later-SELL figure is an optimistic historical price proxy, not a backtested trade: it ignores timing constraints and exact-token exit quotes. It may include less than a full day.</p>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">V4.4 · Candidate forward research</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Uncapped observations, independent of paper-trade eligibility and daily limits. Sustained 30m + 1h momentum, fresh-reference gap events and wrapper reversals. New V4.4 candidates are followed for up to 48 hours with 4h, 24h and 48h checkpoints, using subsequent $1,000 effective quotes as approximate price proxies, not exact-token P&amp;L. The actual paper portfolio retains its original 24h timeout. The scoreboard covers recent (7-day) candidate records; older candidates remain under their original versions.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[890px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300"><tr>{["Pattern", "Side", "Recorded", "48h complete", "24h measured", "48h measured", "+1% by 24h", "+1% by 48h", "−1% by 24h", "−1% by 48h", "Mean 24h", "Mean 48h"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead>
                  <tbody>
                    {data.researchPerformance?.length ? data.researchPerformance.map((row) => (
                      <tr key={`${row.kind}:${row.direction}`} className="border-t border-slate-200 dark:border-slate-800">
                        <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">{row.kind.replaceAll("_", " ")}</td>
                        <td className="px-3 py-3"><SideBadge direction={row.direction} /></td>
                        <td className="px-3 py-3">{row.tracked}</td>
                        <td className="px-3 py-3">{row.complete}</td>
                        <td className="px-3 py-3">{row.measured24h}</td>
                        <td className="px-3 py-3">{row.measured48h}</td>
                        <td className="px-3 py-3">{row.targetBy24h}</td>
                        <td className="px-3 py-3">{row.targetBy48h}</td>
                        <td className="px-3 py-3">{row.stopBy24h}</td>
                        <td className="px-3 py-3">{row.stopBy48h}</td>
                        <td className="px-3 py-3">{pct(row.average24hPct)}</td>
                        <td className="px-3 py-3">{pct(row.average48hPct)}</td>
                      </tr>
                    )) : <tr><td colSpan={12} className="px-3 py-7 text-center text-slate-500 dark:text-slate-400">Waiting for new V4.4 candidates and their 48-hour follow-up.</td></tr>}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Candidate counts overlap within issuers and stocks. New long-only research continues through 48h even if a simulated +1% target or −1% research threshold was hit earlier; such later recovery is NOT a portfolio win. Returns remain sampled price proxies, not guaranteed execution.</p>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-950 dark:text-white">Current long signals</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Long-only: on-chain momentum can run 24/7; convergence requires a fresh regular-session reference. Historical short trades remain in the trade tables.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-300">{candidateCount} candidates · {watchCount} watches</div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {signalCards.length ? signalCards.map((card) => (
                    <div key={card.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-lg font-black text-slate-950 dark:text-white">{card.ticker} · {card.issuer}</div>
                            <StrategyBadge strategyType={card.strategyType} />
                            <SideBadge direction={card.direction} />
                          </div>
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{card.symbol} · {when(card.timestamp)}</div>
                        </div>
                        <SignalBadge status={card.status} />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        {card.metrics.map((metric) => (
                          <div key={metric.label}><div className="text-xs font-bold text-slate-500 dark:text-slate-400">{metric.label}</div><div className="mt-1 font-black text-slate-900 dark:text-white">{metric.value}</div></div>
                        ))}
                      </div>
                      <div className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">{card.reason}</div>
                    </div>
                  )) : (
                    <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">No candidate/watch setups yet. Momentum needs enough 15-minute observations to build its trend window.</div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Strategy suite {data.rules.version}</div>
                <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">Rules being forward-tested</h2>
                <div className="mt-5 grid gap-3 text-sm">
                  {[
                    ["Paper entry", money(data.rules.notionalUsd)],
                    ["Profit target", `${data.rules.targetPct.toFixed(2)}%`],
                    ["Research stretch target", `${(data.rules.secondaryTargetPct ?? 1.2).toFixed(2)}%`],
                    ["Max quoted price impact", `${(data.rules.maxQuoteImpactPct ?? 1).toFixed(2)}% per side`],
                    ["Stop", data.rules.stopPct === null ? "Disabled" : `${data.rules.stopPct.toFixed(2)}%`],
                    ["Maximum hold", `${data.rules.maxHoldHours}h`],
                    ["Daily long cap", `${data.rules.maxNewLongTradesPerDay}`],
                    ["New short entries", "Disabled (long-only)"],
                    ["Required persistence", `${data.rules.minPersistentCaptures} captures`],
                    ["Minimum reported liquidity", money(data.rules.minLiquidityUsd, 0)],
                    ["Convergence: regular only", data.rules.requireMarketOpenForEntries ? "Yes" : "No"],
                    ["Momentum: regular only", data.rules.momentumRequireMarketOpen ? "Yes" : "No — 24/7"],
                    ["Momentum lookback", `${data.rules.momentumLookbackCaptures} captures`],
                    ["Momentum direction", `${data.rules.momentumMinAlignedSteps}/${data.rules.momentumTrendSteps} aligned moves`],
                    ["Momentum max friction", `${data.rules.momentumMaxBreakEvenPct.toFixed(2)}%`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
                      <span className="font-semibold text-slate-600 dark:text-slate-400">{label}</span>
                      <span className="font-black text-slate-950 dark:text-white">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                  <div><div className="text-xs font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">Momentum long</div><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">The on-chain wrapper must show upward movement over the lookback window, with broadly aligned recent moves. Executable BUY and SELL routes, liquidity and round-trip friction are checked. A fresh Wall Street benchmark is not required for momentum. The target is still measured from the real executable paper entry, not from the trend percentage.</p></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">Convergence long</div><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">The original strategy remains a separate experiment. A fresh regular-session Wall Street reference and a discount sufficient to cover friction and the target are required.</p></div>
                  <div><div className="text-xs font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">Why both stay</div><p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">Discovery events record gap crosses, returns toward zero, on-chain price reversals and friction improvements independently of entries. Existing V1/V2 trades and observations are preserved.</p></div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="p-5 md:p-6"><h2 className="text-xl font-black text-slate-950 dark:text-white">Open paper positions</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Long positions are marked using fresh exact-quantity Jupiter SELL quotes. Previously opened synthetic shorts are retained and marked only to complete their historical experiment; the lab never opens new ones. Quotes are not guaranteed fills. Identical marks are reused across strategies.</p></div>
              <div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left"><thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{["Stock / strategy", "Opened", "Entry", "Current mark", "P&L", "MFE", "MAE", "Held", "Status"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody>{data.openTrades.length ? data.openTrades.map((trade) => <TradeRow key={trade.id} trade={trade} open />) : <tr><td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No open paper positions.</td></tr>}</tbody></table></div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="p-5 md:p-6"><h2 className="text-xl font-black text-slate-950 dark:text-white">Completed trades</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Realised paper P&L is frozen at the first 15-minute observation that hits the target, stop, or maximum holding period.</p></div>
              <div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left"><thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-400"><tr>{["Stock / strategy", "Opened", "Entry", "Exit / cover", "P&L", "MFE", "MAE", "Held", "Exit reason"].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead><tbody>{data.completedTrades.length ? data.completedTrades.map((trade) => <TradeRow key={trade.id} trade={trade} open={false} />) : <tr><td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No completed paper trades yet.</td></tr>}</tbody></table></div>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
