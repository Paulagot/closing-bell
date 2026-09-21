"use client";

import { useEffect, useRef, useState } from "react";
import ExecutionResults from "@/components/ExecutionResults";
import type { StockExecutionResponse } from "@/types";

interface Props {
  ticker: string;
  cachedResults?: Record<string, StockExecutionResponse>;
  onResult?: (amountUsd: number, result: StockExecutionResponse) => void;
}

const PRESETS = [100, 1000, 10000];

export default function ExecutionAnalyzer({
  ticker,
  cachedResults = {},
  onResult,
}: Props) {
  const [amountUsd, setAmountUsd] = useState(1000);
  const [customAmount, setCustomAmount] = useState("1000");
  const [customMode, setCustomMode] = useState(false);
  const [result, setResult] = useState<StockExecutionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const requestIdRef = useRef(0);

  function useCached(nextAmountUsd: number) {
    const cached = cachedResults[String(nextAmountUsd)];
    if (!cached) return false;

    requestIdRef.current++;
    setLoading(false);
    setError(null);
    setResult(cached);
    return true;
  }

  async function fetchComparison(
    nextAmountUsd: number,
    options: { force?: boolean } = {}
  ) {
    if (!options.force && useCached(nextAmountUsd)) return;

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, amountUsd: nextAmountUsd }),
      });

      const text = await response.text();
      let json:
        | StockExecutionResponse
        | { error?: string; details?: string };

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Execution comparison returned ${response.status} instead of JSON.`
        );
      }

      if (!response.ok) {
        const problem = json as { error?: string; details?: string };
        throw new Error(
          problem.error ??
            problem.details ??
            "Unable to compare execution."
        );
      }

      if (requestId !== requestIdRef.current) return;

      const liveResult = json as StockExecutionResponse;
      setResult(liveResult);
      onResult?.(nextAmountUsd, liveResult);
    } catch (compareError) {
      if (requestId !== requestIdRef.current) return;

      setError(
        compareError instanceof Error
          ? compareError.message
          : String(compareError)
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }

  function choosePreset(nextAmountUsd: number) {
    setCustomMode(false);

    if (nextAmountUsd === amountUsd) {
      if (!result) fetchComparison(nextAmountUsd);
      return;
    }

    setAmountUsd(nextAmountUsd);
    setCustomAmount(String(nextAmountUsd));

    if (liveMode) fetchComparison(nextAmountUsd);
  }

  function parseCustomAmount() {
    const parsed = Number(customAmount);

    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100_000) {
      setError("Enter an amount between $1 and $100,000.");
      return null;
    }

    return parsed;
  }

  function refreshLiveComparison() {
    setLiveMode(true);

    if (customMode) {
      const parsed = parseCustomAmount();
      if (parsed === null) return;

      setAmountUsd(parsed);
      fetchComparison(parsed, { force: true });
      return;
    }

    fetchComparison(amountUsd, { force: true });
  }

  useEffect(() => {
    setAmountUsd(1000);
    setCustomAmount("1000");
    setCustomMode(false);
    setLiveMode(true);
    setResult(null);
    setError(null);
    setLoading(false);
    requestIdRef.current++;

    const timer = window.setTimeout(() => {
      fetchComparison(1000, { force: true });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      requestIdRef.current++;
    };
    // Auto-load once per ticker. Cache updates must not retrigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker]);

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-gray-100 p-4 dark:border-slate-800 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
              Order size
            </div>

            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => choosePreset(preset)}
                  className={[
                    "min-h-10 rounded-xl border px-4 text-sm font-bold transition",
                    !customMode && amountUsd === preset
                      ? "border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600",
                  ].join(" ")}
                >
                  ${preset.toLocaleString()}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setCustomMode(true)}
                className={[
                  "min-h-10 rounded-xl border px-4 text-sm font-bold transition",
                  customMode
                    ? "border-violet-600 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-950/40 dark:text-violet-300"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-slate-600",
                ].join(" ")}
              >
                Custom
              </button>
            </div>
          </div>

          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              refreshLiveComparison();
            }}
          >
            {customMode && (
              <div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
                  Custom amount
                </div>

                <div className="flex">
                  <div className="flex min-h-11 items-center rounded-l-xl border border-r-0 border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                    $
                  </div>

                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={customAmount}
                    onChange={(event) => {
                      setCustomAmount(event.target.value);
                      setError(null);
                    }}
                    aria-label="Custom order size in US dollars"
                    className="min-h-11 w-36 rounded-r-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-950 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-xl bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh live market"}
            </button>
          </form>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-500 dark:text-slate-400">
          <div>
            $1,000 loads automatically. Choose a preset, or type a custom amount and press Refresh live market.
          </div>

          <div className="font-semibold text-violet-700 dark:text-violet-300">
            {customMode ? `Custom $${customAmount || "—"}` : `$${amountUsd.toLocaleString()}`} · BUY + SELL
          </div>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {loading && (
          <div className="flex min-h-44 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-violet-600 dark:border-slate-700 dark:border-t-violet-400" />
              <div className="mt-3 text-sm font-semibold text-gray-500 dark:text-slate-400">
                Checking both sides of the market…
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Comparing executable BUY and SELL liquidity across all issuers
              </div>
            </div>
          </div>
        )}

        {!loading && !result && !error && (
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-5 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <div>
              <div className="text-sm font-bold text-gray-700 dark:text-slate-200">
                Live execution is ready to refresh
              </div>
              <div className="mt-1 max-w-xl text-xs leading-5 text-gray-500 dark:text-slate-400">
                Closing Bell compares entry and exit pricing for the same order size so you can see the current execution hurdle.
              </div>
            </div>
          </div>
        )}

        {!loading && result && <ExecutionResults data={result} />}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}
