import {
  getStock,
  readStockRegistry,
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

import {
  appendHistorySnapshot,
} from "@/lib/history/storage";

import {
  capturePaperLabForSnapshot,
} from "@/lib/paperLab/engine";

import {
  approxBreakEvenMovePct,
  divergenceAfterBreakEvenPct,
  executionGapPct,
  gapPct,
} from "@/lib/history/math";

import type {
  ExecutionQuote,
} from "@/types";

import type {
  HistoryExecutionQuote,
  HistorySnapshot,
} from "@/types/history";

export const HISTORY_CANONICAL_SIZE_USD =
  1000;

function quoteForHistory(
  quote: ExecutionQuote
): HistoryExecutionQuote {
  return {
    status:
      quote.status,

    effectivePrice:
      quote.effectivePrice,
    tokenAmount: quote.tokenAmount,
    usdcAmount: quote.usdcAmount,
    executionCostPct: quote.executionCostPct,
    routePlan: quote.routePlan,

    priceImpactPct:
      quote.priceImpactPct,

    slippageBps:
      quote.slippageBps,

    feeBps:
      quote.feeBps,
  };
}

function unavailableQuote(
  side:
    "buy" |
    "sell",
  shareMultiplier: number
): ExecutionQuote {
  return {
    status:
      "unavailable",

    side,

    notionalUsd:
      HISTORY_CANONICAL_SIZE_USD,

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
      "Token decimals unavailable",
  };
}

export async function captureTickerSnapshot(
  requestedTicker: string
): Promise<HistorySnapshot> {
  const ticker =
    requestedTicker
      .trim()
      .toUpperCase();

  const stock =
    await getStock(
      ticker
    );

  if (!stock) {
    throw new Error(
      `Unsupported ticker ${ticker}`
    );
  }

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

  const reference =
    references[
      stock.refSymbol
    ] ??
    null;

  const marketStatus =
    getMarketStatus();

  /**
   * Finnhub quote `c` is the current/latest US-market price.
   *
   * IMPORTANT:
   * Do not switch to `previousClose` merely because the regular
   * US session is closed. `previousClose` is the prior completed
   * session and caused the artificial benchmark drop visible in
   * the original history.
   *
   * It remains a fallback only if the latest/current price is
   * unavailable.
   */
  const benchmark =
    reference?.price ??
    reference?.previousClose ??
    null;

  const benchmarkSource:
    HistorySnapshot["benchmarkSource"] =
    reference?.price !==
      null &&
    reference?.price !==
      undefined
      ? "latest_price"
      : reference?.previousClose !==
            null &&
          reference?.previousClose !==
            undefined
        ? "previous_close_fallback"
        : "unavailable";

  const benchmarkTimestamp =
    reference?.timestamp ??
    null;

  const issuers:
    HistorySnapshot[
      "issuers"
    ] = [];

  for (
    const [
      issuer,
      token,
    ]
    of issuerEntries
  ) {
    const tokenPrice =
      prices[
        token.mint
      ];

    const rawIndicative =
      tokenPrice
        ?.priceUsd ??
      null;

    const decimals =
      tokenPrice
        ?.decimals ??
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
      error
    ) {
      console.warn(
        `[history] ${ticker}/${issuer} multiplier unavailable`,
        error
      );
    }

    const indicativePrice =
      rawIndicative !==
        null &&
      shareMultiplier >
        0
        ? rawIndicative /
          shareMultiplier
        : null;

    const buyQuote =
      decimals ===
      null
        ? unavailableQuote(
            "buy",
            shareMultiplier
          )
        : await fetchExecutionQuote(
            token.mint,
            decimals,
            "buy",
            HISTORY_CANONICAL_SIZE_USD,
            rawIndicative,
            benchmark,
            shareMultiplier
          );

    const sellQuote =
      decimals ===
      null
        ? unavailableQuote(
            "sell",
            shareMultiplier
          )
        : await fetchExecutionQuote(
            token.mint,
            decimals,
            "sell",
            HISTORY_CANONICAL_SIZE_USD,
            rawIndicative,
            benchmark,
            shareMultiplier
          );

    const buyGap =
      gapPct(
        buyQuote
          .effectivePrice,
        benchmark
      );

    const sellGap =
      gapPct(
        sellQuote
          .effectivePrice,
        benchmark
      );

    const breakEven =
      approxBreakEvenMovePct(
        buyQuote
          .effectivePrice,
        sellQuote
          .effectivePrice
      );

    issuers.push({
      issuer,

      symbol:
        token.symbol,

      mint:
        token.mint,

      decimals:
        decimals ?? undefined,

      shareMultiplier,

      indicativePrice,

      liquidityUsd:
        tokenPrice
          ?.liquidityUsd ??
        null,

      buy:
        quoteForHistory(
          buyQuote
        ),

      sell:
        quoteForHistory(
          sellQuote
        ),

      buyGapPct:
        buyGap,

      sellGapPct:
        sellGap,

      executionGapPct:
        executionGapPct(
          buyQuote
            .effectivePrice,
          sellQuote
            .effectivePrice
        ),

      approxBreakEvenMovePct:
        breakEven,

      divergenceAfterBreakEvenPct:
        divergenceAfterBreakEvenPct(
          buyGap,
          breakEven
        ),
    });
  }

  const snapshot:
    HistorySnapshot = {
      version:
        3,

      timestamp:
        Date.now(),

      capturedAt:
        new Date()
          .toISOString(),

      ticker,

      stockName:
        stock.name,

      refSymbol:
        stock.refSymbol,

      canonicalSizeUsd:
        HISTORY_CANONICAL_SIZE_USD,

      marketOpen:
        marketStatus.open,

      marketLabel:
        marketStatus.label,

      benchmarkPrice:
        benchmark,

      benchmarkTimestamp,

      benchmarkSource,

      previousClose:
        reference
          ?.previousClose ??
        null,

      issuers,
    };

  await appendHistorySnapshot(
    snapshot
  );

  /**
   * The private Paper Lab deliberately piggybacks on the same
   * scheduled $1,000 capture. It REUSES history quotes without
   * requesting duplicate lab BUY/SELL quotes, and advances open positions. A lab failure must never
   * prevent the public/history snapshot from being stored.
   */
  try {
    await capturePaperLabForSnapshot(
      snapshot
    );
  } catch (error) {
    console.error(
      `[paper-lab] ${ticker} capture failed`,
      error
    );
  }

  return snapshot;
}

export async function captureAllTickerSnapshots() {
  const results:
    Array<{
      ticker: string;
      ok: boolean;
      error?: string;
    }> = [];

  const registry =
    await readStockRegistry();

  for (
    const ticker
    of Object.keys(
      registry
    )
  ) {
    try {
      await captureTickerSnapshot(
        ticker
      );

      results.push({
        ticker,
        ok:
          true,
      });
    } catch (
      error
    ) {
      results.push({
        ticker,
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      });
    }
  }

  return results;
}
