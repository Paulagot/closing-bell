import type { IssuerDailyRangeSummary } from "@/lib/paperLab/dailyRanges";
import type { QuoteStatus } from "@/types";

export type PaperSignalStatus = "candidate" | "watch" | "no_setup";
export type PaperTradeStatus = "open" | "closed";
export type PaperTradeExitReason = "target" | "stop" | "timeout" | "manual";
export type PaperTradeDirection = "long" | "short";
export type PaperStrategyType = "convergence" | "momentum";

export interface PaperStrategyRules {
  version: string;
  notionalUsd: number;
  targetPct: number;
  secondaryTargetPct?: number;
  maxQuoteImpactPct?: number;
  stopPct: number | null;
  maxHoldHours: number;
  maxNewLongTradesPerDay: number;
  maxNewShortTradesPerDay: number;
  minPersistentCaptures: number;
  minLiquidityUsd: number; // indicative Jupiter liquidity, not route capacity
  cooldownHours: number;
  requireMarketOpenForEntries: boolean; // convergence only in V3; legacy name retained
  momentumRequireMarketOpen: boolean;
  momentumLookbackCaptures: number;
  momentumTrendSteps: number;
  momentumMinAlignedSteps: number;
  momentumMaxBreakEvenPct: number;
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

/** Research-only hypothetical outcome. Future $1,000 effective SELL/BUY prices
 * are proxies, NOT executable exact-quantity exit quotes or realised P&L. */
export interface PaperCandidateOutcome {
  direction: PaperTradeDirection;
  kind: "sustained_momentum" | "gap_cross" | "gap_narrowing" | "wrapper_turn";
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
  /** New 48h research only; older V4.1 candidates retain their original 4h meaning. */
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

  // Convergence strategy. These field names are retained for backward
  // compatibility with the original V1 long/short observation files.
  longRawEligible: boolean;
  longPersistentCaptures: number;
  longSignalStatus: PaperSignalStatus;
  longSignalReasons: string[];

  shortRawEligible: boolean;
  shortPersistentCaptures: number;
  shortSignalStatus: PaperSignalStatus;
  shortSignalReasons: string[];

  momentum: PaperMomentumFeatures;
  momentumLongRawEligible: boolean;
  momentumLongPersistentCaptures: number;
  momentumLongSignalStatus: PaperSignalStatus;
  momentumLongSignalReasons: string[];
  momentumShortRawEligible: boolean;
  momentumShortPersistentCaptures: number;
  momentumShortSignalStatus: PaperSignalStatus;
  momentumShortSignalReasons: string[];

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
