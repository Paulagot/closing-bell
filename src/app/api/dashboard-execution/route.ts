import {
  NextResponse,
} from "next/server";

import {
  readStockRegistry,
} from "@/lib/stockRegistry";

import {
  readHistory,
} from "@/lib/history/storage";

import type {
  ExecutionQuote,
  TokenExecutions,
} from "@/types";

import type {
  HistoryIssuerSnapshot,
} from "@/types/history";


export const dynamic =
  "force-dynamic";

export const revalidate =
  0;


interface DashboardExecutionSnapshot {
  /**
   * Latest capture time found across all tickers.
   *
   * This is NOT the time that Jupiter was queried
   * for every stock at once.
   */
  generatedAt: string;

  /**
   * Each stock can have a different latest capture
   * time, so StockCard gets the ticker-specific time.
   */
  tickerGeneratedAt: Record<
    string,
    string
  >;

  executions: Record<
    string,
    TokenExecutions
  >;
}


function historyBuyQuote(
  issuer:
    HistoryIssuerSnapshot,
  notionalUsd:
    number
): ExecutionQuote {

  return {
    status:
      issuer.buy.status,

    side:
      "buy",

    notionalUsd,

    /**
     * The history snapshot deliberately stores the
     * normalized executable economics rather than
     * the full transient Jupiter order quantities.
     *
     * Homepage ranking/cards only require
     * effectivePrice + status.
     */
    tokenAmount:
      null,

    shareEquivalentAmount:
      null,

    usdcAmount:
      null,

    effectivePrice:
      issuer.buy
        .effectivePrice,

    rawEffectivePrice:
      null,

    priceImpactPct:
      issuer.buy
        .priceImpactPct,

    executionCostPct:
      null,

    slippageBps:
      issuer.buy
        .slippageBps,

    feeBps:
      issuer.buy
        .feeBps,

    feeMint:
      null,

    shareMultiplier:
      issuer.shareMultiplier,

    routePlan:
      [],
  };
}


function historySellQuote(
  issuer:
    HistoryIssuerSnapshot,
  notionalUsd:
    number
): ExecutionQuote {

  return {
    status:
      issuer.sell.status,

    side:
      "sell",

    notionalUsd,

    tokenAmount:
      null,

    shareEquivalentAmount:
      null,

    usdcAmount:
      null,

    effectivePrice:
      issuer.sell
        .effectivePrice,

    rawEffectivePrice:
      null,

    priceImpactPct:
      issuer.sell
        .priceImpactPct,

    executionCostPct:
      null,

    slippageBps:
      issuer.sell
        .slippageBps,

    feeBps:
      issuer.sell
        .feeBps,

    feeMint:
      null,

    shareMultiplier:
      issuer.shareMultiplier,

    routePlan:
      [],
  };
}


export async function GET() {

  console.log(
    "[dashboard-execution] Reading stored $1K history snapshots"
  );


  try {

    const executions: Record<
      string,
      TokenExecutions
    > = {};


    const tickerGeneratedAt: Record<
      string,
      string
    > = {};


    let latestTimestamp =
      0;

    const registry =
      await readStockRegistry();


    /**
     * Local JSON reads are cheap and require zero
     * Jupiter calls.
     *
     * Importantly, this endpoint NEVER creates a
     * history snapshot. Stock-page history capture
     * and the scheduled history collector are the
     * only things that populate history.
     */
    await Promise.all(
      Object.entries(
        registry
      ).map(
        async (
          [
            ticker,
            stock,
          ]
        ) => {

          const history =
            await readHistory(
              ticker
            );


          const latest =
            history[
              history.length - 1
            ];


          if (!latest) {
            return;
          }


          /**
           * Homepage is intentionally standardized on
           * the same canonical $1K historical quote.
           */
          if (
            latest.canonicalSizeUsd !==
            1000
          ) {
            return;
          }


          tickerGeneratedAt[
            ticker
          ] =
            latest.capturedAt ??
            new Date(
              latest.timestamp
            ).toISOString();


          latestTimestamp =
            Math.max(
              latestTimestamp,
              latest.timestamp
            );


          for (
            const [
              issuerName,
              token,
            ]
            of Object.entries(
              stock.issuers
            )
          ) {

            const storedIssuer =
              latest.issuers.find(
                (
                  issuer
                ) =>
                  issuer.mint ===
                    token.mint ||
                  issuer.issuer ===
                    issuerName
              );


            if (!storedIssuer) {
              continue;
            }


            executions[
              token.mint
            ] ??= {
              buy:
                {},
              sell:
                {},
            };


            executions[
              token.mint
            ].buy[
              "1000"
            ] =
              historyBuyQuote(
                storedIssuer,
                1000
              );


            executions[
              token.mint
            ].sell[
              "1000"
            ] =
              historySellQuote(
                storedIssuer,
                1000
              );

          }

        }
      )
    );


    const snapshot:
      DashboardExecutionSnapshot = {

      generatedAt:
        new Date(
          latestTimestamp ||
          Date.now()
        ).toISOString(),

      tickerGeneratedAt,

      executions,

    };


    console.log(
      `[dashboard-execution] Stored snapshot ready: ${Object.keys(
        executions
      ).length} wrapper quotes`
    );


    return NextResponse.json(
      snapshot,
      {
        headers: {
          /**
           * These are stored historical values, so a
           * short browser/CDN cache is safe.
           */
          "Cache-Control":
            "public, s-maxage=30, stale-while-revalidate=120",
        },
      }
    );

  } catch (
    error
  ) {

    console.error(
      "[dashboard-execution] Stored snapshot error:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Failed to read stored dashboard execution snapshots",

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
