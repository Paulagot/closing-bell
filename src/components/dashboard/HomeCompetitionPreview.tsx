"use client";

import Link from "next/link";

import type {
  CompetitionPublicResponse,
} from "@/types/competitions";

interface Props {
  data:
    CompetitionPublicResponse |
    null;

  loading:
    boolean;

  error:
    string |
    null;
}

function dateTime(
  value:
    number
) {
  return new Date(
    value
  ).toLocaleString(
    "en-IE",
    {
      weekday:
        "short",
      hour:
        "2-digit",
      minute:
        "2-digit",
    }
  );
}

export default function HomeCompetitionPreview({
  data,
  loading,
  error,
}: Props) {
  if (
    loading &&
    !data
  ) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="text-sm font-bold text-slate-600 dark:text-slate-400">
          Loading current competition…
        </div>
      </section>
    );
  }

  if (
    error ||
    !data
  ) {
    return null;
  }

  const now =
    Date.now();

  const openQuestions =
    data.questions
      .filter(
        (
          question
        ) =>
          question.status ===
            "open" &&
          now <
            question.lockAt
      )
      .sort(
        (
          left,
          right
        ) =>
          left.lockAt -
          right.lockAt
      );

  const preview =
    openQuestions.slice(
      0,
      3
    );

  const top =
    data.leaderboard.slice(
      0,
      3
    );

  const firstPrize =
    data.competition.prizes
      .slice()
      .sort(
        (
          left,
          right
        ) =>
          left.place -
          right.place
      )[0];

  return (
    <section className="overflow-hidden rounded-3xl border border-violet-200 bg-violet-50/70 shadow-sm dark:border-violet-900/70 dark:bg-violet-950/15 dark:shadow-none">
      <div className="grid lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
                Live learning competition
              </div>

              <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
                {
                  data.competition.shortName
                }
              </h2>

              <p className="mt-2 max-w-2xl text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                Use Closing Bell&apos;s live execution and history data to make market calls, learn how tokenized stocks behave, and see how your read compares on the leaderboard.
              </p>
            </div>

            <div className="text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              <div>
                {
                  data.participantCount
                }{" "}
                participants
              </div>
              <div className="mt-1">
                {
                  data.predictionCount
                }{" "}
                calls made
              </div>
            </div>
          </div>

          {(data.competition.sponsor ||
            firstPrize) && (
            <div className="mt-4 rounded-2xl border border-violet-200 bg-white p-3 dark:border-violet-800/80 dark:bg-violet-950/45">
              <div className="flex flex-wrap items-center gap-3">
                {data.competition.sponsor && (
                  <>
                    {data.competition.sponsor.logoUrl && (
                      <div className="flex h-12 min-w-20 items-center justify-center rounded-xl bg-white px-3 py-2">
                        <img
                          src={data.competition.sponsor.logoUrl}
                          alt={`${data.competition.sponsor.name} logo`}
                          className="max-h-8 max-w-[120px] object-contain"
                        />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                        Competition sponsor
                      </div>
                      <div className="mt-0.5 text-sm font-black text-slate-950 dark:text-white">
                        {data.competition.sponsor.name}
                      </div>
                      {data.competition.sponsor.tagline && (
                        <div className="mt-0.5 text-[13px] leading-5 text-slate-700 dark:text-slate-300">
                          {data.competition.sponsor.tagline}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {firstPrize && (
                  <div className="ml-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 dark:border-amber-700/70 dark:bg-amber-500/10 dark:text-amber-100 sm:ml-auto">
                    🏆{" "}
                    {firstPrize.valueText
                      ? `${firstPrize.valueText} · `
                      : ""}
                    {firstPrize.title}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-2">
            {preview.length >
            0 ? (
              preview.map(
                (
                  question
                ) => (
                  <Link
                    key={
                      question.id
                    }
                    href={`/competitions/${encodeURIComponent(
                      data.competition.slug
                    )}`}
                    className="group rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-violet-800 dark:hover:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-400">
                          {
                            question.ticker
                          }{" "}
                          ·{" "}
                          {question.type.replaceAll(
                            "_",
                            " "
                          )}
                        </div>

                        <div className="mt-1 text-sm font-black text-slate-950 dark:text-white group-hover:text-violet-700 dark:group-hover:text-violet-200">
                          {
                            question.title
                          }
                        </div>
                      </div>

                      <div className="shrink-0 text-right text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Closes
                        <div className="mt-0.5 text-slate-800 dark:text-slate-300">
                          {dateTime(
                            question.lockAt
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-4 text-sm text-slate-600 dark:text-slate-400">
                No open calls right now. New questions appear as the competition is updated.
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/competitions/${encodeURIComponent(
                data.competition.slug
              )}`}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white hover:bg-violet-500"
            >
              Make your calls →
            </Link>

            <Link
              href={`/competitions/${encodeURIComponent(
                data.competition.slug
              )}/leaderboard`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Full leaderboard
            </Link>
          </div>
        </div>

        <div className="border-t border-violet-200 bg-violet-100/60 p-5 dark:border-violet-900/60 dark:bg-slate-950/50 lg:border-l lg:border-t-0">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400">
            Leaderboard
          </div>

          <div className="mt-3 space-y-2">
            {top.length >
            0 ? (
              top.map(
                (
                  row
                ) => (
                  <div
                    key={
                      row.wallet
                    }
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="w-7 text-center text-sm font-black text-violet-700 dark:text-violet-300">
                      #{row.rank}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-black text-slate-950 dark:text-white">
                        {
                          row.displayName
                        }
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {
                          row.walletShort
                        }
                      </div>
                    </div>

                    <div className="text-xs font-black tabular-nums text-slate-900 dark:text-slate-200">
                      {
                        row.points
                      }{" "}
                      pts
                    </div>
                  </div>
                )
              )
            ) : (
              <div className="text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                No scores yet. Be one of the first to make a call.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
