"use client";

import { useEffect, useMemo, useState } from "react";

import SignalOverview from "@/components/history/SignalOverview";
import HistoricalIntelligence from "@/components/history/HistoricalIntelligence";
import GapRadar from "@/components/history/GapRadar";
import ConvergencePanel from "@/components/history/ConvergencePanel";
import MarketDepthPanel from "@/components/history/MarketDepthPanel";
import IssuerHistoryTable from "@/components/history/IssuerHistoryTable";

import type { StockExecutionResponse } from "@/types";
import type {
  IssuerHistoryAnalytics,
  StockHistoryAnalyticsResponse,
} from "@/types/history";

interface Props {
  ticker: string;
  liveExecutions?: Record<string, StockExecutionResponse>;
}

const HISTORY_REFRESH_MS = 15 * 60 * 1000 + 30 * 1000;

type IssuerTheme = {
  shell: string;
  tabActive: string;
  eyebrow: string;
  divider: string;
};

function issuerTheme(issuer: IssuerHistoryAnalytics | null): IssuerTheme {
  const name = issuer?.issuer.toLowerCase() ?? "";

  if (name.includes("backpack")) {
    return {
      shell:
        "border-blue-500/50 bg-blue-50/20 shadow-[0_0_0_1px_rgba(59,130,246,0.06)] dark:border-blue-500/40 dark:bg-blue-950/10",
      tabActive:
        "border-blue-500 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200",
      eyebrow: "text-blue-600 dark:text-blue-400",
      divider: "border-blue-200/70 dark:border-blue-900/60",
    };
  }

  if (name.includes("ondo")) {
    return {
      shell:
        "border-emerald-500/50 bg-emerald-50/20 shadow-[0_0_0_1px_rgba(16,185,129,0.06)] dark:border-emerald-500/40 dark:bg-emerald-950/10",
      tabActive:
        "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200",
      eyebrow: "text-emerald-600 dark:text-emerald-400",
      divider: "border-emerald-200/70 dark:border-emerald-900/60",
    };
  }

  return {
    shell:
      "border-violet-500/50 bg-violet-50/20 shadow-[0_0_0_1px_rgba(139,92,246,0.06)] dark:border-violet-500/40 dark:bg-violet-950/10",
    tabActive:
      "border-violet-500 bg-violet-50 text-violet-800 shadow-sm dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-200",
    eyebrow: "text-violet-600 dark:text-violet-400",
    divider: "border-violet-200/70 dark:border-violet-900/60",
  };
}

