"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppShell from "@/components/shell/AppShell";
import CompetitionHero from "@/components/competitions/CompetitionHero";
import CompetitionLeaderboard from "@/components/competitions/CompetitionLeaderboard";

import type {
  CompetitionPublicResponse,
} from "@/types/competitions";

interface Props {
  slug: string;
}

export default function CompetitionLeaderboardPageClient({
  slug,
}: Props) {
  const [data, setData] = useState<CompetitionPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/competitions/${encodeURIComponent(slug)}`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? json.details ?? "Unable to load leaderboard"
        );
      }

      setData(json);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : String(loadError)
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell>
      <main className="app-shell space-y-5 py-5 md:py-8">
        {data ? (
          <CompetitionHero
            competition={data.competition}
            participantCount={data.participantCount}
            predictionCount={data.predictionCount}
          />
        ) : (
          <section className="rounded-[2rem] border border-gray-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950 md:p-8">
            <div className="text-sm text-gray-500 dark:text-slate-400">
              Loading competition…
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400">
              Competition rankings
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Player names, calls, accuracy and points for this competition.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/competitions/${encodeURIComponent(slug)}`}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-xs font-black text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Back to competition
            </Link>

            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        {data ? (
          <CompetitionLeaderboard rows={data.leaderboard} />
        ) : !error ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            Loading leaderboard…
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
