import type {
  GapPoint,
  HistoryIssuerSnapshot,
  HistorySnapshot,
  IssuerHistoryAnalytics,
  OpenConvergenceRow,
  StockHistoryAnalyticsResponse,
} from "@/types/history";

import {
  median,
  percentileRank,
  percentileRankByMagnitude,
} from "@/lib/history/math";

const HOUR =
  60 * 60 * 1000;

const DAY =
  24 * HOUR;

function valuesWithin(
  rows: Array<{
    timestamp: number;
    value: number | null;
  }>,
  since: number
) {
  return rows
    .filter(
      (
        row
      ) =>
        row.timestamp >=
          since &&
        row.value !==
          null &&
        Number.isFinite(
          row.value
        )
    )
    .map(
      (
        row
      ) =>
        row.value as number
    );
}

function easternParts(
  timestamp: number
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "America/New_York",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,
      }
    );

  const parts =
    Object.fromEntries(
      formatter
        .formatToParts(
          new Date(
            timestamp
          )
        )
        .filter(
          (
            part
          ) =>
            part.type !==
              "literal"
        )
        .map(
          (
            part
          ) => [
            part.type,
            part.value,
          ]
        )
    );

  return {
    date:
      `${parts.year}-${parts.month}-${parts.day}`,

    hour:
      Number(
        parts.hour
      ),

    minute:
      Number(
        parts.minute
      ),
  };
}

function buildOpenRows(
  rows: Array<{
    timestamp: number;
    gap: number | null;
  }>
): OpenConvergenceRow[] {
  const byDate =
    new Map<
      string,
      {
        before:
          typeof rows[number] |
          null;

        after:
          typeof rows[number] |
          null;
      }
    >();

  for (
    const row
    of rows
  ) {
    if (
      row.gap ===
      null
    ) {
      continue;
    }

    const parts =
      easternParts(
        row.timestamp
      );

    const bucket =
      byDate.get(
        parts.date
      ) ?? {
        before:
          null,
        after:
          null,
      };

    const isBefore =
      (
        parts.hour ===
          8 &&
        parts.minute >=
          45
      ) ||
      (
        parts.hour ===
          9 &&
        parts.minute <
          30
      );

    if (
      isBefore &&
      (
        !bucket.before ||
        row.timestamp >
          bucket.before
            .timestamp
      )
    ) {
      bucket.before =
        row;
    }

    const isAfter =
      parts.hour ===
        10 &&
      parts.minute <=
        30;

    if (
      isAfter &&
      (
        !bucket.after ||
        row.timestamp <
          bucket.after
            .timestamp
      )
    ) {
      bucket.after =
        row;
    }

    byDate.set(
      parts.date,
      bucket
    );
  }

  const result:
    OpenConvergenceRow[] =
    [];

  for (
    const [
      date,
      pair,
    ]
    of byDate
  ) {
    if (
      pair.before
        ?.gap ===
        null ||
      pair.before
        ?.gap ===
        undefined ||
      pair.after
        ?.gap ===
        null ||
      pair.after
        ?.gap ===
        undefined
    ) {
      continue;
    }

    result.push({
      date,

      beforeGapPct:
        pair.before
          .gap,

      afterGapPct:
        pair.after
          .gap,

      narrowed:
        Math.abs(
          pair.after
            .gap
        ) <
        Math.abs(
          pair.before
            .gap
        ),
    });
  }

  return result
    .sort(
      (
        a,
        b
      ) =>
        b.date.localeCompare(
          a.date
        )
    )
    .slice(
      0,
      20
    );
}

