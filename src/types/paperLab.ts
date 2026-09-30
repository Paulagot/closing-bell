import type { IssuerDailyRangeSummary } from "@/lib/paperLab/dailyRanges";
import type { QuoteStatus } from "@/types";

export type PaperSignalStatus = "candidate" | "watch" | "no_setup";
export type PaperTradeStatus = "open" | "closed";
export type PaperTradeExitReason = "target" | "stop" | "timeout" | "manual";
export type PaperTradeDirection = "long" | "short";

/**
 * Keep the legacy names because historical JSON already contains them.
 * V5 opens NEW trades only for the three research strategies below.
 */
export type PaperStrategyType =
  | "convergence"
  | "momentum"
  | "extreme_momentum"
  | "discount_recovery"
  | "wrapper_lag"
  | "drift_reversal";

export interface PaperStrategyRules {
  version: string;
  notionalUsd: number;

  targetPct: number;
  secondaryTargetPct?: number;
  maxQuoteImpactPct?: number;
  stopPct: number | null;
  maxHoldHours: number;

  /**
   * In V5 this cap is applied independently to EACH active long strategy.
   * It is no longer one shared long cap across all strategy families.
   */
  maxNewLongTradesPerDay: number;

  /** Retained for backwards compatibility. V5 opens no new shorts. */
  maxNewShortTradesPerDay: number;

  minPersistentCaptures: number;
  minLiquidityUsd: number;
  cooldownHours: number;

  /** Legacy convergence research settings. */
  requireMarketOpenForEntries: boolean;

  /** Legacy momentum research settings. */
  momentumRequireMarketOpen: boolean;
  momentumLookbackCaptures: number;
  momentumTrendSteps: number;
  momentumMinAlignedSteps: number;
  momentumMaxBreakEvenPct: number;

  /** V5 Strategy A: Extreme Momentum. */
  extremeMomentumMin2hPct: number;
  extremeMomentumMaxBreakEvenPct: number;

  /** V5 Strategy B: Discount Recovery. */
  discountRecoveryMaxBuyGapPct: number;
  discountRecoveryMinNarrowing1hPct: number;
  discountRecoveryMaxBreakEvenPct: number;

  /** V5 Strategy C: Wrapper Lag. */
  wrapperLagMaxLag1hPct: number;
  wrapperLagMaxBreakEvenPct: number;

  /** V5 Strategy D: Pre-open Drift Reversal, long-only research. */
  driftReversalMaxBuyGapPct: number;
  driftReversalMaxBreakEvenPct: number;
  driftReversalStartMinutesEt: number;
  driftReversalEndMinutesEt: number;
  driftReversalWindowStartEt: string;
driftReversalWindowEndEt: string;
}

export interface PaperExecutionSnapshot {
  status: QuoteStatus;
  tokenAmount: number | null;
  usdcAmount: number | null;
  effectivePrice: number | null;
  priceImpactPct: number | null;
  executionCostPct: number | null;
  routePlan: string[];
  error?: string;
}

export interface PaperMomentumFeatures {
  wrapperMidPrice: number | null;
  wrapperMove15mPct: number | null;
  wrapperMove1hPct: number | null;
  wrapperMove2hPct: number | null;
  benchmarkMove15mPct: number | null;
  benchmarkMove1hPct: number | null;
  benchmarkMove2hPct: number | null;
  wrapperPositiveSteps: number;
  wrapperNegativeSteps: number;
  benchmarkPositiveSteps: number;
  benchmarkNegativeSteps: number;
  trendStepsAvailable: number;
  wrapperTrendStepsAvailable: number;
}

export interface PaperExperimentalSignalState {
  rawEligible: boolean;
  signalStatus: PaperSignalStatus;
  signalReasons: string[];
}

export interface PaperExperimentalFeatures {
  /** Current wrapper return minus reference-stock return over ~1 hour. */
  wrapperLag1hPct: number | null;

  /** BUY gap from approximately four 15-minute captures ago. */
  buyGap1hAgoPct: number | null;

