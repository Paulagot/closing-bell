export type HistoryQuoteStatus =
  | "ok"
  | "no_route"
  | "rate_limited"
  | "unavailable"
  | "error";

export interface HistoryExecutionQuote {
  status: HistoryQuoteStatus;
  effectivePrice: number | null;
  /** New snapshots retain the real Jupiter amounts to reconstruct exact entry inventory. */
  tokenAmount?: number | null;
  usdcAmount?: number | null;
  routePlan?: string[];
  executionCostPct?: number | null;
  priceImpactPct: number | null;
  slippageBps: number | null;
  feeBps: number | null;
}

export interface HistoryIssuerSnapshot {
  issuer: string;
  symbol: string;
  mint: string;
  decimals?: number;
  shareMultiplier: number;

  indicativePrice: number | null;

  /**
   * Jupiter Price V3 reported liquidity.
   * Do not describe this as one specific AMM pool balance.
   */
  liquidityUsd: number | null;

  buy: HistoryExecutionQuote;
  sell: HistoryExecutionQuote;

  buyGapPct: number | null;
  sellGapPct: number | null;

  /**
   * Whole-order BUY minus SELL as % of BUY.
   */
  executionGapPct: number | null;

  /**
   * Approximate move required for the current SELL
   * to equal the current BUY.
   */
  approxBreakEvenMovePct: number | null;

  /**
   * BUY discount vs Wall Street remaining after
   * current execution friction.
   */
  divergenceAfterBreakEvenPct: number | null;
}

export type HistoryBenchmarkSource =
  | "latest_price"
  | "previous_close_fallback"
  | "unavailable";

export interface HistorySnapshot {
  version: 3;
  timestamp: number;
  capturedAt: string;

  ticker: string;
  stockName: string;
  refSymbol: string;

  canonicalSizeUsd: number;

  marketOpen: boolean;
  marketLabel: string;

  benchmarkPrice: number | null;

  /**
   * Timestamp supplied by the Wall Street reference provider for the
   * current/latest price. This is useful for measuring reference age,
   * especially outside the regular US session.
   */
  benchmarkTimestamp: number | null;

  /**
   * Records how benchmarkPrice was resolved so downstream analytics
   * can distinguish a current/latest price from a fallback.
   */
  benchmarkSource: HistoryBenchmarkSource;

  previousClose: number | null;

  issuers: HistoryIssuerSnapshot[];
}

export interface GapPoint {
  timestamp: number;

  /**
   * Absolute prices captured at the same stored observation.
   * These let the UI distinguish movement in the underlying stock
   * from movement in the wrapper's relative gap.
   */
  benchmarkPrice: number | null;
  indicativePrice: number | null;
  buyPrice: number | null;
  sellPrice: number | null;

  buyGapPct: number | null;
  sellGapPct: number | null;
  indicativeGapPct: number | null;
  approxBreakEvenMovePct: number | null;
}

export interface OpenConvergenceRow {
  date: string;
  beforeGapPct: number;
  afterGapPct: number;
  narrowed: boolean;
}

export interface IssuerHistoryAnalytics {
  issuer: string;
  symbol: string;
  mint: string;

  latest: HistoryIssuerSnapshot | null;

  observations: number;
  quoteAvailabilityPct: number | null;

  currentBuyGapPct: number | null;
  currentSellGapPct: number | null;
  currentApproxBreakEvenMovePct: number | null;
  currentDivergenceAfterBreakEvenPct: number | null;

  currentDivergenceMagnitudePercentile: number | null;
  currentBreakEvenPercentile: number | null;

  medianBuyGap24hPct: number | null;
  medianBuyGap7dPct: number | null;

  medianBreakEven24hPct: number | null;
  medianBreakEven7dPct: number | null;

  similarDivergenceEvents: number;
  convergenceRatePct: number | null;
  convergenceFailures: number;
  medianMinutesToConvergence: number | null;

  openObservations: number;
  openNarrowedPct: number | null;
  openRows: OpenConvergenceRow[];

  gap48h: GapPoint[];
}

export interface StockHistoryAnalyticsResponse {
  ticker: string;
  stockName: string;
  canonicalSizeUsd: number;

  firstSnapshotAt: number | null;
  lastSnapshotAt: number | null;
  snapshotCount: number;

  ready: boolean;

  issuers: IssuerHistoryAnalytics[];
}

export interface DepthSizeResult {
  sizeUsd: number;

  buyPrice: number | null;
  sellPrice: number | null;

  buyImpactPct: number | null;
  sellImpactPct: number | null;

  buyGapPct: number | null;
  sellGapPct: number | null;

  approxBreakEvenMovePct: number | null;

  buyStatus: HistoryQuoteStatus;
  sellStatus: HistoryQuoteStatus;
}

export interface IssuerDepthResponse {
  ticker: string;

  issuer: string;
  symbol: string;

  benchmarkPrice: number | null;

  reportedLiquidityUsd: number | null;

  sizes: DepthSizeResult[];

  timestamp: number;
}
