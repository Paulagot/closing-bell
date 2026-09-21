import {
  NextResponse,
} from "next/server";

import {
  getStock,
} from "@/lib/stockRegistry";

import {
  fetchExecutionQuote,
  fetchPrices,
} from "@/lib/jupiter";

import {
  fetchReferencePrices,
} from "@/lib/reference";

import {
  getShareMultiplier,
} from "@/lib/xstocks";

import {
  getMarketStatus,
} from "@/lib/market";

import type {
  ExecutionQuote,
  StockExecutionResponse,
  TradeSide,
} from "@/types";


export const dynamic =
  "force-dynamic";

export const revalidate =
  0;


// ─────────────────────────────────────────────
// Unavailable quote helper
// ─────────────────────────────────────────────

function unavailableQuote(
  side: TradeSide,
  amountUsd: number,
  shareMultiplier: number,
  error: string
): ExecutionQuote {

  return {
    status:
      "unavailable",

    side,

    notionalUsd:
      amountUsd,

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

    error,
  };

}


// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(
  request: Request
) {

  try {

    const body =
      await request.json();


    const ticker =
      String(
        body?.ticker ??
        ""
      )
        .trim()
        .toUpperCase();


    const amountUsd =
      Number(
        body?.amountUsd
      );


    // ─────────────────────────────────────────
    // Validate request
    // ─────────────────────────────────────────

    if (!ticker) {

      return NextResponse.json(
        {
          error:
            "Ticker is required",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !Number.isFinite(
        amountUsd
      ) ||
      amountUsd <
        1 ||
      amountUsd >
        100_000
    ) {

      return NextResponse.json(
        {
          error:
            "Amount must be between $1 and $100,000",
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
            404,
        }
      );

    }


    // ─────────────────────────────────────────
    // Market/reference data
    // ─────────────────────────────────────────

    const issuerEntries =
      Object.entries(
        stock.issuers
      );


    const mints =
      issuerEntries.map(
        (
          [
            ,
            token,
          ]
        ) =>
          token.mint
      );


    const [
      prices,
      references,
    ] =
      await Promise.all([

        fetchPrices(
          mints
        ),

        fetchReferencePrices([
          stock.refSymbol,
        ]),

      ]);


    const marketStatus =
      getMarketStatus();


    const reference =
      references[
        stock.refSymbol
      ] ??
      null;


    /**
     * Finnhub `price` is the current/latest US-market price.
     *
     * Do not switch to `previousClose` outside the regular session.
     * `previousClose` is retained only as a fallback if Finnhub does
     * not return a usable current/latest price.
     */
    const benchmark =
      reference?.price ??
      reference?.previousClose ??
      null;


    const previousClose =
      reference
        ?.previousClose ??
      null;


    // ─────────────────────────────────────────
    // Issuer execution
    // ─────────────────────────────────────────

    const issuers:
      StockExecutionResponse[
        "issuers"
      ] = [];


    /**
     * Deliberately process issuers sequentially.
     *
     * Each issuer needs a BUY and SELL V2 quote.
     * Serial execution is slower but substantially
     * less likely to hit Jupiter rate limits.
     */
    for (
      const [
        issuer,
        token,
      ]
      of issuerEntries
    ) {

      const price =
        prices[
          token.mint
        ];


      const rawMidpoint =
        price?.priceUsd ??
        null;


      const decimals =
        price?.decimals ??
        token.decimals ??
        null;


      let shareMultiplier =
        1;


      try {

        shareMultiplier =
          await getShareMultiplier(
            issuer,
            token.symbol
          );

      } catch (
        multiplierError
      ) {

        console.error(
          `[quote] ${ticker} / ${issuer} multiplier failed:`,
          multiplierError
        );


        issuers.push({
          issuer,

          symbol:
            token.symbol,

          mint:
            token.mint,

          midpoint:
            rawMidpoint,

          rawMidpoint,

          shareMultiplier:
            1,

          buyQuote:
            unavailableQuote(
              "buy",
              amountUsd,
              1,
              "Unable to resolve wrapper share multiplier"
            ),

          sellQuote:
            unavailableQuote(
              "sell",
              amountUsd,
              1,
              "Unable to resolve wrapper share multiplier"
            ),
        });


        continue;

      }


      /**
       * Convert the raw token indication into
       * price per underlying-share equivalent.
       */
      const normalizedMidpoint =
        rawMidpoint !==
          null &&
        shareMultiplier >
          0
          ? rawMidpoint /
            shareMultiplier
          : null;


      if (
        decimals ===
        null
      ) {

        issuers.push({
          issuer,

          symbol:
            token.symbol,

          mint:
            token.mint,

          midpoint:
            normalizedMidpoint,

          rawMidpoint,

          shareMultiplier,

          buyQuote:
            unavailableQuote(
              "buy",
              amountUsd,
              shareMultiplier,
              "Token decimals are unavailable"
            ),

          sellQuote:
            unavailableQuote(
              "sell",
              amountUsd,
              shareMultiplier,
              "Token decimals are unavailable"
            ),
        });


        continue;

      }


      console.log(
        `[quote] ${ticker} / ${issuer} / ${amountUsd}`
      );


      /**
       * BUY first, then SELL.
       *
       * Do not Promise.all these calls because
       * Jupiter V2 rate limiting is much easier
       * to hit when all issuers and sides fire
       * simultaneously.
       */
      const buyQuote =
        await fetchExecutionQuote(
          token.mint,
          decimals,
          "buy",
          amountUsd,
          rawMidpoint,
          benchmark,
          shareMultiplier
        );


      const sellQuote =
        await fetchExecutionQuote(
          token.mint,
          decimals,
          "sell",
          amountUsd,
          rawMidpoint,
          benchmark,
          shareMultiplier
        );


      issuers.push({
        issuer,

        symbol:
          token.symbol,

        mint:
          token.mint,

        midpoint:
          normalizedMidpoint,

        rawMidpoint,

        shareMultiplier,

        buyQuote,

        sellQuote,
      });

    }


    // ─────────────────────────────────────────
    // Response
    // ─────────────────────────────────────────

    const response:
      StockExecutionResponse = {

      ticker,

      stockName:
        stock.name,

      amountUsd,

      referencePrice:
        benchmark,

      previousClose,

      marketStatus,

      issuers,

      timestamp:
        Date.now(),

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
      "[quote]",
      error
    );


    return NextResponse.json(
      {
        error:
          "Unable to compare execution",

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