  /**
   * Percentage-point recovery toward zero for a negative gap.
   * Example: -2.0% -> -1.1% = +0.9pp narrowing.
   */
  gapNarrowing1hPct: number | null;

  extremeMomentum: PaperExperimentalSignalState;
  discountRecovery: PaperExperimentalSignalState;
  wrapperLag: PaperExperimentalSignalState;
  driftReversal: PaperExperimentalSignalState;
}

/** Research-only hypothetical outcome. Future $1,000 effective SELL/BUY prices
 * are proxies, NOT executable exact-quantity exit quotes or realised P&L. */
export interface PaperCandidateOutcome {
  direction: PaperTradeDirection;
  kind:
    | "sustained_momentum"
    | "gap_cross"
    | "gap_narrowing"
    | "wrapper_turn"
    | "extreme_momentum"
    | "discount_recovery"
    | "wrapper_lag"
    | "drift_reversal";
  enteredAt: number;
  entryEffectivePrice: number;
  firstTargetPct: 1 | 1.2 | null;
  firstTargetAt: number | null;
  secondaryTargetAt: number | null;
  firstStopAt: number | null;
  firstTouch: "target" | "stop" | null;
  maxFavourablePct: number | null;
  maxAdversePct: number | null;
  terminalPct: number | null;
  lastSeenAt: number;
  status: "tracking" | "complete";
  at4hPct?: number | null;
  at24hPct?: number | null;
  at48hPct?: number | null;
  targetBy24h?: boolean | null;
  targetBy48h?: boolean | null;
  stopBy24h?: boolean | null;
  stopBy48h?: boolean | null;
}

export interface PaperLabObservation {
  version: 3;
  id: string;
  timestamp: number;
  capturedAt: string;

  ticker: string;
  stockName: string;
  refSymbol: string;
  issuer: string;
  symbol: string;
  mint: string;
  tokenDecimals: number;
  shareMultiplier: number;

  marketOpen: boolean;
  marketLabel: string;
  benchmarkPrice: number | null;
  benchmarkTimestamp: number | null;
  liquidityUsd: number | null;

  notionalUsd: number;
  buy: PaperExecutionSnapshot;
  sell: PaperExecutionSnapshot;

  buyGapPct: number | null;
  sellGapPct: number | null;
  executionGapPct: number | null;
  approxBreakEvenMovePct: number | null;

  longTheoreticalConvergencePct: number | null;
  shortTheoreticalConvergencePct: number | null;

  // Legacy convergence research fields retained for historical compatibility.
  longRawEligible: boolean;
  longPersistentCaptures: number;
  longSignalStatus: PaperSignalStatus;
  longSignalReasons: string[];

  shortRawEligible: boolean;
  shortPersistentCaptures: number;
  shortSignalStatus: PaperSignalStatus;
  shortSignalReasons: string[];

  // Legacy momentum research fields retained for historical compatibility.
  momentum: PaperMomentumFeatures;
  momentumLongRawEligible: boolean;
  momentumLongPersistentCaptures: number;
  momentumLongSignalStatus: PaperSignalStatus;
  momentumLongSignalReasons: string[];
  momentumShortRawEligible: boolean;
  momentumShortPersistentCaptures: number;
  momentumShortSignalStatus: PaperSignalStatus;
  momentumShortSignalReasons: string[];

  /** V5 parallel-strategy research fields. Optional so old observations still load. */
  experimental?: PaperExperimentalFeatures;

  strategyVersion: string;
  researchCandidates?: PaperCandidateOutcome[];

  discovery?: {
    gapCross: "negative_to_positive" | "positive_to_negative" | null;
    gapReferenceFresh: boolean;
    gapReversal: "toward_zero" | "away_from_zero" | null;
    wrapperTurn: "up" | "down" | null;
    frictionChangePct: number | null;
    events: string[];
  };
}

export interface PaperTradeMark {
  timestamp: number;
  capturedAt: string;
  markStatus: QuoteStatus;
  markUsd: number | null;
  markEffectivePrice: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  benchmarkPrice: number | null;
  error?: string;
}

