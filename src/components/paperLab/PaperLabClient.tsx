"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppShell from "@/components/shell/AppShell";

import type {
  PaperLabDashboard,
  PaperLabObservation,
  PaperSignalStatus,
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
  if (value === null || value === undefined) {
    return "text-slate-500 dark:text-slate-400";
  }

  if (value > 0) {
    return "text-emerald-700 dark:text-emerald-300";
  }

  if (value < 0) {
    return "text-red-700 dark:text-red-300";
  }

  return "text-slate-700 dark:text-slate-300";
}

function signalRank(status: PaperSignalStatus) {
  if (status === "candidate") return 0;
  if (status === "watch") return 1;
  return 2;
}

function SignalBadge({ status }: { status: PaperSignalStatus }) {
  const classes =
    status === "candidate"
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
  const classes =
    direction === "long"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
      : "bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${classes}`}>
      {direction}
    </span>
  );
}

function strategyLabel(strategyType: PaperStrategyType) {
  switch (strategyType) {
    case "extreme_momentum":
      return "Extreme Momentum";
    case "discount_recovery":
      return "Discount Recovery";
    case "wrapper_lag":
      return "Wrapper Lag";
    case "drift_reversal":
      return "Drift Reversal";
    case "momentum":
      return "Legacy Momentum";
    case "convergence":
      return "Legacy Convergence";
    default:
      return strategyType;
  }
}

