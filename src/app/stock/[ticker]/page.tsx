"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import ExecutionAnalyzer from "@/components/ExecutionAnalyzer";
import StockMarketOverview from "@/components/StockMarketOverview";
import MarketPriceComparison from "@/components/history/MarketPriceComparison";
import Pass4Insights from "@/components/history/Pass4Insights";
import OnchainPriceMovement from "@/components/history/OnchainPriceMovement";
import AppShell from "@/components/shell/AppShell";

import type { StockExecutionResponse, StockSnapshotResponse } from "@/types";

export default function StockDetailPage() {
  const params = useParams<{ ticker: string }>();
  const ticker = params.ticker?.toUpperCase();
  const loadedTickerRef = useRef<string | null>(null);

  const [data, setData] = useState<StockSnapshotResponse | null>(null);
  const [liveExecutions, setLiveExecutions] =
    useState<Record<string, StockExecutionResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStock = useCallback(async (showLoading = true) => {
    if (!ticker) return;

    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(
        `/api/stocks?ticker=${encodeURIComponent(ticker)}`,
        { cache: "no-store" }
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Failed to load stock");
      }

      setData(json);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : String(loadError)
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [ticker]);

  useEffect(() => {
    if (!ticker || loadedTickerRef.current === ticker) return;

    loadedTickerRef.current = ticker;
    setLiveExecutions({});
    loadStock();

    const refreshTimer = window.setInterval(() => {
      loadStock(false);
    }, 15 * 60 * 1000 + 30 * 1000);

    return () => {
      window.clearInterval(refreshTimer);
    };
  }, [ticker, loadStock]);

  const rememberLiveExecution = useCallback(
    (amountUsd: number, result: StockExecutionResponse) => {
      setLiveExecutions((current) => ({
        ...current,
        [String(amountUsd)]: result,
      }));
    },
    []
  );

  return (
    <AppShell>
      <main className="app-shell py-4 md:py-7">

        {loading && !data && (
          <div className="py-24 text-center text-gray-500 dark:text-slate-400">
            Loading market…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {data && (
          <>
            <header className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                  {data.ticker}
                </h1>

                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-bold",
                    data.marketStatus.open
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                      : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400",
                  ].join(" ")}
                >
                  {data.marketStatus.label}
                </span>
              </div>

              <div className="mt-1 text-lg font-semibold text-gray-600 dark:text-slate-400">
                {data.stock.name}
              </div>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-400">
                Find where each tokenized wrapper is trading relative to the underlying stock, then check whether that gap survives real execution.
              </p>
            </header>

            <StockMarketOverview data={data} />

            <section className="mt-6">
              <div className="mb-3">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                  Execution truth
                </div>
                <h2 className="mt-1 text-xl font-black md:text-2xl">
                  Live execution
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-slate-400">
                  The $1,000 comparison loads automatically so you can see whether the indicative gap survives a real BUY and SELL order. Change the order size to test execution at a different level.
                </p>
              </div>

              <ExecutionAnalyzer
                ticker={data.ticker}
                cachedResults={liveExecutions}
                onResult={rememberLiveExecution}
              />
            </section>

            <OnchainPriceMovement ticker={data.ticker} />

            <MarketPriceComparison ticker={data.ticker} />

            <Pass4Insights
              ticker={ticker}
              liveExecutions={liveExecutions}
            />

            <footer className="mt-7 border-t border-gray-200 py-6 text-sm leading-6 text-gray-500 dark:border-slate-800 dark:text-slate-400">
              Indicative token prices are not executable quotes. Tokenized securities can carry different legal, issuer, liquidity and redemption risks even when they reference the same underlying stock.
            </footer>
          </>
        )}
      </main>
    </AppShell>
  );
}