export interface PaperTrade {
  version: 3;
  id: string;
  strategyType: PaperStrategyType;
  direction: PaperTradeDirection;
  status: PaperTradeStatus;
  strategyVersion: string;
  strategyRules: PaperStrategyRules;

  ticker: string;
  stockName: string;
  refSymbol: string;
  issuer: string;
  symbol: string;
  mint: string;
  tokenDecimals: number;
  shareMultiplier: number;

  openedAt: number;
  openedAtIso: string;
  closedAt: number | null;
  closedAtIso: string | null;
  exitReason: PaperTradeExitReason | null;

  entryObservationId: string;
  entryCostUsd: number;
  tokenAmount: number;
  shareEquivalentAmount: number;
  entryEffectivePrice: number | null;
  entryBenchmarkPrice: number | null;
  entryBuyGapPct: number | null;
  entrySellGapPct: number | null;
  entryExecutionGapPct: number | null;
  entryBreakEvenPct: number | null;
  entryTheoreticalConvergencePct: number | null;
  entryLiquidityUsd: number | null;
  entryMarketOpen: boolean;
  entryMomentum: PaperMomentumFeatures | null;

  /** V5 entry diagnostics. Optional for backwards compatibility with old trades. */
  entryWrapperMove1hPct?: number | null;
  entryWrapperMove2hPct?: number | null;
  entryBenchmarkMove1hPct?: number | null;
  entryWrapperLag1hPct?: number | null;
  entryGap1hAgoPct?: number | null;
  entryGapNarrowing1hPct?: number | null;

  currentExitUsd: number | null;
  currentPnlUsd: number | null;
  currentPnlPct: number | null;

  maxExitUsd: number | null;
  minExitUsd: number | null;
  maxFavourablePct: number | null;
  maxAdversePct: number | null;

  realisedExitUsd: number | null;
  realisedPnlUsd: number | null;
  realisedPnlPct: number | null;

  marks: PaperTradeMark[];
}

export interface PaperStrategyPerformance {
  strategyVersion: string;
  strategyType: PaperStrategyType;
  direction: PaperTradeDirection;
  label: string;
  openTrades: number;
  completedTrades: number;
  targetHits: number;
  targetHitRatePct: number | null;
  averagePnlPct: number | null;
  realisedPnlUsd: number;
}

export interface PaperLabSummary {
  strategyVersion: string;
  paperNotionalUsd: number;
  targetPct: number;

  openTrades: number;
  completedTrades: number;
  openLongTrades: number;
  openShortTrades: number;
  completedLongTrades: number;
  completedShortTrades: number;
  winners: number;
  losers: number;
  targetHits: number;
  targetHitRatePct: number | null;
  secondaryTargetHits?: number;

  realisedPnlUsd: number;
  unrealisedPnlUsd: number;
  combinedPnlUsd: number;

  averagePnlUsd: number | null;
  averagePnlPct: number | null;
  averageHoldMinutes: number | null;
  largestWinnerUsd: number | null;
  largestLoserUsd: number | null;
}

export interface PaperResearchGroup {
  kind: PaperCandidateOutcome["kind"];
  direction: PaperTradeDirection;
  tracked: number;
  complete: number;
  hit1Pct: number;
  hit12Pct: number;
  stoppedFirst: number;
  targetFirst: number;
  averageTerminalPct: number | null;
  measured24h: number;
  measured48h: number;
  targetBy24h: number;
  targetBy48h: number;
  stopBy24h: number;
  stopBy48h: number;
  average24hPct: number | null;
  average48hPct: number | null;
}

export interface PaperLabDashboard {
  generatedAt: number;
  rules: PaperStrategyRules;
  summary: PaperLabSummary;
  strategyPerformance: PaperStrategyPerformance[];
  researchPerformance: PaperResearchGroup[];
  dailyIssuerRanges: IssuerDailyRangeSummary[];
  latestObservations: PaperLabObservation[];
  discoveryObservations: PaperLabObservation[];
  openTrades: PaperTrade[];
  completedTrades: PaperTrade[];
}
