"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import LocalTime from "@/components/competitions/LocalTime";

import {
  competitionAuthMessage,
  type CompetitionAuthPayload,
} from "@/lib/competitions/authMessage";

import type {
  CompetitionPublicResponse,
  CompetitionQuestion,
} from "@/types/competitions";

interface Props {
  question: CompetitionQuestion;
  data: CompetitionPublicResponse;
  onUpdated: (data: CompetitionPublicResponse) => void;
}

function pct(value: number | null) {
  if (value === null) return "—";

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function statusClasses(status: CompetitionQuestion["status"]) {
  if (status === "open") {
    return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "locked") {
    return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
  }

  if (status === "settled") {
    return "border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300";
  }

  return "border-gray-300 bg-gray-100 text-gray-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export default function PredictionCard({
  question,
  data,
  onUpdated,
}: Props) {
  const { publicKey, signMessage } = useWallet();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const viewerPrediction =
    data.viewer?.predictions[question.id] ?? null;

  const currentAnswer =
    viewerPrediction?.answer ?? null;

  const now = Date.now();

  const isOpen =
    question.status === "open" &&
    now < question.lockAt;

  const resultOption = useMemo(
    () =>
      question.resultOptionId
        ? question.options.find(
            (option) => option.id === question.resultOptionId
          ) ?? null
        : null,
    [question]
  );

  const selectedOption =
    currentAnswer
      ? question.options.find(
          (option) => option.id === currentAnswer
        ) ?? null
      : null;

  async function predict(answer: string) {
    if (!data.viewer) {
      setError("Join the competition first.");
      return;
    }

    if (!publicKey || !signMessage) {
      setError(
        "Connect a wallet that supports message signing."
      );
      return;
    }

    setBusy(answer);
    setError(null);

    try {
      const payload: CompetitionAuthPayload = {
        action: "predict",
        wallet: publicKey.toBase58(),
        competitionId: data.competition.id,
        questionId: question.id,
        answer,
        issuedAt: Date.now(),
      };

      const message = competitionAuthMessage(payload);
      const signatureBytes = await signMessage(
        new TextEncoder().encode(message)
      );

      // The API verifier expects the Ed25519 signature as Base64.
      // Keep this encoding identical to JoinCompetitionCard.
      const signature = btoa(
        String.fromCharCode(...Array.from(signatureBytes))
      );

      const response = await fetch(
        `/api/competitions/${encodeURIComponent(
          data.competition.slug
        )}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            payload,
            signature,
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? "Unable to save prediction"
        );
      }

      onUpdated(json);
    } catch (predictError) {
      setError(
        predictError instanceof Error
          ? predictError.message
          : String(predictError)
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400">
              {question.ticker}
              {question.issuer
                ? ` · ${question.issuer}`
                : ""}
              {question.symbol
                ? ` · ${question.symbol}`
                : ""}
            </div>

            <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">
              {question.answerFormat.replaceAll("_", " ")}
            </div>
          </div>

          <div
            className={[
              "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em]",
              statusClasses(question.status),
            ].join(" ")}
          >
            {question.status}
          </div>
        </div>

        <h3 className="mt-3 text-xl font-black leading-snug text-gray-950 dark:text-white">
          {question.title}
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-slate-300">
          {question.description}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Published
            </div>
            <div className="mt-1 font-bold text-gray-900 dark:text-slate-200">
              <LocalTime
                timestamp={question.publishedAt}
                includeZone={false}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Source data
            </div>
            <div className="mt-1 font-bold text-gray-900 dark:text-slate-200">
              <LocalTime
                timestamp={question.source.tickerSnapshotAt}
                includeZone={false}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Closes
            </div>
            <div className="mt-1 font-bold text-gray-900 dark:text-slate-200">
              <LocalTime
                timestamp={question.lockAt}
                includeZone={false}
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="uppercase tracking-wide text-gray-500 dark:text-slate-400">
              Settles
            </div>
            <div className="mt-1 font-bold text-gray-900 dark:text-slate-200">
              <LocalTime
                timestamp={question.settlementAt}
                includeZone
              />
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-[#0c1118]">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-500 dark:text-slate-400">
            Starting evidence
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500 dark:text-slate-400">Wall Street</span>
              <div className="font-bold tabular-nums text-gray-950 dark:text-white">
                {money(question.source.currentBenchmarkPrice)}
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-slate-400">$1K BUY</span>
              <div className="font-bold tabular-nums text-gray-950 dark:text-white">
                {money(question.source.currentExecutableBuyPrice)}
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-slate-400">BUY gap</span>
              <div className="font-bold tabular-nums text-gray-950 dark:text-white">
                {pct(question.source.currentBuyGapPct)}
              </div>
            </div>

            <div>
              <span className="text-gray-500 dark:text-slate-400">Break-even</span>
              <div className="font-bold tabular-nums text-gray-950 dark:text-white">
                {pct(
                  question.source.currentApproxBreakEvenMovePct
                )}
              </div>
            </div>
          </div>
        </div>

        {isOpen ? (
          <div className="mt-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">
              Make your call
            </div>

            <div
              className={[
                "grid gap-2",
                question.options.length <= 3
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-2",
              ].join(" ")}
            >
              {question.options.map((option) => {
                const selected = currentAnswer === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => predict(option.id)}
                    className={[
                      "min-h-14 rounded-xl border px-4 py-3 text-left text-sm font-bold transition disabled:opacity-50",
                      selected
                        ? "border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200"
                        : "border-gray-200 bg-white text-gray-800 hover:border-violet-400 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-violet-500/60 dark:hover:bg-slate-800",
                    ].join(" ")}
                  >
                    <div>{option.label}</div>
                    {selected && (
                      <div className="mt-1 text-[11px] uppercase tracking-wide text-violet-700 dark:text-violet-400">
                        Your call
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {!data.viewer && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Join the competition before submitting a call.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            {selectedOption ? (
              <div className="text-sm text-gray-700 dark:text-slate-300">
                Your call:{" "}
                <strong className="text-gray-950 dark:text-white">
                  {selectedOption.label}
                </strong>
              </div>
            ) : (
              <div className="text-sm text-gray-500 dark:text-slate-400">
                You did not submit a call for this question.
              </div>
            )}

            {question.status === "locked" && (
              <div className="mt-2 text-sm font-bold text-amber-700 dark:text-amber-300">
                Predictions are closed. Waiting for the stored settlement observation.
              </div>
            )}

            {question.status === "settled" && (
              <div className="mt-3 border-t border-gray-200 dark:border-slate-800 pt-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
                      Settlement result
                    </div>
                    <div className="mt-1 font-black text-gray-950 dark:text-white">
                      {resultOption?.label ?? "Settled"}
                    </div>
                  </div>

                  {viewerPrediction && (
                    <div className="text-right">
                      <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Your points
                      </div>
                      <div className="text-2xl font-black text-violet-700 dark:text-violet-300">
                        +{viewerPrediction.pointsAwarded}
                      </div>
                    </div>
                  )}
                </div>

                {viewerPrediction &&
                  viewerPrediction.pointsAwarded > 0 &&
                  viewerPrediction.correct !== true && (
                    <div className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                      Close call — partial credit awarded.
                    </div>
                  )}

                <div className="mt-3 grid grid-cols-2 gap-3 text-xs lg:grid-cols-4">
                  <div>
                    <span className="text-gray-500 dark:text-slate-400">Wall Street</span>
                    <div className="font-bold text-gray-900 dark:text-slate-200">
                      {money(question.settlementBenchmarkPrice)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-slate-400">$1K BUY</span>
                    <div className="font-bold text-gray-900 dark:text-slate-200">
                      {money(
                        question.settlementExecutableBuyPrice
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-slate-400">BUY gap</span>
                    <div className="font-bold text-gray-900 dark:text-slate-200">
                      {pct(question.settlementBuyGapPct)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-slate-400">Snapshot</span>
                    <div className="font-bold text-gray-900 dark:text-slate-200">
                      {question.settlementSnapshotAt ? (
                        <LocalTime
                          timestamp={question.settlementSnapshotAt}
                          includeZone={false}
                        />
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {question.status === "void" && (
              <div className="mt-3 border-t border-gray-200 dark:border-slate-800 pt-3 text-sm text-gray-600 dark:text-slate-400">
                Result void — {question.voidReason ?? "no valid settlement observation was available."}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mt-4 border-t border-gray-200 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowHelp((current) => !current)}
            className="text-sm font-black text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
          >
            {showHelp ? "Hide guidance ↑" : "How to think about this →"}
          </button>

          {showHelp && (
            <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <div>
                <strong className="text-gray-950 dark:text-white">What this means:</strong>{" "}
                {question.plainEnglish}
              </div>

              <div className="mt-2">
                <strong className="text-gray-950 dark:text-white">What to look at:</strong>{" "}
                {question.hint}
              </div>

              <div className="mt-3">
                <div className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  Data worth checking
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {question.dataToWatch.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 dark:border-slate-700 dark:bg-transparent dark:text-slate-300"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                href={`/stock/${encodeURIComponent(question.ticker)}`}
                className="mt-3 inline-flex font-black text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
              >
                Analyse {question.ticker} →
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
