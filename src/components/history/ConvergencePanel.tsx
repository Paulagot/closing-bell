import type { IssuerHistoryAnalytics } from "@/types/history";

interface Props {
  issuer: IssuerHistoryAnalytics;
}

function gap(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function duration(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);

  return remaining > 0 ? `${hours}h ${remaining}m` : `${hours}h`;
}

export default function ConvergencePanel({ issuer }: Props) {
  const openObservations = issuer.openObservations;
  const openNarrowedPct = issuer.openNarrowedPct;
  const estimatedNarrowed =
    openNarrowedPct === null || openObservations === 0
      ? null
      : Math.round((openNarrowedPct / 100) * openObservations);

  const limitedOpenSample = openObservations > 0 && openObservations < 5;

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div>
        <h3 className="font-black text-gray-950 dark:text-white">
          Convergence history
        </h3>

        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">
          A divergence episode starts when the recorded $1K executable BUY is at least 0.75% from the Wall Street reference. It counts as converged if it later reaches within 0.50% of that reference within 24 hours.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-900">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            Mature divergence episodes
          </div>
          <div className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
            {issuer.similarDivergenceEvents}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-900">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            Reached ±0.50% within 24h
          </div>
          <div className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
            {issuer.convergenceRatePct === null
              ? "—"
              : `${issuer.convergenceRatePct.toFixed(0)}%`}
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4 dark:bg-slate-900">
          <div className="text-xs text-gray-500 dark:text-slate-400">
            Median time when converged
          </div>
          <div className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
            {duration(issuer.medianMinutesToConvergence)}
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-5 dark:border-slate-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="font-bold text-gray-950 dark:text-white">
              What happened around the US open?
            </h4>

            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              Compares the last recorded observation before 9:30 ET with a recorded observation around 10:00–10:30 ET.
            </p>
          </div>

          <div className="text-right">
            {limitedOpenSample && estimatedNarrowed !== null ? (
              <>
                <div className="text-base font-black text-gray-950 dark:text-white">
                  {estimatedNarrowed} of {openObservations} observed opens narrowed
                </div>
                <div className="mt-0.5 text-[10px] text-gray-400 dark:text-slate-500">
                  {openNarrowedPct?.toFixed(0)}% · early sample
                </div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-gray-950 dark:text-white">
                  {openNarrowedPct === null
                    ? "—"
                    : `${openNarrowedPct.toFixed(0)}%`}
                </div>
                <div className="text-[10px] text-gray-400 dark:text-slate-500">
                  narrowed · {openObservations} opens
                </div>
              </>
            )}
          </div>
        </div>

        {issuer.openRows.length > 0 && (
          <div className="mt-4 divide-y divide-gray-100 dark:divide-slate-800">
            {issuer.openRows.slice(0, 6).map((row) => (
              <div
                key={row.date}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2 text-xs"
              >
                <div className="text-gray-500 dark:text-slate-400">
                  {row.date}
                </div>

                <div className="font-bold tabular-nums text-gray-950 dark:text-white">
                  {gap(row.beforeGapPct)} → {gap(row.afterGapPct)}
                </div>

                <div
                  className={[
                    "rounded-full px-2 py-1 text-[9px] font-black uppercase",
                    row.narrowed
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
                  ].join(" ")}
                >
                  {row.narrowed ? "narrowed" : "widened"}
                </div>
              </div>
            ))}
          </div>
        )}

        {issuer.similarDivergenceEvents < 5 && (
          <div className="mt-4 text-[11px] leading-5 text-amber-600 dark:text-amber-400">
            Early data: fewer than five mature divergence episodes is a hint, not a pattern.
          </div>
        )}
      </div>
    </section>
  );
}
