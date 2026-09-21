"use client";

import { useState } from "react";

import IssuerBadge from "@/components/IssuerBadge";
import WrapperInfoDrawer from "@/components/WrapperInfoDrawer";

import type { StockSnapshotResponse } from "@/types";

interface Props {
  data: StockSnapshotResponse;
}

function money(value: number | null | undefined) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function pct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function StockMarketOverview({ data }: Props) {
  const [selectedWrapper, setSelectedWrapper] = useState<{
    issuer: string;
    symbol: string;
  } | null>(null);

  // Finnhub `price` is the current/latest US-market price.
  // Do not switch to `previousClose` merely because the regular
  // session has ended; doing so creates an artificial benchmark drop.
  const reference =
    data.reference?.price ??
    data.reference?.previousClose ??
    null;

  const referenceLabel = data.marketStatus.open
    ? "Wall Street reference"
    : "Latest US price";

  const rows = Object.entries(data.stock.issuers).map(
    ([issuer, token]) => {
      const price = data.prices[token.mint];
      const multiplier = price?.shareMultiplier ?? 1;
      const midpoint =
        price?.normalizedPriceUsd ??
        (price?.priceUsd !== null && price?.priceUsd !== undefined
          ? price.priceUsd / multiplier
          : null);

      const gap =
        reference && midpoint
          ? ((midpoint - reference) / reference) * 100
          : null;

      return { issuer, token, midpoint, gap };
    }
  );

  const largestDiscount =
    rows
      .filter((row) => row.gap !== null)
      .sort(
        (a, b) =>
          (a.gap ?? Infinity) - (b.gap ?? Infinity)
      )[0] ?? null;

  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-gray-100 px-5 py-5 dark:border-slate-800 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
              {referenceLabel}
            </div>

            <div className="mt-1 text-3xl font-black tracking-tight text-gray-950 dark:text-white">
              {money(reference)}
            </div>

            <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {data.marketStatus.open
                ? "Underlying US market is open"
                : "Latest available US-market price used as the benchmark"}
            </div>
          </div>

          {largestDiscount &&
            largestDiscount.gap !== null &&
            largestDiscount.gap < 0 && (
              <div className="rounded-2xl bg-violet-50 px-4 py-3 text-right dark:bg-violet-950/30">
                <div className="text-[11px] font-bold uppercase tracking-wide text-violet-500 dark:text-violet-400">
                  Largest indicative discount
                </div>

                <div className="mt-1 font-bold text-violet-950 dark:text-violet-100">
                  {largestDiscount.issuer} {pct(largestDiscount.gap)}
                </div>

                <div className="mt-1 text-[11px] font-semibold text-violet-600/80 dark:text-violet-300/80">
                  Indicative only · check executable pricing below
                </div>
              </div>
            )}
        </div>
      </div>

      <div className="grid gap-px bg-gray-100 dark:bg-slate-800 md:grid-cols-3">
        {rows.map((row) => {
          const below = (row.gap ?? 0) < 0;

          return (
            <div
              key={row.token.mint}
              className="bg-white p-5 dark:bg-slate-950 md:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <IssuerBadge issuer={row.issuer} />

                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                    {row.token.symbol}
                  </span>
                </div>

                {row.gap !== null && (
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-bold",
                      below
                        ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
                    ].join(" ")}
                  >
                    {pct(row.gap)}
                  </span>
                )}
              </div>

              <div className="mt-5">
                <div className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  Indicative token price
                </div>

                <div className="mt-1 text-2xl font-black tracking-tight text-gray-950 dark:text-white">
                  {money(row.midpoint)}
                </div>

                <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {row.gap !== null
                    ? `${pct(row.gap)} vs ${
                        data.marketStatus.open
                          ? "Wall Street"
                          : "latest US price"
                      }`
                    : "Reference comparison unavailable"}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedWrapper({
                    issuer: row.issuer,
                    symbol: row.token.symbol,
                  })
                }
                className="mt-5 text-sm font-bold text-violet-600 transition hover:text-violet-800 dark:text-violet-400 dark:hover:text-violet-300"
              >
                About this wrapper →
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 bg-gray-50/70 px-5 py-3 text-[11px] leading-5 text-gray-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 md:px-6">
        Indicative prices are a headline reference, not executable quotes. The live section below checks whether the apparent premium or discount survives an actual BUY and SELL order size.
      </div>

      {selectedWrapper && (
        <WrapperInfoDrawer
          open
          onClose={() => setSelectedWrapper(null)}
          issuer={selectedWrapper.issuer}
          symbol={selectedWrapper.symbol}
          underlyingName={data.stock.name}
          ticker={data.ticker}
        />
      )}
    </section>
  );
}
