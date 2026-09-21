import SnapshotStamp from "@/components/history/SnapshotStamp";

import type { IssuerHistoryAnalytics } from "@/types/history";

interface Props {
  issuers: IssuerHistoryAnalytics[];
  snapshotTimestamp: number | null;
}

function pct(value: number | null, signed = true) {
  if (value === null) return "—";
  return `${signed && value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function money(value: number | null) {
  if (value === null) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function IssuerHistoryTable({
  issuers,
  snapshotTimestamp,
}: Props) {
  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-gray-950 dark:text-white">
            Issuer comparison
          </h3>

          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
            Same recorded $1K observation, compared across wrappers.
          </p>
        </div>

        <SnapshotStamp timestamp={snapshotTimestamp} prefix="Captured" />
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:text-slate-500">
              <th className="px-2 py-2">Wrapper</th>
              <th className="px-2 py-2">BUY vs Wall St</th>
              <th className="px-2 py-2">Approx. break-even</th>
              <th className="px-2 py-2">Excess gap beyond break-even</th>
              <th className="px-2 py-2">Reported liquidity</th>
              <th className="px-2 py-2">Quote availability</th>
              <th className="px-2 py-2">Convergence</th>
            </tr>
          </thead>

          <tbody>
            {issuers.map((issuer) => (
              <tr
                key={issuer.mint}
                className="border-b border-gray-100 last:border-0 dark:border-slate-800"
              >
                <td className="px-2 py-3">
                  <div className="font-black text-gray-950 dark:text-white">
                    {issuer.issuer}
                  </div>
                  <div className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                    {issuer.symbol}
                  </div>
                </td>

                <td className="px-2 py-3 font-bold tabular-nums text-gray-900 dark:text-white">
                  {pct(issuer.currentBuyGapPct)}
                </td>

                <td className="px-2 py-3 tabular-nums text-gray-700 dark:text-slate-300">
                  {pct(issuer.currentApproxBreakEvenMovePct, false)}
                </td>

                <td className="px-2 py-3 tabular-nums text-gray-700 dark:text-slate-300">
                  {pct(issuer.currentDivergenceAfterBreakEvenPct, false)}
                </td>

                <td className="px-2 py-3 text-gray-700 dark:text-slate-300">
                  {money(issuer.latest?.liquidityUsd ?? null)}
                </td>

                <td className="px-2 py-3 text-gray-700 dark:text-slate-300">
                  {issuer.quoteAvailabilityPct === null
                    ? "—"
                    : `${issuer.quoteAvailabilityPct.toFixed(0)}%`}
                </td>

                <td className="px-2 py-3 text-gray-700 dark:text-slate-300">
                  {issuer.convergenceRatePct === null
                    ? "—"
                    : `${issuer.convergenceRatePct.toFixed(0)}% · ${issuer.similarDivergenceEvents} episodes`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
