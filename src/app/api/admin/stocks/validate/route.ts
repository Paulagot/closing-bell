import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";

import {
  fetchExecutionQuote,
  fetchPrices,
} from "@/lib/jupiter";

import {
  fetchReferencePrice,
} from "@/lib/reference";

import {
  getShareMultiplier,
} from "@/lib/xstocks";

import type {
  MultiplierMode,
} from "@/types";

export const dynamic = "force-dynamic";

interface WrapperInput {
  issuer: string;
  symbol: string;
  mint: string;
  decimals: number;
  multiplierMode: MultiplierMode;
  enabled: boolean;
}

function validMint(
  value: string
) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
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

    const refSymbol =
      String(
        body?.refSymbol ?? ""
      )
        .trim()
        .toUpperCase();

    const wrappers: WrapperInput[] =
      Array.isArray(
        body?.wrappers
      )
        ? body.wrappers.map(
            (
              item: Record<
                string,
                unknown
              >
            ) => ({
              issuer:
                String(
                  item?.issuer ??
                  ""
                ).trim(),
              symbol:
                String(
                  item?.symbol ??
                  ""
                ).trim(),
              mint:
                String(
                  item?.mint ??
                  ""
                ).trim(),
              decimals:
                Number(
                  item?.decimals
                ),
              multiplierMode:
                item?.multiplierMode ===
                "xstocks"
                  ? "xstocks"
                  : "one_to_one",
              enabled:
                item?.enabled !==
                false,
            })
          )
        : [];

    if (!refSymbol) {
      return NextResponse.json(
        {
          error:
            "Reference symbol is required.",
        },
        { status: 400 }
      );
    }

    const reference =
      await fetchReferencePrice(
        refSymbol
      );

    const results = [];

    for (
      const wrapper
      of wrappers
    ) {
      if (!wrapper.enabled) {
        results.push({
          ...wrapper,
          ok: true,
          skipped: true,
          message:
            "Disabled wrapper — validation skipped.",
        });
        continue;
      }

      if (
        !wrapper.issuer ||
        !wrapper.symbol ||
        !wrapper.mint ||
        !Number.isInteger(
          wrapper.decimals
        )
      ) {
        results.push({
          ...wrapper,
          ok: false,
          message:
            "Issuer, symbol, mint and decimals are required.",
        });
        continue;
      }

      if (
        !validMint(
          wrapper.mint
        )
      ) {
        results.push({
          ...wrapper,
          ok: false,
          message:
            "Mint is not a valid Solana public key.",
        });
        continue;
      }

      const priceMap =
        await fetchPrices([
          wrapper.mint,
        ]);

      const price =
        priceMap[
          wrapper.mint
        ];

      if (
        !price ||
        price.priceUsd ===
          null
      ) {
        results.push({
          ...wrapper,
          ok: false,
          message:
            "Jupiter did not return an indicative price for this mint.",
        });
        continue;
      }

      let multiplier =
        1;

      try {
        multiplier =
          await getShareMultiplier(
            wrapper.issuer,
            wrapper.symbol
          );
      } catch (error) {
        results.push({
          ...wrapper,
          ok: false,
          priceUsd:
            price.priceUsd,
          message:
            error instanceof Error
              ? error.message
              : String(error),
        });
        continue;
      }

      const quote =
        await fetchExecutionQuote(
          wrapper.mint,
          wrapper.decimals,
          "buy",
          1000,
          price.priceUsd,
          reference?.price ??
            reference?.previousClose ??
            null,
          multiplier
        );

      results.push({
        ...wrapper,
        ok:
          quote.status ===
          "ok",
        priceUsd:
          price.priceUsd,
        liquidityUsd:
          price.liquidityUsd,
        multiplier,
        buyQuoteStatus:
          quote.status,
        buyEffectivePrice:
          quote.effectivePrice,
        message:
          quote.status ===
          "ok"
            ? "Finnhub/Jupiter checks passed and a $1K BUY route is available."
            : quote.error ??
              `Jupiter BUY route status: ${quote.status}`,
      });
    }

    return NextResponse.json({
      reference: {
        symbol:
          refSymbol,
        ok:
          reference !==
          null,
        price:
          reference?.price ??
          null,
        previousClose:
          reference?.previousClose ??
          null,
      },
      wrappers:
        results,
      ok:
        reference !==
          null &&
        results.every(
          (item) =>
            item.ok
        ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Validation failed",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