function convergenceStats(
  rows: Array<{
    timestamp: number;
    gap: number | null;
  }>
) {
  const threshold =
    0.75;

  const target =
    0.50;

  const horizon =
    24 * HOUR;

  const minimumEpisodeSpacing =
    2 * HOUR;

  const events:
    Array<{
      timestamp: number;
      gap: number;
    }> = [];

  let lastEventAt =
    -Infinity;

  for (
    let index =
      0;
    index <
      rows.length;
    index++
  ) {
    const row =
      rows[
        index
      ];

    if (
      row.gap ===
      null ||
      Math.abs(
        row.gap
      ) <
        threshold
    ) {
      continue;
    }

    const previous =
      index >
        0
        ? rows[
            index - 1
          ].gap
        : null;

    const crossedThreshold =
      previous ===
        null ||
      Math.abs(
        previous
      ) <
        threshold;

    const spacingReached =
      row.timestamp -
        lastEventAt >=
      minimumEpisodeSpacing;

    if (
      crossedThreshold ||
      spacingReached
    ) {
      events.push({
        timestamp:
          row.timestamp,

        gap:
          row.gap,
      });

      lastEventAt =
        row.timestamp;
    }
  }

  let converged =
    0;

  const minutes:
    number[] = [];

  const matureEvents =
    events.filter(
      (
        event
      ) =>
        Date.now() -
          event.timestamp >=
        horizon
    );

  for (
    const event
    of matureEvents
  ) {
    const future =
      rows.find(
        (
          row
        ) =>
          row.timestamp >
            event.timestamp &&
          row.timestamp <=
            event.timestamp +
              horizon &&
          row.gap !==
            null &&
          Math.abs(
            row.gap
          ) <=
            target
      );

    if (
      future
    ) {
      converged++;

      minutes.push(
        (
          future.timestamp -
          event.timestamp
        ) /
          60000
      );
    }
  }

  return {
    events:
      matureEvents.length,

    converged,

    failures:
      matureEvents.length -
      converged,

    rate:
      matureEvents.length >
        0
        ? (
            converged /
            matureEvents.length
          ) *
          100
        : null,

    medianMinutes:
      median(
        minutes
      ),
  };
}

