"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  GapPoint,
  StockHistoryAnalyticsResponse,
} from "@/types/history";

type ViewMode =
  | "indicative"
  | "buy"
  | "sell";

interface Props {
  ticker: string;
}

interface Series {
  id: string;
  label: string;
  values: Array<{
    timestamp: number;
    value: number;
  }>;
  color: string;
  dashed?: boolean;
}

const COLORS = [
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#d97706",
  "#db2777",
];

function money(
  value:
    | number
    | null
    | undefined
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }
  ).format(value);
}

function timeLabel(
  timestamp: number
) {
  return new Date(
    timestamp
  ).toLocaleString(
    [],
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function priceFor(
  point: GapPoint,
  mode: ViewMode
) {
  if (mode === "indicative") {
    return point.indicativePrice;
  }

  if (mode === "sell") {
    return point.sellPrice;
  }

  return point.buyPrice;
}

function linePath(
  values: Series["values"],
  minTime: number,
  maxTime: number,
  minValue: number,
  maxValue: number,
  width: number,
  height: number,
  left: number,
  top: number
) {
  const usableWidth =
    width - left - 18;

  const usableHeight =
    height - top - 30;

  const timeSpan =
    Math.max(
      1,
      maxTime - minTime
    );

  const valueSpan =
    Math.max(
      0.000001,
      maxValue - minValue
    );

  return values
    .map(
      (
        point,
        index
      ) => {
        const x =
          left +
          ((point.timestamp - minTime) /
            timeSpan) *
            usableWidth;

        const y =
          top +
          (1 -
            (point.value - minValue) /
              valueSpan) *
            usableHeight;

        return `${index === 0 ? "M" : "L"} ${x.toFixed(
          2
        )} ${y.toFixed(
          2
        )}`;
      }
    )
    .join(" ");
}

function nearestPoint(
  points: GapPoint[],
  timestamp: number
) {
  if (points.length === 0) {
    return null;
  }

  return points.reduce(
    (
      closest,
      point
    ) =>
      Math.abs(
        point.timestamp - timestamp
      ) <
      Math.abs(
        closest.timestamp - timestamp
      )
        ? point
        : closest
  );
}

export default function MarketPriceComparison({
  ticker,
}: Props) {
  const [data, setData] =
    useState<StockHistoryAnalyticsResponse | null>(
      null
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [mode, setMode] =
    useState<ViewMode>(
      "buy"
    );

  const [
    selectedTimestamp,
    setSelectedTimestamp,
  ] =
    useState<number | null>(
      null
    );

  const svgRef =
    useRef<SVGSVGElement | null>(
      null
    );

  useEffect(
    () => {
      let cancelled = false;

      async function load(showLoading = true) {
        if (showLoading) setLoading(true);
        setError(null);

        try {
          const response = await fetch(
            `/api/history/${encodeURIComponent(ticker)}`,
            { cache: "no-store" }
          );

          const json = await response.json();

          if (!response.ok) {
            throw new Error(
              json.error ??
                json.details ??
                "Unable to load price history"
            );
          }

          if (!cancelled) setData(json);
        } catch (loadError) {
          if (!cancelled) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : String(loadError)
            );
          }
        } finally {
          if (!cancelled && showLoading) setLoading(false);
        }
      }

      load();

      const refreshTimer = window.setInterval(() => {
        load(false);
      }, 15 * 60 * 1000 + 30 * 1000);

      return () => {
        cancelled = true;
        window.clearInterval(refreshTimer);
      };
    },
    [ticker]
  );

  const series =
    useMemo(
      () => {
        if (!data) {
          return [] as Series[];
        }

        const benchmarkByTime =
          new Map<number, number>();

        for (const issuer of data.issuers) {
          for (const point of issuer.gap48h) {
            if (
              point.benchmarkPrice !== null &&
              Number.isFinite(
                point.benchmarkPrice
              )
            ) {
              benchmarkByTime.set(
                point.timestamp,
                point.benchmarkPrice
              );
            }
          }
        }

        const result: Series[] = [
          {
            id: "benchmark",
            label: "Wall Street",
            color: "#CBD5E1",
            dashed: true,
          values: Array.from(
  benchmarkByTime.entries()
)

              .sort(
                (left, right) =>
                  left[0] -
                  right[0]
              )
              .map(
                ([timestamp, value]) => ({
                  timestamp,
                  value,
                })
              ),
          },
        ];

        data.issuers.forEach(
          (issuer, index) => {
            const values =
              issuer.gap48h
                .map(
                  (point) => ({
                    timestamp:
                      point.timestamp,
                    value:
                      priceFor(
                        point,
                        mode
                      ),
                  })
                )
                .filter(
                  (
                    row
                  ): row is {
                    timestamp: number;
                    value: number;
                  } =>
                    row.value !== null &&
                    Number.isFinite(
                      row.value
                    )
                );

            if (values.length > 0) {
              result.push({
                id: issuer.mint,
                label: `${issuer.issuer} · ${issuer.symbol}`,
                color:
                  COLORS[
                    index %
                      COLORS.length
                  ],
                values,
              });
            }
          }
        );

        return result;
      },
      [
        data,
        mode,
      ]
    );

  const chart =
    useMemo(
      () => {
        const all =
          series.flatMap(
            (item) =>
              item.values
          );

        if (all.length < 2) {
          return null;
        }

        const minTime =
          Math.min(
            ...all.map(
              (row) =>
                row.timestamp
            )
          );

        const maxTime =
          Math.max(
            ...all.map(
              (row) =>
                row.timestamp
            )
          );

        const rawMin =
          Math.min(
            ...all.map(
              (row) =>
                row.value
            )
          );

        const rawMax =
          Math.max(
            ...all.map(
              (row) =>
                row.value
            )
          );

        const padding =
          Math.max(
            0.05,
            (rawMax - rawMin) *
              0.08
          );

        return {
          minTime,
          maxTime,
          minValue:
            rawMin - padding,
          maxValue:
            rawMax + padding,
        };
      },
      [
        series,
      ]
    );

  const selected =
    useMemo(
      () => {
        if (!data) {
          return null;
        }

        const timestamp =
          selectedTimestamp ??
          data.lastSnapshotAt;

        if (timestamp === null) {
          return null;
        }

        const issuerRows =
          data.issuers.map(
            (issuer) => ({
              issuer,
              point:
                nearestPoint(
                  issuer.gap48h,
                  timestamp
                ),
            })
          );

        const benchmark =
          issuerRows
            .map(
              (row) =>
                row.point
                  ?.benchmarkPrice ??
                null
            )
            .find(
              (value) =>
                value !== null
            ) ??
          null;

        return {
          timestamp,
          benchmark,
          issuerRows,
        };
      },
      [
        data,
        selectedTimestamp,
      ]
    );

  const width = 900;
  const height = 360;
  const left = 72;
  const top = 18;

  function handlePointerMove(
    event:
      React.PointerEvent<SVGSVGElement>
  ) {
    if (
      !chart ||
      !svgRef.current
    ) {
      return;
    }

    const rect =
      svgRef.current.getBoundingClientRect();

    const localX =
      Math.min(
        rect.width,
        Math.max(
          0,
          event.clientX -
            rect.left
        )
      );

    const plotStart =
      (left / width) *
      rect.width;

    const plotEnd =
      ((width - 18) /
        width) *
      rect.width;

    const ratio =
      Math.min(
        1,
        Math.max(
          0,
          (localX -
            plotStart) /
            Math.max(
              1,
              plotEnd -
                plotStart
            )
        )
      );

    setSelectedTimestamp(
      chart.minTime +
        ratio *
          (chart.maxTime -
            chart.minTime)
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-gray-100 p-5 dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              48h price history
            </div>

            <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white md:text-2xl">
              Wall Street vs tokenized wrappers
            </h2>

            <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-500 dark:text-slate-400">
              Actual dollar prices recorded by Closing Bell at matching timestamps. Compare Wall Street with indicative, executable BUY or executable SELL wrapper prices to see whether the underlying moved, the wrapper diverged, or both.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                [
                  "indicative",
                  "Indicative",
                ],
                [
                  "buy",
                  "$1K BUY",
                ],
                [
                  "sell",
                  "$1K SELL",
                ],
              ] as Array<
                [
                  ViewMode,
                  string,
                ]
              >
            ).map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setMode(value)
                  }
                  className={[
                    "rounded-xl border px-3 py-2 text-xs font-bold transition",
                    mode === value
                      ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-900",
                  ].join(" ")}
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {loading &&
      !data && (
        <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
          Loading price history…
        </div>
      )}

      {error && (
        <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {data &&
      chart ? (
        <div className="p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-bold text-gray-500 dark:text-slate-400">
            {series.map(
              (item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2"
                >
                  <span
                    className="inline-block h-0.5 w-5"
                    style={{
                      backgroundColor:
                        item.color,
                    }}
                  />

                  {item.label}
                </div>
              )
            )}

            <span className="ml-auto rounded-full border border-gray-200 px-2.5 py-1 text-[11px] uppercase tracking-wide text-gray-500 dark:border-slate-800 dark:text-slate-400">
              Recorded observations · 48h
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50/50 dark:border-slate-800 dark:bg-slate-900/30">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="block h-auto w-full touch-none"
              onPointerMove={
                handlePointerMove
              }
              onPointerLeave={() =>
                setSelectedTimestamp(
                  null
                )
              }
              role="img"
              aria-label={`${ticker} Wall Street and tokenized wrapper price comparison`}
            >
              {Array.from({
                length: 5,
              }).map(
                (_, index) => {
                  const ratio =
                    index / 4;

                  const y =
                    top +
                    ratio *
                      (height -
                        top -
                        30);

                  const value =
                    chart.maxValue -
                    ratio *
                      (chart.maxValue -
                        chart.minValue);

                  return (
                    <g
                      key={index}
                    >
                      <line
                        x1={left}
                        x2={width - 18}
                        y1={y}
                        y2={y}
                        stroke="currentColor"
                        className="text-gray-200 dark:text-slate-800"
                        strokeWidth="1"
                      />

                      <text
                        x={left - 10}
                        y={y + 4}
                        textAnchor="end"
                        fontSize="11"
                        fill="currentColor"
                        className="text-gray-500 dark:text-slate-400"
                      >
                        {money(value)}
                      </text>
                    </g>
                  );
                }
              )}

              {series.map(
                (item) => (
                  <path
                    key={item.id}
                    d={linePath(
                      item.values,
                      chart.minTime,
                      chart.maxTime,
                      chart.minValue,
                      chart.maxValue,
                      width,
                      height,
                      left,
                      top
                    )}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={
                      item.id ===
                      "benchmark"
                        ? 2.5
                        : 2
                    }
                    strokeDasharray={
                      item.dashed
                        ? "7 5"
                        : undefined
                    }
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              )}

              <text
                x={left}
                y={height - 8}
                fontSize="11"
                fill="currentColor"
                className="text-gray-500 dark:text-slate-400"
              >
                {timeLabel(
                  chart.minTime
                )}
              </text>

              <text
                x={width - 18}
                y={height - 8}
                textAnchor="end"
                fontSize="11"
                fill="currentColor"
                className="text-gray-500 dark:text-slate-400"
              >
                {timeLabel(
                  chart.maxTime
                )}
              </text>
            </svg>
          </div>

          {selected && (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    {selectedTimestamp
                      ? "Selected observation"
                      : "Latest observation"}
                  </div>

                  <div className="mt-1 text-sm font-bold text-gray-800 dark:text-slate-200">
                    {timeLabel(
                      selected.timestamp
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    Wall Street
                  </div>

                  <div className="mt-1 text-lg font-black tabular-nums text-gray-950 dark:text-white">
                    {money(
                      selected.benchmark
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {selected.issuerRows.map(
                  (row) => {
                    const price =
                      row.point
                        ? priceFor(
                            row.point,
                            mode
                          )
                        : null;

                    const gap =
                      mode ===
                      "indicative"
                        ? row.point
                            ?.indicativeGapPct ??
                          null
                        : mode ===
                          "sell"
                          ? row.point
                              ?.sellGapPct ??
                            null
                          : row.point
                              ?.buyGapPct ??
                            null;

                    return (
                      <div
                        key={
                          row.issuer.mint
                        }
                        className="rounded-xl bg-white p-3 dark:bg-slate-950"
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                          {row.issuer.issuer} ·{" "}
                          {row.issuer.symbol}
                        </div>

                        <div className="mt-1 flex items-end justify-between gap-3">
                          <div className="text-base font-black tabular-nums text-gray-950 dark:text-white">
                            {money(price)}
                          </div>

                          <div
                            className={[
                              "text-xs font-black tabular-nums",
                              gap === null
                                ? "text-gray-400"
                                : gap < 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : gap > 0
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-gray-600 dark:text-slate-300",
                            ].join(" ")}
                          >
                            {gap === null
                              ? "—"
                              : `${gap >= 0 ? "+" : ""}${gap.toFixed(
                                  2
                                )}%`}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-4 text-gray-500 dark:text-slate-400">
            This chart does not make a new market-data request. It visualises the Wall Street benchmark and wrapper prices already recorded by Closing Bell. Indicative is not executable; BUY and SELL are historical whole-order $1K prices.
          </p>
        </div>
      ) : (
        data &&
        !loading &&
        !error && (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
            Not enough recorded absolute-price observations yet to draw the comparison chart.
          </div>
        )
      )}
    </section>
  );
}