"use client";

import {
  useState,
} from "react";

import {
  useWallet,
} from "@solana/wallet-adapter-react";

import {
  competitionAuthMessage,
  type CompetitionAuthPayload,
} from "@/lib/competitions/authMessage";

import type {
  CompetitionPublicResponse,
} from "@/types/competitions";

interface Props {
  data:
    CompetitionPublicResponse;

  onUpdated: (
    data:
      CompetitionPublicResponse
  ) => void;
}

export default function JoinCompetitionCard({
  data,
  onUpdated,
}: Props) {
  const {
    publicKey,
    signMessage,
  } =
    useWallet();

  const [
    displayName,
    setDisplayName,
  ] =
    useState(
      data.viewer
        ?.displayName ??
      ""
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  if (
    !publicKey
  ) {
    return (
      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h2 className="text-lg font-black text-gray-950 dark:text-white">
          Join the leaderboard
        </h2>

        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
          Connect a Solana wallet above. Your wallet is your competition identity; no password is required.
        </p>
      </section>
    );
  }

  if (
    data.viewer
  ) {
    return (
      <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 px-4 py-4 dark:border-emerald-900 dark:bg-emerald-950/20">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-white text-sm font-black text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            ✓
          </div>

          <div className="min-w-0">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-400">
              You are in
            </div>
            <div className="truncate text-base font-black text-gray-950 dark:text-white">
              {data.viewer.displayName}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
          Make a call on any open question. You can change it until that question locks.
        </p>
      </section>
    );
  }

  async function join() {
    if (
      !publicKey ||
      !signMessage
    ) {
      setError(
        "This wallet does not support message signing."
      );

      return;
    }

    const name =
      displayName.trim();

    if (
      name.length <
      2
    ) {
      setError(
        "Choose a display name with at least 2 characters."
      );

      return;
    }

    setBusy(
      true
    );

    setError(
      null
    );

    try {
      const payload:
        CompetitionAuthPayload = {
          action:
            "join",

          wallet:
            publicKey.toBase58(),

          competitionId:
            data.competition.id,

          displayName:
            name,

          issuedAt:
            Date.now(),
        };

      const signatureBytes =
        await signMessage(
          new TextEncoder().encode(
            competitionAuthMessage(
              payload
            )
          )
        );

      const signature =
        btoa(
          String.fromCharCode(
            ...Array.from(
              signatureBytes
            )
          )
        );

      const response =
        await fetch(
          `/api/competitions/${encodeURIComponent(
            data.competition.slug
          )}/join`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                payload,
                signature,
              }),
          }
        );

      const json =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          json.error ??
          "Unable to join competition"
        );
      }

      onUpdated(
        json
      );
    } catch (
      joinError
    ) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : String(
              joinError
            )
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <h2 className="text-lg font-black text-gray-950 dark:text-white">
        Join the leaderboard
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-slate-400">
        Pick a public display name, then sign a wallet message to prove this wallet is yours. Signing does not send a transaction or spend funds.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={
            displayName
          }
          onChange={(
            event
          ) =>
            setDisplayName(
              event.target.value
            )
          }
          maxLength={
            32
          }
          placeholder="Display name"
          className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none focus:border-violet-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        />

        <button
          type="button"
          onClick={
            join
          }
          disabled={
            busy
          }
          className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-50"
        >
          {busy
            ? "Signing…"
            : "Join challenge"}
        </button>
      </div>

      {error && (
        <div className="mt-3 text-xs font-semibold text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </section>
  );
}
