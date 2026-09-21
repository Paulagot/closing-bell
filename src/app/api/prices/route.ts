import {
  NextResponse,
} from "next/server";

import {
  getAllMints,
  readStockRegistry,
} from "@/lib/stockRegistry";

import {
  fetchPrices,
} from "@/lib/jupiter";

import {
  fetchReferencePrices,
} from "@/lib/reference";

import {
  getMarketStatus,
} from "@/lib/market";

import {
  getShareMultiplier,
} from "@/lib/xstocks";

import type {
  ComparisonData,
  TokenExecutions,
  TokenPrice,
} from "@/types";


export const dynamic =
  "force-dynamic";

export const revalidate =
  0;


/**
 * Prevent duplicate simultaneous dashboard
 * calculations inside the same server process.
 */
let inFlightRequest:
  Promise<ComparisonData> |
  null = null;


// ─────────────────────────────────────────────

async function buildComparisonData():
  Promise<ComparisonData> {

  const registry =
    await readStockRegistry();

  const mints =
    await getAllMints();


  const referenceSymbols =
    Array.from(
      new Set(
        Object.values(
          registry
        ).map(
          (stock) =>
            stock.refSymbol
        )
      )
    );


  /**
   * IMPORTANT:
   *
   * This endpoint still uses Jupiter Price V3 only.
   *
   * It does NOT call the Swap API.
   *
   * The cached $1K executable BUY snapshot is
   * handled separately by:
   *
   * /api/dashboard-execution
   */
  const [
    rawPrices,
    reference,
  ] =
    await Promise.all([
      fetchPrices(
        mints
      ),

      fetchReferencePrices(
        referenceSymbols
      ),
    ]);


  /**
   * Clone prices before enriching them.
   *
   * xStocks can have an economic share multiplier,
   * so the dashboard needs the normalized
   * USD-per-underlying-share price.
   */
  const prices: Record<
    string,
    TokenPrice
  > = {
    ...rawPrices,
  };


  /**
   * Resolve multipliers.
   *
   * Non-xStocks return 1 immediately.
   * xStocks uses the cached xStocks API helper.
   */
  const multiplierJobs:
    Promise<void>[] =
    [];


  for (
    const stock
    of Object.values(
      registry
    )
  ) {

    for (
      const [
        issuer,
        token,
      ]
      of Object.entries(
        stock.issuers
      )
    ) {

      multiplierJobs.push(
        (
          async () => {

            const price =
              prices[
                token.mint
              ];


            if (!price) {
              return;
            }


            try {

              const multiplier =
                await getShareMultiplier(
                  issuer,
                  token.symbol
                );


              const rawPrice =
                price.priceUsd;


              prices[
                token.mint
              ] = {
                ...price,

                shareMultiplier:
                  multiplier,

                normalizedPriceUsd:
                  rawPrice !==
                    null
                    ? rawPrice /
                      multiplier
                    : null,
              };

            } catch (
              error
            ) {

              console.error(
                `[api/prices] Multiplier failed for ${issuer} ${token.symbol}:`,
                error
              );


              /**
               * Do not fail the whole dashboard because
               * one multiplier lookup failed.
               *
               * The token's raw Price V3 value remains
               * available.
               */
              prices[
                token.mint
              ] = {
                ...price,
              };

            }

          }
        )()
      );

    }

  }


  await Promise.all(
    multiplierJobs
  );


  /**
   * Keep executions in ComparisonData because
   * existing homepage components expect the field.
   *
   * Actual $1K BUY executions are loaded separately
   * from /api/dashboard-execution.
   */
  const executions: Record<
    string,
    TokenExecutions
  > = {};


  for (
    const mint
    of mints
  ) {

    executions[
      mint
    ] = {
      buy: {},
      sell: {},
    };

  }


  return {
    stocks:
      registry,

    prices,

    executions,

    reference,

    marketStatus:
      getMarketStatus(),

    timestamp:
      Date.now(),
  };
}


// ─────────────────────────────────────────────

export async function GET() {

  console.log(
    "[api/prices] Dashboard request received"
  );


  try {

    if (
      !inFlightRequest
    ) {

      inFlightRequest =
        buildComparisonData()
          .finally(
            () => {

              inFlightRequest =
                null;

            }
          );

    } else {

      console.log(
        "[api/prices] Reusing in-flight dashboard request"
      );

    }


    const data =
      await inFlightRequest;


    return NextResponse.json(
      data,
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );

  } catch (
    error
  ) {

    console.error(
      "[api/prices] Error:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Failed to build dashboard data",

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
