"use client";

import Link from "next/link";

import {
  useMemo,
  useState,
} from "react";

import type {
  DashboardMarketRow,
} from "@/lib/dashboardMarket";

import type {
  DashboardIssuerChange,
  DashboardStockIntelligence,
} from "@/types/dashboardIntelligence";

type Filter =
  | "all"
  | "unusual"
  | "tight"
  | "liquid"
  | "three";

type SortKey =
  | "ticker"
  | "wallStreet"
  | "buyGap"
  | "breakEven"
  | "liquidity"
  | "issuers"
  | "calls";

interface Props {
  rows: DashboardMarketRow[];

  openCallsByTicker?: Record<
    string,
    number
  >;

  openCallTitlesByTicker?: Record<
    string,
    string[]
  >;

  activeCompetitionSlug?: string | null;

  intelligenceByTicker?: Record<
    string,
    DashboardStockIntelligence
  >;
}

const LOW_FRICTION_PERCENTILE = 25;
const DEEP_LIQUIDITY_PERCENTILE = 75;

function money(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits:
        value >= 1000
          ? 2
          : 4,
    }
  ).format(value);
}

function pct(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return `${
    value >= 0 ? "+" : ""
  }${value.toFixed(2)}%`;
}

function compactUsd(
  value: number | null
) {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }
  ).format(value);
}

function numeric(
  value: number | null
) {
  return value ??
    Number.POSITIVE_INFINITY;
}

function issuerIntelligence(
  stock: DashboardStockIntelligence | undefined,
  issuer: string | null
): DashboardIssuerChange | null {
  if (!stock || !issuer) {
    return null;
  }

  return stock.issuers[issuer] ?? null;
}

function ContextNote({
  change,
  changeSuffix = "pp",
  percentile,
  unusual = false,
}: {
  change: number | null;
  changeSuffix?: "pp" | "%";
  percentile: number | null;
  unusual?: boolean;
}) {
  const hasChange =
    change !== null &&
    Number.isFinite(change) &&
    Math.abs(change) >= 0.005;

  const hasPercentile =
    percentile !== null &&
    Number.isFinite(percentile);

  if (!hasChange && !hasPercentile) {
    return null;
  }

  return (
    <div
      className={[
        "mt-1 whitespace-nowrap text-[11px] font-semibold tabular-nums",
        unusual
          ? "text-amber-700 dark:text-amber-300"
          : "text-slate-500 dark:text-slate-500",
      ].join(" ")}
      title="Movement is versus the previous stored snapshot. Percentile ranks the current reading against this wrapper's own stored history."
    >
      {hasChange && (
        <>
          {change! > 0 ? "↑" : "↓"} {Math.abs(change!).toFixed(2)}
          {changeSuffix}
        </>
      )}
      {hasChange && hasPercentile && " · "}
      {hasPercentile && `${percentile!.toFixed(0)}th pct`}
    </div>
  );
}

