"use client";

import { useState } from "react";
import LocalTime from "@/components/competitions/LocalTime";

import type {
  CompetitionQuestionCandidate,
} from "@/types/competitions";

interface Props {
  slug: string;
  onPublished: () => void;
}

function pct(value: number | null) {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function CompetitionAdminPanel({
  slug,
  onPublished,
}: Props) {
  const [candidates, setCandidates] =
    useState<CompetitionQuestionCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/competitions/${encodeURIComponent(
          slug
        )}/admin/generate`,
        {
          method: "POST",
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? json.details ?? "Unable to generate candidates"
        );
      }

      setCandidates(json.candidates ?? []);
      setMessage(
        `${json.candidates?.length ?? 0} diversified candidates generated from stored market data.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function publish(
    candidate: CompetitionQuestionCandidate
  ) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/competitions/${encodeURIComponent(
          slug
        )}/admin/publish`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ candidate }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to publish question");
      }

      setCandidates((current) =>
        current.filter(
          (item) => item.candidateId !== candidate.candidateId
        )
      );

      setMessage("Question published.");
      onPublished();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-900/70 bg-amber-950/15 p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-400">
        Question admin
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-white">
            Generate a varied question set
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">
            Candidates can be ranges, direction calls, issuer choices or binary questions. Generator rank is internal only; it does not affect player points.
          </p>
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="min-h-11 rounded-xl bg-amber-600 px-4 text-xs font-black text-white disabled:opacity-50"
        >
          {busy ? "Working…" : "Generate candidates"}
        </button>
      </div>

      {message && (
        <div className="mt-3 text-xs font-semibold text-slate-300">
          {message}
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-5 grid gap-3">
          {candidates.map((candidate) => (
            <article
              key={candidate.candidateId}
              className="rounded-2xl border border-amber-900/60 bg-slate-950 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-black uppercase tracking-wide text-amber-400">
                    {candidate.type.replaceAll("_", " ")} ·{" "}
                    {candidate.answerFormat.replaceAll("_", " ")} · generator rank{" "}
                    {candidate.interestingnessScore.toFixed(1)}
                  </div>

                  <h3 className="mt-1 font-black text-white">
                    {candidate.title}
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {candidate.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {candidate.options.map((option) => (
                      <span
                        key={option.id}
                        className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300"
                      >
                        {option.label}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-900 p-3 text-xs leading-5 text-slate-300">
                    <strong className="text-white">What it means:</strong>{" "}
                    {candidate.plainEnglish}
                    <div className="mt-2">
                      <strong className="text-white">Player hint:</strong>{" "}
                      {candidate.hint}
                    </div>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-500">
                    Starting BUY gap {pct(candidate.source.currentBuyGapPct)} · source{" "}
                    <LocalTime
                      timestamp={candidate.source.tickerSnapshotAt}
                      includeZone={false}
                    />{" "}
                    · settles{" "}
                    <LocalTime
                      timestamp={candidate.suggestedSettlementAt}
                      includeZone
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => publish(candidate)}
                  disabled={busy}
                  className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  Publish
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
