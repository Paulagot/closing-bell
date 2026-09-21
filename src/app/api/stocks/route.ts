//src/app/api/stocks/route.ts
import {
  NextResponse,
} from "next/server";

import {
  getStock,
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

import type {
  StockSnapshotResponse,
} from "@/types";


export const dynamic =
  "force-dynamic";


// ─────────────────────────────────────────────

export async function GET(
  request: Request
) {

  const {
    searchParams,
  } =
    new URL(
      request.url
    );


  const ticker =
    searchParams
      .get("ticker")
      ?.toUpperCase()
      .trim();


  if (
    !ticker
  ) {

    return NextResponse.json(
      {
        error:
          "Missing ticker",
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


  if (
    !stock
  ) {

    return NextResponse.json(
      {
        error:
          "Unknown stock",
      },
      {
        status:
          404,
      }
    );

  }


  try {

    const mints =
      Object.values(
        stock.issuers
      ).map(
        (issuer) =>
          issuer.mint
      );


    const [
      prices,
      referenceMap,
    ] =
      await Promise.all([
        fetchPrices(
          mints
        ),

        fetchReferencePrices(
          [
            stock.refSymbol,
          ]
        ),
      ]);


    const result:
      StockSnapshotResponse =
      {
        ticker,

        stock,

        prices,

        reference:
          referenceMap[
            stock.refSymbol
          ] ??
          null,

        marketStatus:
          getMarketStatus(),

        timestamp:
          Date.now(),
      };


    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );

  } catch (error) {

    console.error(
      "[api/stock] Error:",
      error
    );


    return NextResponse.json(
      {
        error:
          "Failed to load stock",

        details:
          String(
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