import { randomUUID } from "crypto";

import {
  gapPct,
  executionGapPct,
  approxBreakEvenMovePct,
  divergenceAfterBreakEvenPct,
} from "@/lib/history/math";

import {
  readPaperObservations,
  appendPaperObservations,
  updatePaperCandidateOutcomes,
  readPaperTrades,
  writePaperTrades,
} from "@/lib/paperLab/storage";

import { getPaperStrategyRules } from "@/lib/paperLab/config";

import {
  fetchExactTokenBuyQuote,
  fetchExactTokenSellQuote,
} from "@/lib/paperLab/execution";

import type {
  HistoryExecutionQuote,
  HistorySnapshot,
} from "@/types/history";

import { readHistory } from "@/lib/history/storage";

import type {
  PaperCandidateOutcome,
  PaperExecutionSnapshot,
  PaperExperimentalFeatures,
  PaperExperimentalSignalState,
  PaperLabObservation,
  PaperMomentumFeatures,
  PaperSignalStatus,
  PaperStrategyType,
  PaperTrade,
  PaperTradeDirection,
  PaperTradeMark,
} from "@/types/paperLab";

const ACTIVE_LONG_STRATEGIES: PaperStrategyType[] = [
  "extreme_momentum",
  "discount_recovery",
  "wrapper_lag",
  "drift_reversal",
];

/**
 * The history capture has already obtained Jupiter's $1,000 two-sided routes.
 * Never repeat those calls for observations.
 *
 * Older history that lacks exact token quantities can seed trend calculations,
 * but it must never create a backdated paper transaction.
 */
function quoteFromHistory(
  quote: HistoryExecutionQuote
): PaperExecutionSnapshot {
  return {
    status: quote.status,
    tokenAmount: quote.tokenAmount ?? null,
    usdcAmount: quote.usdcAmount ?? null,
    effectivePrice: quote.effectivePrice,
    priceImpactPct: quote.priceImpactPct,
    executionCostPct: quote.executionCostPct ?? null,
    routePlan: quote.routePlan ?? [],
  };
}

function emptyMomentumFeatures(): PaperMomentumFeatures {
  return {
    wrapperMidPrice: null,
    wrapperMove15mPct: null,
    wrapperMove1hPct: null,
    wrapperMove2hPct: null,
    benchmarkMove15mPct: null,
    benchmarkMove1hPct: null,
    benchmarkMove2hPct: null,
    wrapperPositiveSteps: 0,
    wrapperNegativeSteps: 0,
    benchmarkPositiveSteps: 0,
    benchmarkNegativeSteps: 0,
    trendStepsAvailable: 0,
    wrapperTrendStepsAvailable: 0,
  };
}

/**
 * Historic $1,000 observations bootstrap V5 trend calculations immediately.
 * They are synthetic observations only. They never create paper entries.
 */
function historyAsTrendObservations(
  history: HistorySnapshot[],
  ticker: string,
  notional: number,
  version: string,
  currentTimestamp: number
): PaperLabObservation[] {
  const rows: PaperLabObservation[] = [];

  for (const snap of history
    .filter(
      (item) =>
        item.timestamp < currentTimestamp &&
        item.canonicalSizeUsd === notional
    )
    .slice(-12)) {
    for (const issuer of snap.issuers) {
      rows.push({
        id: `history:${snap.timestamp}:${issuer.mint}`,
        version: 3,

        timestamp: snap.timestamp,
        capturedAt: snap.capturedAt,

        ticker,
        stockName: snap.stockName,
        refSymbol: snap.refSymbol,

        issuer: issuer.issuer,
        symbol: issuer.symbol,
        mint: issuer.mint,

        tokenDecimals: issuer.decimals ?? 0,
        shareMultiplier: issuer.shareMultiplier,

        marketOpen: snap.marketOpen,
        marketLabel: snap.marketLabel,

        benchmarkPrice: snap.benchmarkPrice,
        benchmarkTimestamp: snap.benchmarkTimestamp,

        liquidityUsd: issuer.liquidityUsd,
        notionalUsd: notional,

        buy: quoteFromHistory(issuer.buy),
        sell: quoteFromHistory(issuer.sell),

        buyGapPct: issuer.buyGapPct,
        sellGapPct: issuer.sellGapPct,
        executionGapPct: issuer.executionGapPct,
        approxBreakEvenMovePct: issuer.approxBreakEvenMovePct,

        longTheoreticalConvergencePct:
          issuer.divergenceAfterBreakEvenPct,
        shortTheoreticalConvergencePct: null,

        longRawEligible: false,
        longPersistentCaptures: 0,
        longSignalStatus: "no_setup",
        longSignalReasons: [],

        shortRawEligible: false,
        shortPersistentCaptures: 0,
        shortSignalStatus: "no_setup",
        shortSignalReasons: [],

        momentum: emptyMomentumFeatures(),

        momentumLongRawEligible: false,
        momentumLongPersistentCaptures: 0,
        momentumLongSignalStatus: "no_setup",
        momentumLongSignalReasons: [],

        momentumShortRawEligible: false,
        momentumShortPersistentCaptures: 0,
        momentumShortSignalStatus: "no_setup",
        momentumShortSignalReasons: [],

        strategyVersion: version,
      });
    }
  }

  return rows;
}

function startOfUtcDay(timestamp: number) {
  const d = new Date(timestamp);

  return Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate()
  );
}

/**
 * Convert a timestamp to New York weekday/time without hard-coding EST/EDT.
 * Intl handles daylight-saving transitions for America/New_York.
 */
function newYorkClock(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp));

  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? null;

  const hour = Number(partValue("hour"));
  const minute = Number(partValue("minute"));
  const weekday = partValue("weekday");

  return {
    weekday,
    minutes:
      Number.isFinite(hour) && Number.isFinite(minute)
        ? hour * 60 + minute
        : null,
    isWeekday: weekday !== "Sat" && weekday !== "Sun",
  };
}

function midPrice(
  row: Pick<PaperLabObservation, "buy" | "sell">
) {
  const buy = row.buy?.effectivePrice;
  const sell = row.sell?.effectivePrice;

  if (
    buy === null ||
    buy === undefined ||
    sell === null ||
    sell === undefined
  ) {
    return null;
  }

  if (
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0 ||
    sell <= 0
  ) {
    return null;
  }

  return (buy + sell) / 2;
}

function pctChange(
  current: number | null,
  previous: number | null
) {
  if (
    current === null ||
    previous === null ||
    previous <= 0
  ) {
    return null;
  }

  return ((current / previous) - 1) * 100;
}

