"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

import AppShell from "@/components/shell/AppShell";
import CompetitionAdminPanel from "@/components/competitions/CompetitionAdminPanel";
import CompetitionSettingsPanel from "@/components/competitions/CompetitionSettingsPanel";

import type {
  CompetitionDefinition,
} from "@/types/competitions";

interface Props {
  slug: string;
}

export default function CompetitionAdminPageClient({
  slug,
}: Props) {
  const router = useRouter();
  const [competition, setCompetition] =
    useState<CompetitionDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAdmin() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/competitions/${encodeURIComponent(slug)}/admin/settings`,
        { cache: "no-store" }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? json.details ?? "Unable to load competition admin"
        );
      }

      setCompetition(json.competition);
    } catch (error) {
      setCompetition(null);
      setMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmin();
  }, [slug]);

  async function logout() {
    await fetch("/api/admin/session", {
      method: "DELETE",
    });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <AppShell>
      <main className="app-shell space-y-5 py-5 md:py-8">
        <section className="rounded-[2rem] border border-slate-800 bg-slate-950 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">
                Closing Bell admin
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
                {competition?.name ?? "Competition admin"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage this competition's public details, sponsor, prizes and questions.
              </p>
              <div className="mt-2 text-xs text-slate-500">
                {slug}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/competitions"
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:bg-slate-900"
              >
                All competitions
              </Link>
              <Link
                href={`/competitions/${encodeURIComponent(slug)}`}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:bg-slate-900"
              >
                View competition
              </Link>
              <Link
                href={`/competitions/${encodeURIComponent(slug)}/leaderboard`}
                className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300 hover:bg-slate-900"
              >
                View leaderboard
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-red-900 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-950/30"
              >
                Sign out
              </button>
            </div>
          </div>

          {loading && (
            <div className="mt-5 text-xs font-semibold text-slate-400">
              Loading competition…
            </div>
          )}

          {message && (
            <div className="mt-5 text-xs font-semibold text-red-300">
              {message}
            </div>
          )}
        </section>

        {competition && (
          <>
            <CompetitionSettingsPanel
              key={`${competition.id}-${competition.startsAt}-${competition.endsAt}-${competition.sponsor?.name ?? "none"}-${competition.prizes.length}`}
              slug={slug}
              competition={competition}
              onSaved={setCompetition}
            />

            <CompetitionAdminPanel
              slug={slug}
              onPublished={loadAdmin}
            />
          </>
        )}
      </main>
    </AppShell>
  );
}
