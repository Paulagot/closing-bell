import HistoryMetric from "@/components/history/HistoryMetric";
import SnapshotStamp from "@/components/history/SnapshotStamp";

import type { IssuerHistoryAnalytics } from "@/types/history";

interface Props {
  issuer: IssuerHistoryAnalytics;
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
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value);
}

export default function SignalOverview({
  issuer,
  snapshotTimestamp,
}: Props) {
  const latest = issuer.latest;

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
            $1K execution snapshot
          </div>

          <h3 className="mt-1 text-xl font-black text-gray-950 dark:text-white">
            {issuer.issuer} · {issuer.symbol}
          </h3>
        </div>

        <div className="text-right">
          <SnapshotStamp timestamp={snapshotTimestamp} prefix="Captured" />

          <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Compare with live execution only when the timestamps are close.
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <HistoryMetric
          label="Executable BUY vs Wall St"
          value={pct(issuer.currentBuyGapPct)}
          help="Recorded $1K effective BUY price versus the Wall Street benchmark captured at the same observation."
        />

        <HistoryMetric
          label="Approx. break-even move"
          value={pct(issuer.currentApproxBreakEvenMovePct, false)}
          help="How much the executable SELL would need to improve to equal the executable BUY at this observation."
        />

        <HistoryMetric
          label="Excess gap beyond break-even"
          value={pct(issuer.currentDivergenceAfterBreakEvenPct, false)}
          help="BUY discount versus Wall Street remaining after the approximate break-even move. Positive only when the BUY itself is below Wall Street."
        />

        <HistoryMetric
          label="Reported liquidity"
          value={money(latest?.liquidityUsd ?? null)}
          help="Liquidity reported by Jupiter Price V3. This may aggregate routing venues and is not necessarily one AMM pool balance."
        />

        <HistoryMetric
          label="Divergence percentile"
          value={
            issuer.currentDivergenceMagnitudePercentile === null
              ? "—"
              : `${issuer.currentDivergenceMagnitudePercentile.toFixed(0)}th`
          }
          help="Percent of recorded observations whose absolute BUY divergence was no larger than the current one."
        />

        <HistoryMetric
          label="7d median BUY gap"
          value={pct(issuer.medianBuyGap7dPct)}
        />

        <HistoryMetric
          label="7d median break-even"
          value={pct(issuer.medianBreakEven7dPct, false)}
        />

        <HistoryMetric
          label="Quote availability"
          value={
            issuer.quoteAvailabilityPct === null
              ? "—"
              : `${issuer.quoteAvailabilityPct.toFixed(0)}%`
          }
          help="Share of recorded observations where both BUY and SELL executable quotes were available."
        />
      </div>
    </section>
  );
}