function previousIssuerRows(
  previous: PaperLabObservation[],
  mint: string
) {
  return previous
    .filter((row) => row.mint === mint)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function valueAtCapture<T>(
  rows: T[],
  capturesBack: number,
  value: (row: T) => number | null
) {
  const row = rows[capturesBack - 1];
  return row ? value(row) : null;
}

function directionalSteps(
  current: number | null,
  rows: PaperLabObservation[],
  steps: number,
  value: (row: PaperLabObservation) => number | null
) {
  const sequence: Array<number | null> = [current];

  for (let i = 0; i < steps; i += 1) {
    sequence.push(rows[i] ? value(rows[i]) : null);
  }

  let positive = 0;
  let negative = 0;
  let available = 0;

  for (let i = 0; i < steps; i += 1) {
    const newer = sequence[i];
    const older = sequence[i + 1];

    if (newer === null || older === null) continue;

    available += 1;

    if (newer > older) positive += 1;
    if (newer < older) negative += 1;
  }

  return {
    positive,
    negative,
    available,
  };
}

function buildMomentumFeatures(
  currentMid: number | null,
  benchmarkPrice: number | null,
  previousRows: PaperLabObservation[],
  trendSteps: number
): PaperMomentumFeatures {
  const previousMid = (row: PaperLabObservation) =>
    midPrice(row);

  const previousBenchmark = (
    row: PaperLabObservation
  ) => row.benchmarkPrice;

  const wrapperSteps = directionalSteps(
    currentMid,
    previousRows,
    trendSteps,
    previousMid
  );

  const benchmarkSteps = directionalSteps(
    benchmarkPrice,
    previousRows,
    trendSteps,
    previousBenchmark
  );

  return {
    wrapperMidPrice: currentMid,

    wrapperMove15mPct: pctChange(
      currentMid,
      valueAtCapture(previousRows, 1, previousMid)
    ),

    wrapperMove1hPct: pctChange(
      currentMid,
      valueAtCapture(previousRows, 4, previousMid)
    ),

    wrapperMove2hPct: pctChange(
      currentMid,
      valueAtCapture(previousRows, 8, previousMid)
    ),

    benchmarkMove15mPct: pctChange(
      benchmarkPrice,
      valueAtCapture(previousRows, 1, previousBenchmark)
    ),

    benchmarkMove1hPct: pctChange(
      benchmarkPrice,
      valueAtCapture(previousRows, 4, previousBenchmark)
    ),

    benchmarkMove2hPct: pctChange(
      benchmarkPrice,
      valueAtCapture(previousRows, 8, previousBenchmark)
    ),

    wrapperPositiveSteps: wrapperSteps.positive,
    wrapperNegativeSteps: wrapperSteps.negative,

    benchmarkPositiveSteps: benchmarkSteps.positive,
    benchmarkNegativeSteps: benchmarkSteps.negative,

    trendStepsAvailable: Math.min(
      wrapperSteps.available,
      benchmarkSteps.available
    ),

    wrapperTrendStepsAvailable:
      wrapperSteps.available,
  };
}

function shortTheoreticalConvergencePct(
  sellGap: number | null,
  breakEven: number | null
) {
  if (
    sellGap === null ||
    breakEven === null
  ) {
    return null;
  }

  const premium = Math.max(sellGap, 0);

  return Math.max(
    0,
    premium - Math.max(breakEven, 0)
  );
}

/**
 * Legacy convergence and momentum fields remain populated so old dashboards
 * and historical analysis keep working, but V5 never opens trades from them.
 */
function buildLegacyConvergenceState(params: {
  executableOk: boolean;
  benchmarkFresh: boolean;
  marketOk: boolean;
  liquidityOk: boolean;
  buyGap: number | null;
  longTheoretical: number | null;
  targetPct: number;
}) {
  const {
    executableOk,
    benchmarkFresh,
    marketOk,
    liquidityOk,
    buyGap,
    longTheoretical,
    targetPct,
  } = params;

  const discounted =
    buyGap !== null &&
    buyGap < 0;

  const enoughRoom =
    longTheoretical !== null &&
    longTheoretical >= targetPct;

  const rawEligible =
    executableOk &&
    benchmarkFresh &&
    marketOk &&
    liquidityOk &&
    discounted &&
    enoughRoom;

  const reasons: string[] = [];

  if (!executableOk) {
    reasons.push(
      "Executable $1,000 BUY and SELL routes are required."
    );
  }

  if (!benchmarkFresh) {
    reasons.push(
      "A current Wall Street reference price is required."
    );
  }

  if (!marketOk) {
    reasons.push(
      "Legacy convergence market-session restriction is enabled."
    );
  }

  if (!liquidityOk) {
    reasons.push(
      "Reported liquidity is below the research threshold."
    );
  }

  if (!discounted) {
    reasons.push(
      "The executable BUY is not below the Wall Street reference."
    );
  }

  if (!enoughRoom) {
    reasons.push(
      `The current long divergence does not leave ${targetPct.toFixed(
        2
      )}% of theoretical room after execution friction.`
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Legacy convergence research conditions are met; V5 does not open trades from this legacy signal."
    );
  }

  return {
    rawEligible,
    reasons,
  };
}

function buildLegacyMomentumState(params: {
  executableOk: boolean;
  marketOk: boolean;
  liquidityOk: boolean;
  breakEven: number | null;
  wrapperLookbackMove: number | null;
  recent30mMove: number | null;
  positiveSteps: number;
  stepsAvailable: number;
  minAlignedSteps: number;
  trendSteps: number;
  maxBreakEvenPct: number;
}) {
  const {
    executableOk,
    marketOk,
    liquidityOk,
    breakEven,
    wrapperLookbackMove,
    recent30mMove,
    positiveSteps,
    stepsAvailable,
    minAlignedSteps,
    trendSteps,
    maxBreakEvenPct,
  } = params;

  const dataReady =
    wrapperLookbackMove !== null &&
    stepsAvailable >= trendSteps;

  const frictionOk =
    breakEven !== null &&
    breakEven >= 0 &&
    breakEven <= maxBreakEvenPct;

  const minMovePct = Math.max(
    0.25,
    (breakEven ?? 0) * 1.5
  );

  const trendOk =
    dataReady &&
    wrapperLookbackMove !== null &&
    wrapperLookbackMove >= minMovePct &&
    recent30mMove !== null &&
    recent30mMove > 0;

  const stepsOk =
    positiveSteps >= minAlignedSteps;

  const rawEligible =
    executableOk &&
    marketOk &&
    liquidityOk &&
    dataReady &&
    trendOk &&
    stepsOk &&
    frictionOk;

  const reasons: string[] = [];

  if (!executableOk) {
    reasons.push(
      "Executable $1,000 BUY and SELL routes are required."
    );
  }

  if (!marketOk) {
    reasons.push(
      "Legacy momentum market-session restriction is enabled."
    );
  }

  if (!liquidityOk) {
    reasons.push(
      "Reported liquidity is below the research threshold."
    );
  }

  if (!dataReady) {
    reasons.push(
      "More history is needed before the legacy momentum window can be evaluated."
    );
  }

  if (dataReady && !trendOk) {
    reasons.push(
      `Legacy entry requires at least +${minMovePct.toFixed(
        3
      )}% over its lookback and a rising 30-minute trend.`
    );
  }

  if (!stepsOk) {
    reasons.push(
      `Legacy wrapper trend has fewer than ${minAlignedSteps} rising steps in the last ${trendSteps} moves.`
    );
  }

  if (!frictionOk) {
    reasons.push(
      `Legacy quoted break-even friction is above ${maxBreakEvenPct.toFixed(
        2
      )}%.`
    );
  }

  if (!reasons.length) {
    reasons.push(
      "Legacy momentum research conditions are met; V5 does not open trades from this legacy signal."
    );
  }

  return {
    rawEligible,
    reasons,
  };
}


function legacyObservationEligible(
  row: PaperLabObservation,
  strategyType: "convergence" | "momentum"
) {
  return strategyType === "momentum"
    ? row.momentumLongRawEligible
    : row.longRawEligible;
}

function legacyConsecutiveEligible(
  previous: PaperLabObservation[],
  mint: string,
  strategyType: "convergence" | "momentum",
  currentEligible: boolean,
  strategyVersion: string
) {
  if (!currentEligible) return 0;

  let count = 1;

  const rows = previous
    .filter((row) => row.mint === mint && row.strategyVersion === strategyVersion)
    .sort((a, b) => b.timestamp - a.timestamp);

  for (const row of rows) {
    if (!legacyObservationEligible(row, strategyType)) break;
    count += 1;
  }

  return count;
}

function signalStatus(
  rawEligible: boolean,
  blocked: boolean,
  capReached: boolean
): PaperSignalStatus {
  if (!rawEligible) return "no_setup";
  if (blocked || capReached) return "watch";
  return "candidate";
}

/**
 * Same strategy + same mint is blocked while open and during cooldown.
 *
 * Different issuers of the same underlying are deliberately independent.
 * Different strategies on the same mint are deliberately independent too.
 */
function recentTradeBlocksEntry(
  trades: PaperTrade[],
  mint: string,
  timestamp: number,
  cooldownHours: number,
  direction: PaperTradeDirection,
  strategyType: PaperStrategyType,
  strategyVersion: string
) {
  const cooldownMs =
    cooldownHours * 60 * 60 * 1000;

  return trades.some((trade) => {
    if (trade.mint !== mint) return false;
    if (trade.direction !== direction) return false;
    if (trade.strategyType !== strategyType) return false;

    // Never duplicate an already-open position for this strategy + token.
    if (trade.status === "open") {
      return true;
    }

    // Closed trades from the current experiment version observe cooldown.
    if (trade.strategyVersion !== strategyVersion) {
      return false;
    }

    return (
      timestamp - trade.openedAt <
      cooldownMs
    );
  });
}

function dailyTradeCount(
  trades: PaperTrade[],
  timestamp: number,
  direction: PaperTradeDirection,
  strategyVersion: string,
  strategyType: PaperStrategyType
) {
  const start = startOfUtcDay(timestamp);
  const end =
    start + 24 * 60 * 60 * 1000;

  return trades.filter(
    (trade) =>
      trade.strategyVersion ===
        strategyVersion &&
      trade.strategyType ===
        strategyType &&
      trade.direction === direction &&
      trade.openedAt >= start &&
      trade.openedAt < end
  ).length;
}

function buildExperimentalSignal(
  params: {
    label: string;
    rawEligible: boolean;
    executableOk: boolean;
    liquidityOk: boolean;
    benchmarkAvailable?: boolean;
    dataReady?: boolean;
    conditionReasons: string[];
    blocked: boolean;
    capReached: boolean;
  }
): PaperExperimentalSignalState {
  const {
    label,
    rawEligible,
    executableOk,
    liquidityOk,
    benchmarkAvailable,
    dataReady,
    conditionReasons,
    blocked,
    capReached,
  } = params;

  const reasons: string[] = [];

  if (!executableOk) {
    reasons.push(
      "Executable $1,000 BUY and SELL routes, including token quantities, are required."
    );
  }

  if (!liquidityOk) {
    reasons.push(
      "Reported liquidity is below the research threshold."
    );
  }

  if (
    benchmarkAvailable === false
  ) {
    reasons.push(
      "A reference-stock price is required for this strategy."
    );
  }

  if (dataReady === false) {
    reasons.push(
      "More historical captures are required before this strategy can be evaluated."
    );
  }

  reasons.push(...conditionReasons);

  if (rawEligible && blocked) {
    reasons.push(
      `${label}: this token is already open or still inside its strategy-specific cooldown.`
    );
  }

  if (rawEligible && capReached) {
    reasons.push(
      `${label}: the strategy has reached its daily long-entry cap.`
    );
  }

  if (!reasons.length) {
    reasons.push(
      `${label}: all V5 research entry conditions are met.`
    );
  }

  return {
    rawEligible,
    signalStatus: signalStatus(
      rawEligible,
      blocked,
      capReached
    ),
    signalReasons: reasons,
  };
}

function createTrade(
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection,
  observation: PaperLabObservation,
  rules: ReturnType<
    typeof getPaperStrategyRules
  >
): PaperTrade | null {
  const sourceQuote =
    direction === "long"
      ? observation.buy
      : observation.sell;

  const tokenAmount =
    sourceQuote.tokenAmount;

  const entryCostUsd =
    sourceQuote.usdcAmount;

  if (
    !tokenAmount ||
    tokenAmount <= 0 ||
    !entryCostUsd ||
    entryCostUsd <= 0
  ) {
    return null;
  }

  const experimental =
    observation.experimental;

  return {
    version: 3,
    id: randomUUID(),

    strategyType,
    direction,
    status: "open",

    strategyVersion: rules.version,
    strategyRules: {
      ...rules,
    },

    ticker: observation.ticker,
    stockName: observation.stockName,
    refSymbol: observation.refSymbol,

    issuer: observation.issuer,
    symbol: observation.symbol,
    mint: observation.mint,

    tokenDecimals:
      observation.tokenDecimals,

    shareMultiplier:
      observation.shareMultiplier,

    openedAt: observation.timestamp,
    openedAtIso: observation.capturedAt,

    closedAt: null,
    closedAtIso: null,
    exitReason: null,

    entryObservationId: observation.id,
    entryCostUsd,
    tokenAmount,

    shareEquivalentAmount:
      tokenAmount *
      observation.shareMultiplier,

    entryEffectivePrice:
      sourceQuote.effectivePrice,

    entryBenchmarkPrice:
      observation.benchmarkPrice,

    entryBuyGapPct:
      observation.buyGapPct,

    entrySellGapPct:
      observation.sellGapPct,

    entryExecutionGapPct:
      observation.executionGapPct,

    entryBreakEvenPct:
      observation.approxBreakEvenMovePct,

    entryTheoreticalConvergencePct:
      direction === "long"
        ? observation.longTheoreticalConvergencePct
        : observation.shortTheoreticalConvergencePct,

    entryLiquidityUsd:
      observation.liquidityUsd,

    entryMarketOpen:
      observation.marketOpen,

    /**
     * Store momentum for all V5 strategies, not just the old momentum type,
     * because it is valuable diagnostic material for the next analysis.
     */
    entryMomentum: {
      ...observation.momentum,
    },

    entryWrapperMove1hPct:
      observation.momentum.wrapperMove1hPct,

    entryWrapperMove2hPct:
      observation.momentum.wrapperMove2hPct,

    entryBenchmarkMove1hPct:
      observation.momentum.benchmarkMove1hPct,

    entryWrapperLag1hPct:
      experimental?.wrapperLag1hPct ??
      null,

    entryGap1hAgoPct:
      experimental?.buyGap1hAgoPct ??
      null,

    entryGapNarrowing1hPct:
      experimental?.gapNarrowing1hPct ??
      null,

    currentExitUsd: null,
    currentPnlUsd: null,
    currentPnlPct: null,

    maxExitUsd: null,
    minExitUsd: null,
    maxFavourablePct: null,
    maxAdversePct: null,

    realisedExitUsd: null,
    realisedPnlUsd: null,
    realisedPnlPct: null,

    marks: [],
  };
}

/**
 * Candidate log is uncapped and independent of paper-trade limits.
 * These use standard stored $1,000 effective prices as research proxies,
 * not exact-quantity executed exits.
 */
function makeResearchCandidates(
  time: number,
  buy: PaperExecutionSnapshot,
  sell: PaperExecutionSnapshot,
  move30m: number | null,
  move1h: number | null,
  gapCross:
    | "negative_to_positive"
    | "positive_to_negative"
    | null,
  legacyGapNarrowing: boolean,
  currentGap: number | null,
  gapIsFresh: boolean,
  wrapperTurn: "up" | "down" | null,
  experimentalKinds: PaperCandidateOutcome["kind"][] = []
): PaperCandidateOutcome[] {
  const candidates: PaperCandidateOutcome[] =
    [];

  const add = (
    kind: PaperCandidateOutcome["kind"],
    direction: PaperTradeDirection
  ) => {
    const entry =
      direction === "long"
        ? buy.effectivePrice
        : sell.effectivePrice;

    if (
      entry === null ||
      !Number.isFinite(entry) ||
      entry <= 0
    ) {
      return;
    }

    if (
      buy.status !== "ok" ||
      sell.status !== "ok"
    ) {
      return;
    }

    candidates.push({
      kind,
      direction,
      enteredAt: time,
      entryEffectivePrice: entry,

      firstTargetPct: null,
      firstTargetAt: null,
      secondaryTargetAt: null,
      firstStopAt: null,
      firstTouch: null,

      maxFavourablePct: null,
      maxAdversePct: null,
      terminalPct: null,

      lastSeenAt: time,
      status: "tracking",

      at4hPct: null,
      at24hPct: null,
      at48hPct: null,

      targetBy24h: null,
      targetBy48h: null,
      stopBy24h: null,
      stopBy48h: null,
    });
  };

  // Preserve the existing research-only candidate families.
  if (
    move30m !== null &&
    move1h !== null
  ) {
    if (
      move30m > 0 &&
      move1h > 0
    ) {
      add(
        "sustained_momentum",
        "long"
      );
    }
  }

  if (
    gapIsFresh &&
    gapCross
  ) {
    add(
      "gap_cross",
      gapCross ===
        "positive_to_negative"
        ? "long"
        : "short"
    );
  }

  if (
    gapIsFresh &&
    legacyGapNarrowing &&
    currentGap !== null
  ) {
    add(
      "gap_narrowing",
      currentGap < 0
        ? "long"
        : "short"
    );
  }

  if (wrapperTurn === "up") {
    add(
      "wrapper_turn",
      "long"
    );
  }

  for (const kind of experimentalKinds) {
    add(kind, "long");
  }

  // V5 research is long-only. Old stored short candidates remain untouched.
  return candidates.filter(
    (candidate) =>
      candidate.direction === "long"
  );
}

function updateResearchOutcomes(
  previous: PaperLabObservation[],
  current: PaperLabObservation[],
  timestamp: number
): Map<
  string,
  PaperCandidateOutcome[]
> {
  const updates = new Map<
    string,
    PaperCandidateOutcome[]
  >();

  const currentByMint = new Map(
    current.map((row) => [
      row.mint,
      row,
    ])
  );

  const horizonMs =
    48 * 60 * 60 * 1000;

  const checkpoint4 =
    4 * 60 * 60 * 1000;

  const checkpoint24 =
    24 * 60 * 60 * 1000;

  for (const previousRow of previous) {
    if (
      !previousRow.researchCandidates?.some(
        (candidate) =>
          candidate.status === "tracking"
      )
    ) {
      continue;
    }

    if (
      previousRow.timestamp >= timestamp
    ) {
      continue;
    }

    const next =
      currentByMint.get(
        previousRow.mint
      );

    const elapsed =
      timestamp - previousRow.timestamp;

    const updated =
      previousRow.researchCandidates.map(
        (candidate) => {
          if (
            candidate.status !==
            "tracking"
          ) {
            return candidate;
          }

          const exit =
            next &&
            (candidate.direction ===
            "long"
              ? next.sell
              : next.buy);

          const exitPrice =
            exit?.status === "ok"
              ? exit.effectivePrice
              : null;

          const outcome = {
            ...candidate,
          };

          if (
            exitPrice !== null &&
            exitPrice !== undefined &&
            Number.isFinite(exitPrice) &&
            exitPrice > 0
          ) {
            const pct =
              candidate.direction ===
              "long"
                ? (exitPrice /
                    candidate.entryEffectivePrice -
                    1) *
                  100
                : (1 -
                    exitPrice /
                      candidate.entryEffectivePrice) *
                  100;

            outcome.maxFavourablePct =
              outcome.maxFavourablePct ===
              null
                ? pct
                : Math.max(
                    outcome.maxFavourablePct,
                    pct
                  );

            outcome.maxAdversePct =
              outcome.maxAdversePct === null
                ? pct
                : Math.min(
                    outcome.maxAdversePct,
                    pct
                  );

            outcome.terminalPct = pct;
            outcome.lastSeenAt =
              timestamp;

            if (
              elapsed >= checkpoint4 &&
              outcome.at4hPct == null
            ) {
              outcome.at4hPct = pct;
            }

            if (
              elapsed >= checkpoint24 &&
              outcome.at24hPct == null
            ) {
              outcome.at24hPct = pct;

              outcome.targetBy24h =
                outcome.firstTargetAt !==
                  null || pct >= 1;

              outcome.stopBy24h =
                outcome.firstStopAt !==
                  null || pct <= -1;
            }

            if (
              elapsed >= horizonMs &&
              outcome.at48hPct == null
            ) {
              outcome.at48hPct = pct;

              outcome.targetBy48h =
                outcome.firstTargetAt !==
                  null || pct >= 1;

              outcome.stopBy48h =
                outcome.firstStopAt !==
                  null || pct <= -1;
            }

            if (
              pct >= 1 &&
              outcome.firstTargetAt ===
                null
            ) {
              outcome.firstTargetAt =
                timestamp;

              outcome.firstTargetPct = 1;
            }

            if (
              pct >= 1.2 &&
              outcome.secondaryTargetAt ===
                null
            ) {
              outcome.secondaryTargetAt =
                timestamp;
            }

            if (
              pct <= -1 &&
              outcome.firstStopAt === null
            ) {
              outcome.firstStopAt =
                timestamp;
            }

            if (
              outcome.firstTouch === null
            ) {
              if (pct >= 1) {
                outcome.firstTouch =
                  "target";
              } else if (pct <= -1) {
                outcome.firstTouch =
                  "stop";
              }
            }
          }

          if (
            elapsed >= horizonMs &&
            outcome.at48hPct !== null &&
            outcome.at48hPct !==
              undefined
          ) {
            outcome.status = "complete";
          }

          return outcome;
        }
      );

    updates.set(
      previousRow.id,
      updated
    );
  }

  return updates;
}

function strategySignalFromObservation(
  observation: PaperLabObservation,
  strategyType: PaperStrategyType
): PaperExperimentalSignalState | null {
  const experimental =
    observation.experimental;

  if (!experimental) return null;

  if (
    strategyType ===
    "extreme_momentum"
  ) {
    return experimental.extremeMomentum;
  }

  if (
    strategyType ===
    "discount_recovery"
  ) {
    return experimental.discountRecovery;
  }

  if (
    strategyType === "wrapper_lag"
  ) {
    return experimental.wrapperLag;
  }

  if (
    strategyType === "drift_reversal"
  ) {
    return experimental.driftReversal;
  }

  return null;
}

// Serialize read/decide/write across tickers in this process.
let labCaptureQueue: Promise<unknown> =
  Promise.resolve();

export function capturePaperLabForSnapshot(
  snapshot: HistorySnapshot
): Promise<PaperLabObservation[]> {
  const task =
    labCaptureQueue.then(() =>
      capturePaperLabForSnapshotSerial(
        snapshot
      )
    );

  labCaptureQueue =
    task.catch(() => undefined);

  return task;
}

async function capturePaperLabForSnapshotSerial(
  snapshot: HistorySnapshot
) {
  const rules =
    getPaperStrategyRules();

  if (
    Math.abs(
      rules.notionalUsd -
        snapshot.canonicalSizeUsd
    ) > 0.000001
  ) {
    throw new Error(
      `Paper notional $${rules.notionalUsd} disagrees with history quote $${snapshot.canonicalSizeUsd}. Set PAPER_TRADE_NOTIONAL_USD=${snapshot.canonicalSizeUsd}.`
    );
  }

  const oldLabObservations =
    await readPaperObservations(
      snapshot.ticker
    );

  const historical =
    await readHistory(
      snapshot.ticker
    );

  const currentVersionObservations =
    oldLabObservations.filter(
      (row) =>
        row.strategyVersion ===
          rules.version &&
        row.notionalUsd ===
          rules.notionalUsd
    );

  const bootstrap =
    historyAsTrendObservations(
      historical,
      snapshot.ticker,
      rules.notionalUsd,
      rules.version,
      snapshot.timestamp
    );

  const existingKeys = new Set(
    currentVersionObservations.map(
      (row) =>
        `${row.timestamp}:${row.mint}`
    )
  );

  const previous = [
    ...bootstrap.filter(
      (row) =>
        !existingKeys.has(
          `${row.timestamp}:${row.mint}`
        )
    ),
    ...currentVersionObservations,
  ].sort(
    (a, b) =>
      a.timestamp - b.timestamp
  );

  const trades =
    await readPaperTrades();

  /**
   * Retried capture:
   * never create a second observation/trade set for the same ticker timestamp.
   */
  if (
    currentVersionObservations.some(
      (row) =>
        row.timestamp ===
        snapshot.timestamp
    )
  ) {
    return [];
  }

  const newRows: PaperLabObservation[] =
    [];

  /**
   * IMPORTANT:
   * each active strategy gets its OWN six-per-day counter.
   */
  const mutableLongCounts =
    new Map<PaperStrategyType, number>();

  for (const strategyType of ACTIVE_LONG_STRATEGIES) {
    mutableLongCounts.set(
      strategyType,
      dailyTradeCount(
        trades,
        snapshot.timestamp,
        "long",
        rules.version,
        strategyType
      )
    );
  }

  for (const issuerRow of snapshot.issuers) {
    const decimals =
      issuerRow.decimals;

    if (
      decimals === undefined ||
      decimals === null
    ) {
      continue;
    }

    const buyQuote =
      quoteFromHistory(
        issuerRow.buy
      );

    const sellQuote =
      quoteFromHistory(
        issuerRow.sell
      );

    const buyGap = gapPct(
      buyQuote.effectivePrice,
      snapshot.benchmarkPrice
    );

    const sellGap = gapPct(
      sellQuote.effectivePrice,
      snapshot.benchmarkPrice
    );

    const executionGap =
      executionGapPct(
        buyQuote.effectivePrice,
        sellQuote.effectivePrice
      );

    const breakEven =
      approxBreakEvenMovePct(
        buyQuote.effectivePrice,
        sellQuote.effectivePrice
      );

    const longTheoretical =
      divergenceAfterBreakEvenPct(
        buyGap,
        breakEven
      );

    const shortTheoretical =
      shortTheoreticalConvergencePct(
        sellGap,
        breakEven
      );

    const quoteOk =
      buyQuote.status === "ok" &&
      sellQuote.status === "ok" &&
      buyQuote.effectivePrice !== null &&
      buyQuote.effectivePrice > 0 &&
      sellQuote.effectivePrice !== null &&
      sellQuote.effectivePrice > 0 &&
      buyQuote.tokenAmount !== null &&
      buyQuote.tokenAmount > 0 &&
      sellQuote.tokenAmount !== null &&
      sellQuote.tokenAmount > 0 &&
      buyQuote.usdcAmount !== null &&
      buyQuote.usdcAmount > 0 &&
      sellQuote.usdcAmount !== null &&
      sellQuote.usdcAmount > 0;

    const quoteImpactOk = [
      buyQuote.priceImpactPct,
      sellQuote.priceImpactPct,
    ].every(
      (impact) =>
        impact !== null &&
        Number.isFinite(impact) &&
        Math.abs(impact) <=
          (rules.maxQuoteImpactPct ??
            1)
    );

    const executableOk =
      quoteOk && quoteImpactOk;

    /**
     * "Fresh" is retained only for legacy convergence/discovery research.
     * The V5 backtested benchmark-relative strategies require a benchmark
     * value and lookback, but do not force regular-session-only entries.
     */
    const benchmarkAvailable =
      snapshot.benchmarkPrice !==
        null &&
      snapshot.benchmarkPrice > 0;

    const benchmarkFresh =
      benchmarkAvailable &&
      snapshot.benchmarkTimestamp !==
        null &&
      snapshot.benchmarkTimestamp <=
        snapshot.timestamp + 60_000 &&
      snapshot.timestamp -
        snapshot.benchmarkTimestamp <=
        30 * 60_000;

    const convergenceMarketOk =
      !rules.requireMarketOpenForEntries ||
      snapshot.marketOpen;

    const legacyMomentumMarketOk =
      !rules.momentumRequireMarketOpen ||
      snapshot.marketOpen;

    const liquidityOk =
      issuerRow.liquidityUsd !==
        null &&
      issuerRow.liquidityUsd >=
        rules.minLiquidityUsd;

    const issuerPrevious =
      previousIssuerRows(
        previous,
        issuerRow.mint
      );

    const currentMid =
      buyQuote.effectivePrice !==
        null &&
      sellQuote.effectivePrice !==
        null
        ? (buyQuote.effectivePrice +
            sellQuote.effectivePrice) /
          2
        : null;

    const momentum =
      buildMomentumFeatures(
        currentMid,
        snapshot.benchmarkPrice,
        issuerPrevious,
        rules.momentumTrendSteps
      );

    const recent30mMove =
      pctChange(
        currentMid,
        valueAtCapture(
          issuerPrevious,
          2,
          (row) => midPrice(row)
        )
      );

    const legacyLookbackPrice =
      valueAtCapture(
        issuerPrevious,
        rules.momentumLookbackCaptures,
        (row) => midPrice(row)
      );

    const legacyWrapperLookbackMove =
      pctChange(
        currentMid,
        legacyLookbackPrice
      );

    const legacyConvergence =
      buildLegacyConvergenceState({
        executableOk,
        benchmarkFresh,
        marketOk:
          convergenceMarketOk,
        liquidityOk,
        buyGap,
        longTheoretical,
        targetPct: rules.targetPct,
      });

    const legacyMomentum =
      buildLegacyMomentumState({
        executableOk,
        marketOk:
          legacyMomentumMarketOk,
        liquidityOk,
        breakEven,
        wrapperLookbackMove:
          legacyWrapperLookbackMove,
        recent30mMove,
        positiveSteps:
          momentum.wrapperPositiveSteps,
        stepsAvailable:
          momentum.wrapperTrendStepsAvailable,
        minAlignedSteps:
          rules.momentumMinAlignedSteps,
        trendSteps:
          rules.momentumTrendSteps,
        maxBreakEvenPct:
          rules.momentumMaxBreakEvenPct,
      });

    const legacyConvergencePersistent =
      legacyConsecutiveEligible(
        currentVersionObservations,
        issuerRow.mint,
        "convergence",
        legacyConvergence.rawEligible,
        rules.version
      );

    const legacyMomentumPersistent =
      legacyConsecutiveEligible(
        currentVersionObservations,
        issuerRow.mint,
        "momentum",
        legacyMomentum.rawEligible,
        rules.version
      );

    /**
     * V5 features.
     */
    const buyGap1hAgoPct =
      valueAtCapture(
        issuerPrevious,
        4,
        (row) => row.buyGapPct
      );

    /**
     * For Discount Recovery we care specifically about a NEGATIVE gap
     * becoming less negative.
     *
     * Example:
     *   1h ago = -2.0
     *   now    = -1.1
     *   narrowing = +0.9 percentage points
     */
    const gapNarrowing1hPct =
      buyGap !== null &&
      buyGap1hAgoPct !== null &&
      buyGap1hAgoPct < 0 &&
      buyGap < 0
        ? buyGap - buyGap1hAgoPct
        : null;

    const wrapperLag1hPct =
      momentum.wrapperMove1hPct !==
        null &&
      momentum.benchmarkMove1hPct !==
        null
        ? momentum.wrapperMove1hPct -
          momentum.benchmarkMove1hPct
        : null;

    /**
     * Strategy A — Extreme Momentum
     */
    const extremeDataReady =
      momentum.wrapperMove2hPct !==
      null;

    const extremeFrictionOk =
      breakEven !== null &&
      breakEven >= 0 &&
      breakEven <=
        rules.extremeMomentumMaxBreakEvenPct;

    const extremeMoveOk =
      momentum.wrapperMove2hPct !==
        null &&
      momentum.wrapperMove2hPct >=
        rules.extremeMomentumMin2hPct;

    const extremeRawEligible =
      executableOk &&
      liquidityOk &&
      extremeDataReady &&
      extremeFrictionOk &&
      extremeMoveOk;

    const extremeBlocked =
      recentTradeBlocksEntry(
        trades,
        issuerRow.mint,
        snapshot.timestamp,
        rules.cooldownHours,
        "long",
        "extreme_momentum",
        rules.version
      );

    const extremeCapReached =
      (mutableLongCounts.get(
        "extreme_momentum"
      ) ?? 0) >=
      rules.maxNewLongTradesPerDay;

    const extremeMomentum =
      buildExperimentalSignal({
        label: "Extreme Momentum",
        rawEligible:
          extremeRawEligible,
        executableOk,
        liquidityOk,
        dataReady: extremeDataReady,
        blocked: extremeBlocked,
        capReached:
          extremeCapReached,
        conditionReasons: [
          ...(!extremeMoveOk &&
          extremeDataReady
            ? [
                `2-hour wrapper move is below +${rules.extremeMomentumMin2hPct.toFixed(
                  2
                )}%.`,
              ]
            : []),

          ...(!extremeFrictionOk
            ? [
                `Break-even friction is above ${rules.extremeMomentumMaxBreakEvenPct.toFixed(
                  2
                )}%.`,
              ]
            : []),
        ],
      });

    /**
     * Strategy B — Discount Recovery
     */
    const discountDataReady =
      buyGap !== null &&
      buyGap1hAgoPct !== null &&
      gapNarrowing1hPct !== null;

    const discountGapOk =
      buyGap !== null &&
      buyGap <=
        rules.discountRecoveryMaxBuyGapPct;

    const discountNarrowingOk =
      gapNarrowing1hPct !== null &&
      gapNarrowing1hPct >=
        rules.discountRecoveryMinNarrowing1hPct;

    const discountFrictionOk =
      breakEven !== null &&
      breakEven >= 0 &&
      breakEven <=
        rules.discountRecoveryMaxBreakEvenPct;

    const discountRawEligible =
      executableOk &&
      liquidityOk &&
      benchmarkAvailable &&
      discountDataReady &&
      discountGapOk &&
      discountNarrowingOk &&
      discountFrictionOk;

    const discountBlocked =
      recentTradeBlocksEntry(
        trades,
        issuerRow.mint,
        snapshot.timestamp,
        rules.cooldownHours,
        "long",
        "discount_recovery",
        rules.version
      );

    const discountCapReached =
      (mutableLongCounts.get(
        "discount_recovery"
      ) ?? 0) >=
      rules.maxNewLongTradesPerDay;

    const discountRecovery =
      buildExperimentalSignal({
        label: "Discount Recovery",
        rawEligible:
          discountRawEligible,
        executableOk,
        liquidityOk,
        benchmarkAvailable,
        dataReady:
          discountDataReady,
        blocked: discountBlocked,
        capReached:
          discountCapReached,
        conditionReasons: [
          ...(!discountGapOk &&
          buyGap !== null
            ? [
                `Current BUY gap is not at or below ${rules.discountRecoveryMaxBuyGapPct.toFixed(
                  2
                )}%.`,
              ]
            : []),

          ...(!discountNarrowingOk &&
          gapNarrowing1hPct !== null
            ? [
                `Negative BUY gap has narrowed by less than ${rules.discountRecoveryMinNarrowing1hPct.toFixed(
                  2
                )} percentage points over ~1 hour.`,
              ]
            : []),

          ...(!discountFrictionOk
            ? [
                `Break-even friction is above ${rules.discountRecoveryMaxBreakEvenPct.toFixed(
                  2
                )}%.`,
              ]
            : []),
        ],
      });

    /**
     * Strategy C — Wrapper Lag
     */
    const lagDataReady =
      wrapperLag1hPct !== null;

    const lagConditionOk =
      wrapperLag1hPct !== null &&
      wrapperLag1hPct <=
        rules.wrapperLagMaxLag1hPct;

    const lagFrictionOk =
      breakEven !== null &&
      breakEven >= 0 &&
      breakEven <=
        rules.wrapperLagMaxBreakEvenPct;

    const wrapperLagRawEligible =
      executableOk &&
      liquidityOk &&
      benchmarkAvailable &&
      lagDataReady &&
      lagConditionOk &&
      lagFrictionOk;

    const wrapperLagBlocked =
      recentTradeBlocksEntry(
        trades,
        issuerRow.mint,
        snapshot.timestamp,
        rules.cooldownHours,
        "long",
        "wrapper_lag",
        rules.version
      );

    const wrapperLagCapReached =
      (mutableLongCounts.get(
        "wrapper_lag"
      ) ?? 0) >=
      rules.maxNewLongTradesPerDay;

    const wrapperLag =
      buildExperimentalSignal({
        label: "Wrapper Lag",
        rawEligible:
          wrapperLagRawEligible,
        executableOk,
        liquidityOk,
        benchmarkAvailable,
        dataReady: lagDataReady,
        blocked:
          wrapperLagBlocked,
        capReached:
          wrapperLagCapReached,
        conditionReasons: [
          ...(!lagConditionOk &&
          wrapperLag1hPct !== null
            ? [
                `1-hour wrapper-minus-benchmark return is not at or below ${rules.wrapperLagMaxLag1hPct.toFixed(
                  2
                )} percentage points.`,
              ]
            : []),

          ...(!lagFrictionOk
            ? [
                `Break-even friction is above ${rules.wrapperLagMaxBreakEvenPct.toFixed(
                  2
                )}%.`,
              ]
            : []),
        ],
      });

    /**
     * Strategy D — Pre-open Drift Reversal (LONG only).
     *
     * The benchmark is intentionally allowed to be stale here: that is the
     * hypothesis being tested. We compare the token BUY quote with the last
     * available stock reference during the pre-open window.
     *
     * No ticker whitelist is applied prospectively.
     */
    const nyClock = newYorkClock(snapshot.timestamp);

    const driftWindowOk =
      nyClock.isWeekday &&
      nyClock.minutes !== null &&
      nyClock.minutes >= rules.driftReversalStartMinutesEt &&
      nyClock.minutes <= rules.driftReversalEndMinutesEt &&
      !snapshot.marketOpen;

    const driftGapOk =
      buyGap !== null &&
      buyGap <= rules.driftReversalMaxBuyGapPct;

    const driftFrictionOk =
      breakEven !== null &&
      breakEven >= 0 &&
      breakEven <= rules.driftReversalMaxBreakEvenPct;

    const driftRawEligible =
      executableOk &&
      liquidityOk &&
      benchmarkAvailable &&
      driftWindowOk &&
      driftGapOk &&
      driftFrictionOk;

    const driftBlocked =
      recentTradeBlocksEntry(
        trades,
        issuerRow.mint,
        snapshot.timestamp,
        rules.cooldownHours,
        "long",
        "drift_reversal",
        rules.version
      );

    const driftCapReached =
      (mutableLongCounts.get("drift_reversal") ?? 0) >=
      rules.maxNewLongTradesPerDay;

    const driftReversal =
      buildExperimentalSignal({
        label: "Drift Reversal",
        rawEligible: driftRawEligible,
        executableOk,
        liquidityOk,
        benchmarkAvailable,
        dataReady: true,
        blocked: driftBlocked,
        capReached: driftCapReached,
        conditionReasons: [
          ...(!driftWindowOk
            ? [
                "Entry is outside the configured America/New_York pre-open research window.",
              ]
            : []),

          ...(!driftGapOk && buyGap !== null
            ? [
                `Current BUY gap is not at or below ${rules.driftReversalMaxBuyGapPct.toFixed(2)}% versus the last available stock reference.`,
              ]
            : []),

          ...(!driftFrictionOk
            ? [
                `Break-even friction is above ${rules.driftReversalMaxBreakEvenPct.toFixed(2)}%.`,
              ]
            : []),
        ],
      });

    const experimental: PaperExperimentalFeatures =
      {
        wrapperLag1hPct,
        buyGap1hAgoPct,
        gapNarrowing1hPct,

        extremeMomentum,
        discountRecovery,
        wrapperLag,
        driftReversal,
      };

    /**
     * Preserve discovery metadata from V4.
     */
    const priorRow =
      issuerPrevious[0];

    const priorGap =
      priorRow?.buyGapPct ?? null;

    const gapCross =
      buyGap === null ||
      priorGap === null
        ? null
        : priorGap <= 0 &&
          buyGap > 0
        ? ("negative_to_positive" as const)
        : priorGap >= 0 &&
          buyGap < 0
        ? ("positive_to_negative" as const)
        : null;

    const priorAbsGap =
      priorGap === null
        ? null
        : Math.abs(priorGap);

    const gapReversal =
      buyGap === null ||
      priorAbsGap === null
        ? null
        : priorAbsGap -
            Math.abs(buyGap) >=
          0.1
        ? ("toward_zero" as const)
        : Math.abs(buyGap) -
            priorAbsGap >=
          0.1
        ? ("away_from_zero" as const)
        : null;

    const oldMid =
      issuerPrevious[0]
        ? midPrice(
            issuerPrevious[0]
          )
        : null;

    const olderMid =
      issuerPrevious[1]
        ? midPrice(
            issuerPrevious[1]
          )
        : null;

    const wrapperTurn =
      currentMid === null ||
      oldMid === null ||
      olderMid === null
        ? null
        : oldMid < olderMid &&
          currentMid > oldMid
        ? ("up" as const)
        : oldMid > olderMid &&
          currentMid < oldMid
        ? ("down" as const)
        : null;

    const frictionChangePct =
      breakEven === null ||
      priorRow?.approxBreakEvenMovePct ==
        null
        ? null
        : breakEven -
          priorRow.approxBreakEvenMovePct;

    const gapReferenceFresh =
      snapshot.marketOpen &&
      benchmarkFresh;

    const discoveryEvents = [
      ...(gapCross
        ? [
            `${
              gapReferenceFresh
                ? "Gap"
                : "Apparent gap (stale reference)"
            } crossed ${
              gapCross ===
              "negative_to_positive"
                ? "above"
                : "below"
            } zero`,
          ]
        : []),

      ...(gapReversal ===
      "toward_zero"
        ? [
            gapReferenceFresh
              ? "Gap moved toward zero"
              : "Apparent gap narrowed (stale reference)",
          ]
        : []),

      ...(wrapperTurn
        ? [
            `On-chain wrapper reversed ${wrapperTurn}`,
          ]
        : []),

      ...(frictionChangePct !==
        null &&
      frictionChangePct < -0.1
        ? [
            "Round-trip friction improved >0.1 percentage points",
          ]
        : []),
    ];

    const experimentalKinds: PaperCandidateOutcome["kind"][] = [];

    if (extremeMomentum.rawEligible) {
      experimentalKinds.push("extreme_momentum");
    }

    if (discountRecovery.rawEligible) {
      experimentalKinds.push("discount_recovery");
    }

    if (wrapperLag.rawEligible) {
      experimentalKinds.push("wrapper_lag");
    }

    if (driftReversal.rawEligible) {
      experimentalKinds.push("drift_reversal");
    }

    const researchCandidates =
      makeResearchCandidates(
        snapshot.timestamp,
        buyQuote,
        sellQuote,
        recent30mMove,
        momentum.wrapperMove1hPct,
        gapCross,
        gapReversal ===
          "toward_zero",
        buyGap,
        gapReferenceFresh,
        wrapperTurn,
        experimentalKinds
      );

    const observation: PaperLabObservation =
      {
        version: 3,
        id: randomUUID(),

        timestamp:
          snapshot.timestamp,

        capturedAt:
          snapshot.capturedAt,

        ticker: snapshot.ticker,
        stockName:
          snapshot.stockName,
        refSymbol:
          snapshot.refSymbol,

        issuer: issuerRow.issuer,
        symbol: issuerRow.symbol,
        mint: issuerRow.mint,

        tokenDecimals: decimals,

        shareMultiplier:
          issuerRow.shareMultiplier,

        marketOpen:
          snapshot.marketOpen,

        marketLabel:
          snapshot.marketLabel,

        benchmarkPrice:
          snapshot.benchmarkPrice,

        benchmarkTimestamp:
          snapshot.benchmarkTimestamp,

        liquidityUsd:
          issuerRow.liquidityUsd,

        notionalUsd:
          rules.notionalUsd,

        buy: buyQuote,
        sell: sellQuote,

        buyGapPct: buyGap,
        sellGapPct: sellGap,

        executionGapPct:
          executionGap,

        approxBreakEvenMovePct:
          breakEven,

        longTheoreticalConvergencePct:
          longTheoretical,

        shortTheoreticalConvergencePct:
          shortTheoretical,

        // Legacy convergence research only.
        longRawEligible:
          legacyConvergence.rawEligible,

        longPersistentCaptures:
          legacyConvergencePersistent,

        longSignalStatus:
          legacyConvergence.rawEligible
            ? "watch"
            : "no_setup",

        longSignalReasons:
          legacyConvergence.reasons,

        shortRawEligible: false,
        shortPersistentCaptures: 0,
        shortSignalStatus:
          "no_setup",

        shortSignalReasons: [
          "V5 is long-only; no new convergence shorts are admitted.",
        ],

        // Legacy momentum research only.
        momentum,

        momentumLongRawEligible:
          legacyMomentum.rawEligible,

        momentumLongPersistentCaptures:
          legacyMomentumPersistent,

        momentumLongSignalStatus:
          legacyMomentum.rawEligible
            ? "watch"
            : "no_setup",

        momentumLongSignalReasons:
          legacyMomentum.reasons,

        momentumShortRawEligible:
          false,

        momentumShortPersistentCaptures:
          0,

        momentumShortSignalStatus:
          "no_setup",

        momentumShortSignalReasons: [
          "V5 is long-only; no new momentum shorts are admitted.",
        ],

        experimental,

        strategyVersion:
          rules.version,

        researchCandidates,

        discovery: {
          gapCross,
          gapReferenceFresh,
          gapReversal,
          wrapperTurn,
          frictionChangePct,
          events: discoveryEvents,
        },
      };

    newRows.push(observation);

    /**
     * Open each V5 strategy independently.
     *
     * A token can therefore be entered by two different strategies at the
     * same time. That is intentional: these are parallel virtual portfolios.
     */
    for (const strategyType of ACTIVE_LONG_STRATEGIES) {
      const signal =
        strategySignalFromObservation(
          observation,
          strategyType
        );

      if (
        signal?.signalStatus !==
        "candidate"
      ) {
        continue;
      }

      const currentCount =
        mutableLongCounts.get(
          strategyType
        ) ?? 0;

      if (
        currentCount >=
        rules.maxNewLongTradesPerDay
      ) {
        continue;
      }

      const trade =
        createTrade(
          strategyType,
          "long",
          observation,
          rules
        );

      if (!trade) continue;

      trades.push(trade);

      mutableLongCounts.set(
        strategyType,
        currentCount + 1
      );
    }
  }

  /**
   * Follow previously recorded research candidates only after new prices arrive.
   * No historical/backdated trades are invented.
   */
  const candidateUpdates =
    updateResearchOutcomes(
      currentVersionObservations,
      newRows,
      snapshot.timestamp
    );

  await updatePaperCandidateOutcomes(
    snapshot.ticker,
    candidateUpdates
  );

  await appendPaperObservations(
    snapshot.ticker,
    newRows
  );

  await markOpenPaperTrades(
    trades,
    snapshot.ticker,
    snapshot.benchmarkPrice,
    snapshot.timestamp
  );

  return newRows;
}

export async function markOpenPaperTrades(
  suppliedTrades?: PaperTrade[],
  tickerFilter?: string,
  benchmarkPrice: number | null = null,
  timestamp = Date.now()
) {
  const trades =
    suppliedTrades ??
    (await readPaperTrades());

  let changed = false;

  const quoteCache =
    new Map<
      string,
      Promise<
        Awaited<
          ReturnType<
            typeof fetchExactTokenSellQuote
          >
        >
      >
    >();

  for (const trade of trades) {
    if (
      trade.status !== "open"
    ) {
      continue;
    }

    if (
      tickerFilter &&
      trade.ticker !== tickerFilter
    ) {
      continue;
    }

    const cacheKey = [
      trade.direction,
      trade.mint,
      trade.tokenDecimals,
      trade.tokenAmount.toFixed(12),
      trade.shareMultiplier.toFixed(
        12
      ),
      trade.direction === "short"
        ? trade.entryCostUsd.toFixed(
            8
          )
        : "",
    ].join(":");

    let quotePromise =
      quoteCache.get(cacheKey);

    if (!quotePromise) {
      quotePromise =
        trade.direction === "long"
          ? fetchExactTokenSellQuote(
              trade.mint,
              trade.tokenDecimals,
              trade.tokenAmount,
              trade.shareMultiplier
            )
          : fetchExactTokenBuyQuote(
              trade.mint,
              trade.tokenDecimals,
              trade.tokenAmount,
              trade.shareMultiplier,
              trade.entryCostUsd
            );

      quoteCache.set(
        cacheKey,
        quotePromise
      );
    }

    const quote =
      await quotePromise;

    const markUsd =
      quote.usdcAmount;

    const pnlUsd =
      markUsd === null
        ? null
        : trade.direction ===
          "long"
        ? markUsd -
          trade.entryCostUsd
        : trade.entryCostUsd -
          markUsd;

    const pnlPct =
      pnlUsd === null
        ? null
        : (pnlUsd /
            trade.entryCostUsd) *
          100;

    const mark: PaperTradeMark = {
      timestamp,

      capturedAt:
        new Date(
          timestamp
        ).toISOString(),

      markStatus: quote.status,
      markUsd,

      markEffectivePrice:
        quote.effectivePrice,

      pnlUsd,
      pnlPct,
      benchmarkPrice,

      ...(quote.error
        ? {
            error: quote.error,
          }
        : {}),
    };

    trade.marks = [
      ...trade.marks,
      mark,
    ].slice(-500);

    if (
      markUsd !== null &&
      pnlUsd !== null &&
      pnlPct !== null
    ) {
      trade.currentExitUsd =
        markUsd;

      trade.currentPnlUsd =
        pnlUsd;

      trade.currentPnlPct =
        pnlPct;

      trade.maxExitUsd =
        trade.maxExitUsd === null
          ? markUsd
          : Math.max(
              trade.maxExitUsd,
              markUsd
            );

      trade.minExitUsd =
        trade.minExitUsd === null
          ? markUsd
          : Math.min(
              trade.minExitUsd,
              markUsd
            );

      trade.maxFavourablePct =
        trade.maxFavourablePct ===
        null
          ? pnlPct
          : Math.max(
              trade.maxFavourablePct,
              pnlPct
            );

      trade.maxAdversePct =
        trade.maxAdversePct ===
        null
          ? pnlPct
          : Math.min(
              trade.maxAdversePct,
              pnlPct
            );

      const heldHours =
        (timestamp -
          trade.openedAt) /
        (60 * 60 * 1000);

      let reason: PaperTrade["exitReason"] =
        null;

      if (
        pnlPct >=
        trade.strategyRules.targetPct
      ) {
        reason = "target";
      } else if (
        trade.strategyRules.stopPct !==
          null &&
        pnlPct <=
          trade.strategyRules.stopPct
      ) {
        reason = "stop";
      } else if (
        heldHours >=
        trade.strategyRules.maxHoldHours
      ) {
        reason = "timeout";
      }

      if (reason) {
        trade.status = "closed";

        trade.closedAt =
          timestamp;

        trade.closedAtIso =
          new Date(
            timestamp
          ).toISOString();

        trade.exitReason =
          reason;

        trade.realisedExitUsd =
          markUsd;

        trade.realisedPnlUsd =
          pnlUsd;

        trade.realisedPnlPct =
          pnlPct;
      }
    }

    changed = true;
  }

  if (
    changed ||
    suppliedTrades
  ) {
    await writePaperTrades(
      trades
    );
  }

  return trades;
}

