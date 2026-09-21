"use client";

import {
  useMemo,
  useState,
} from "react";

import type {
  GapPoint,
  IssuerHistoryAnalytics,
} from "@/types/history";

interface Props {
  issuer:
    IssuerHistoryAnalytics;
}

function pct(
  value:
    | number
    | null
) {
  if (
    value ===
    null
  ) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(
    2
  )}%`;
}

function money(
  value:
    | number
    | null
) {
  if (
    value ===
      null ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",
      currency:
        "USD",
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        4,
    }
  ).format(
    value
  );
}

function median(
  values: number[]
) {
  if (
    values.length ===
    0
  ) {
    return null;
  }

  const sorted =
    [
      ...values,
    ].sort(
      (
        left,
        right
      ) =>
        left -
        right
    );

  const middle =
    Math.floor(
      sorted.length /
      2
    );

  if (
    sorted.length %
      2 ===
    0
  ) {
    return (
      (
        sorted[
          middle -
            1
        ] +
        sorted[
          middle
        ]
      ) /
      2
    );
  }

  return sorted[
    middle
  ];
}

function timeLabel(
  timestamp: number
) {
  return new Date(
    timestamp
  ).toLocaleTimeString(
    [],
    {
      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function dateTimeLabel(
  timestamp: number
) {
  return new Date(
    timestamp
  ).toLocaleString(
    [],
    {
      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-lg font-black tabular-nums text-gray-950 dark:text-white">
        {value}
      </div>

      {note && (
        <div className="mt-1 text-[10px] leading-4 text-gray-400 dark:text-slate-500">
          {note}
        </div>
      )}
    </div>
  );
}

function TooltipMetric({
  label,
  value,
}: {
  label: string;
  value:
    | number
    | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500 dark:text-slate-400">
        {label}
      </span>

      <strong className="tabular-nums text-gray-950 dark:text-white">
        {pct(
          value
        )}
      </strong>
    </div>
  );
}

function TooltipPrice({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value:
    | number
    | null;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500 dark:text-slate-400">
        {label}
      </span>

      <strong
        className={[
          "tabular-nums",
          emphasis
            ? "text-violet-700 dark:text-violet-300"
            : "text-gray-950 dark:text-white",
        ].join(
          " "
        )}
      >
        {money(
          value
        )}
      </strong>
    </div>
  );
}

export default function GapRadar({
  issuer,
}: Props) {
  const points =
    issuer.gap48h;

  const [
    hovered,
    setHovered,
  ] =
    useState<GapPoint | null>(
      null
    );

  const stats =
    useMemo(
      () => {
        const values =
          points
            .map(
              (
                point
              ) =>
                point.buyGapPct
            )
            .filter(
              (
                value
              ): value is number =>
                value !==
                null
            );

        const latest =
          points[
            points.length -
              1
          ] ??
          null;

        return {
          latest,

          low:
            values.length
              ? Math.min(
                  ...values
                )
              : null,

          high:
            values.length
              ? Math.max(
                  ...values
                )
              : null,

          median:
            median(
              values
            ),

          observations:
            values.length,
        };
      },
      [
        points,
      ]
    );

  const maxMagnitude =
    Math.max(
      0.5,
      Math.abs(
        stats.low ??
          0
      ),
      Math.abs(
        stats.high ??
          0
      )
    );

  const displayPoint =
    hovered ??
    stats.latest;

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="font-black text-gray-950 dark:text-white">
            How today's gap compares with history
          </h3>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-slate-400">
            Historical $1K executable BUY versus the Wall Street reference.
            Hover any observation to see the actual benchmark, indicative,
            BUY and SELL prices captured at that moment. Below zero means the
            wrapper was cheaper than the benchmark; above zero means it was
            more expensive.
          </p>
        </div>

        <div className="shrink-0 rounded-full border border-gray-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:text-slate-500">
          Recorded observations · 48h
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Metric
          label="Current BUY gap"
          value={
            pct(
              stats.latest
                ?.buyGapPct ??
                null
            )
          }
        />

        <Metric
          label="48h low"
          value={
            pct(
              stats.low
            )
          }
          note="Cheapest observed BUY"
        />

        <Metric
          label="48h high"
          value={
            pct(
              stats.high
            )
          }
          note="Priciest observed BUY"
        />

        <Metric
          label="48h median"
          value={
            pct(
              stats.median
            )
          }
        />

        <Metric
          label="Observations"
          value={
            stats.observations.toLocaleString()
          }
        />
      </div>

      {points.length >
      1 ? (
        <div className="mt-5">
          <div className="mb-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            {displayPoint ? (
              <div className="grid gap-3 md:grid-cols-[1fr_1.3fr] md:items-center">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    {hovered
                      ? "Selected observation"
                      : "Latest observation"}
                  </div>

                  <div className="mt-1 text-sm font-bold text-gray-700 dark:text-slate-200">
                    {dateTimeLabel(
                      displayPoint.timestamp
                    )}
                  </div>
                </div>

                <div className="grid gap-1.5 text-xs">
                  <div className="mb-1 grid gap-1.5 border-b border-gray-200 pb-2 dark:border-slate-800">
                    <TooltipPrice
                      label="Wall Street benchmark"
                      value={
                        displayPoint.benchmarkPrice
                      }
                      emphasis
                    />

                    <TooltipPrice
                      label="Indicative wrapper"
                      value={
                        displayPoint.indicativePrice
                      }
                    />

                    <TooltipPrice
                      label="Executable $1K BUY"
                      value={
                        displayPoint.buyPrice
                      }
                    />

                    <TooltipPrice
                      label="Executable $1K SELL"
                      value={
                        displayPoint.sellPrice
                      }
                    />
                  </div>

                  <TooltipMetric
                    label="BUY vs Wall Street"
                    value={
                      displayPoint.buyGapPct
                    }
                  />

                  <TooltipMetric
                    label="SELL vs Wall Street"
                    value={
                      displayPoint.sellGapPct
                    }
                  />

                  <TooltipMetric
                    label="Indicative vs Wall Street"
                    value={
                      displayPoint.indicativeGapPct
                    }
                  />

                  <TooltipMetric
                    label="Approx. break-even move"
                    value={
                      displayPoint.approxBreakEvenMovePct
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 dark:text-slate-500">
                No executable observation available.
              </div>
            )}
          </div>

          <div className="relative h-56 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="absolute left-12 right-3 top-3 border-t border-dashed border-gray-200 dark:border-slate-800" />
            <div className="absolute left-12 right-3 top-1/4 border-t border-dashed border-gray-200 dark:border-slate-800" />
            <div className="absolute left-12 right-3 top-1/2 border-t-2 border-gray-300 dark:border-slate-700" />
            <div className="absolute left-12 right-3 top-3/4 border-t border-dashed border-gray-200 dark:border-slate-800" />

            <div className="absolute left-2 top-2 text-[9px] font-semibold tabular-nums text-gray-400 dark:text-slate-500">
              +{maxMagnitude.toFixed(
                2
              )}%
            </div>

            <div className="absolute left-2 top-[calc(25%-5px)] text-[9px] tabular-nums text-gray-400 dark:text-slate-500">
              +{(
                maxMagnitude /
                2
              ).toFixed(
                2
              )}%
            </div>

            <div className="absolute left-2 top-[calc(50%-5px)] text-[9px] font-bold tabular-nums text-gray-500 dark:text-slate-400">
              0.00%
            </div>

            <div className="absolute bottom-[calc(25%-5px)] left-2 text-[9px] tabular-nums text-gray-400 dark:text-slate-500">
              -{(
                maxMagnitude /
                2
              ).toFixed(
                2
              )}%
            </div>

            <div className="absolute bottom-2 left-2 text-[9px] font-semibold tabular-nums text-gray-400 dark:text-slate-500">
              -{maxMagnitude.toFixed(
                2
              )}%
            </div>

            <div className="absolute inset-y-3 left-12 right-3 flex items-stretch gap-[2px]">
              {points.map(
                (
                  point
                ) => {
                  const value =
                    point.buyGapPct;

                  if (
                    value ===
                    null
                  ) {
                    return (
                      <div
                        key={
                          point.timestamp
                        }
                        className="min-w-0 flex-1"
                      />
                    );
                  }

                  const magnitude =
                    Math.min(
                      1,
                      Math.abs(
                        value
                      ) /
                        maxMagnitude
                    );

                  const height =
                    Math.max(
                      2,
                      magnitude *
                        50
                    );

                  const cheaper =
                    value <
                    0;

                  const active =
                    hovered
                      ?.timestamp ===
                    point.timestamp;

                  return (
                    <button
                      key={
                        point.timestamp
                      }
                      type="button"
                      aria-label={`${dateTimeLabel(
                        point.timestamp
                      )}, BUY gap ${pct(
                        point.buyGapPct
                      )}, SELL gap ${pct(
                        point.sellGapPct
                      )}, indicative gap ${pct(
                        point.indicativeGapPct
                      )}, break-even ${pct(
                        point.approxBreakEvenMovePct
                      )}`}
                      onMouseEnter={() =>
                        setHovered(
                          point
                        )
                      }
                      onMouseLeave={() =>
                        setHovered(
                          null
                        )
                      }
                      onFocus={() =>
                        setHovered(
                          point
                        )
                      }
                      onBlur={() =>
                        setHovered(
                          null
                        )
                      }
                      className={[
                        "relative min-w-[3px] flex-1 rounded-sm outline-none transition",
                        active
                          ? "bg-violet-100/70 dark:bg-violet-950/30"
                          : "hover:bg-gray-100 dark:hover:bg-slate-800/60",
                      ].join(
                        " "
                      )}
                    >
                      <span
                        className={[
                          "absolute left-[15%] right-[15%] rounded-sm transition",
                          cheaper
                            ? "top-1/2 bg-blue-500"
                            : "bottom-1/2 bg-rose-500",
                          active
                            ? "opacity-100 ring-2 ring-violet-400 ring-offset-1 ring-offset-gray-50 dark:ring-offset-slate-900"
                            : "opacity-80",
                        ].join(
                          " "
                        )}
                        style={{
                          height:
                            `${height}%`,
                        }}
                      />
                    </button>
                  );
                }
              )}
            </div>

            <div className="absolute bottom-1 left-12 text-[9px] text-gray-400 dark:text-slate-500">
              {timeLabel(
                points[
                  0
                ].timestamp
              )}
            </div>

            <div className="absolute bottom-1 right-3 text-[9px] text-gray-400 dark:text-slate-500">
              {timeLabel(
                points[
                  points.length -
                    1
                ].timestamp
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 text-gray-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                Cheaper than Wall Street
              </span>

              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                Pricier than Wall Street
              </span>
            </div>

            <div className="font-semibold text-gray-500 dark:text-slate-400">
              {issuer.issuer} · {issuer.symbol}
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-[10px] leading-4 text-gray-400 dark:bg-slate-900/60 dark:text-slate-500">
            Hover or focus any bar to inspect the exact recorded BUY gap, SELL gap, indicative gap and approximate break-even move for that observation.
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
          We need more snapshots before the 48-hour radar can form.
        </div>
      )}
    </section>
  );
}