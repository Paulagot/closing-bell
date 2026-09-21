import type {
  CompetitionLeaderboardRow,
} from "@/types/competitions";

interface Props {
  rows: CompetitionLeaderboardRow[];
}

export default function CompetitionLeaderboard({
  rows,
}: Props) {
  return (
    <section className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400">
            Full leaderboard
          </div>

          <h2 className="mt-1 text-2xl font-black text-gray-950 dark:text-white md:text-3xl">
            Who is reading the market best?
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-300">
            Ranked by points. Exact calls score most; range and issuer questions can award partial credit for close answers.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-right dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xl font-black text-gray-950 dark:text-white">
            {rows.length}
          </div>
          <div className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Players
          </div>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] font-black uppercase tracking-wide text-gray-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-3 pr-4">Rank</th>
                <th className="py-3 pr-4">Player</th>
                <th className="py-3 pr-4 text-right">Calls</th>
                <th className="py-3 pr-4 text-right">Settled</th>
                <th className="py-3 pr-4 text-right">Exact</th>
                <th className="py-3 pr-4 text-right">Near</th>
                <th className="py-3 pr-4 text-right">Accuracy</th>
                <th className="py-3 pr-4 text-right">Score %</th>
                <th className="py-3 text-right">Points</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.wallet}
                  className="border-b border-gray-100 last:border-0 dark:border-slate-900"
                >
                  <td className="py-4 pr-4">
                    <span className="inline-flex min-w-12 justify-center rounded-xl bg-violet-50 px-2 py-2 font-black text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">
                      #{row.rank}
                    </span>
                  </td>

                  <td className="py-4 pr-4">
                    <div className="font-black text-gray-950 dark:text-white">
                      {row.displayName}
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-gray-500 dark:text-slate-400">
                      {row.walletShort}
                    </div>
                  </td>

                  <td className="py-4 pr-4 text-right font-semibold text-gray-700 dark:text-slate-300">
                    {row.calls}
                  </td>
                  <td className="py-4 pr-4 text-right font-semibold text-gray-700 dark:text-slate-300">
                    {row.settledCalls}
                  </td>
                  <td className="py-4 pr-4 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                    {row.exactCalls}
                  </td>
                  <td className="py-4 pr-4 text-right font-semibold text-amber-700 dark:text-amber-300">
                    {row.nearCalls}
                  </td>
                  <td className="py-4 pr-4 text-right font-semibold text-gray-700 dark:text-slate-300">
                    {row.accuracyPct === null
                      ? "—"
                      : `${row.accuracyPct.toFixed(1)}%`}
                  </td>
                  <td className="py-4 pr-4 text-right font-semibold text-gray-700 dark:text-slate-300">
                    {row.pointsEfficiencyPct === null
                      ? "—"
                      : `${row.pointsEfficiencyPct.toFixed(1)}%`}
                  </td>
                  <td className="py-4 text-right text-base font-black text-violet-700 dark:text-violet-300">
                    {row.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-slate-800 dark:text-slate-400">
          The leaderboard is waiting for its first player.
        </div>
      )}
    </section>
  );
}
