import { buildDailyIssuerRanges } from "@/lib/paperLab/dailyRanges";
import { getPaperStrategyRules } from "@/lib/paperLab/config";
import {
  latestPaperObservations,
  recentPaperDiscoveryObservations,
  recentPaperResearchObservations,
  readPaperTrades,
} from "@/lib/paperLab/storage";

import type {
  PaperLabDashboard,
  PaperResearchGroup,
  PaperCandidateOutcome,
  PaperLabSummary,
  PaperStrategyPerformance,
  PaperStrategyType,
  PaperTrade,
  PaperTradeDirection,
} from "@/types/paperLab";

function average(values: number[]) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
}

function holdMinutes(trade: PaperTrade) {
  if (!trade.closedAt) return null;
  return (trade.closedAt - trade.openedAt) / 60000;
}

function strategyLabel(
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection
) {
  let family: string;

  switch (strategyType) {
    case "extreme_momentum":
      family = "Extreme Momentum";
      break;

    case "discount_recovery":
      family = "Discount Recovery";
      break;

    case "wrapper_lag":
      family = "Wrapper Lag";
      break;

    case "drift_reversal":
      family = "Drift Reversal";
      break;

    case "momentum":
      family = "Momentum";
      break;

    case "convergence":
      family = "Convergence";
      break;

    default:
      family = strategyType;
      break;
  }

  return `${family} ${direction === "long" ? "Long" : "Short"}`;
}

function buildStrategyPerformance(
  trades: PaperTrade[],
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection,
  version: string
): PaperStrategyPerformance {
  const matching = trades.filter(
    (trade) =>
      trade.strategyVersion === version &&
      trade.strategyType === strategyType &&
      trade.direction === direction
  );

  const open = matching.filter(
    (trade) => trade.status === "open"
  );

  const completed = matching.filter(
    (trade) => trade.status === "closed"
  );

  const targetHits = completed.filter(
    (trade) => trade.exitReason === "target"
  ).length;

  const realisedPnl = completed
    .map((trade) => trade.realisedPnlUsd)
    .filter((value): value is number => value !== null);

  const realisedPct = completed
    .map((trade) => trade.realisedPnlPct)
    .filter((value): value is number => value !== null);

  return {
    strategyVersion: version,
    strategyType,
    direction,
    label: strategyLabel(strategyType, direction),
    openTrades: open.length,
    completedTrades: completed.length,
    targetHits,
    targetHitRatePct: completed.length
      ? (targetHits / completed.length) * 100
      : null,
    averagePnlPct: average(realisedPct),
    realisedPnlUsd: realisedPnl.reduce(
      (sum, value) => sum + value,
      0
    ),
  };
}

/**
 * Strategies that V5 actively forward-tests.
 *
 * These should always appear on the scoreboard for the current
 * strategy version, even when they have no trades yet.
 */
const ACTIVE_V5_STRATEGIES: Array<{
  strategyType: PaperStrategyType;
  direction: PaperTradeDirection;
}> = [
  {
    strategyType: "extreme_momentum",
    direction: "long",
  },
  {
    strategyType: "discount_recovery",
    direction: "long",
  },
  {
    strategyType: "wrapper_lag",
    direction: "long",
  },
  {
    strategyType: "drift_reversal",
    direction: "long",
  },
];

/**
 * Legacy strategies remain available for historical comparison.
 *
 * They are only displayed when a particular version actually
 * contains trades for that strategy/direction.
 */
const LEGACY_STRATEGIES: Array<{
  strategyType: PaperStrategyType;
  direction: PaperTradeDirection;
}> = [
  {
    strategyType: "momentum",
    direction: "long",
  },
  {
    strategyType: "momentum",
    direction: "short",
  },
  {
    strategyType: "convergence",
    direction: "long",
  },
  {
    strategyType: "convergence",
    direction: "short",
  },
];

