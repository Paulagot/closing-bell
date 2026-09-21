export type DashboardActivityKind =
  | "gap_move"
  | "tightest_execution_changed"
  | "all_routes_available"
  | "unusual_gap";

export interface DashboardActivityItem {
  id: string;
  kind: DashboardActivityKind;
  ticker: string;
  issuer: string | null;
  headline: string;
  detail: string;
  observedAt: number;
  importance: number;
}

export interface DashboardIssuerChange {
  issuer: string;
  symbol: string;
  mint: string;

  buyAvailable: boolean;
  sellAvailable: boolean;

  currentBuyGapPct: number | null;
  currentSellGapPct: number | null;
  currentBreakEvenPct: number | null;
  currentLiquidityUsd: number | null;

  buyGapChangeSinceLastPctPoints: number | null;
  buyGapChange1hPctPoints: number | null;
  sellGapChangeSinceLastPctPoints: number | null;
  sellGapChange1hPctPoints: number | null;
  breakEvenChangeSinceLastPctPoints: number | null;
  liquidityChangeSinceLastPct: number | null;

  divergenceMagnitudePercentile: number | null;
  sellDivergenceMagnitudePercentile: number | null;
  breakEvenPercentile: number | null;
  liquidityPercentile: number | null;

  unusualGap: boolean;
  unusualSellGap: boolean;
  unusualFriction: boolean;
}

export interface DashboardStockIntelligence {
  ticker: string;
  stockName: string;
  snapshotCount: number;
  latestSnapshotAt: number | null;
  previousSnapshotAt: number | null;
  comparison1hAt: number | null;

  allIssuerRoutesAvailable: boolean;
  unusualNow: boolean;

  tightestExecutionIssuer: string | null;
  tightestExecutionPct: number | null;

  issuers: Record<string, DashboardIssuerChange>;
}

export interface DashboardIntelligenceResponse {
  generatedAt: string;
  latestSnapshotAt: number | null;
  activity: DashboardActivityItem[];
  stocks: Record<string, DashboardStockIntelligence>;
}
