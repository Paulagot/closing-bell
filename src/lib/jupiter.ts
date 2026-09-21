import type {
  ExecutionQuote,
  TokenExecutions,
  TokenPrice,
  TradeSide,
} from "@/types";

import {
  USDC_DECIMALS,
  USDC_MINT,
} from "@/lib/tokens";

import {
  scheduledJupiterFetch,
} from "@/lib/jupiterScheduler";

import type {
  JupiterRequestPriority,
} from "@/lib/jupiterScheduler";


const JUPITER_API_URL =
  process.env.JUPITER_API_URL ||
  "https://api.jup.ag";

const JUPITER_API_KEY =
  process.env.JUPITER_API_KEY ||
  "";


function getHeaders(): HeadersInit {
  return {
    Accept:
      "application/json",

    ...(JUPITER_API_KEY
      ? {
          "x-api-key":
            JUPITER_API_KEY,
        }
      : {}),
  };
}


// ─────────────────────────────────────────────
// Price V3
// ─────────────────────────────────────────────

type JupiterPriceV3 = {
  usdPrice?: number;
  decimals?: number;
  liquidity?: number;
  blockId?: number;
  priceChange24h?: number;
};


export async function fetchPrices(
  mints: string[]
): Promise<
  Record<string, TokenPrice>
> {

  const result: Record<
    string,
    TokenPrice
  > = {};


  if (
    !mints.length
  ) {
    return result;
  }


  const chunks:
    string[][] = [];


  for (
    let i = 0;
    i < mints.length;
    i += 50
  ) {

    chunks.push(
      mints.slice(
        i,
        i + 50
      )
    );

  }


  for (
    const chunk
    of chunks
  ) {

    const params =
      new URLSearchParams({
        ids:
          chunk.join(","),
      });


    const url =
      `${JUPITER_API_URL}/price/v3?${params}`;


    try {

      console.log(
        `[jupiter] Fetching ${chunk.length} Price V3 midpoints`
      );


      const response =
        await scheduledJupiterFetch(
          url,
          {
            headers:
              getHeaders(),

            signal:
              AbortSignal.timeout(
                12000
              ),
          },
          {
            priority:
              "interactive",

            cacheTtlMs:
              10_000,

            cacheKey:
              `price-v3:${chunk
                .slice()
                .sort()
                .join(",")}`,
          }
        );


      if (
        !response.ok
      ) {

        const body =
          await response
            .text()
            .catch(
              () => ""
            );


        console.error(
          `[jupiter] Price V3 failed ${response.status}`,
          body
        );


        for (
          const mint
          of chunk
        ) {

          result[mint] = {
            mint,
            priceUsd:
              null,
            liquidityUsd:
              null,
            decimals:
              null,
          };

        }


        continue;
      }


      const data =
        (await response.json()) as Record<
          string,
          JupiterPriceV3
        >;


      for (
        const mint
        of chunk
      ) {

        const entry =
          data[mint];


        result[mint] = {
          mint,

          priceUsd:
            typeof
              entry
                ?.usdPrice ===
            "number"
              ? entry.usdPrice
              : null,

          liquidityUsd:
            typeof
              entry
                ?.liquidity ===
            "number"
              ? entry.liquidity
              : null,

          decimals:
            typeof
              entry
                ?.decimals ===
            "number"
              ? entry.decimals
              : null,
        };

      }

    } catch (error) {

      console.error(
        "[jupiter] Price V3 request failed:",
        error
      );


      for (
        const mint
        of chunk
      ) {

        result[mint] ??= {
          mint,
          priceUsd:
            null,
          liquidityUsd:
            null,
          decimals:
            null,
        };

      }

    }

  }


  return result;
}


// ─────────────────────────────────────────────
// Quote helpers
// ─────────────────────────────────────────────

