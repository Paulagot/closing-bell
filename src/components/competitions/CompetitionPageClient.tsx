"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useWallet } from "@solana/wallet-adapter-react";

import AppShell from "@/components/shell/AppShell";
import CompetitionHero from "@/components/competitions/CompetitionHero";
import JoinCompetitionCard from "@/components/competitions/JoinCompetitionCard";
import PredictionCard from "@/components/competitions/PredictionCard";
import CompetitionLeaderboardPreview from "@/components/competitions/CompetitionLeaderboardPreview";
import HowItWorks from "@/components/competitions/HowItWorks";

import type {
  CompetitionPublicResponse,
  CompetitionQuestion,
} from "@/types/competitions";

interface Props {
  slug: string;
}

function sortByClose(
  left: CompetitionQuestion,
  right: CompetitionQuestion
) {
  return left.lockAt - right.lockAt;
}

export default function CompetitionPageClient({
  slug,
}: Props) {
  const { publicKey } = useWallet();

  const [data, setData] =
    useState<CompetitionPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const wallet = publicKey?.toBase58();
      const params = wallet
        ? `?wallet=${encodeURIComponent(wallet)}`
        : "";

      const response = await fetch(
        `/api/competitions/${encodeURIComponent(
          slug
        )}${params}`,
        { cache: "no-store" }
      );

      const text = await response.text();
      let json: any;

      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(
          `Competition API returned ${response.status} instead of JSON.`
        );
      }

      if (!response.ok) {
        throw new Error(
          json.error ??
            json.details ??
            "Unable to load competition"
        );
      }

      setData(json);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : String(loadError)
      );
    } finally {
      setLoading(false);
    }
  }, [publicKey, slug]);

  useEffect(() => {
    load();
  }, [load]);

  const openQuestions = useMemo(
    () =>
      data
        ? data.questions
            .filter(
              (question) =>
                question.status === "open" &&
                Date.now() < question.lockAt
            )
            .sort(sortByClose)
        : [],
    [data]
  );

  const lockedQuestions = useMemo(
    () =>
      data
        ? data.questions
            .filter(
              (question) =>
                question.status === "locked" ||
                (question.status === "open" &&
                  Date.now() >= question.lockAt)
            )
            .sort(
              (a, b) =>
                a.settlementAt - b.settlementAt
            )
        : [],
    [data]
  );

  const settledQuestions = useMemo(
    () =>
      data
        ? data.questions
            .filter(
              (question) =>
                question.status === "settled" ||
                question.status === "void"
            )
            .sort(
              (a, b) =>
                (b.settledAt ??
                  b.settlementAt) -
                (a.settledAt ??
                  a.settlementAt)
            )
        : [],
    [data]
  );

  const viewerSettledPoints =
    data?.viewer
      ? Object.values(data.viewer.predictions).reduce(
          (total, prediction) =>
            total + prediction.pointsAwarded,
          0
        )
      : 0;

  if (loading && !data) {
    return (
      <AppShell>
        <main className="app-shell py-8">
          <div className="rounded-3xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950 p-10 text-center text-sm text-gray-600 dark:text-slate-400">
            Loading competition…
          </div>
        </main>
      </AppShell>
    );
  }

  if (error && !data) {
    return (
      <AppShell>
        <main className="app-shell py-8">
          <div className="rounded-3xl border border-red-900 bg-red-950/20 p-6 text-sm text-red-300">
            {error}
          </div>
        </main>
      </AppShell>
    );
  }

  if (!data) return null;

  return (
    <AppShell>
      <main className="app-shell space-y-5 py-5 md:py-8">
        <CompetitionHero
          competition={data.competition}
          participantCount={data.participantCount}
          predictionCount={data.predictionCount}
        />

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-start">
          <JoinCompetitionCard
            data={data}
            onUpdated={setData}
          />
          <CompetitionLeaderboardPreview
            rows={data.leaderboard}
            slug={slug}
          />
        </div>

        <HowItWorks />

        <div className="min-w-0 space-y-6">
            <section>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400">
                    Today's calls
                  </div>

                  <h2 className="mt-1 text-2xl font-black text-gray-950 dark:text-white">
                    Open questions
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-slate-300">
                    Open questions are sorted by close time. You can change a call until it locks.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={load}
                  disabled={loading}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {openQuestions.length > 0 ? (
                <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
                  {openQuestions.map((question) => (
                    <PredictionCard
                      key={question.id}
                      question={question}
                      data={data}
                      onUpdated={setData}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-950">
                  <div className="font-black text-gray-950 dark:text-white">
                    No open calls right now
                  </div>
                  <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-slate-300">
                    New questions only appear when Closing Bell has the stored market data required to define and settle them.
                  </p>
                </div>
              )}
            </section>

            {lockedQuestions.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-700 dark:text-amber-400">
                      Locked
                    </div>
                    <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">
                      Waiting for settlement · {lockedQuestions.length}
                    </h2>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
                  {lockedQuestions.map((question) => (
                    <PredictionCard
                      key={question.id}
                      question={question}
                      data={data}
                      onUpdated={setData}
                    />
                  ))}
                </div>
              </section>
            )}

            {settledQuestions.length > 0 && (
              <section className="rounded-3xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <button
                  type="button"
                  onClick={() =>
                    setShowSettled((current) => !current)
                  }
                  className="flex w-full items-center justify-between gap-4 p-5 text-left"
                >
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
                      Settled questions
                    </div>
                    <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">
                      {settledQuestions.length} results
                      {data.viewer
                        ? ` · ${viewerSettledPoints.toLocaleString()} pts earned`
                        : ""}
                    </h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                      Newest settlement first
                    </p>
                  </div>

                  <span className="text-xl font-black text-violet-700 dark:text-violet-300">
                    {showSettled ? "−" : "+"}
                  </span>
                </button>

                {showSettled && (
                  <div className="border-t border-gray-200 p-5 dark:border-slate-800">
                    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
                      {settledQuestions.map((question) => (
                        <PredictionCard
                          key={question.id}
                          question={question}
                          data={data}
                          onUpdated={setData}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}
        </div>

      </main>
    </AppShell>
  );
}
