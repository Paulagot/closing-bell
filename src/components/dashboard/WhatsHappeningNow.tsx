"use client";

import Link from "next/link";

import type {
  DashboardIntelligenceResponse,
} from "@/types/dashboardIntelligence";

interface Props {
  data:
    | DashboardIntelligenceResponse
    | null;
  loading?: boolean;
  error?: string | null;
}

function timeAgo(
  timestamp: number
) {
  const minutes =
    Math.max(
      0,
      Math.round(
        (Date.now() -
          timestamp) /
          60000
      )
    );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.floor(
      minutes /
        60
    );

  return `${hours}h ago`;
}

export default function WhatsHappeningNow({
  data,
  loading = false,
  error = null,
}: Props) {
  const items =
    data?.activity ??
    [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
            What&apos;s happening now
          </div>

          <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Objective changes detected from the stored 15-minute execution history.
          </p>
        </div>

        {data?.latestSnapshotAt && (
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-500">
            Latest capture {timeAgo(
              data.latestSnapshotAt
            )}
          </div>
        )}
      </div>

      {loading &&
        !data && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/45 px-4 py-4 text-xs font-semibold text-slate-600 dark:text-slate-500">
            Reading recent market changes…
          </div>
        )}

      {error &&
        !data && (
          <div className="mt-4 rounded-2xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
            Recent-change analysis is temporarily unavailable. The main market snapshot is unaffected.
          </div>
        )}

      {!loading &&
        !error &&
        items.length ===
          0 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/45 px-4 py-4">
            <div className="text-sm font-black text-slate-900 dark:text-slate-200">
              No material changes detected yet.
            </div>

            <p className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-500">
              Closing Bell will surface changes here as the stored history develops — for example a widening executable gap, a new tightest issuer, or an unusually large reading versus that wrapper&apos;s own history.
            </p>
          </div>
        )}

      {items.length >
        0 && (
        <div className="mt-4 grid gap-2 lg:grid-cols-2">
          {items.map(
            (
              item
            ) => (
              <Link
                key={
                  item.id
                }
                href={`/stock/${encodeURIComponent(
                  item.ticker
                )}`}
                className="group rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/45 px-4 py-3 transition hover:border-violet-300 hover:bg-violet-50 dark:hover:border-violet-800/70 dark:hover:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-black text-slate-950 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-200">
                      {
                        item.headline
                      }
                    </div>

                    <div className="mt-1 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                      {
                        item.detail
                      }
                    </div>
                  </div>

                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500">
                    {timeAgo(
                      item.observedAt
                    )}
                  </span>
                </div>
              </Link>
            )
          )}
        </div>
      )}

      <div className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-500">
        These observations describe recorded execution conditions. They are not trade recommendations or predictions.
      </div>
    </section>
  );
}
