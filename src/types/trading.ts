export type TradeOrderStatus =
  | "ready"
  | "unavailable"
  | "disabled";


export interface TradeOrderResponse {
  status: TradeOrderStatus;

  ticker: string;

  stockName: string;

  issuer: string;

  symbol: string;

  side:
    | "buy"
    | "sell";

  amountUsd: number;

  inputMint: string;

  outputMint: string;

  inputAmount: string;

  outputAmount: string;

  minimumOutputAmount:
    | string
    | null;

  inputDisplay: number;

  outputDisplay: number;

  shareEquivalentAmount: number;

  effectivePrice:
    | number
    | null;

  shareMultiplier: number;

  router:
    | string
    | null;

  routePlan: string[];

  priceImpactPct:
    | number
    | null;

  slippageBps:
    | number
    | null;

  feeBps:
    | number
    | null;

  feeMint:
    | string
    | null;

  gasless: boolean;

  transaction:
    | string
    | null;

  requestId:
    | string
    | null;

  lastValidBlockHeight:
    | string
    | null;

  expireAt:
    | string
    | null;

  quoteCreatedAt: number;

  liveTradingEnabled: boolean;

  error?: string;
}


export interface TradeExecuteResponse {
  status:
    | "Success"
    | "Failed";

  signature?: string;

  code: number;

  totalInputAmount?: string;

  totalOutputAmount?: string;

  inputAmountResult?: string;

  outputAmountResult?: string;

  error?: string;
}
