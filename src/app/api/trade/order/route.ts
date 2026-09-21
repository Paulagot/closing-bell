import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  PublicKey,
} from "@solana/web3.js";

import {
  USDC_DECIMALS,
  USDC_MINT,
} from "@/lib/tokens";

import {
  getStock,
} from "@/lib/stockRegistry";

import {
  fetchPrices,
} from "@/lib/jupiter";

import {
  scheduledJupiterFetch,
} from "@/lib/jupiterScheduler";

import {
  getShareMultiplier,
} from "@/lib/xstocks";

import {
  storeTradeOrder,
} from "@/lib/tradeOrders";

import type {
  TradeOrderResponse,
} from "@/types/trading";


export const dynamic =
  "force-dynamic";


const JUPITER_API_URL =
  "https://api.jup.ag/swap/v2";


function isValidWallet(
  address: string
) {

  try {

    new PublicKey(
      address
    );

    return true;

  } catch {

    return false;

  }

}


function routeLabels(
  routePlan: unknown
): string[] {

  if (
    !Array.isArray(
      routePlan
    )
  ) {
    return [];
  }


  return routePlan.map(
    (
      route: any
    ) =>
      route?.swapInfo
        ?.label ??
      "Unknown"
  );

}


/**
 * Convert an exact decimal token amount into
 * its integer atomic representation.
 *
 * Example:
 *
 * "1.2345" with 6 decimals
 * → "1234500"
 *
 * This avoids using floating-point arithmetic
 * for the final SELL quantity.
 */
function decimalToAtomic(
  value: string,
  decimals: number
): string {

  const clean =
    value.trim();


  if (
    !/^\d+(\.\d+)?$/.test(
      clean
    )
  ) {

    throw new Error(
      "Invalid token amount"
    );

  }


  const [
    wholePart,
    fractionPart = "",
  ] =
    clean.split(
      "."
    );


  /**
   * Don't silently round a user's requested
   * token amount.
   */
  if (
    fractionPart.length >
    decimals
  ) {

    throw new Error(
      `Token amount supports a maximum of ${decimals} decimal places`
    );

  }


  const paddedFraction =
    fractionPart.padEnd(
      decimals,
      "0"
    );


  const atomicText =
    `${
      wholePart.replace(
        /^0+(?=\d)/,
        ""
      ) || "0"
    }${paddedFraction}`;


  return BigInt(
    atomicText ||
    "0"
  ).toString();

}


