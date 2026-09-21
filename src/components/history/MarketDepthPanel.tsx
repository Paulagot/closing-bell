"use client";

import { useMemo, useState } from "react";
import SnapshotStamp from "@/components/history/SnapshotStamp";

import type { StockExecutionResponse } from "@/types";
import type {
  DepthSizeResult,
  IssuerDepthResponse,
  IssuerHistoryAnalytics,
} from "@/types/history";

interface Props {
  ticker: string;
  issuers: IssuerHistoryAnalytics[];
  liveExecutions?: Record<string, StockExecutionResponse>;
}

const SIZES = [100, 1000, 10000];

type DepthByIssuer = Record<string, IssuerDepthResponse>;

const money = (value: number | null) =>
  value === null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        notation: value >= 100000 ? "compact" : "standard",
        maximumFractionDigits: value >= 100000 ? 1 : 2,
      }).format(value);

const pct = (value: number | null, signed = false) =>
  value === null
    ? "—"
    : `${signed && value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

function gap(price: number | null, benchmark: number | null) {
  if (price === null || benchmark === null || benchmark <= 0) return null;
  return ((price - benchmark) / benchmark) * 100;
}

function hurdle(buy: number | null, sell: number | null) {
  if (buy === null || sell === null || buy <= 0 || sell <= 0) return null;
  return (buy / sell - 1) * 100;
}

function fromLive(
  response: StockExecutionResponse | undefined,
  issuerName: string,
  sizeUsd: number
): DepthSizeResult | null {
  if (!response) return null;

  const issuer = response.issuers.find((item) => item.issuer === issuerName);
  if (!issuer) return null;

  const benchmark = response.marketStatus.open
    ? response.referencePrice ?? response.previousClose ?? null
    : response.previousClose ?? response.referencePrice ?? null;

  return {
    sizeUsd,
    buyPrice: issuer.buyQuote.effectivePrice,
    sellPrice: issuer.sellQuote.effectivePrice,
    buyImpactPct: issuer.buyQuote.priceImpactPct,
    sellImpactPct: issuer.sellQuote.priceImpactPct,
    buyGapPct: gap(issuer.buyQuote.effectivePrice, benchmark),
    sellGapPct: gap(issuer.sellQuote.effectivePrice, benchmark),
    approxBreakEvenMovePct: hurdle(
      issuer.buyQuote.effectivePrice,
      issuer.sellQuote.effectivePrice
    ),
    buyStatus: issuer.buyQuote.status as DepthSizeResult["buyStatus"],
    sellStatus: issuer.sellQuote.status as DepthSizeResult["sellStatus"],
  };
}

function timeMs(value: StockExecutionResponse["timestamp"]) {
  const parsed =
    typeof value === "number" ? value : new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : Date.now();
}

export default function MarketDepthPanel({
  ticker,
  issuers,
  liveExecutions = {},
}: Props) {
  const [serverData, setServerData] = useState<DepthByIssuer>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cachedRows = useMemo(() => {
    const result: Record<string, DepthSizeResult[]> = {};

    for (const issuer of issuers) {
      result[issuer.issuer] = SIZES
        .map((size) =>
          fromLive(
            liveExecutions[String(size)],
            issuer.issuer,
            size
          )
        )
        .filter((row): row is DepthSizeResult => row !== null);
    }

    return result;
  }, [issuers, liveExecutions]);

  const groups = useMemo(() => {
    return issuers.map((issuer) => {
      const rows = new Map<number, DepthSizeResult>();

      serverData[issuer.issuer]?.sizes.forEach((row) =>
        rows.set(row.sizeUsd, row)
      );

      cachedRows[issuer.issuer]?.forEach((row) =>
        rows.set(row.sizeUsd, row)
      );

      const liveTimes = SIZES
        .map((size) => liveExecutions[String(size)])
        .filter(Boolean)
        .map((response) => timeMs(response!.timestamp));

      const server = serverData[issuer.issuer];

      return {
        issuer,
        rows: SIZES
          .map((size) => rows.get(size))
          .filter((row): row is DepthSizeResult => Boolean(row)),
        reportedLiquidityUsd: server?.reportedLiquidityUsd ?? null,
        timestamp: Math.max(server?.timestamp ?? 0, ...liveTimes, 0),
        reusedCount: cachedRows[issuer.issuer]?.length ?? 0,
      };
    });
  }, [cachedRows, issuers, liveExecutions, serverData]);

  const missingRequests = useMemo(
    () =>
      issuers
        .map((issuer) => {
          const cached = new Set(
            cachedRows[issuer.issuer]?.map((row) => row.sizeUsd) ?? []
          );
          const server = new Set(
            serverData[issuer.issuer]?.sizes.map((row) => row.sizeUsd) ?? []
          );

          return {
            issuer: issuer.issuer,
            sizes: SIZES.filter(
              (size) => !cached.has(size) && !server.has(size)
            ),
          };
        })
        .filter((item) => item.sizes.length > 0),
    [cachedRows, issuers, serverData]
  );

  const missingQuotePairs = missingRequests.reduce(
    (total, request) => total + request.sizes.length,
    0
  );

  async function testMissingDepth() {
    if (!missingRequests.length) return;

    setLoading(true);
    setError(null);

    try {
      const results: DepthByIssuer = {};

      for (const request of missingRequests) {
        const response = await fetch(
          `/api/depth/${encodeURIComponent(ticker)}?issuer=${encodeURIComponent(
            request.issuer
          )}&sizes=${request.sizes.join(",")}`,
          { cache: "no-store" }
        );

        const json = await response.json();

        if (!response.ok) {
          throw new Error(
            json.error ??
              json.details ??
              `Unable to test ${request.issuer} market depth`
          );
        }

        results[request.issuer] = json;
      }

      setServerData((current) => {
        const merged = { ...current };

        for (const [issuer, next] of Object.entries(results)) {
          const existing = merged[issuer];
          const rows = new Map<number, DepthSizeResult>();

          existing?.sizes.forEach((row) => rows.set(row.sizeUsd, row));
          next.sizes.forEach((row) => rows.set(row.sizeUsd, row));

          merged[issuer] = {
            ...next,
            sizes: SIZES
              .map((size) => rows.get(size))
              .filter((row): row is DepthSizeResult => Boolean(row)),
          };
        }

        return merged;
      });
    } catch (depthError) {
      setError(
        depthError instanceof Error
          ? depthError.message
          : String(depthError)
      );
    } finally {
      setLoading(false);
    }
  }

  const hasAnyRows = groups.some((group) => group.rows.length > 0);

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="font-black text-gray-950 dark:text-white">
            Market depth by issuer
          </h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-gray-500 dark:text-slate-400">
            Compare $100, $1K and $10K execution across every wrapper. Matching live comparisons from the execution section are reused exactly; only missing issuer/size combinations are requested.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || missingQuotePairs === 0}
          onClick={testMissingDepth}
          className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:opacity-40"
        >
          {loading
            ? "Testing missing depth…"
            : missingQuotePairs === 0
              ? "All depth loaded"
              : `Test ${missingQuotePairs} missing ${
                  missingQuotePairs === 1 ? "size" : "sizes"
                }`}
        </button>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {!hasAnyRows && !error && (
        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 p-5 text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
          The auto-loaded $1K live comparison seeds this table. Test the remaining sizes here when you want a deeper size comparison.
        </div>
      )}

      <div className="mt-5 space-y-4">
        {groups.map((group) => (
          <div
            key={group.issuer.mint}
            className="overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-3 dark:bg-slate-900/60">
              <div>
                <div className="font-black text-gray-950 dark:text-white">
                  {group.issuer.issuer} · {group.issuer.symbol}
                </div>

                <div className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                  {group.reusedCount > 0
                    ? `${group.reusedCount} size${
                        group.reusedCount === 1 ? "" : "s"
                      } reused from live execution`
                    : "No live comparison reused yet"}
                </div>
              </div>

              <div className="text-right">
                {group.reportedLiquidityUsd !== null && (
                  <div className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Reported liquidity{" "}
                    {money(group.reportedLiquidityUsd)}
                  </div>
                )}

                {group.timestamp > 0 && (
                  <SnapshotStamp
                    timestamp={group.timestamp}
                    prefix="Latest live depth"
                  />
                )}
              </div>
            </div>

            {group.rows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:text-slate-500">
                      <th className="px-4 py-2">Size</th>
                      <th className="px-2 py-2">BUY impact</th>
                      <th className="px-2 py-2">SELL impact</th>
                      <th className="px-2 py-2">BUY vs Wall St</th>
                      <th className="px-2 py-2">SELL vs Wall St</th>
                      <th className="px-4 py-2">Approx. break-even</th>
                    </tr>
                  </thead>

                  <tbody>
                    {group.rows.map((row) => (
                      <tr
                        key={row.sizeUsd}
                        className="border-b border-gray-100 last:border-0 dark:border-slate-800"
                      >
                        <td className="px-4 py-3 font-black text-gray-950 dark:text-white">
                          {money(row.sizeUsd)}
                        </td>
                        <td className="px-2 py-3 tabular-nums text-gray-700 dark:text-slate-300">
                          {pct(row.buyImpactPct, true)}
                        </td>
                        <td className="px-2 py-3 tabular-nums text-gray-700 dark:text-slate-300">
                          {pct(row.sellImpactPct, true)}
                        </td>
                        <td className="px-2 py-3 tabular-nums text-gray-700 dark:text-slate-300">
                          {pct(row.buyGapPct, true)}
                        </td>
                        <td className="px-2 py-3 tabular-nums text-gray-700 dark:text-slate-300">
                          {pct(row.sellGapPct, true)}
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums text-gray-950 dark:text-white">
                          {pct(row.approxBreakEvenMovePct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-4 py-5 text-xs text-gray-400 dark:text-slate-500">
                No live depth loaded for this issuer yet.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 text-[10px] leading-4 text-gray-400 dark:text-slate-500">
        A “missing size” is one issuer/order-size pair. Each fetched size
        retrieves both BUY and SELL. Reported liquidity comes from Jupiter
        Price V3 and is not necessarily one AMM pool balance.
      </div>
    </section>
  );
}