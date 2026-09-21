"use client";

import { useMemo, useState } from "react";

import type {
  CompetitionDefinition,
  CompetitionPrize,
  CompetitionSponsor,
} from "@/types/competitions";

interface Props {
  slug: string;
  competition: CompetitionDefinition;
  onSaved: (competition: CompetitionDefinition) => void;
}

function toLocalInput(timestamp: number) {
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return new Date(value).getTime();
}

function emptyPrize(place: 1 | 2 | 3): CompetitionPrize {
  return {
    place,
    title: "",
    description: "",
    imageUrl: null,
    valueText: null,
  };
}

export default function CompetitionSettingsPanel({
  slug,
  competition,
  onSaved,
}: Props) {
  const [name, setName] = useState(competition.name);
  const [shortName, setShortName] = useState(competition.shortName);
  const [description, setDescription] = useState(competition.description);
  const [startsAt, setStartsAt] = useState(toLocalInput(competition.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(competition.endsAt));
  const [sponsor, setSponsor] = useState<CompetitionSponsor | null>(
    competition.sponsor
  );
  const [prizes, setPrizes] = useState<CompetitionPrize[]>(competition.prizes);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sponsorEnabled = sponsor !== null;

  const prizeSlots = useMemo(() => {
    return ([1, 2, 3] as const).map(
      (place) => prizes.find((prize) => prize.place === place) ?? emptyPrize(place)
    );
  }, [prizes]);

  function setSponsorEnabled(enabled: boolean) {
    if (enabled) {
      setSponsor(
        sponsor ?? {
          name: "",
          tagline: "",
          websiteUrl: null,
          logoUrl: null,
        }
      );
    } else {
      setSponsor(null);
    }
  }

  function updatePrize(place: 1 | 2 | 3, patch: Partial<CompetitionPrize>) {
    setPrizes((current) => {
      const existing = current.find((prize) => prize.place === place);
      const next = existing
        ? { ...existing, ...patch, place }
        : { ...emptyPrize(place), ...patch, place };

      return [
        ...current.filter((prize) => prize.place !== place),
        next,
      ].sort((a, b) => a.place - b.place);
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/competitions/${encodeURIComponent(slug)}/admin/settings`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            shortName,
            description,
            startsAt: fromLocalInput(startsAt),
            endsAt: fromLocalInput(endsAt),
            sponsor,
            prizes: prizeSlots.filter((prize) => prize.title.trim()),
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ?? json.details ?? "Unable to save competition settings"
        );
      }

      onSaved(json.competition);
      setMessage("Competition settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5 md:p-6">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">
        Competition settings
      </div>

      <h2 className="mt-1 text-xl font-black text-white">
        Public competition details
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-bold text-slate-300">
          Competition name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-slate-300">
          Short name
          <input
            value={shortName}
            onChange={(event) => setShortName(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-slate-300 md:col-span-2">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-violet-500"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-slate-300">
          Starts
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-bold text-slate-300">
          Ends
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
          />
        </label>
      </div>

      <div className="mt-7 border-t border-slate-800 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-violet-400">
              Sponsor
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Leave sponsor disabled for an independent competition.
            </p>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-300">
            <input
              type="checkbox"
              checked={sponsorEnabled}
              onChange={(event) => setSponsorEnabled(event.target.checked)}
              className="h-4 w-4"
            />
            Sponsored competition
          </label>
        </div>

        {sponsor && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-slate-300">
              Sponsor name
              <input
                value={sponsor.name}
                onChange={(event) =>
                  setSponsor({ ...sponsor, name: event.target.value })
                }
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-300">
              Sponsor tagline
              <input
                value={sponsor.tagline}
                onChange={(event) =>
                  setSponsor({ ...sponsor, tagline: event.target.value })
                }
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-300">
              Sponsor website URL
              <input
                value={sponsor.websiteUrl ?? ""}
                onChange={(event) =>
                  setSponsor({
                    ...sponsor,
                    websiteUrl: event.target.value || null,
                  })
                }
                placeholder="https://..."
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>

            <label className="grid gap-1.5 text-xs font-bold text-slate-300">
              Sponsor logo URL
              <input
                value={sponsor.logoUrl ?? ""}
                onChange={(event) =>
                  setSponsor({
                    ...sponsor,
                    logoUrl: event.target.value || null,
                  })
                }
                placeholder="https://.../logo.png"
                className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500"
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-7 border-t border-slate-800 pt-6">
        <div className="text-xs font-black uppercase tracking-wide text-amber-400">
          Prizes · up to 3
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Leave a prize title blank to omit that place. Prizes can exist with or without a sponsor.
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          {prizeSlots.map((prize) => (
            <div
              key={prize.place}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="text-xs font-black text-white">
                Prize {prize.place}
              </div>

              <div className="mt-3 grid gap-3">
                <input
                  value={prize.title}
                  onChange={(event) =>
                    updatePrize(prize.place, { title: event.target.value })
                  }
                  placeholder="Prize title"
                  className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-amber-500"
                />

                <textarea
                  value={prize.description}
                  onChange={(event) =>
                    updatePrize(prize.place, {
                      description: event.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Prize description"
                  className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                />

                <input
                  value={prize.valueText ?? ""}
                  onChange={(event) =>
                    updatePrize(prize.place, {
                      valueText: event.target.value || null,
                    })
                  }
                  placeholder="Value, e.g. €500"
                  className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-amber-500"
                />

                <input
                  value={prize.imageUrl ?? ""}
                  onChange={(event) =>
                    updatePrize(prize.place, {
                      imageUrl: event.target.value || null,
                    })
                  }
                  placeholder="Prize image URL"
                  className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-white outline-none focus:border-amber-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {message && (
        <div className="mt-4 text-xs font-semibold text-slate-300">
          {message}
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-11 rounded-xl bg-violet-600 px-5 text-xs font-black text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save competition settings"}
        </button>
      </div>
    </section>
  );
}