export async function POST(
  request: NextRequest
) {

  try {

    const apiKey =
      process.env
        .JUPITER_API_KEY;


    if (!apiKey) {

      return NextResponse.json(
        {
          error:
            "JUPITER_API_KEY is not configured",
        },
        {
          status:
            500,
        }
      );

    }


    const body =
      await request.json();


    const ticker =
      String(
        body?.ticker ??
        ""
      )
        .trim()
        .toUpperCase();


    const issuer =
      String(
        body?.issuer ??
        ""
      ).trim();


    const side =
      String(
        body?.side ??
        ""
      )
        .trim()
        .toLowerCase();


    /**
     * BUY:
     * USD / USDC amount.
     */
    const amountUsd =
      Number(
        body?.amountUsd
      );


    /**
     * SELL:
     * Exact raw-token DISPLAY quantity.
     *
     * Keep this as a string so MAX can preserve
     * the wallet's decimal precision.
     */
    const tokenAmount =
      body?.tokenAmount ===
        undefined ||
      body?.tokenAmount ===
        null
        ? ""
        : String(
            body.tokenAmount
          ).trim();


    const taker =
      String(
        body?.taker ??
        ""
      ).trim();


    if (
      side !== "buy" &&
      side !== "sell"
    ) {

      return NextResponse.json(
        {
          error:
            "Invalid trade side",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      side ===
      "buy" &&
      (
        !Number.isFinite(
          amountUsd
        ) ||
        amountUsd < 1 ||
        amountUsd > 100_000
      )
    ) {

      return NextResponse.json(
        {
          error:
            "BUY amount must be between $1 and $100,000",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      side ===
      "sell"
    ) {

      const parsedTokenAmount =
        Number(
          tokenAmount
        );


      if (
        !tokenAmount ||
        !Number.isFinite(
          parsedTokenAmount
        ) ||
        parsedTokenAmount <=
          0
      ) {

        return NextResponse.json(
          {
            error:
              "Enter a token amount greater than zero",
          },
          {
            status:
              400,
          }
        );

      }

    }


    if (
      !isValidWallet(
        taker
      )
    ) {

      return NextResponse.json(
        {
          error:
            "Invalid Solana wallet address",
        },
        {
          status:
            400,
        }
      );

    }


    const stock =
      await getStock(
        ticker
      );


    if (!stock) {

      return NextResponse.json(
        {
          error:
            "Ticker is not supported by Closing Bell",
        },
        {
          status:
            400,
        }
      );

    }


    const token =
      stock.issuers[
        issuer
      ];


    if (!token) {

      return NextResponse.json(
        {
          error:
            "Issuer is not supported for this stock",
        },
        {
          status:
            400,
        }
      );

    }


    /**
     * We still fetch the token here because the
     * chain/Jupiter decimals are preferable to
     * blindly trusting configured decimals.
     */
    const [
      priceMap,
      shareMultiplier,
    ] =
      await Promise.all([

        fetchPrices([
          token.mint,
        ]),

        getShareMultiplier(
          issuer,
          token.symbol
        ),

      ]);


    const tokenPrice =
      priceMap[
        token.mint
      ];


    const decimals =
      tokenPrice
        ?.decimals ??
      token.decimals;


    if (
      decimals ===
        null ||
      decimals ===
        undefined
    ) {

      return NextResponse.json(
        {
          error:
            "Token decimals are unavailable",
        },
        {
          status:
            503,
        }
      );

    }


    let inputMint:
      string;

    let outputMint:
      string;

    let inputDecimals:
      number;

    let outputDecimals:
      number;

    let atomicAmount:
      string;


    if (
      side ===
      "buy"
    ) {

      /**
       * BUY means exact USDC input.
       *
       * $10 = exactly 10 USDC before Jupiter
       * calculates the output quantity.
       */
      inputMint =
        USDC_MINT;

      outputMint =
        token.mint;

      inputDecimals =
        USDC_DECIMALS;

      outputDecimals =
        decimals;


      atomicAmount =
        Math.round(
          amountUsd *
          10 **
            USDC_DECIMALS
        ).toString();

    } else {

      /**
       * SELL means exact wrapper-token input.
       *
       * No USD → stock conversion here anymore.
       * If the user says sell 1.5 tokens, Jupiter
       * receives exactly that input quantity.
       */
      inputMint =
        token.mint;

      outputMint =
        USDC_MINT;

      inputDecimals =
        decimals;

      outputDecimals =
        USDC_DECIMALS;


      try {

        atomicAmount =
          decimalToAtomic(
            tokenAmount,
            decimals
          );

      } catch (
        amountError
      ) {

        return NextResponse.json(
          {
            error:
              amountError instanceof Error
                ? amountError.message
                : "Invalid token amount",
          },
          {
            status:
              400,
          }
        );

      }

if (
  BigInt(
    atomicAmount
  ) <= BigInt(0)
) {

        return NextResponse.json(
          {
            error:
              "Trade amount is too small",
          },
          {
            status:
              400,
          }
        );

      }

    }


    const params =
      new URLSearchParams({
        inputMint,
        outputMint,

        amount:
          atomicAmount,

        taker,
      });


    /**
     * Jupiter automatic slippage protection is
     * deliberately retained.
     */
    const jupiterResponse =
      await scheduledJupiterFetch(
        `${JUPITER_API_URL}/order?${params.toString()}`,
        {
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
          /**
           * Wallet-bound transaction orders are
           * highest priority and are NEVER cached.
           */
          priority:
            "trade",

          cacheTtlMs:
            0,
        }
      );


    const text =
      await jupiterResponse.text();


    let order:
      any;


    try {

      order =
        JSON.parse(
          text
        );

    } catch {

      return NextResponse.json(
        {
          error:
            "Jupiter returned an invalid response",

          details:
            text.slice(
              0,
              300
            ),
        },
        {
          status:
            502,
        }
      );

    }

    if (
      !jupiterResponse.ok
    ) {

      console.error(
        "[trade/order] Jupiter rejected order",
        {
          ticker,

          issuer,

          symbol:
            token.symbol,

          side,

          amountUsd:
            side ===
            "buy"
              ? amountUsd
              : null,

          tokenAmount:
            side ===
            "sell"
              ? tokenAmount
              : null,

          inputMint,

          outputMint,

          status:
            jupiterResponse.status,

          response:
            order,
        }
      );


      return NextResponse.json(
        {
          error:
            order?.error ??
            order?.errorMessage ??
            "Jupiter order request failed",

          errorCode:
            order?.errorCode ??
            null,

          ticker,

          issuer,

          symbol:
            token.symbol,
        },
        {
          status:
            jupiterResponse.status,

          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
      );

    }


    const inAmount =
      BigInt(
        order.inAmount ??
        atomicAmount
      );


    const outAmount =
      BigInt(
        order.outAmount ??
        "0"
      );


    const threshold =
      order.otherAmountThreshold
        ? BigInt(
            order.otherAmountThreshold
          )
        : null;


    const inputDisplay =
      Number(
        inAmount
      ) /
      10 **
        inputDecimals;


    const outputDisplay =
      Number(
        outAmount
      ) /
      10 **
        outputDecimals;


    let shareEquivalentAmount =
      0;


    let effectivePrice:
      number |
      null =
      null;


    if (
      side ===
      "buy"
    ) {

      shareEquivalentAmount =
        outputDisplay *
        shareMultiplier;


      if (
        shareEquivalentAmount >
        0
      ) {

        effectivePrice =
          inputDisplay /
          shareEquivalentAmount;

      }

    } else {

      shareEquivalentAmount =
        inputDisplay *
        shareMultiplier;


      if (
        shareEquivalentAmount >
        0
      ) {

        effectivePrice =
          outputDisplay /
          shareEquivalentAmount;

      }

    }


    /**
     * For BUY, this is exactly the requested
     * USDC amount.
     *
     * For SELL, use the quoted USDC proceeds.
     */
    const responseAmountUsd =
      side ===
      "buy"
        ? inputDisplay
        : outputDisplay;


    const liveTradingEnabled =
      process.env
        .ENABLE_LIVE_TRADING ===
      "true";


    if (
      !order.transaction
    ) {

      const response:
        TradeOrderResponse =
        {
          status:
            "unavailable",

          ticker,

          stockName:
            stock.name,

          issuer,

          symbol:
            token.symbol,

          side,

          amountUsd:
            responseAmountUsd,

          inputMint,

          outputMint,

          inputAmount:
            inAmount.toString(),

          outputAmount:
            outAmount.toString(),

          minimumOutputAmount:
            threshold
              ?.toString() ??
            null,

          inputDisplay,

          outputDisplay,

          shareEquivalentAmount,

          effectivePrice,

          shareMultiplier,

          router:
            order.router ??
            null,

          routePlan:
            routeLabels(
              order.routePlan
            ),

          priceImpactPct:
            typeof order
              .priceImpact ===
            "number"
              ? order.priceImpact
              : null,

          slippageBps:
            typeof order
              .slippageBps ===
            "number"
              ? order.slippageBps
              : null,

          feeBps:
            typeof order
              .feeBps ===
            "number"
              ? order.feeBps
              : null,

          feeMint:
            order.feeMint ??
            null,

          gasless:
            Boolean(
              order.gasless
            ),

          transaction:
            null,

          requestId:
            order.requestId ??
            null,

          lastValidBlockHeight:
            order
              .lastValidBlockHeight ??
            null,

          expireAt:
            order.expireAt ??
            null,

          quoteCreatedAt:
            Date.now(),

          liveTradingEnabled,

          error:
            order
              .errorMessage ??
            order.error ??
            "Jupiter could quote this trade but could not build a transaction.",
        };


      return NextResponse.json(
        response,
        {
          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
      );

    }


    if (
      !order.requestId
    ) {

      return NextResponse.json(
        {
          error:
            "Jupiter order did not contain a request ID",
        },
        {
          status:
            502,
        }
      );

    }


    if (
      liveTradingEnabled
    ) {

      storeTradeOrder({
        requestId:
          order.requestId,

        walletAddress:
          taker,

        ticker,

        issuer,

        side,

        originalTransaction:
          order.transaction,
      });

    }


    const response:
      TradeOrderResponse =
      {
        status:
          liveTradingEnabled
            ? "ready"
            : "disabled",

        ticker,

        stockName:
          stock.name,

        issuer,

        symbol:
          token.symbol,

        side,

        amountUsd:
          responseAmountUsd,

        inputMint,

        outputMint,

        inputAmount:
          inAmount.toString(),

        outputAmount:
          outAmount.toString(),

        minimumOutputAmount:
          threshold
            ?.toString() ??
          null,

        inputDisplay,

        outputDisplay,

        shareEquivalentAmount,

        effectivePrice,

        shareMultiplier,

        router:
          order.router ??
          null,

        routePlan:
          routeLabels(
            order.routePlan
          ),

        priceImpactPct:
          typeof order
            .priceImpact ===
          "number"
            ? order.priceImpact
            : null,

        slippageBps:
          typeof order
            .slippageBps ===
          "number"
            ? order.slippageBps
            : null,

        feeBps:
          typeof order
            .feeBps ===
          "number"
            ? order.feeBps
            : null,

        feeMint:
          order.feeMint ??
          null,

        gasless:
          Boolean(
            order.gasless
          ),

        transaction:
          liveTradingEnabled
            ? order.transaction
            : null,

        requestId:
          liveTradingEnabled
            ? order.requestId
            : null,

        lastValidBlockHeight:
          order
            .lastValidBlockHeight ??
          null,

        expireAt:
          order.expireAt ??
          null,

        quoteCreatedAt:
          Date.now(),

        liveTradingEnabled,
      };


    return NextResponse.json(
      response,
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );

  } catch (
    error
  ) {

    console.error(
      "[trade/order]",
      error
    );


    return NextResponse.json(
      {
        error:
          "Unable to build trade order",

        details:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }

}