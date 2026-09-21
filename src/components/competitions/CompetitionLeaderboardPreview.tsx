import Link from "next/link";

import type {
  CompetitionLeaderboardRow,
} from "@/types/competitions";

interface Props {
  rows: CompetitionLeaderboardRow[];
  slug: string;
}

export default function CompetitionLeaderboardPreview({
  rows,
  slug,
}: Props) {
  const top = rows.slice(0, 5);

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400">
            Leaderboard
          </div>
          <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">
            Top players
          </h2>
        </div>

        <Link
          href={`/competitions/${encodeURIComponent(slug)}/leaderboard`}
          className="text-xs font-black text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
        >
          Full leaderboard →
        </Link>
      </div>

      {top.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {top.map((row) => (
            <div
              key={row.wallet}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <div className="w-9 shrink-0 text-center text-sm font-black text-violet-700 dark:text-violet-300">
                #{row.rank}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-black text-gray-950 dark:text-white">
                  {row.displayName}
                </div>
                <div className="truncate font-mono text-[11px] text-gray-500 dark:text-slate-400">
                  {row.walletShort}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-sm font-black text-violet-700 dark:text-violet-300">
                  {row.points.toLocaleString()}
                </div>
                <div className="text-[11px] uppercase text-gray-500 dark:text-slate-400">
                  pts
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
          The leaderboard is waiting for its first player.
        </div>
      )}
    </section>
  );
}
