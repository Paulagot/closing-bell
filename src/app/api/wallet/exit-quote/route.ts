import { NextResponse } from "next/server";
import { getStock } from "@/lib/stockRegistry";
import { fetchExactTokenSellQuote } from "@/lib/paperLab/execution";
import { getShareMultiplier } from "@/lib/xstocks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Indicative, non-executing exact-input quote for a supported wallet holding.
 * A live quote is not a fill or a guarantee of output. Never accepts mint
 * decimals or share multiplier from the caller. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const ticker = String(body?.ticker ?? "").trim().toUpperCase();
    const mint = String(body?.mint ?? "").trim();
    const tokenAmount = Number(body?.tokenAmount);
    if (!/^[A-Z0-9._-]{1,20}$/.test(ticker) || !mint ||
        !Number.isFinite(tokenAmount) || tokenAmount <= 0 || tokenAmount > 1_000_000) {
      return NextResponse.json({ error: "Invalid supported holding or token quantity." }, { status: 400 });
    }
    const stock = await getStock(ticker);
    if (!stock || stock.enabled === false) {
      return NextResponse.json({ error: "Stock is not supported." }, { status: 404 });
    }
    const found = Object.entries(stock.issuers).find(([, issuer]) => issuer.enabled !== false && issuer.mint === mint);
    const token = found?.[1];
    if (!token || !Number.isInteger(token.decimals) || token.decimals! < 0 || token.decimals! > 18) {
      return NextResponse.json({ error: "Token mint or decimals are not supported." }, { status: 404 });
    }
    const shareMultiplier = await getShareMultiplier(found![0], token.symbol);
    const result = await fetchExactTokenSellQuote(mint, token.decimals!, tokenAmount, shareMultiplier);
    if (result.status !== "ok" || result.usdcAmount === null) {
      return NextResponse.json({ error: result.error ?? "No live SELL route for this balance." }, { status: 503 });
    }
    return NextResponse.json({ ...result, quotedAt: Date.now(), tokenAmount });
  } catch (error) {
    console.error("[wallet/exit-quote]", error);
    return NextResponse.json({ error: "Unable to quote the wallet SELL amount." }, { status: 500 });
  }
}