function StrategyBadge({ strategyType }: { strategyType: PaperStrategyType }) {
  const classes =
    strategyType === "extreme_momentum"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
      : strategyType === "discount_recovery"
        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
        : strategyType === "wrapper_lag"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
          : strategyType === "drift_reversal"
            ? "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-300"
            : strategyType === "momentum"
              ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              : "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300";

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${classes}`}>
      {strategyLabel(strategyType)}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
  valueClass = "",
}: {
  label: string;
  value: string;
  detail?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </div>

      <div className={`mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white ${valueClass}`}>
        {value}
      </div>

      {detail ? (
        <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function TradeEntryContext({ trade }: { trade: PaperTrade }) {
  if (trade.strategyType === "extreme_momentum") {
    return (
      <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Wrapper 2h {pct(trade.entryWrapperMove2hPct ?? trade.entryMomentum?.wrapperMove2hPct)} · friction {pct(trade.entryBreakEvenPct)}
      </div>
    );
  }

  if (trade.strategyType === "discount_recovery") {
    return (
      <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Gap {pct(trade.entryBuyGapPct)} · 1h narrowing {pct(trade.entryGapNarrowing1hPct)} · friction {pct(trade.entryBreakEvenPct)}
      </div>
    );
  }

  if (trade.strategyType === "wrapper_lag") {
    return (
      <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Wrapper lag 1h {pct(trade.entryWrapperLag1hPct)} · friction {pct(trade.entryBreakEvenPct)}
      </div>
    );
  }

  if (trade.strategyType === "drift_reversal") {
    return (
      <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Pre-open BUY gap {pct(trade.entryBuyGapPct)} · friction {pct(trade.entryBreakEvenPct)}
      </div>
    );
  }

  if (trade.entryMomentum) {
    return (
      <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
        Wrapper 1h {pct(trade.entryMomentum.wrapperMove1hPct)} · Wall St context {pct(trade.entryMomentum.benchmarkMove1hPct)}
      </div>
    );
  }

  return null;
}

function TradeRow({ trade, open }: { trade: PaperTrade; open: boolean }) {
  const holdMinutes = ((trade.closedAt ?? Date.now()) - trade.openedAt) / 60000;
  const pnlUsd = open ? trade.currentPnlUsd : trade.realisedPnlUsd;
  const pnlPct = open ? trade.currentPnlPct : trade.realisedPnlPct;

  return (
    <tr className="border-t border-slate-200 align-top dark:border-slate-800">
      <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-black text-slate-950 dark:text-white">
            {trade.ticker}
          </div>

          <StrategyBadge strategyType={trade.strategyType} />
          <SideBadge direction={trade.direction} />
        </div>

        <div className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {trade.issuer} · {trade.symbol}
        </div>
      </td>

      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {when(trade.openedAt)}
      </td>

      <td className="px-3 py-3">
        <div className="text-sm font-black text-slate-950 dark:text-white">
          {money(trade.entryCostUsd)}
        </div>

        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {trade.direction === "long" ? "Entry buy" : "Entry short proceeds"} · {number(trade.tokenAmount, 6)} tokens
        </div>

        <TradeEntryContext trade={trade} />
      </td>

      <td className="px-3 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">
        {money(open ? trade.currentExitUsd : trade.realisedExitUsd)}
      </td>

      <td className={`px-3 py-3 text-sm font-black ${pnlClass(pnlUsd)}`}>
        <div>{money(pnlUsd)}</div>
        <div className="text-xs">{pct(pnlPct)}</div>
      </td>

      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {pct(trade.maxFavourablePct)}
      </td>

      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {pct(trade.maxAdversePct)}
      </td>

      <td className="px-3 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        {durationMinutes(holdMinutes)}
      </td>

      <td className="px-3 py-3">
        {open ? (
          <span className="text-xs font-black uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
            Open
          </span>
        ) : (
          <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
            {trade.exitReason ?? "Closed"}
          </span>
        )}
      </td>
    </tr>
  );
}

type SignalMetric = {
  label: string;
  value: string;
};

type SignalCardData = {
  key: string;
  strategyType: PaperStrategyType;
  direction: PaperTradeDirection;
  status: PaperSignalStatus;
  reason: string;
  ticker: string;
  issuer: string;
  symbol: string;
  timestamp: number;
  metrics: SignalMetric[];
};

function firstReason(reasons: string[] | undefined) {
  return reasons?.[0] ?? "";
}

function signalCardsFromObservation(row: PaperLabObservation): SignalCardData[] {
  const cards: SignalCardData[] = [];
  const experimental = row.experimental;

  if (!experimental) {
    return cards;
  }

  if (experimental.extremeMomentum.signalStatus !== "no_setup") {
    cards.push({
      key: `${row.id}:extreme_momentum:long`,
      strategyType: "extreme_momentum",
      direction: "long",
      status: experimental.extremeMomentum.signalStatus,
      reason: firstReason(experimental.extremeMomentum.signalReasons),
      ticker: row.ticker,
      issuer: row.issuer,
      symbol: row.symbol,
      timestamp: row.timestamp,
      metrics: [
        { label: "Wrapper 2h", value: pct(row.momentum.wrapperMove2hPct) },
        { label: "Wrapper 1h", value: pct(row.momentum.wrapperMove1hPct) },
        { label: "Break-even", value: pct(row.approxBreakEvenMovePct) },
        { label: "Liquidity", value: money(row.liquidityUsd, 0) },
      ],
    });
  }

  if (experimental.discountRecovery.signalStatus !== "no_setup") {
    cards.push({
      key: `${row.id}:discount_recovery:long`,
      strategyType: "discount_recovery",
      direction: "long",
      status: experimental.discountRecovery.signalStatus,
      reason: firstReason(experimental.discountRecovery.signalReasons),
      ticker: row.ticker,
      issuer: row.issuer,
      symbol: row.symbol,
      timestamp: row.timestamp,
      metrics: [
        { label: "BUY gap now", value: pct(row.buyGapPct) },
        { label: "BUY gap ~1h ago", value: pct(experimental.buyGap1hAgoPct) },
        { label: "1h narrowing", value: pct(experimental.gapNarrowing1hPct) },
        { label: "Break-even", value: pct(row.approxBreakEvenMovePct) },
      ],
    });
  }

  if (experimental.wrapperLag.signalStatus !== "no_setup") {
    cards.push({
      key: `${row.id}:wrapper_lag:long`,
      strategyType: "wrapper_lag",
      direction: "long",
      status: experimental.wrapperLag.signalStatus,
      reason: firstReason(experimental.wrapperLag.signalReasons),
      ticker: row.ticker,
      issuer: row.issuer,
      symbol: row.symbol,
      timestamp: row.timestamp,
      metrics: [
        { label: "Wrapper 1h", value: pct(row.momentum.wrapperMove1hPct) },
        { label: "Benchmark 1h", value: pct(row.momentum.benchmarkMove1hPct) },
        { label: "Wrapper lag 1h", value: pct(experimental.wrapperLag1hPct) },
        { label: "Break-even", value: pct(row.approxBreakEvenMovePct) },
      ],
    });
  }

  if (experimental.driftReversal.signalStatus !== "no_setup") {
    cards.push({
      key: `${row.id}:drift_reversal:long`,
      strategyType: "drift_reversal",
      direction: "long",
      status: experimental.driftReversal.signalStatus,
      reason: firstReason(experimental.driftReversal.signalReasons),
      ticker: row.ticker,
      issuer: row.issuer,
      symbol: row.symbol,
      timestamp: row.timestamp,
      metrics: [
        { label: "Pre-open BUY gap", value: pct(row.buyGapPct) },
        { label: "Break-even", value: pct(row.approxBreakEvenMovePct) },
        { label: "Liquidity", value: money(row.liquidityUsd, 0) },
        { label: "Market state", value: row.marketLabel || (row.marketOpen ? "Open" : "Closed") },
      ],
    });
  }

  return cards;
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900">
      <span className="font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </span>

      <span className="text-right font-black text-slate-950 dark:text-white">
        {value}
      </span>
    </div>
  );
}

export default function PaperLabClient() {
  const [data, setData] = useState<PaperLabDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/lab", {
        cache: "no-store",
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to load Paper Lab");
      }

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const signalCards = useMemo(() => {
    const cards = (data?.latestObservations ?? []).flatMap(signalCardsFromObservation);

    const strategyRank = (strategyType: PaperStrategyType) => {
      if (strategyType === "extreme_momentum") return 0;
      if (strategyType === "discount_recovery") return 1;
      if (strategyType === "wrapper_lag") return 2;
      if (strategyType === "drift_reversal") return 3;
      return 4;
    };

    return cards.sort(
      (a, b) =>
        signalRank(a.status) - signalRank(b.status) ||
        strategyRank(a.strategyType) - strategyRank(b.strategyType) ||
        b.timestamp - a.timestamp
    );
  }, [data]);

  const candidateCount = useMemo(
    () => signalCards.filter((card) => card.status === "candidate").length,
    [signalCards]
  );

  const watchCount = useMemo(
    () => signalCards.filter((card) => card.status === "watch").length,
    [signalCards]
  );

  return (
    <AppShell>
      <main className="app-shell py-8 md:py-10">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700 dark:text-violet-300">
                Private admin · Research only
              </div>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 dark:text-white md:text-4xl">
                Paper Trading Lab
              </h1>

              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                Forward-tests four independent long-only research strategies using stored $1,000 executable BUY/SELL quotes: Extreme Momentum, Discount Recovery, Wrapper Lag and Drift Reversal. Each strategy has its own daily entry cap and cooldown. No real trades are placed. Historical convergence, momentum and short trades remain visible for comparison.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/stocks"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Stocks
              </Link>

              <Link
                href="/admin/competitions"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                Competitions
              </Link>

              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!data && loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
            Loading Paper Lab…
          </div>
        ) : null}

        {data ? (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="All-time paper P&L"
                value={money(data.summary.combinedPnlUsd)}
                detail={`${money(data.summary.realisedPnlUsd)} realised · ${money(data.summary.unrealisedPnlUsd)} open`}
                valueClass={pnlClass(data.summary.combinedPnlUsd)}
              />

              <StatCard
                label="Paper trades · all versions"
                value={`${data.summary.openTrades + data.summary.completedTrades}`}
                detail={`${data.summary.completedTrades} completed · ${data.summary.openTrades} open (${data.summary.openLongTrades} long · ${data.summary.openShortTrades} short)`}
              />

              <StatCard
                label="Target hits · saved rules"
                value={
                  data.summary.targetHitRatePct === null
                    ? "—"
                    : `${data.summary.targetHitRatePct.toFixed(1)}%`
                }
                detail={`${data.summary.targetHits} of ${data.summary.completedTrades} completed`}
              />

              <StatCard
                label="Average completed P&L"
                value={money(data.summary.averagePnlUsd)}
                detail={
                  data.summary.averagePnlPct === null
                    ? "No completed trades yet"
                    : `${pct(data.summary.averagePnlPct)} per trade`
                }
                valueClass={pnlClass(data.summary.averagePnlUsd)}
              />
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">
                Strategy scoreboard
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Results are separated by strategy version, direction and entry setup. The V5 strategies run as independent virtual portfolios; legacy momentum/convergence trades remain visible but do not open new V5 positions. Current target: +{data.rules.targetPct.toFixed(2)}%.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {data.strategyPerformance.map((row) => (
                  <div
                    key={`${row.strategyVersion}:${row.strategyType}:${row.direction}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StrategyBadge strategyType={row.strategyType} />
                      <SideBadge direction={row.direction} />
                    </div>

                    <div className="mt-3 text-lg font-black text-slate-950 dark:text-white">
                      {row.label}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {row.strategyVersion}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Completed
                        </div>
                        <div className="font-black text-slate-950 dark:text-white">
                          {row.completedTrades}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Open
                        </div>
                        <div className="font-black text-slate-950 dark:text-white">
                          {row.openTrades}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Target hit rate
                        </div>
                        <div className="font-black text-slate-950 dark:text-white">
                          {row.targetHitRatePct === null
                            ? "—"
                            : `${row.targetHitRatePct.toFixed(1)}%`}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Avg P&L
                        </div>
                        <div className={`font-black ${pnlClass(row.averagePnlPct)}`}>
                          {pct(row.averagePnlPct)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">
                24/7 discovery observations
              </h2>

              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Patterns continue to be recorded even when no paper entry qualifies. Closed-market gap changes are research context, not proof of live stock/token mispricing.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(data.discoveryObservations ?? []).slice(0, 18).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="font-black text-slate-950 dark:text-white">
                      {row.ticker} · {row.issuer}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {when(row.timestamp)} · {row.discovery?.gapReferenceFresh ? "Fresh regular reference" : "Underlying reference unverified"}
                    </div>

                    <div className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {row.discovery?.events.join(" · ")}
                    </div>

                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      Wrapper 1h {pct(row.momentum?.wrapperMove1hPct)} · BUY gap {pct(row.buyGapPct)}
                    </div>
                  </div>
                ))}

                {!(data.discoveryObservations ?? []).length ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    No discovery events in the latest captures yet. Observations continue every capture.
                  </div>
                ) : null}
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">
                Daily $1,000 executable quote ranges
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Per stock and issuer: today's sampled BUY/SELL lows and highs, with the average daily range across completed UTC days. No additional Jupiter requests. The current UTC day is partial and never included in the historical average.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[1120px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      {[
                        "Stock / issuer",
                        "Latest UTC day",
                        "BUY low → high",
                        "BUY range",
                        "SELL low → high",
                        "SELL range",
                        "Avg BUY range",
                        "Avg SELL range",
                        "Best later SELL vs earlier BUY",
                      ].map((head) => (
                        <th key={head} className="px-3 py-3">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {(data.dailyIssuerRanges ?? []).map((row) => (
                      <tr
                        key={`${row.ticker}:${row.issuer}:${row.symbol}`}
                        className="border-t border-slate-200 align-top dark:border-slate-800"
                      >
                        <td className="px-3 py-3 font-bold text-slate-950 dark:text-white">
                          {row.ticker}
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {row.issuer} · {row.symbol}
                          </div>
                        </td>

                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {row.latest.dateUtc}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {row.latest.completeDay ? "Complete UTC day" : "Partial UTC day"} · {row.latest.samples} captures
                          </div>
                        </td>

                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {money(row.latest.buyLow)} → {money(row.latest.buyHigh)}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Low {when(row.latest.buyLowAt)} · high {when(row.latest.buyHighAt)}
                          </div>
                        </td>

                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">
                          {pct(row.latest.buyRangePct)}
                        </td>

                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {money(row.latest.sellLow)} → {money(row.latest.sellHigh)}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Low {when(row.latest.sellLowAt)} · high {when(row.latest.sellHighAt)}
                          </div>
                        </td>

                        <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300">
                          {pct(row.latest.sellRangePct)}
                        </td>

                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {pct(row.avgBuyRangePct)}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {row.completedDays} completed day(s)
                          </div>
                        </td>

                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {pct(row.avgSellRangePct)}
                        </td>

                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                          {pct(row.latest.bestChronologicalLongPct)}
                        </td>
                      </tr>
                    ))}

                    {!(data.dailyIssuerRanges ?? []).length ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-7 text-center text-slate-500 dark:text-slate-400">
                          Waiting for valid $1,000 history quotes.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                These are sampled 15-minute prices, not true intraday extremes. The chronological BUY-to-later-SELL figure is an optimistic historical price proxy, not a backtested trade: it ignores timing constraints and exact-token exit quotes. It may include less than a full day.
              </p>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
              <h2 className="text-xl font-black text-slate-950 dark:text-white">
                V5 · Candidate forward research
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Uncapped research observations are tracked independently of paper-trade caps and cooldowns. The four V5 strategy families are followed alongside the older discovery patterns, with 4h, 24h and 48h checkpoints based on subsequent stored $1,000 effective quotes. These are research proxies, not exact-token realised P&amp;L.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-[890px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      {[
                        "Pattern",
                        "Side",
                        "Recorded",
                        "48h complete",
                        "24h measured",
                        "48h measured",
                        "+1% by 24h",
                        "+1% by 48h",
                        "−1% by 24h",
                        "−1% by 48h",
                        "Mean 24h",
                        "Mean 48h",
                      ].map((head) => (
                        <th key={head} className="px-3 py-3">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {data.researchPerformance?.length ? (
                      data.researchPerformance.map((row) => (
                        <tr
                          key={`${row.kind}:${row.direction}`}
                          className="border-t border-slate-200 dark:border-slate-800"
                        >
                          <td className="px-3 py-3 font-bold capitalize text-slate-950 dark:text-white">
                            {row.kind.replaceAll("_", " ")}
                          </td>

                          <td className="px-3 py-3">
                            <SideBadge direction={row.direction} />
                          </td>

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
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="px-3 py-7 text-center text-slate-500 dark:text-slate-400">
                          Waiting for V5 candidates and their forward follow-up.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Candidate counts can overlap across strategies, issuers and stocks. That is intentional: V5 is testing independent hypotheses prospectively. Research follow-up continues even if a strategy trade was blocked by its daily cap or cooldown.
              </p>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-950 dark:text-white">
                      Current V5 long signals
                    </h2>

                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Live candidate/watch states for Extreme Momentum, Discount Recovery, Wrapper Lag and Drift Reversal. Each strategy has its own virtual portfolio, daily cap and token cooldown.
                    </p>
                  </div>

                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {candidateCount} candidates · {watchCount} watches
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {signalCards.length ? (
                    signalCards.map((card) => (
                      <div
                        key={card.key}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-lg font-black text-slate-950 dark:text-white">
                                {card.ticker} · {card.issuer}
                              </div>

                              <StrategyBadge strategyType={card.strategyType} />
                              <SideBadge direction={card.direction} />
                            </div>

                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {card.symbol} · {when(card.timestamp)}
                            </div>
                          </div>

                          <SignalBadge status={card.status} />
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          {card.metrics.map((metric) => (
                            <div key={metric.label}>
                              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {metric.label}
                              </div>

                              <div className="mt-1 font-black text-slate-900 dark:text-white">
                                {metric.value}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:text-slate-300">
                          {card.reason}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="md:col-span-2 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
                      No current V5 candidate/watch setups. The lab is still collecting observations and evaluating all four strategies on every capture.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                  Strategy suite {data.rules.version}
                </div>

                <h2 className="mt-2 text-xl font-black text-slate-950 dark:text-white">
                  Rules being forward-tested
                </h2>

                <div className="mt-5 grid gap-3 text-sm">
                  <RuleRow label="Paper entry" value={money(data.rules.notionalUsd)} />
                  <RuleRow label="Profit target" value={`${data.rules.targetPct.toFixed(2)}%`} />
                  <RuleRow label="Stop" value={data.rules.stopPct === null ? "Disabled" : `${data.rules.stopPct.toFixed(2)}%`} />
                  <RuleRow label="Maximum hold" value={`${data.rules.maxHoldHours}h`} />
                  <RuleRow label="Minimum liquidity" value={money(data.rules.minLiquidityUsd, 0)} />
                  <RuleRow label="Per-strategy daily cap" value={`${data.rules.maxNewLongTradesPerDay}`} />
                  <RuleRow label="Token/strategy cooldown" value={`${data.rules.cooldownHours}h`} />
                  <RuleRow label="New short entries" value="Disabled" />
                  <RuleRow label="Extreme momentum" value={`2h ≥ +${data.rules.extremeMomentumMin2hPct.toFixed(2)}% · BE ≤ ${data.rules.extremeMomentumMaxBreakEvenPct.toFixed(2)}%`} />
                  <RuleRow label="Discount recovery" value={`Gap ≤ ${data.rules.discountRecoveryMaxBuyGapPct.toFixed(2)}% · narrows ≥ ${data.rules.discountRecoveryMinNarrowing1hPct.toFixed(2)}pp · BE ≤ ${data.rules.discountRecoveryMaxBreakEvenPct.toFixed(2)}%`} />
                  <RuleRow label="Wrapper lag" value={`1h lag ≤ ${data.rules.wrapperLagMaxLag1hPct.toFixed(2)}pp · BE ≤ ${data.rules.wrapperLagMaxBreakEvenPct.toFixed(2)}%`} />
                  <RuleRow label="Drift reversal" value={`Pre-open BUY gap ≤ ${data.rules.driftReversalMaxBuyGapPct.toFixed(2)}% · BE ≤ ${data.rules.driftReversalMaxBreakEvenPct.toFixed(2)}%`} />
                  <RuleRow label="Drift window" value={`${data.rules.driftReversalWindowStartEt}–${data.rules.driftReversalWindowEndEt} New York`} />
                </div>

                <div className="mt-5 space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-blue-700 dark:text-blue-300">
                      Extreme Momentum
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      Tests whether unusually strong two-hour wrapper momentum continues after executable costs. Ordinary momentum is not used for new V5 entries.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                      Discount Recovery
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      Requires a meaningful negative BUY gap and evidence that the negative gap has already started narrowing over roughly one hour.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
                      Wrapper Lag
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      Tests whether a wrapper that has underperformed its reference stock over the previous hour subsequently catches up.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-fuchsia-700 dark:text-fuchsia-300">
                      Drift Reversal
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      Long-only prospective test of negative pre-open drift versus the last stock reference. It runs only inside the configured New York pre-open window and deliberately has no ticker whitelist yet.
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.12em] text-slate-700 dark:text-slate-300">
                      Legacy data
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      Historical convergence, momentum and short records remain available for comparison, but V5 opens new paper trades only from the four strategies above.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="p-5 md:p-6">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  Open paper positions
                </h2>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Long positions are marked using fresh exact-quantity Jupiter SELL quotes. Legacy shorts remain only to complete their historical experiment. Different V5 strategies may hold the same token simultaneously because each is being evaluated as an independent virtual portfolio.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1080px] w-full text-left">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      {[
                        "Stock / strategy",
                        "Opened",
                        "Entry",
                        "Current mark",
                        "P&L",
                        "MFE",
                        "MAE",
                        "Held",
                        "Status",
                      ].map((head) => (
                        <th key={head} className="px-3 py-3">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {data.openTrades.length ? (
                      data.openTrades.map((trade) => (
                        <TradeRow key={trade.id} trade={trade} open />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          No open paper positions.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5 rounded-[2rem] border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="p-5 md:p-6">
                <h2 className="text-xl font-black text-slate-950 dark:text-white">
                  Completed trades
                </h2>

                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Realised paper P&L is frozen at the first sampled mark that reaches the saved target, stop, or maximum holding period for that trade.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-[1080px] w-full text-left">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      {[
                        "Stock / strategy",
                        "Opened",
                        "Entry",
                        "Exit / cover",
                        "P&L",
                        "MFE",
                        "MAE",
                        "Held",
                        "Exit reason",
                      ].map((head) => (
                        <th key={head} className="px-3 py-3">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {data.completedTrades.length ? (
                      data.completedTrades.map((trade) => (
                        <TradeRow key={trade.id} trade={trade} open={false} />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={9} className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                          No completed paper trades yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}