export async function buildPaperLabDashboard(): Promise<PaperLabDashboard> {
  const rules = getPaperStrategyRules();

  const [
    trades,
    latestObservations,
    discoveryObservations,
    researchObservations,
    dailyIssuerRanges,
  ] = await Promise.all([
    readPaperTrades(),
    latestPaperObservations(),
    recentPaperDiscoveryObservations(),
    recentPaperResearchObservations(),
    buildDailyIssuerRanges(),
  ]);

  const openTrades = trades
    .filter((trade) => trade.status === "open")
    .sort((a, b) => b.openedAt - a.openedAt);

  const completedTrades = trades
    .filter((trade) => trade.status === "closed")
    .sort(
      (a, b) =>
        (b.closedAt ?? 0) - (a.closedAt ?? 0)
    );

  // All-time headline: include historical strategy versions as well as the
  // currently active experiment. Version-specific performance stays in the
  // strategy scoreboard below. Never rewrite or migrate saved trade records.
  const realised = completedTrades
    .map((trade) => trade.realisedPnlUsd)
    .filter((value): value is number => value !== null);

  const realisedPct = completedTrades
    .map((trade) => trade.realisedPnlPct)
    .filter((value): value is number => value !== null);

  const unrealised = openTrades
    .map((trade) => trade.currentPnlUsd)
    .filter((value): value is number => value !== null);

  const holds = completedTrades
    .map(holdMinutes)
    .filter((value): value is number => value !== null);

  const targetHits = completedTrades.filter(
    (trade) => trade.exitReason === "target"
  ).length;

  const secondaryTargetHits = completedTrades.filter(
    (trade) =>
      (trade.maxFavourablePct ??
        trade.realisedPnlPct ??
        -Infinity) >=
      (trade.strategyRules?.secondaryTargetPct ?? 1.2)
  ).length;

  const summary: PaperLabSummary = {
    strategyVersion: rules.version,
    paperNotionalUsd: rules.notionalUsd,
    targetPct: rules.targetPct,

    openTrades: openTrades.length,
    completedTrades: completedTrades.length,

    openLongTrades: openTrades.filter(
      (trade) => trade.direction === "long"
    ).length,

    openShortTrades: openTrades.filter(
      (trade) => trade.direction === "short"
    ).length,

    completedLongTrades: completedTrades.filter(
      (trade) => trade.direction === "long"
    ).length,

    completedShortTrades: completedTrades.filter(
      (trade) => trade.direction === "short"
    ).length,

    winners: completedTrades.filter(
      (trade) => (trade.realisedPnlUsd ?? 0) > 0
    ).length,

    losers: completedTrades.filter(
      (trade) => (trade.realisedPnlUsd ?? 0) < 0
    ).length,

    targetHits,
    secondaryTargetHits,

    targetHitRatePct: completedTrades.length
      ? (targetHits / completedTrades.length) * 100
      : null,

    realisedPnlUsd: realised.reduce(
      (sum, value) => sum + value,
      0
    ),

    unrealisedPnlUsd: unrealised.reduce(
      (sum, value) => sum + value,
      0
    ),

    combinedPnlUsd: [...realised, ...unrealised].reduce(
      (sum, value) => sum + value,
      0
    ),

    averagePnlUsd: average(realised),
    averagePnlPct: average(realisedPct),
    averageHoldMinutes: average(holds),

    largestWinnerUsd: realised.length
      ? Math.max(...realised)
      : null,

    largestLoserUsd: realised.length
      ? Math.min(...realised)
      : null,
  };

  const versions = [
    rules.version,
    ...new Set(
      trades
        .map((trade) => trade.strategyVersion)
        .filter((version) => version !== rules.version)
    ),
  ];

  /**
   * Current V5 version:
   *   - Always show all four active V5 strategies.
   *   - Only show legacy strategies if trades actually exist.
   *
   * Historical versions:
   *   - Only show strategy/direction combinations that actually
   *     contain trades.
   */
  const strategyPerformance: PaperStrategyPerformance[] =
    versions.flatMap((version) => {
      const isCurrentVersion =
        version === rules.version;

      const v5Rows = ACTIVE_V5_STRATEGIES.map(
        ({ strategyType, direction }) =>
          buildStrategyPerformance(
            trades,
            strategyType,
            direction,
            version
          )
      );

      const legacyRows = LEGACY_STRATEGIES.map(
        ({ strategyType, direction }) =>
          buildStrategyPerformance(
            trades,
            strategyType,
            direction,
            version
          )
      );

      if (isCurrentVersion) {
        return [
          ...v5Rows,

          // These should normally disappear once the corrupted V5
          // convergence records are cleaned up.
          ...legacyRows.filter(
            (row) =>
              row.openTrades > 0 ||
              row.completedTrades > 0
          ),
        ];
      }

      return [...v5Rows, ...legacyRows].filter(
        (row) =>
          row.openTrades > 0 ||
          row.completedTrades > 0
      );
    });

  const allResearch = researchObservations
    .filter(
      (row) =>
        row.strategyVersion === rules.version
    )
    .flatMap(
      (row) => row.researchCandidates ?? []
    );

  const groupKeys = new Set(
    allResearch.map(
      (candidate) =>
        `${candidate.kind}:${candidate.direction}`
    )
  );

  const researchPerformance: PaperResearchGroup[] =
    Array.from(groupKeys)
      .map((key) => {
        const [kind, direction] = key.split(
          ":"
        ) as [
          PaperCandidateOutcome["kind"],
          PaperCandidateOutcome["direction"]
        ];

        const matching = allResearch.filter(
          (candidate) =>
            candidate.kind === kind &&
            candidate.direction === direction
        );

        const complete = matching.filter(
          (candidate) =>
            candidate.status === "complete"
        );

        const terminals = complete
          .map(
            (candidate) =>
              candidate.terminalPct
          )
          .filter(
            (value): value is number =>
              value !== null
          );

        return {
          kind,
          direction,
          tracked: matching.length,
          complete: complete.length,

          hit1Pct: complete.filter(
            (candidate) =>
              candidate.firstTargetAt !== null
          ).length,

          hit12Pct: complete.filter(
            (candidate) =>
              candidate.secondaryTargetAt !== null
          ).length,

          targetFirst: complete.filter(
            (candidate) =>
              candidate.firstTouch === "target"
          ).length,

          stoppedFirst: complete.filter(
            (candidate) =>
              candidate.firstTouch === "stop"
          ).length,

          averageTerminalPct:
            average(terminals),

          measured24h: matching.filter(
            (candidate) =>
              candidate.at24hPct !== null &&
              candidate.at24hPct !== undefined
          ).length,

          measured48h: matching.filter(
            (candidate) =>
              candidate.at48hPct !== null &&
              candidate.at48hPct !== undefined
          ).length,

          targetBy24h: matching.filter(
            (candidate) =>
              candidate.targetBy24h === true
          ).length,

          targetBy48h: matching.filter(
            (candidate) =>
              candidate.targetBy48h === true
          ).length,

          stopBy24h: matching.filter(
            (candidate) =>
              candidate.stopBy24h === true
          ).length,

          stopBy48h: matching.filter(
            (candidate) =>
              candidate.stopBy48h === true
          ).length,

          average24hPct: average(
            matching
              .map(
                (candidate) =>
                  candidate.at24hPct
              )
              .filter(
                (value): value is number =>
                  value !== null &&
                  value !== undefined
              )
          ),

          average48hPct: average(
            matching
              .map(
                (candidate) =>
                  candidate.at48hPct
              )
              .filter(
                (value): value is number =>
                  value !== null &&
                  value !== undefined
              )
          ),
        };
      })
      .sort(
        (a, b) =>
          b.tracked - a.tracked
      );

  return {
    generatedAt: Date.now(),
    rules,
    summary,
    strategyPerformance,
    researchPerformance,
    dailyIssuerRanges,

    latestObservations:
      latestObservations.filter(
        (row) =>
          row.strategyVersion === rules.version
      ),

    discoveryObservations:
      discoveryObservations.filter(
        (row) =>
          row.strategyVersion === rules.version
      ),

    openTrades,

    completedTrades:
      completedTrades.slice(0, 250),
  };
}