export default function MarketOverviewTable({
  rows,
  openCallsByTicker = {},
  openCallTitlesByTicker = {},
  activeCompetitionSlug = null,
  intelligenceByTicker = {},
}: Props) {
  const [
    filter,
    setFilter,
  ] = useState<Filter>("all");

  const [
    sortKey,
    setSortKey,
  ] = useState<SortKey>("breakEven");

  const [
    ascending,
    setAscending,
  ] = useState(true);

  const visibleRows =
    useMemo(
      () => {
        let next = rows;

        if (filter === "unusual") {
          next = rows.filter(
            (row) =>
              intelligenceByTicker[
                row.ticker
              ]?.unusualNow === true
          );
        }

        if (filter === "tight") {
          next = rows.filter(
            (row) => {
              const stock =
                intelligenceByTicker[
                  row.ticker
                ];

              const issuer =
                issuerIntelligence(
                  stock,
                  row.bestBreakEvenIssuer
                );

              return (
                issuer?.breakEvenPercentile !== null &&
                issuer?.breakEvenPercentile !== undefined &&
                issuer.breakEvenPercentile <=
                  LOW_FRICTION_PERCENTILE
              );
            }
          );
        }

        if (filter === "liquid") {
          next = rows.filter(
            (row) => {
              const stock =
                intelligenceByTicker[
                  row.ticker
                ];

              const issuer =
                issuerIntelligence(
                  stock,
                  row.deepestLiquidityIssuer
                );

              return (
                issuer?.liquidityPercentile !== null &&
                issuer?.liquidityPercentile !== undefined &&
                issuer.liquidityPercentile >=
                  DEEP_LIQUIDITY_PERCENTILE
              );
            }
          );
        }

        if (filter === "three") {
          next = rows.filter(
            (row) =>
              row.issuerCount >= 3
          );
        }

        const sorted = [...next];

        sorted.sort(
          (left, right) => {
            let result = 0;

            switch (sortKey) {
              case "ticker":
                result =
                  left.ticker.localeCompare(
                    right.ticker
                  );
                break;

              case "wallStreet":
                result =
                  numeric(
                    left.wallStreetPrice
                  ) -
                  numeric(
                    right.wallStreetPrice
                  );
                break;

              case "buyGap":
                result =
                  numeric(
                    left.bestBuyGapPct
                  ) -
                  numeric(
                    right.bestBuyGapPct
                  );
                break;

              case "breakEven":
                result =
                  numeric(
                    left.bestBreakEvenPct
                  ) -
                  numeric(
                    right.bestBreakEvenPct
                  );
                break;

              case "liquidity":
                result =
                  numeric(
                    left.deepestLiquidityUsd
                  ) -
                  numeric(
                    right.deepestLiquidityUsd
                  );
                break;

              case "issuers":
                result =
                  left.quotingIssuerCount -
                  right.quotingIssuerCount;
                break;

              case "calls":
                result =
                  (openCallsByTicker[
                    left.ticker
                  ] ?? 0) -
                  (openCallsByTicker[
                    right.ticker
                  ] ?? 0);
                break;
            }

            return ascending
              ? result
              : -result;
          }
        );

        return sorted;
      },
      [
        rows,
        filter,
        sortKey,
        ascending,
        openCallsByTicker,
        intelligenceByTicker,
      ]
    );

  function toggleSort(
    key: SortKey
  ) {
    if (key === sortKey) {
      setAscending(
        (current) =>
          !current
      );
      return;
    }

    setSortKey(key);

    setAscending(
      key === "liquidity"
        ? false
        : true
    );
  }

  function heading(
    label: string,
    key: SortKey,
    align: "left" | "right" = "right"
  ) {
    return (
      <button
        type="button"
        onClick={() =>
          toggleSort(key)
        }
        className={[
          "inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-300",
          align === "right"
            ? "justify-end"
            : "justify-start",
        ].join(" ")}
      >
        {label}
        {sortKey === key && (
          <span>
            {ascending ? "↑" : "↓"}
          </span>
        )}
      </button>
    );
  }

  const filterDefinitions: Array<[
    Filter,
    string,
    string
  ]> = [
    [
      "all",
      "All stocks",
      "Show the full tracked universe",
    ],
    [
      "unusual",
      "Unusual vs history",
      "At least one current gap or friction reading is at or above the 90th percentile of that wrapper's own stored history",
    ],
    [
      "tight",
      "Low friction now",
      "Current best break-even is in the lowest 25% of that wrapper's own stored history",
    ],
    [
      "liquid",
      "Deep liquidity now",
      "Current deepest reported liquidity is in the highest 25% of that wrapper's own stored history",
    ],
    [
      "three",
      "3 issuers",
      "Show stocks tracked across at least three issuers",
    ],
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
              Market overview
            </div>

            <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
              Compare execution across the stocks we track
            </h2>

            <p className="mt-2 max-w-3xl text-[13px] leading-5 text-slate-600 dark:text-slate-400">
              Wall Street is the reference. BUY gap shows how the lowest available $1K executable BUY compares with that reference; it is not an arbitrage profit or a guaranteed saving.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {filterDefinitions.map(
              ([key, label, title]) => (
                <button
                  key={key}
                  type="button"
                  title={title}
                  onClick={() =>
                    setFilter(key)
                  }
                  className={[
                    "rounded-full border px-3 py-1.5 text-[11px] font-black transition",
                    filter === key
                      ? "border-violet-600 bg-violet-600 text-white dark:border-violet-500 dark:bg-violet-500/15 dark:text-violet-200"
                      : "border-slate-300 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700 dark:border-slate-700 dark:bg-transparent dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white",
                  ].join(" ")}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[930px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-950/80">
            <tr>
              <th className="px-5 py-3">
                {heading(
                  "Stock",
                  "ticker",
                  "left"
                )}
              </th>

              <th className="px-3 py-3 text-right">
                {heading(
                  "Wall Street",
                  "wallStreet"
                )}
              </th>

              <th className="px-3 py-3 text-right">
                {heading(
                  "Quoting",
                  "issuers"
                )}
              </th>

              <th className="px-3 py-3 text-right">
                Best $1K BUY
              </th>

              <th className="px-3 py-3 text-right">
                {heading(
                  "BUY gap",
                  "buyGap"
                )}
              </th>

              <th className="px-3 py-3 text-right">
                {heading(
                  "Break-even",
                  "breakEven"
                )}
              </th>

              <th className="px-3 py-3 text-right">
                {heading(
                  "Liquidity",
                  "liquidity"
                )}
              </th>

              <th className="px-3 py-3 text-right">
                {heading(
                  "Open calls",
                  "calls"
                )}
              </th>

              <th className="px-5 py-3" />
            </tr>
          </thead>

          <tbody>
            {visibleRows.map(
              (row) => {
                const calls =
                  openCallsByTicker[
                    row.ticker
                  ] ?? 0;

                const callTitles =
                  openCallTitlesByTicker[
                    row.ticker
                  ] ?? [];

                const competitionHref =
                  activeCompetitionSlug
                    ? `/competitions/${encodeURIComponent(
                        activeCompetitionSlug
                      )}`
                    : null;

                const stockIntelligence =
                  intelligenceByTicker[
                    row.ticker
                  ];

                const buyIntelligence =
                  issuerIntelligence(
                    stockIntelligence,
                    row.bestBuyIssuer
                  );

                const breakEvenIntelligence =
                  issuerIntelligence(
                    stockIntelligence,
                    row.bestBreakEvenIssuer
                  );

                const liquidityIntelligence =
                  issuerIntelligence(
                    stockIntelligence,
                    row.deepestLiquidityIssuer
                  );

                return (
                  <tr
                    key={row.ticker}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-900 dark:hover:bg-slate-900/45"
                  >
                    <td className="px-5 py-4">
                      <div className="font-black text-slate-950 dark:text-white">
                        {row.ticker}
                      </div>

                      <div className="mt-1 max-w-[210px] truncate text-[11px] text-slate-600 dark:text-slate-400">
                        {row.stockName}
                      </div>
                    </td>

                    <td className="px-3 py-4 text-right font-bold tabular-nums text-slate-900 dark:text-slate-200">
                      {money(
                        row.wallStreetPrice
                      )}
                    </td>

                    <td className="px-3 py-4 text-right">
                      <span className="rounded-full border border-slate-300 px-2 py-1 text-[11px] font-black text-slate-700 dark:border-slate-700 dark:text-slate-300">
                        {row.quotingIssuerCount}/
                        {row.issuerCount}
                      </span>
                    </td>

                    <td className="px-3 py-4 text-right">
                      <div className="font-bold tabular-nums text-slate-950 dark:text-white">
                        {money(
                          row.bestBuyPrice
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {row.bestBuyIssuer ??
                          "—"}
                      </div>
                    </td>

                    <td className="px-3 py-4 text-right">
                      <div className="font-black tabular-nums text-slate-900 dark:text-slate-200">
                        {pct(
                          row.bestBuyGapPct
                        )}
                      </div>

                      <ContextNote
                        change={
                          buyIntelligence?.buyGapChangeSinceLastPctPoints ??
                          null
                        }
                        percentile={
                          buyIntelligence?.divergenceMagnitudePercentile ??
                          null
                        }
                        unusual={
                          buyIntelligence?.unusualGap ??
                          false
                        }
                      />
                    </td>

                    <td className="px-3 py-4 text-right">
                      <div className="font-black tabular-nums text-emerald-700 dark:text-emerald-400">
                        {row.bestBreakEvenPct ===
                        null
                          ? "—"
                          : `${row.bestBreakEvenPct.toFixed(
                              2
                            )}%`}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {row.bestBreakEvenIssuer ??
                          "—"}
                      </div>

                      <ContextNote
                        change={
                          breakEvenIntelligence?.breakEvenChangeSinceLastPctPoints ??
                          null
                        }
                        percentile={
                          breakEvenIntelligence?.breakEvenPercentile ??
                          null
                        }
                        unusual={
                          breakEvenIntelligence?.unusualFriction ??
                          false
                        }
                      />
                    </td>

                    <td className="px-3 py-4 text-right">
                      <div className="font-bold tabular-nums text-slate-900 dark:text-slate-200">
                        {compactUsd(
                          row.deepestLiquidityUsd
                        )}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {row.deepestLiquidityIssuer ??
                          "—"}
                      </div>

                      <ContextNote
                        change={
                          liquidityIntelligence?.liquidityChangeSinceLastPct ??
                          null
                        }
                        changeSuffix="%"
                        percentile={
                          liquidityIntelligence?.liquidityPercentile ??
                          null
                        }
                      />
                    </td>

                    <td className="px-3 py-4 text-right">
                      {calls > 0 && competitionHref ? (
                        <Link
                          href={competitionHref}
                          title={
                            callTitles.length > 0
                              ? callTitles.join(" • ")
                              : `${calls} active competition ${calls === 1 ? "call" : "calls"}`
                          }
                          className="text-sm font-black tabular-nums text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
                        >
                          {calls}
                        </Link>
                      ) : (
                        <span className="text-sm font-bold tabular-nums text-slate-600 dark:text-slate-400">
                          {calls}
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/stock/${encodeURIComponent(
                          row.ticker
                        )}`}
                        className="text-xs font-black text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
                      >
                        Analyse →
                      </Link>
                    </td>
                  </tr>
                );
              }
            )}

            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-10 text-center text-xs font-semibold text-slate-600 dark:text-slate-500"
                >
                  No stocks currently match this history-based filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 px-5 py-3 text-[11px] leading-5 dark:border-slate-800 text-slate-600 dark:text-slate-400">
        History-based filters require at least eight stored observations for the relevant wrapper. “Historically unusual” means at least one current BUY-gap or execution-friction reading is in the top 10% of that wrapper&apos;s own stored history. “Low friction” and “deep liquidity” use the lower and upper quartiles of that wrapper&apos;s own history. “Best” describes only the quoted metric shown at this moment, not the issuer as a whole. Jupiter-reported liquidity is a market-data diagnostic and should not be read as a single pool balance.
      </div>
    </section>
  );
}
