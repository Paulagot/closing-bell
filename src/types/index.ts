// ─────────────────────────────────────────────
// Token / issuer registry
// ─────────────────────────────────────────────

export type AssetType =
  | "public_stock"
  | "etf"
  | "private_equity";


export type MultiplierMode =
  | "xstocks"
  | "one_to_one";


export interface IssuerToken {
  symbol: string;

  enabled?: boolean;

  mint: string;

  decimals?: number;

  /**
   * How raw token units map to the economic
   * underlying-share equivalent.
   */
  multiplierMode?: MultiplierMode;
}


export interface Stock {
  name: string;

  enabled?: boolean;

  refSymbol: string;

  assetType?: AssetType;

  exchange?: string;

  issuers: Record<
    string,
    IssuerToken
  >;
}


export interface IssuerMeta {
  fullName: string;

  structure: string;

  backing: string;

  redemption: string;

  color: string;
}


// ─────────────────────────────────────────────
// Market price
// ─────────────────────────────────────────────

export interface TokenPrice {
  mint: string;

  /**
   * Jupiter/raw-token indicative price.
   */
  priceUsd:
    | number
    | null;

  liquidityUsd:
    | number
    | null;

  decimals:
    | number
    | null;

  /**
   * Number of underlying-share equivalents
   * represented by one raw token unit.
   *
   * 1 for ordinary 1:1 wrappers.
   */
  shareMultiplier?:
    | number
    | null;

  /**
   * Indicative price normalised to USD per
   * underlying-share equivalent.
   */
  normalizedPriceUsd?:
    | number
    | null;
}


// ─────────────────────────────────────────────
// Execution
// ─────────────────────────────────────────────

export type TradeSide =
  | "buy"
  | "sell";


export type QuoteStatus =
  | "ok"
  | "no_route"
  | "rate_limited"
  | "unavailable"
  | "error";


export interface ExecutionQuote {
  status: QuoteStatus;

  side: TradeSide;

  /**
   * USD comparison size selected by the user.
   */
  notionalUsd: number;

  /**
   * Actual raw stock-token units used or
   * received by the Solana transaction.
   */
  tokenAmount:
    | number
    | null;

  /**
   * Economic underlying-share equivalent:
   *
   * raw token amount × shareMultiplier
   */
  shareEquivalentAmount:
    | number
    | null;

  /**
   * USDC spent on a BUY or received on a SELL.
   */
  usdcAmount:
    | number
    | null;

  /**
   * Normalized USD price per underlying-share
   * equivalent.
   *
   * This is the price Closing Bell should use
   * when comparing issuers.
   */
  effectivePrice:
    | number
    | null;

  /**
   * Raw-token effective price.
   *
   * Useful for diagnostics, but not for
   * cross-issuer comparison.
   */
  rawEffectivePrice:
    | number
    | null;

  /**
   * Jupiter's quoted price-impact percentage.
   *
   * Already expressed in percentage points.
   */
  priceImpactPct:
    | number
    | null;

  /**
   * Difference between executable price and
   * the token's indicative price.
   *
   * BUY:
   *   (effective - indicative) / indicative
   *
   * SELL:
   *   (indicative - effective) / indicative
   *
   * Positive therefore means worse execution
   * for either trade direction.
   */
  executionCostPct:
    | number
    | null;

  /**
   * Jupiter's protection tolerance for the
   * quoted route, in basis points.
   */
  slippageBps:
    | number
    | null;

  /**
   * Fee reported by Jupiter for the quote,
   * in basis points.
   */
  feeBps:
    | number
    | null;

  /**
   * Mint in which Jupiter reports the fee.
   */
  feeMint:
    | string
    | null;

  /**
   * Number of underlying-share equivalents
   * represented by one raw token.
   */
  shareMultiplier: number;

  routePlan: string[];

  error?: string;
}


export interface TokenExecutions {
  buy: Record<
    string,
    ExecutionQuote
  >;

  sell: Record<
    string,
    ExecutionQuote
  >;
}


// ─────────────────────────────────────────────
// TradFi reference
// ─────────────────────────────────────────────

export interface ReferencePrice {
  symbol: string;

  price: number;

  previousClose:
    | number
    | null;

  open:
    | number
    | null;

  high:
    | number
    | null;

  low:
    | number
    | null;

  change: number;

  changePct: number;

  timestamp: number;
}


// ─────────────────────────────────────────────
// Market status
// ─────────────────────────────────────────────

export interface MarketStatus {
  open: boolean;

  label: string;

  etTime: string;
}


// ─────────────────────────────────────────────
// Wallet
// ─────────────────────────────────────────────

export interface WalletHolding {
  mint: string;

  symbol: string;

  issuer: string;

  ticker: string;

  /**
   * Raw on-chain token balance.
   */
  balance: number;

  valueUsd:
    | number
    | null;

  shareMultiplier?: number;

  shareEquivalentBalance?: number;
}


// ─────────────────────────────────────────────
// Dashboard opportunity
// ─────────────────────────────────────────────

export interface ExecutionOpportunity {
  ticker: string;

  stockName: string;

  sizeUsd: number;

  bestIssuer: string;

  otherIssuer: string;

  bestEffectivePrice: number;

  otherEffectivePrice: number;

  estimatedSavingUsd: number;

  savingPct: number;
}


// ─────────────────────────────────────────────
// Dashboard API
// ─────────────────────────────────────────────

export interface ComparisonData {
  stocks: Record<
    string,
    Stock
  >;

  prices: Record<
    string,
    TokenPrice
  >;

  /**
   * Dashboard execution snapshot.
   *
   * The homepage currently uses canonical
   * cached execution sizes rather than fetching
   * every custom amount on demand.
   */
  executions: Record<
    string,
    TokenExecutions
  >;

  reference: Record<
    string,
    ReferencePrice
  >;

  marketStatus:
    MarketStatus;

  timestamp:
    number;
}


// ─────────────────────────────────────────────
// Single stock snapshot
// ─────────────────────────────────────────────

export interface StockSnapshotResponse {
  ticker: string;

  stock: Stock;

  prices: Record<
    string,
    TokenPrice
  >;

  reference:
    | ReferencePrice
    | null;

  marketStatus:
    MarketStatus;

  timestamp:
    number;
}


// ─────────────────────────────────────────────
// Custom cross-issuer execution comparison
// ─────────────────────────────────────────────

export interface IssuerExecutionResult {
  issuer: string;

  symbol: string;

  mint: string;

  /**
   * Normalized share-equivalent indicative price.
   */
  midpoint:
    | number
    | null;

  /**
   * Raw-token indicative price from Jupiter.
   */
  rawMidpoint?:
    | number
    | null;

  shareMultiplier?: number;

  /**
   * Fresh executable BUY quote for the selected
   * comparison size.
   */
  buyQuote:
    ExecutionQuote;

  /**
   * Fresh executable SELL quote for the selected
   * comparison size.
   */
  sellQuote:
    ExecutionQuote;
}


export interface StockExecutionResponse {
  ticker: string;

  stockName: string;

  /**
   * Same USD comparison size used for both the
   * BUY and SELL execution checks.
   */
  amountUsd: number;

  referencePrice:
    | number
    | null;

  previousClose:
    | number
    | null;

  marketStatus:
    MarketStatus;

  issuers:
    IssuerExecutionResult[];

  timestamp:
    number;
}


// ─────────────────────────────────────────────
// xStocks multiplier
// ─────────────────────────────────────────────

export interface XStocksMultiplier {
  symbol: string;

  multiplier: number;

  source:
    "xstocks_api";

  fetchedAt: number;

  activationTimestamp:
    | string
    | null;
}
