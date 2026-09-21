import { readStockRegistry } from "@/lib/stockRegistry";
import { readHistory } from "@/lib/history/storage";
import type { HistoryIssuerSnapshot } from "@/types/history";

/** Every value is a sampled $1,000 effective quote, never a full-session high/low. */
export interface DailyIssuerRange {
  ticker: string;
  issuer: string;
  symbol: string;
  dateUtc: string;
  completeDay: boolean;
  samples: number;
  buySamples: number;
  sellSamples: number;
  buyLow: number | null;
  buyLowAt: number | null;
  buyHigh: number | null;
  buyHighAt: number | null;
  sellLow: number | null;
  sellLowAt: number | null;
  sellHigh: number | null;
  sellHighAt: number | null;
  buyRangePct: number | null;
  sellRangePct: number | null;
  /** Highest later sampled sell compared with an earlier buy; not an achievable backtest return. */
  bestChronologicalLongPct: number | null;
}
export interface IssuerDailyRangeSummary {
  ticker: string;
  issuer: string;
  symbol: string;
  latest: DailyIssuerRange;
  completedDays: number;
  avgBuyRangePct: number | null;
  avgSellRangePct: number | null;
}
function validPrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function dateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}
function computeDay(
  ticker: string, issuer: string, symbol: string, dateUtc: string,
  entries: Array<{ timestamp: number; row: HistoryIssuerSnapshot }>,
  todayUtc: string
): DailyIssuerRange {
  let buyLow: number | null = null;
  let buyHigh: number | null = null;
  let sellLow: number | null = null;
  let sellHigh: number | null = null;
  let buyLowAt: number | null = null;
  let buyHighAt: number | null = null;
  let sellLowAt: number | null = null;
  let sellHighAt: number | null = null;
  let buySamples = 0;
  let sellSamples = 0;
  let earliestBuy: number | null = null;
  let bestChronologicalLongPct: number | null = null;
  // A later SELL must follow the BUY, and the quotes must be for the same issuer.
  for (const { timestamp, row } of entries.sort((a, b) => a.timestamp - b.timestamp)) {
    const buy = row.buy.status === "ok" && validPrice(row.buy.effectivePrice) ? row.buy.effectivePrice : null;
    const sell = row.sell.status === "ok" && validPrice(row.sell.effectivePrice) ? row.sell.effectivePrice : null;
    if (sell !== null) {
      sellSamples++;
      if (sellLow === null || sell < sellLow) { sellLow = sell; sellLowAt = timestamp; }
      if (sellHigh === null || sell > sellHigh) { sellHigh = sell; sellHighAt = timestamp; }
      if (earliestBuy !== null) {
        const outcome = (sell / earliestBuy - 1) * 100;
        if (bestChronologicalLongPct === null || outcome > bestChronologicalLongPct) bestChronologicalLongPct = outcome;
      }
    }
    if (buy !== null) {
      buySamples++;
      if (buyLow === null || buy < buyLow) { buyLow = buy; buyLowAt = timestamp; }
      if (buyHigh === null || buy > buyHigh) { buyHigh = buy; buyHighAt = timestamp; }
      if (earliestBuy === null || buy < earliestBuy) earliestBuy = buy;
    }
  }
  return {
    ticker, issuer, symbol, dateUtc, completeDay: dateUtc < todayUtc,
    samples: entries.length, buySamples, sellSamples,
    buyLow, buyLowAt, buyHigh, buyHighAt, sellLow, sellLowAt, sellHigh, sellHighAt,
    buyRangePct: buyLow !== null && buyHigh !== null ? (buyHigh / buyLow - 1) * 100 : null,
    sellRangePct: sellLow !== null && sellHigh !== null ? (sellHigh / sellLow - 1) * 100 : null,
    bestChronologicalLongPct,
  };
}

/** Calculated read-only from stored history. No new API calls, persistent files, or watcher work. */
export async function buildDailyIssuerRanges(now = Date.now()): Promise<IssuerDailyRangeSummary[]> {
  const registry = await readStockRegistry();
  const perStock = await Promise.all(Object.keys(registry).map((ticker) => buildTickerDailyIssuerRanges(ticker, now)));
  return perStock.flat().sort((a, b) => a.ticker.localeCompare(b.ticker) || a.issuer.localeCompare(b.issuer));
}

/** Read a single ticker for the public stock page; no quotes or full-universe scan. */
export async function buildTickerDailyIssuerRanges(ticker: string, now = Date.now()): Promise<IssuerDailyRangeSummary[]> {
  const todayUtc = dateKey(now);
  {
    const history = await readHistory(ticker);
    const groups = new Map<string, { issuer: string; symbol: string; dateUtc: string; entries: Array<{timestamp: number; row: HistoryIssuerSnapshot}> }>();
    for (const snapshot of history) {
      if (snapshot.timestamp > now || snapshot.canonicalSizeUsd !== 1000) continue;
      const dateUtc = dateKey(snapshot.timestamp);
      for (const row of snapshot.issuers) {
        const key = `${row.mint}:${dateUtc}`;
        const group = groups.get(key) ?? { issuer: row.issuer, symbol: row.symbol, dateUtc, entries: [] };
        group.entries.push({ timestamp: snapshot.timestamp, row });
        groups.set(key, group);
      }
    }
    const byIssuer = new Map<string, DailyIssuerRange[]>();
    for (const [key, group] of groups) {
      const mint = key.slice(0, key.lastIndexOf(":"));
      const day = computeDay(ticker, group.issuer, group.symbol, group.dateUtc, group.entries, todayUtc);
      const existing = byIssuer.get(mint) ?? [];
      existing.push(day);
      byIssuer.set(mint, existing);
    }
    return Array.from(byIssuer.values()).map((days) => {
      days.sort((a, b) => b.dateUtc.localeCompare(a.dateUtc));
      const completed = days.filter((day) => day.completeDay && day.buySamples >= 2 && day.sellSamples >= 2);
      return {
        ticker, issuer: days[0].issuer, symbol: days[0].symbol, latest: days[0],
        completedDays: completed.length,
        avgBuyRangePct: mean(completed.map((day) => day.buyRangePct).filter((n): n is number => n !== null)),
        avgSellRangePct: mean(completed.map((day) => day.sellRangePct).filter((n): n is number => n !== null)),
      };
    });
  }
}