export function buildHistoryAnalytics(
  ticker: string,
  history: HistorySnapshot[]
): StockHistoryAnalyticsResponse {
  const sorted =
    [
      ...history,
    ].sort(
      (
        a,
        b
      ) =>
        a.timestamp -
        b.timestamp
    );

  const latest =
    sorted[
      sorted.length - 1
    ] ??
    null;

  const issuerKeys =
    new Map<
      string,
      {
        issuer: string;
        symbol: string;
        mint: string;
      }
    >();

  for (
    const snapshot
    of sorted
  ) {
    for (
      const issuer
      of snapshot.issuers
    ) {
      issuerKeys.set(
        issuer.mint,
        {
          issuer:
            issuer.issuer,

          symbol:
            issuer.symbol,

          mint:
            issuer.mint,
        }
      );
    }
  }

  const now =
    Date.now();

  const issuers:
    IssuerHistoryAnalytics[] =
    [];

  for (
    const meta
    of issuerKeys.values()
  ) {
    const rows =
      sorted
        .map(
          (
            snapshot
          ) => {
            const issuer =
              snapshot.issuers
                .find(
                  (
                    item
                  ) =>
                    item.mint ===
                    meta.mint
                ) ??
              null;

            return {
              timestamp:
                snapshot.timestamp,

              issuer,

              benchmark:
                snapshot
                  .benchmarkPrice,
            };
          }
        )
        .filter(
          (
            row
          ) =>
            row.issuer !==
            null
        ) as Array<{
          timestamp: number;
          issuer: HistoryIssuerSnapshot;
          benchmark: number | null;
        }>;

    const latestIssuer =
      rows[
        rows.length - 1
      ]?.issuer ??
      null;

    const buyRows =
      rows.map(
        (
          row
        ) => ({
          timestamp:
            row.timestamp,

          value:
            row.issuer
              .buyGapPct,
        })
      );

    const breakEvenRows =
      rows.map(
        (
          row
        ) => ({
          timestamp:
            row.timestamp,

          value:
            row.issuer
              .approxBreakEvenMovePct,
        })
      );

    const buyHistory =
      buyRows
        .map(
          (
            row
          ) =>
            row.value
        )
        .filter(
          (
            value
          ): value is number =>
            value !==
              null &&
            Number.isFinite(
              value
            )
        );

    const breakEvenHistory =
      breakEvenRows
        .map(
          (
            row
          ) =>
            row.value
        )
        .filter(
          (
            value
          ): value is number =>
            value !==
              null &&
            Number.isFinite(
              value
            )
        );

    const executableObservations =
      rows.filter(
        (
          row
        ) =>
          row.issuer.buy
            .status ===
            "ok" &&
          row.issuer.sell
            .status ===
            "ok"
      ).length;

    const gapRows =
      rows.map(
        (
          row
        ) => ({
          timestamp:
            row.timestamp,

          gap:
            row.issuer
              .buyGapPct,
        })
      );

    const convergence =
      convergenceStats(
        gapRows
      );

    const openRows =
      buildOpenRows(
        gapRows
      );

    const gap48h:
      GapPoint[] =
      rows
        .filter(
          (
            row
          ) =>
            row.timestamp >=
            now -
              48 *
                HOUR
        )
        .map(
          (
            row
          ) => {
            const indicativeGap =
              row.issuer
                  .indicativePrice !==
                null &&
              row.benchmark !==
                null &&
              row.benchmark >
                0
                ? (
                    (
                      row.issuer
                        .indicativePrice -
                      row.benchmark
                    ) /
                    row.benchmark
                  ) *
                  100
                : null;

            return {
              timestamp:
                row.timestamp,

              benchmarkPrice:
                row.benchmark,

              indicativePrice:
                row.issuer
                  .indicativePrice,

              buyPrice:
                row.issuer
                  .buy.effectivePrice,

              sellPrice:
                row.issuer
                  .sell.effectivePrice,

              buyGapPct:
                row.issuer
                  .buyGapPct,

              sellGapPct:
                row.issuer
                  .sellGapPct,

              indicativeGapPct:
                indicativeGap,

              approxBreakEvenMovePct:
                row.issuer
                  .approxBreakEvenMovePct,
            };
          }
        );

    issuers.push({
      issuer:
        meta.issuer,

      symbol:
        meta.symbol,

      mint:
        meta.mint,

      latest:
        latestIssuer,

      observations:
        rows.length,

      quoteAvailabilityPct:
        rows.length >
          0
          ? (
              executableObservations /
              rows.length
            ) *
            100
          : null,

      currentBuyGapPct:
        latestIssuer
          ?.buyGapPct ??
        null,

      currentSellGapPct:
        latestIssuer
          ?.sellGapPct ??
        null,

      currentApproxBreakEvenMovePct:
        latestIssuer
          ?.approxBreakEvenMovePct ??
        null,

      currentDivergenceAfterBreakEvenPct:
        latestIssuer
          ?.divergenceAfterBreakEvenPct ??
        null,

      currentDivergenceMagnitudePercentile:
        percentileRankByMagnitude(
          latestIssuer
            ?.buyGapPct ??
            null,
          buyHistory
        ),

      currentBreakEvenPercentile:
        percentileRank(
          latestIssuer
            ?.approxBreakEvenMovePct ??
            null,
          breakEvenHistory
        ),

      medianBuyGap24hPct:
        median(
          valuesWithin(
            buyRows,
            now -
              DAY
          )
        ),

      medianBuyGap7dPct:
        median(
          valuesWithin(
            buyRows,
            now -
              7 *
                DAY
          )
        ),

      medianBreakEven24hPct:
        median(
          valuesWithin(
            breakEvenRows,
            now -
              DAY
          )
        ),

      medianBreakEven7dPct:
        median(
          valuesWithin(
            breakEvenRows,
            now -
              7 *
                DAY
          )
        ),

      similarDivergenceEvents:
        convergence.events,

      convergenceRatePct:
        convergence.rate,

      convergenceFailures:
        convergence.failures,

      medianMinutesToConvergence:
        convergence
          .medianMinutes,

      openObservations:
        openRows.length,

      openNarrowedPct:
        openRows.length >
          0
          ? (
              openRows.filter(
                (
                  row
                ) =>
                  row.narrowed
              ).length /
              openRows.length
            ) *
            100
          : null,

      openRows,

      gap48h,
    });
  }

  return {
    ticker:
      ticker.toUpperCase(),

    stockName:
      latest
        ?.stockName ??
      ticker.toUpperCase(),

    canonicalSizeUsd:
      latest
        ?.canonicalSizeUsd ??
      1000,

    firstSnapshotAt:
      sorted[
        0
      ]?.timestamp ??
      null,

    lastSnapshotAt:
      latest
        ?.timestamp ??
      null,

    snapshotCount:
      sorted.length,

    ready:
      sorted.length >
      0,

    issuers,
  };
}