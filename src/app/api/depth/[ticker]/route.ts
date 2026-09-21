import { NextResponse } from "next/server";

import { getStock } from "@/lib/stockRegistry";
import { fetchExecutionQuote, fetchPrices } from "@/lib/jupiter";
import { fetchReferencePrices } from "@/lib/reference";
import { getShareMultiplier } from "@/lib/xstocks";
import {
  approxBreakEvenMovePct,
  gapPct,
} from "@/lib/history/math";

import type { IssuerDepthResponse } from "@/types/history";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_SIZES = [100, 1000, 10000];

function requestedSizes(url: URL) {
  const raw = url.searchParams.get("sizes");
  if (!raw) return ALLOWED_SIZES;

  return Array.from(
    new Set(
      raw
        .split(",")
        .map(Number)
        .filter((size) => ALLOWED_SIZES.includes(size))
    )
  );
}

export async function GET(
  request: Request,
  context: { params: { ticker: string } }
) {
  const ticker = String(context.params.ticker ?? "")
    .trim()
    .toUpperCase();

  const stock = await getStock(ticker);

  if (!stock) {
    return NextResponse.json(
      { error: "Ticker is not supported by Closing Bell" },
      { status: 404 }
    );
  }

  const url = new URL(request.url);
  const issuer = String(url.searchParams.get("issuer") ?? "").trim();
  const token = stock.issuers[issuer];

  if (!token) {
    return NextResponse.json(
      { error: "Issuer is not supported for this stock" },
      { status: 400 }
    );
  }

  const sizesToFetch = requestedSizes(url);

  if (!sizesToFetch.length) {
    return NextResponse.json(
      { error: "No supported depth sizes were requested" },
      { status: 400 }
    );
  }

  try {
    const [prices, references, shareMultiplier] = await Promise.all([
      fetchPrices([token.mint]),
      fetchReferencePrices([stock.refSymbol]),
      getShareMultiplier(issuer, token.symbol),
    ]);

    const tokenPrice = prices[token.mint];
    const rawMidpoint = tokenPrice?.priceUsd ?? null;
    const decimals = tokenPrice?.decimals ?? token.decimals ?? null;

    if (decimals === null) {
      return NextResponse.json(
        { error: "Token decimals are unavailable" },
        { status: 503 }
      );
    }

    const reference = references[stock.refSymbol];
    // Match the canonical history benchmark: never jump back to the prior
    // session's close solely because Wall Street is closed.
    const benchmark = reference?.price ?? reference?.previousClose ?? null;

    const sizes: IssuerDepthResponse["sizes"] = [];

    for (const size of sizesToFetch) {
      const buy = await fetchExecutionQuote(
        token.mint,
        decimals,
        "buy",
        size,
        rawMidpoint,
        benchmark,
        shareMultiplier
      );

      const sell = await fetchExecutionQuote(
        token.mint,
        decimals,
        "sell",
        size,
        rawMidpoint,
        benchmark,
        shareMultiplier
      );

      sizes.push({
        sizeUsd: size,
        buyPrice: buy.effectivePrice,
        sellPrice: sell.effectivePrice,
        buyImpactPct: buy.priceImpactPct,
        sellImpactPct: sell.priceImpactPct,
        buyGapPct: gapPct(buy.effectivePrice, benchmark),
        sellGapPct: gapPct(sell.effectivePrice, benchmark),
        approxBreakEvenMovePct: approxBreakEvenMovePct(
          buy.effectivePrice,
          sell.effectivePrice
        ),
        buyStatus: buy.status,
        sellStatus: sell.status,
      });
    }

    const response: IssuerDepthResponse = {
      ticker,
      issuer,
      symbol: token.symbol,
      benchmarkPrice: benchmark,
      reportedLiquidityUsd: tokenPrice?.liquidityUsd ?? null,
      sizes,
      timestamp: Date.now(),
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[depth]", error);

    return NextResponse.json(
      {
        error: "Unable to test market depth",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
