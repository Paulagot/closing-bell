"use client";

import { useMemo } from "react";

import {
  buildHistoricalInsights,
  type HistoricalInsight,
  type HistoricalInsightStatus,
} from "@/lib/history/insights";

import type { StockExecutionResponse } from "@/types";
import type { IssuerHistoryAnalytics } from "@/types/history";

interface Props {
  issuer: IssuerHistoryAnalytics;
  firstSnapshotAt: number | null;
  lastSnapshotAt: number | null;
  liveExecutions?: Record<string, StockExecutionResponse>;
}

const PRIMARY_IDS = [
  "execution-reality",
  "market-move",
  "friction",
];

function statusLabel(status: HistoricalInsightStatus) {
  if (status === "available") return "Evidence";
  if (status === "early") return "Early data";
  return "Waiting for data";
}

function statusClass(status: HistoricalInsightStatus) {
  if (status === "available") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300";
  }

  if (status === "early") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300";
  }

  return "border-gray-200 bg-gray-50 text-gray-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400";
}

function InsightCard({
  insight,
  priority = false,
}: {
  insight: HistoricalInsight;
  priority?: boolean;
}) {
  return (
    <article
      className={[
        "rounded-2xl border bg-white p-4 dark:bg-slate-950",
        priority
          ? "border-violet-300 ring-1 ring-violet-100 dark:border-violet-800 dark:ring-violet-950"
          : "border-gray-200 dark:border-slate-800",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
            {insight.question}
          </div>

          {priority && insight.id === "execution-reality" && (
            <span className="rounded-full bg-violet-100 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              Key finding
            </span>
          )}
        </div>

        <span
          className={[
            "rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wide",
            statusClass(insight.status),
          ].join(" ")}
        >
          {statusLabel(insight.status)}
        </span>
      </div>

      <h4 className="mt-3 text-base font-black leading-5 text-gray-950 dark:text-white">
        {insight.headline}
      </h4>

      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-slate-400">
        {insight.body}
      </p>
    </article>
  );
}

export default function HistoricalIntelligence({
  issuer,
  firstSnapshotAt,
  lastSnapshotAt,
  liveExecutions = {},
}: Props) {
  const insights = useMemo(
    () =>
      buildHistoricalInsights({
        issuer,
        firstSnapshotAt,
        lastSnapshotAt,
        liveExecutions,
      }),
    [issuer, firstSnapshotAt, lastSnapshotAt, liveExecutions]
  );

  const answered = insights.filter(
    (insight) => insight.status === "available"
  ).length;

  const early = insights.filter(
    (insight) => insight.status === "early"
  ).length;

  const primary = useMemo(() => {
    const selected: HistoricalInsight[] = [];

    for (const id of PRIMARY_IDS) {
      const match = insights.find(
        (insight) => insight.id === id && insight.status !== "waiting"
      );
      if (match) selected.push(match);
    }

    for (const insight of insights) {
      if (selected.length >= 3) break;
      if (
        insight.status !== "waiting" &&
        !selected.some((item) => item.id === insight.id)
      ) {
        selected.push(insight);
      }
    }

    return selected;
  }, [insights]);

  const secondary = insights.filter(
    (insight) => !primary.some((item) => item.id === insight.id)
  );

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-violet-50/30 shadow-sm dark:border-violet-900/60 dark:bg-violet-950/10">
      <div className="border-b border-violet-100 p-5 dark:border-violet-900/50">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              Plain-English intelligence
            </div>

            <h3 className="mt-1 text-xl font-black text-gray-950 dark:text-white">
              What Closing Bell sees
            </h3>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500 dark:text-slate-400">
              The strongest current findings are shown first. These explanations describe recorded market behaviour and matching live execution; they do not predict the next price move.
            </p>
          </div>

          <div className="flex shrink-0 gap-2 text-[10px] font-bold">
            <span className="rounded-full border border-emerald-200 bg-white px-2.5 py-1.5 text-emerald-700 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300">
              {answered} answered
            </span>

            <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1.5 text-amber-700 dark:border-amber-900 dark:bg-slate-950 dark:text-amber-300">
              {early} early
            </span>
          </div>
        </div>
      </div>

      {primary.length > 0 && (
        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {primary.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              priority
            />
          ))}
        </div>
      )}

      {secondary.length > 0 && (
        <details className="border-t border-violet-100 dark:border-violet-900/50">
          <summary className="cursor-pointer list-none px-5 py-4 text-xs font-black text-violet-700 hover:bg-violet-50/50 dark:text-violet-300 dark:hover:bg-violet-950/20">
            More historical signals ({secondary.length})
          </summary>

          <div className="grid gap-3 px-4 pb-4 md:grid-cols-2 xl:grid-cols-3">
            {secondary.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </details>
      )}

      <div className="border-t border-violet-100 px-5 py-3 text-[10px] leading-4 text-gray-400 dark:border-violet-900/50 dark:text-slate-500">
        Relative convergence and a positive dollar return are not the same thing: the underlying US stock can move while the wrapper&apos;s discount or premium changes.
      </div>
    </section>
  );
}
