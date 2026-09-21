"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import AppShell from "@/components/shell/AppShell";

interface CompetitionSummary {
  slug: string;
  competition: {
    name: string;
    shortName: string;
    description: string;
    startsAt: number;
    endsAt: number;
    sponsor: {
      name: string;
    } | null;
    prizes: Array<{
      place: number;
      title: string;
    }>;
  };
  participantCount: number;
  questionCount: number;
  predictionCount: number;
}

function toLocalInput(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(
    timestamp - offset * 60_000
  );
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return new Date(value).getTime();
}

function suggestedSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export default function CompetitionManagerClient() {
  const router = useRouter();
  const [competitions, setCompetitions] =
    useState<CompetitionSummary[]>([]);
  const [activeSlug, setActiveSlug] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [showCreate, setShowCreate] =
    useState(false);

  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(
    toLocalInput(Date.now())
  );
  const [endsAt, setEndsAt] = useState(
    toLocalInput(Date.now() + 30 * 24 * 60 * 60 * 1000)
  );

  const active = useMemo(
    () =>
      competitions.find(
        (item) => item.slug === activeSlug
      ) ?? null,
    [competitions, activeSlug]
  );

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/competitions",
        { cache: "no-store" }
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? json.details ?? "Unable to load competitions"
        );
      }

      setCompetitions(json.competitions ?? []);
      setActiveSlug(json.activeSlug ?? "");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function makeActive(nextSlug: string) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/competitions/active",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ slug: nextSlug }),
        }
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? "Unable to change active competition"
        );
      }

      setActiveSlug(json.activeSlug);
      setMessage("Active competition updated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", {
      method: "DELETE",
    });
    router.replace("/admin/login");
    router.refresh();
  }

  async function create() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/competitions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            shortName,
            slug,
            description,
            startsAt: fromLocalInput(startsAt),
            endsAt: fromLocalInput(endsAt),
          }),
        }
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? "Unable to create competition"
        );
      }

      setShowCreate(false);
      setName("");
      setShortName("");
      setSlug("");
      setSlugTouched(false);
      setDescription("");
      await load();
      setMessage(
        "Competition created. It has not been made active automatically."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setBusy(false);
    }
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
              <h1 className="mt-2 text-3xl font-black text-white">
                Competitions
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Create competitions, choose which one is live, then manage its sponsor, prizes and questions.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCreate((current) => !current)}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white"
              >
                {showCreate ? "Close form" : "+ New competition"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-red-900 px-4 py-2.5 text-xs font-black text-red-300"
              >
                Sign out
              </button>
            </div>
          </div>

          {active && (
            <div className="mt-5 rounded-2xl border border-emerald-900/70 bg-emerald-950/20 p-4">
              <div className="text-[10px] font-black uppercase tracking-wide text-emerald-400">
                Active competition
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black text-white">
                    {active.competition.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    /competitions · {active.slug}
                  </div>
                </div>
                <Link
                  href={`/admin/competitions/${encodeURIComponent(active.slug)}`}
                  className="rounded-xl border border-emerald-800 px-3 py-2 text-xs font-black text-emerald-300"
                >
                  Manage active competition
                </Link>
              </div>
            </div>
          )}
        </section>

        {showCreate && (
          <section className="rounded-3xl border border-violet-900/60 bg-slate-950 p-5 md:p-6">
            <div className="text-[10px] font-black uppercase tracking-wide text-violet-400">
              New competition
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              Create without overwriting old data
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                Competition name
                <input
                  value={name}
                  onChange={(event) => {
                    const next = event.target.value;
                    setName(next);
                    if (!slugTouched) {
                      setSlug(suggestedSlug(next));
                    }
                  }}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                Short name
                <input
                  value={shortName}
                  onChange={(event) => setShortName(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-300 md:col-span-2">
                URL slug
                <input
                  value={slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    setSlug(event.target.value.toLowerCase());
                  }}
                  placeholder="november-divergence-2026"
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-300 md:col-span-2">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                Starts
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                />
              </label>

              <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                Ends
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={create}
                disabled={busy || !name || !shortName || !slug || !description}
                className="min-h-11 rounded-xl bg-violet-600 px-5 text-xs font-black text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create competition"}
              </button>
            </div>
          </section>
        )}

        {message && (
          <div className="rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs font-semibold text-slate-300">
            {message}
          </div>
        )}

        <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 md:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Competition archive
              </div>
              <h2 className="mt-1 text-xl font-black text-white">
                {loading ? "Loading…" : `${competitions.length} competition${competitions.length === 1 ? "" : "s"}`}
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {competitions.map((item) => {
              const isActive = item.slug === activeSlug;
              return (
                <article
                  key={item.slug}
                  className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-white">
                          {item.competition.name}
                        </h3>
                        {isActive && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase text-emerald-400">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {item.slug}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                        <span>{item.participantCount} participants</span>
                        <span>{item.questionCount} questions</span>
                        <span>{item.predictionCount} predictions</span>
                        <span>{item.competition.prizes.length} prizes</span>
                        <span>{item.competition.sponsor ? item.competition.sponsor.name : "No sponsor"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!isActive && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => makeActive(item.slug)}
                          className="rounded-xl border border-emerald-800 px-3 py-2 text-xs font-black text-emerald-300 disabled:opacity-50"
                        >
                          Make active
                        </button>
                      )}
                      <Link
                        href={`/admin/competitions/${encodeURIComponent(item.slug)}`}
                        className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white"
                      >
                        Manage
                      </Link>
                      <Link
                        href={`/competitions/${encodeURIComponent(item.slug)}`}
                        className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-black text-slate-300"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
