import { NextResponse } from "next/server";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";

import {
  readStockRegistryAdmin,
  upsertStock,
} from "@/lib/stockRegistry";

import type {
  Stock,
} from "@/types";

export const dynamic = "force-dynamic";

function cleanStock(
  raw: unknown
): Stock {
  const input =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const rawIssuers =
    input.issuers &&
    typeof input.issuers === "object"
      ? (
          input.issuers as Record<
            string,
            Record<string, unknown>
          >
        )
      : {};

  const issuers: Stock["issuers"] = {};

  for (
    const [issuerName, rawToken]
    of Object.entries(rawIssuers)
  ) {
    const issuer =
      issuerName.trim();

    const symbol =
      String(
        rawToken?.symbol ?? ""
      ).trim();

    const mint =
      String(
        rawToken?.mint ?? ""
      ).trim();

    const decimals =
      Number(
        rawToken?.decimals
      );

    if (
      !issuer ||
      !symbol ||
      !mint ||
      !Number.isInteger(decimals) ||
      decimals < 0 ||
      decimals > 18
    ) {
      throw new Error(
        "Each wrapper needs an issuer, symbol, mint and decimals between 0 and 18."
      );
    }

    issuers[issuer] = {
      symbol,
      mint,
      decimals,
      enabled:
        rawToken?.enabled !== false,
      multiplierMode:
        rawToken?.multiplierMode ===
        "xstocks"
          ? "xstocks"
          : "one_to_one",
    };
  }

  const name =
    String(
      input.name ?? ""
    ).trim();

  const refSymbol =
    String(
      input.refSymbol ?? ""
    )
      .trim()
      .toUpperCase();

  if (!name || !refSymbol) {
    throw new Error(
      "Company name and reference symbol are required."
    );
  }

  if (
    Object.keys(issuers).length === 0
  ) {
    throw new Error(
      "Add at least one wrapper."
    );
  }

  const assetType =
    input.assetType === "etf" ||
    input.assetType === "private_equity"
      ? input.assetType
      : "public_stock";

  return {
    name,
    refSymbol,
    assetType,
    exchange:
      String(
        input.exchange ?? ""
      ).trim(),
    enabled:
      input.enabled !== false,
    issuers,
  };
}

export async function GET(
  request: Request
) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const stocks =
      await readStockRegistryAdmin();

    return NextResponse.json({
      stocks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Unable to load stock registry",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body =
      await request.json();

    const ticker =
      String(
        body?.ticker ?? ""
      )
        .trim()
        .toUpperCase();

    if (
      !ticker ||
      !/^[A-Z0-9._-]{1,16}$/.test(
        ticker
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Ticker must contain only letters, numbers, dot, dash or underscore.",
        },
        { status: 400 }
      );
    }

    const stock =
      cleanStock(
        body?.stock
      );

    const existing =
      await readStockRegistryAdmin();

    for (
      const [
        existingTicker,
        existingStock,
      ]
      of Object.entries(existing)
    ) {
      if (
        existingTicker === ticker
      ) {
        continue;
      }

      for (
        const token
        of Object.values(
          existingStock.issuers
        )
      ) {
        for (
          const newToken
          of Object.values(
            stock.issuers
          )
        ) {
          if (
            token.mint ===
            newToken.mint
          ) {
            return NextResponse.json(
              {
                error:
                  `Mint is already assigned to ${existingTicker}.`,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    const stocks =
      await upsertStock(
        ticker,
        stock
      );

    return NextResponse.json({
      ok: true,
      ticker,
      stock:
        stocks[ticker],
      stocks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Unable to save stock",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 400 }
    );
  }
}