function failedQuote(
  side: TradeSide,
  notionalUsd: number,
  status:
    ExecutionQuote["status"],
  error: string
): ExecutionQuote {

  return {
    status,
    side,
    notionalUsd,

    tokenAmount:
      null,

    usdcAmount:
      null,

    effectivePrice:
      null,

    priceImpactPct:
      null,

    executionCostPct:
      null,

    slippageBps:
      null,

    feeBps:
      null,

    feeMint:
      null,

    routePlan:
      [],

    shareEquivalentAmount:
      null,

    rawEffectivePrice:
      null,

    shareMultiplier:
      1,
    error,
  };
}


// ─────────────────────────────────────────────
// One executable quote
// ─────────────────────────────────────────────

export async function fetchExecutionQuote(
  tokenMint: string,
  tokenDecimals: number,
  side: TradeSide,
  notionalUsd: number,
  midpoint: number | null,
  referencePrice: number | null,
  shareMultiplier = 1,
  priority: JupiterRequestPriority =
    "interactive"
): Promise<ExecutionQuote> {

  try {

    let inputMint: string;
    let outputMint: string;

    let inputDecimals: number;
    let outputDecimals: number;

    let amountAtomic: string;


    if (
      side === "buy"
    ) {

      inputMint =
        USDC_MINT;

      outputMint =
        tokenMint;

      inputDecimals =
        USDC_DECIMALS;

      outputDecimals =
        tokenDecimals;


      amountAtomic =
        Math.round(
          notionalUsd *
          10 **
            USDC_DECIMALS
        ).toString();

    } else {

      /**
       * SELL needs an amount of wrapper tokens.
       *
       * We size it using the underlying/reference
       * stock price where available.
       */
      const normalizedMidpoint =
        midpoint !== null
          ? midpoint /
            shareMultiplier
          : null;


      const sizingPrice =
        referencePrice ??
        normalizedMidpoint;


      if (
        !sizingPrice ||
        sizingPrice <= 0
      ) {

        return {
          status:
            "unavailable",

          side,

          notionalUsd,

          tokenAmount:
            null,

          shareEquivalentAmount:
            null,

          usdcAmount:
            null,

          effectivePrice:
            null,

          rawEffectivePrice:
            null,

          priceImpactPct:
            null,

          executionCostPct:
            null,

          slippageBps:
            null,

          feeBps:
            null,

          feeMint:
            null,

          shareMultiplier,

          routePlan:
            [],

          error:
            "Unable to determine sell sizing price",
        };

      }


      const desiredShares =
        notionalUsd /
        sizingPrice;


      const rawTokens =
        desiredShares /
        shareMultiplier;


      inputMint =
        tokenMint;

      outputMint =
        USDC_MINT;

      inputDecimals =
        tokenDecimals;

      outputDecimals =
        USDC_DECIMALS;


      amountAtomic =
        Math.floor(
          rawTokens *
          10 **
            tokenDecimals
        ).toString();


      if (
        BigInt(
          amountAtomic
        ) <= BigInt(0)
      ) {

        return {
          status:
            "unavailable",

          side,

          notionalUsd,

          tokenAmount:
            null,

          shareEquivalentAmount:
            null,

          usdcAmount:
            null,

          effectivePrice:
            null,

          rawEffectivePrice:
            null,

          priceImpactPct:
            null,

          executionCostPct:
            null,

          slippageBps:
            null,

          feeBps:
            null,

          feeMint:
            null,

          shareMultiplier,

          routePlan:
            [],

          error:
            "Trade amount is too small",
        };

      }

    }


    const order =
      await fetchV2OrderQuote(
        inputMint,
        outputMint,
        amountAtomic,
        priority
      );


    const inputDisplay =
      Number(
        BigInt(
          order.inAmount
        )
      ) /
      10 **
        inputDecimals;


    const outputDisplay =
      Number(
        BigInt(
          order.outAmount
        )
      ) /
      10 **
        outputDecimals;


    let tokenAmount:
      number | null =
      null;

    let usdcAmount:
      number | null =
      null;

    let shareEquivalentAmount:
      number | null =
      null;

    let rawEffectivePrice:
      number | null =
      null;

    let effectivePrice:
      number | null =
      null;


    if (
      side === "buy"
    ) {

      usdcAmount =
        inputDisplay;

      tokenAmount =
        outputDisplay;

      shareEquivalentAmount =
        tokenAmount *
        shareMultiplier;


      if (
        tokenAmount >
        0
      ) {

        rawEffectivePrice =
          usdcAmount /
          tokenAmount;

      }


      if (
        shareEquivalentAmount >
        0
      ) {

        effectivePrice =
          usdcAmount /
          shareEquivalentAmount;

      }

    } else {

      tokenAmount =
        inputDisplay;

      usdcAmount =
        outputDisplay;

      shareEquivalentAmount =
        tokenAmount *
        shareMultiplier;


      if (
        tokenAmount >
        0
      ) {

        rawEffectivePrice =
          usdcAmount /
          tokenAmount;

      }


      if (
        shareEquivalentAmount >
        0
      ) {

        effectivePrice =
          usdcAmount /
          shareEquivalentAmount;

      }

    }


    const normalizedMidpoint =
      midpoint !== null
        ? midpoint /
          shareMultiplier
        : null;


    let executionCostPct:
      number | null =
      null;


    if (
      effectivePrice !==
        null &&
      normalizedMidpoint !==
        null &&
      normalizedMidpoint >
        0
    ) {

      if (
        side === "buy"
      ) {

        executionCostPct =
          (
            (
              effectivePrice -
              normalizedMidpoint
            ) /
            normalizedMidpoint
          ) *
          100;

      } else {

        executionCostPct =
          (
            (
              normalizedMidpoint -
              effectivePrice
            ) /
            normalizedMidpoint
          ) *
          100;

      }

    }


    return {
      status:
        "ok",

      side,

      notionalUsd,

      tokenAmount,

      shareEquivalentAmount,

      usdcAmount,

      effectivePrice,

      rawEffectivePrice,

      /**
       * Already percentage points from V2.
       */
      priceImpactPct:
        order.priceImpact,

      executionCostPct,

      slippageBps:
        order.slippageBps,

      feeBps:
        order.feeBps,

      feeMint:
        order.feeMint,

      shareMultiplier,

      routePlan:
        order.router
          ? [
              order.router,
              ...order.routePlan,
            ]
          : order.routePlan,
    };

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : String(
            error
          );


    return {
      status:
        "unavailable",

      side,

      notionalUsd,

      tokenAmount:
        null,

      shareEquivalentAmount:
        null,

      usdcAmount:
        null,

      effectivePrice:
        null,

      rawEffectivePrice:
        null,

      priceImpactPct:
        null,

      executionCostPct:
        null,

      slippageBps:
        null,

      feeBps:
        null,

      feeMint:
        null,

      shareMultiplier,

      routePlan:
        [],

      error:
        message,
    };

  }

}


