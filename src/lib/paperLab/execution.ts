import { fetchV2OrderQuote } from "@/lib/jupiter";
import { USDC_DECIMALS, USDC_MINT } from "@/lib/tokens";

export interface ExactSellResult {
  status: "ok" | "unavailable";
  usdcAmount: number | null;
  tokenAmount: number;
  effectivePrice: number | null;
  priceImpactPct: number | null;
  routePlan: string[];
  error?: string;
}

export interface ExactBuyResult {
  status: "ok" | "unavailable";
  usdcAmount: number | null;
  tokenAmount: number;
  effectivePrice: number | null;
  priceImpactPct: number | null;
  routePlan: string[];
  error?: string;
}

export async function fetchExactTokenSellQuote(
  tokenMint: string,
  tokenDecimals: number,
  tokenAmount: number,
  shareMultiplier = 1
): Promise<ExactSellResult> {
  try {
    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      throw new Error("Token amount is invalid");
    }

    const amountAtomic = Math.floor(tokenAmount * 10 ** tokenDecimals).toString();
    if (BigInt(amountAtomic) <= BigInt(0)) {
      throw new Error("Token amount is too small to quote");
    }

    const quote = await fetchV2OrderQuote(
      tokenMint,
      USDC_MINT,
      amountAtomic,
      "background"
    );

    const rawTokenAmount = Number(BigInt(quote.inAmount)) / 10 ** tokenDecimals;
    const usdcAmount = Number(BigInt(quote.outAmount)) / 10 ** USDC_DECIMALS;
    const shareAmount = rawTokenAmount * shareMultiplier;

    return {
      status: "ok",
      usdcAmount,
      tokenAmount: rawTokenAmount,
      effectivePrice: shareAmount > 0 ? usdcAmount / shareAmount : null,
      priceImpactPct: quote.priceImpact,
      routePlan: quote.router ? [quote.router, ...quote.routePlan] : quote.routePlan,
    };
  } catch (error) {
    return {
      status: "unavailable",
      usdcAmount: null,
      tokenAmount,
      effectivePrice: null,
      priceImpactPct: null,
      routePlan: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchExactTokenBuyQuote(
  tokenMint: string,
  tokenDecimals: number,
  tokenAmount: number,
  shareMultiplier = 1,
  estimatedUsd: number | null = null
): Promise<ExactBuyResult> {
  try {
    if (!Number.isFinite(tokenAmount) || tokenAmount <= 0) {
      throw new Error("Token amount is invalid");
    }

    const targetAtomic = BigInt(Math.ceil(tokenAmount * 10 ** tokenDecimals));
    if (targetAtomic <= BigInt(0)) {
      throw new Error("Token amount is too small to quote");
    }

    /**
     * Jupiter's order endpoint is exact-input. For a paper short we need
     * the opposite question: how many USDC would it cost to buy back the
     * exact token quantity originally sold short?
     *
     * Do NOT binary-search the endpoint. That can consume 20-30 requests
     * for one mark. Two quotes are enough at the paper-trade notional:
     *
     *   1. Quote a sensible USDC estimate (normally the original entry).
     *   2. Scale that USDC amount by targetTokens / quotedTokens and re-quote.
     *
     * The second quote is then prorated for any tiny remaining difference.
     * This keeps each open short mark to a hard maximum of two Jupiter calls.
     */
    const firstUsd = Math.max(0.01, estimatedUsd ?? 50);
    const firstAtomic = BigInt(Math.max(1, Math.round(firstUsd * 10 ** USDC_DECIMALS)));

    const firstQuote = await fetchV2OrderQuote(
      USDC_MINT,
      tokenMint,
      firstAtomic.toString(),
      "background"
    );

    const firstOutAtomic = BigInt(firstQuote.outAmount);
    if (firstOutAtomic <= BigInt(0)) {
      throw new Error("Initial buy-back quote returned no tokens");
    }

    const firstOutTokens = Number(firstOutAtomic) / 10 ** tokenDecimals;
    if (!Number.isFinite(firstOutTokens) || firstOutTokens <= 0) {
      throw new Error("Initial buy-back quote returned an invalid token amount");
    }

    const targetTokens = Number(targetAtomic) / 10 ** tokenDecimals;
    const scaledUsd = firstUsd * (targetTokens / firstOutTokens);
    const secondAtomic = BigInt(Math.max(1, Math.round(scaledUsd * 10 ** USDC_DECIMALS)));

    const secondQuote = await fetchV2OrderQuote(
      USDC_MINT,
      tokenMint,
      secondAtomic.toString(),
      "background"
    );

    const secondInputUsd = Number(BigInt(secondQuote.inAmount)) / 10 ** USDC_DECIMALS;
    const secondOutTokens = Number(BigInt(secondQuote.outAmount)) / 10 ** tokenDecimals;

    if (!Number.isFinite(secondOutTokens) || secondOutTokens <= 0) {
      throw new Error("Refined buy-back quote returned an invalid token amount");
    }

    // Do not pretend that a large extrapolation is an executable exact-quantity
    // cover. If the second quote is still materially off, mark unavailable.
    // Keep the Jupiter budget to two requests rather than binary-searching.
    if (Math.abs(secondOutTokens - targetTokens) / targetTokens > 0.005) {
      throw new Error("Refined short cover differs from the required token quantity by over 0.5%");
    }

    // Only prorate the small residual after the second executable quote.
    const exactCoverUsd = secondInputUsd * (targetTokens / secondOutTokens);
    const shareAmount = tokenAmount * shareMultiplier;

    return {
      status: "ok",
      usdcAmount: exactCoverUsd,
      tokenAmount,
      effectivePrice: shareAmount > 0 ? exactCoverUsd / shareAmount : null,
      priceImpactPct: secondQuote.priceImpact,
      routePlan: secondQuote.router ? [secondQuote.router, ...secondQuote.routePlan] : secondQuote.routePlan,
    };
  } catch (error) {
    return {
      status: "unavailable",
      usdcAmount: null,
      tokenAmount,
      effectivePrice: null,
      priceImpactPct: null,
      routePlan: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
