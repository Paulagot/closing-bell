import { NextResponse } from "next/server";
import { getStock } from "@/lib/stockRegistry";
import { buildTickerDailyIssuerRanges } from "@/lib/paperLab/dailyRanges";
import { readHistory } from "@/lib/history/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const ticker = new URL(request.url).searchParams.get("ticker")?.trim().toUpperCase();
  if (!ticker || !/^[A-Z0-9._-]{1,15}$/.test(ticker)) {
    return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
  }
  const stock = await getStock(ticker);
  if (!stock || stock.enabled === false) {
    return NextResponse.json({ error: "Unknown stock" }, { status: 404 });
  }
  try {
    const [ranges, history] = await Promise.all([
      buildTickerDailyIssuerRanges(ticker),
      readHistory(ticker),
    ]);
    const latest = [...history].reverse().find((snapshot) => snapshot.canonicalSizeUsd === 1000);
    const freshQuote = latest && Date.now() - latest.timestamp <= 30 * 60 * 1000;
    const byMint = new Map((latest?.issuers ?? []).map((row) => [row.mint, row]));
    const enabled = new Set(Object.entries(stock.issuers).filter(([, token]) => token.enabled !== false).map(([issuer, token]) => `${issuer}:${token.symbol}`));
    return NextResponse.json({
      ticker,
      quoteSizeUsd: 1000,
      capturedAt: latest?.timestamp ?? null,
      issuers: ranges.filter((range) => enabled.has(`${range.issuer}:${range.symbol}`)).map((range) => {
        const mint = stock.issuers[range.issuer]?.mint;
        const current = mint ? byMint.get(mint) : undefined;
        const friction = freshQuote && current?.buy.status === "ok" && current.sell.status === "ok" ? current.approxBreakEvenMovePct : null;
        return { ...range, currentFrictionPct: friction, frictionAt: friction !== null && friction !== undefined ? latest?.timestamp ?? null : null };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[stock-movement]", error);
    return NextResponse.json({ error: "Unable to load price movement" }, { status: 500 });
  }
}