// ─────────────────────────────────────────────
// Profile helper
//
// Retained because it may still be useful later.
// Detailed stock pages now request individual amounts.
// ─────────────────────────────────────────────

export async function fetchExecutionProfile(
  tokenMint: string,
  tokenDecimals: number,
  midpoint: number | null,
  referencePrice: number | null,
  tradeSizes: number[]
): Promise<TokenExecutions> {

  const buy:
    TokenExecutions["buy"] =
    {};

  const sell:
    TokenExecutions["sell"] =
    {};


  for (
    const size
    of tradeSizes
  ) {

    buy[
      size.toString()
    ] =
      await fetchExecutionQuote(
        tokenMint,
        tokenDecimals,
        "buy",
        size,
        midpoint,
        referencePrice
      );

  }


  for (
    const size
    of tradeSizes
  ) {

    sell[
      size.toString()
    ] =
      await fetchExecutionQuote(
        tokenMint,
        tokenDecimals,
        "sell",
        size,
        midpoint,
        referencePrice
      );

  }


  return {
    buy,
    sell,
  };
}


export interface JupiterV2OrderQuote {
  inputMint: string;
  outputMint: string;

  inAmount: string;
  outAmount: string;

  inUsdValue: number | null;
  outUsdValue: number | null;

  priceImpact: number | null;
  slippageBps: number | null;