function timeLabel(timestamp: number | null | undefined) {
  if (!timestamp) return "No capture yet";

  return new Date(timestamp).toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Pass4Insights({
  ticker,
  liveExecutions = {},
}: Props) {
  const [data, setData] = useState<StockHistoryAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMint, setActiveMint] = useState("");

  async function load(options?: { silent?: boolean }) {
    if (!options?.silent) {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch(
        `/api/history/${encodeURIComponent(ticker)}`,
        { cache: "no-store" }
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? json.details ?? "Unable to load market history"
        );
      }

      setData(json);
      setActiveMint((current) => {
        const stillExists = json.issuers?.some(
          (issuer: IssuerHistoryAnalytics) => issuer.mint === current
        );

        if (stillExists) return current;
        return json.issuers?.[0]?.mint || "";
      });
    } catch (historyError) {
      setError(
        historyError instanceof Error
          ? historyError.message
          : String(historyError)
      );
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    setData(null);
    setActiveMint("");
    load();

    const timer = window.setInterval(() => {
      load({ silent: true });
    }, HISTORY_REFRESH_MS);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  const activeIssuer = useMemo(
    () =>
      data?.issuers.find((issuer) => issuer.mint === activeMint) ??
      data?.issuers[0] ??
      null,
    [data, activeMint]
  );

  const theme = useMemo(() => issuerTheme(activeIssuer), [activeIssuer]);

  return (
    <section className="mt-7">
      <div className="mb-5">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
          Wrapper history
        </div>

        <h2 className="mt-1 text-2xl font-black text-gray-950 dark:text-white md:text-3xl">
          Detailed wrapper analysis
        </h2>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-500 dark:text-slate-400">
          Choose a wrapper to inspect its recorded $1K execution gap, friction
          and convergence behaviour. Historical observations refresh
          automatically after each 15-minute capture cycle.
        </p>
      </div>

      {loading && !data && (
        <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Loading historical signals…
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {data && data.issuers.length > 0 && activeIssuer && (
        <>
          <div
            className={[
              "overflow-hidden rounded-[28px] border-2 transition-colors duration-300",
              theme.shell,
            ].join(" ")}
          >
            <div
              className={[
                "border-b bg-white/70 p-4 backdrop-blur dark:bg-slate-950/70 md:p-5",
                theme.divider,
              ].join(" ")}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="min-w-0">
                  <div
                    className={[
                      "text-[11px] font-black uppercase tracking-[0.18em]",
                      theme.eyebrow,
                    ].join(" ")}
                  >
                    Viewing wrapper
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2.5" role="tablist" aria-label="Select wrapper">
                    {data.issuers.map((issuer) => {
                      const active = activeIssuer.mint === issuer.mint;

                      return (
                        <button
                          key={issuer.mint}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setActiveMint(issuer.mint)}
                          className={[
                            "min-h-14 rounded-2xl border px-5 py-3 text-left transition md:min-w-[180px] md:px-6",
                            active
                              ? theme.tabActive
                              : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-900",
                          ].join(" ")}
                        >
                          <span className="block text-base font-black leading-5 md:text-lg">
                            {issuer.issuer}
                          </span>
                          <span className="mt-1 block text-[11px] font-bold uppercase tracking-wide opacity-70">
                            {issuer.symbol}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
                      Latest recorded capture
                    </div>
                    <div className="mt-1 text-xs font-bold text-gray-700 dark:text-slate-300">
                      {timeLabel(data.lastSnapshotAt)}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => load()}
                    className="min-h-11 rounded-xl bg-gray-950 px-4 text-sm font-black text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-950 dark:hover:bg-slate-200"
                  >
                    {loading ? "Refreshing…" : "Refresh history"}
                  </button>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-200/80 bg-gray-50/80 px-4 py-3 text-xs leading-5 text-gray-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <strong className="text-gray-900 dark:text-slate-200">
                  Live vs recorded:
                </strong>{" "}
                live execution above shows the market now. Everything inside
                this wrapper analysis uses Closing Bell observations captured
                on schedule. Market Depth below reuses matching live results so
                identical issuer/size pairs are not quoted twice.
              </div>
            </div>

            <div className="space-y-4 p-4 md:p-5">
              <HistoricalIntelligence
                issuer={activeIssuer}
                firstSnapshotAt={data.firstSnapshotAt}
                lastSnapshotAt={data.lastSnapshotAt}
                liveExecutions={liveExecutions}
              />

              <SignalOverview
                issuer={activeIssuer}
                snapshotTimestamp={data.lastSnapshotAt}
              />

              <GapRadar issuer={activeIssuer} />

              <ConvergencePanel issuer={activeIssuer} />
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                Across all wrappers
              </div>
              <h3 className="mt-1 text-xl font-black text-gray-950 dark:text-white md:text-2xl">
                Compare wrappers
              </h3>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500 dark:text-slate-400">
                Compare the same recorded $1K snapshot across issuers, then
                test how execution changes as order size increases.
              </p>
            </div>

            <div className="space-y-4">
              <IssuerHistoryTable
                issuers={data.issuers}
                snapshotTimestamp={data.lastSnapshotAt}
              />

              <MarketDepthPanel
                ticker={ticker}
                issuers={data.issuers}
                liveExecutions={liveExecutions}
              />
            </div>
          </div>
        </>
      )}

      {data && data.issuers.length === 0 && !loading && (
        <div className="rounded-3xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
          No recorded wrapper observations are available yet.
        </div>
      )}
    </section>
  );
}