  otherAmountThreshold: string | null;

  router: string | null;
  routePlan: string[];

  feeBps: number | null;
  feeMint: string | null;

  errorCode: number | null;
  errorMessage: string | null;
}


export async function fetchV2OrderQuote(
  inputMint: string,
  outputMint: string,
  amountAtomic: string,
  priority: JupiterRequestPriority =
    "interactive"
): Promise<JupiterV2OrderQuote> {

  const apiKey =
    process.env.JUPITER_API_KEY;

  if (!apiKey) {
    throw new Error(
      "JUPITER_API_KEY is not configured"
    );
  }


  const params =
    new URLSearchParams({
      inputMint,
      outputMint,
      amount:
        amountAtomic,
    });


  console.log(
    `[jupiter-v2] Quote-only ${inputMint.slice(
      0,
      5
    )}... → ${outputMint.slice(
      0,
      5
    )}...`
  );


  const quoteUrl =
    `${JUPITER_API_URL}/swap/v2/order?${params.toString()}`;

  const response =
    await scheduledJupiterFetch(
      quoteUrl,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",

          "x-api-key":
            apiKey,
        },

        cache:
          "no-store",
      },
      {
        priority,

        /**
         * The same mint/side/size is frequently
         * requested by live comparison, history
         * and the $1K market-depth row.
         *
         * Reuse it briefly rather than paying for
         * the same Jupiter call several times.
         */
        cacheTtlMs:
          20_000,

        cacheKey:
          `v2-quote:${inputMint}:${outputMint}:${amountAtomic}`,
      }
    );


  const text =
    await response.text();


  let data: any;


  try {

    data =
      JSON.parse(
        text
      );

  } catch {

    throw new Error(
      `Jupiter V2 returned ${response.status} instead of JSON`
    );

  }


  /**
   * Jupiter can return useful pricing information
   * even where a transaction could not be built.
   *
   * Since this is quote-only, transaction === null
   * is expected because no taker was supplied.
   */
  if (
    !response.ok
  ) {

    const message =
      data?.errorMessage ??
      data?.error ??
      `Jupiter V2 order failed with HTTP ${response.status}`;

    throw new Error(
      message
    );

  }


  const routePlan =
    Array.isArray(
      data.routePlan
    )
      ? data.routePlan.map(
          (route: any) =>
            route?.swapInfo
              ?.label ??
            "Unknown"
        )
      : [];


  return {
    inputMint:
      data.inputMint ??
      inputMint,

    outputMint:
      data.outputMint ??
      outputMint,

    inAmount:
      String(
        data.inAmount ??
        amountAtomic
      ),

    outAmount:
      String(
        data.outAmount ??
        "0"
      ),

    inUsdValue:
      typeof data.inUsdValue ===
      "number"
        ? data.inUsdValue
        : null,

    outUsdValue:
      typeof data.outUsdValue ===
      "number"
        ? data.outUsdValue
        : null,

    /**
     * V2 priceImpact is already percentage points.
     *
     * 0.15 means 0.15%, NOT 15%.
     */
    priceImpact:
      typeof data.priceImpact ===
      "number"
        ? data.priceImpact
        : null,

    slippageBps:
      typeof data.slippageBps ===
      "number"
        ? data.slippageBps
        : null,

    otherAmountThreshold:
      data.otherAmountThreshold
        ? String(
            data.otherAmountThreshold
          )
        : null,

    router:
      typeof data.router ===
      "string"
        ? data.router
        : null,

    routePlan,

    feeBps:
      typeof data.feeBps ===
      "number"
        ? data.feeBps
        : null,

    feeMint:
      typeof data.feeMint ===
      "string"
        ? data.feeMint
        : null,

    errorCode:
      typeof data.errorCode ===
      "number"
        ? data.errorCode
        : null,

    errorMessage:
      typeof data.errorMessage ===
      "string"
        ? data.errorMessage
        : null,
  };
}