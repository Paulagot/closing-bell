import LocalTime from "@/components/competitions/LocalTime";

import type {
  CompetitionDefinition,
  CompetitionPrize,
} from "@/types/competitions";

interface Props {
  competition: CompetitionDefinition;
  participantCount: number;
  predictionCount: number;
}

function ordinal(place: CompetitionPrize["place"]) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  return "3rd";
}

export default function CompetitionHero({
  competition,
  participantCount,
  predictionCount,
}: Props) {
  const sponsor = competition.sponsor;
  const prizes = competition.prizes ?? [];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-violet-900/70 bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.18),transparent_32%),linear-gradient(135deg,#10151d,#090d12_60%,#111827)] p-6 shadow-sm md:p-8">
      <div
        className={
          sponsor
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start"
            : "block"
        }
      >
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-300">
            Closing Bell competition
          </div>

          <h1 className="mt-2 max-w-4xl text-4xl font-black tracking-tight text-white md:text-5xl">
            {competition.shortName}
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base md:leading-7">
            {competition.description}
          </p>

          {prizes.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-amber-300">
                Competition prizes
              </div>

              <div className="flex flex-wrap gap-3">
                {prizes.map((prize) => (
                  <div
                    key={`${prize.place}-${prize.title}`}
                    className="flex min-w-[210px] max-w-sm flex-1 items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 sm:flex-none"
                  >
                    {prize.imageUrl && (
                      <img
                        src={prize.imageUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    )}

                    <div className="min-w-0">
                      <div className="text-[11px] font-black uppercase tracking-wide text-amber-300">
                        {ordinal(prize.place)} prize
                      </div>
                      <div className="truncate text-sm font-black text-white">
                        {prize.title}
                      </div>
                      {prize.valueText && (
                        <div className="mt-0.5 text-xs font-bold text-emerald-300">
                          {prize.valueText}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {sponsor && (
          <div className="rounded-3xl border border-violet-500/30 bg-violet-500/[0.08] p-5">
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-300">
              Sponsored by
            </div>

            <div className="mt-4 flex items-center gap-4 xl:block">
              {sponsor.logoUrl && (
                <div className="flex h-24 w-36 shrink-0 items-center justify-center rounded-2xl bg-white p-3 shadow-sm xl:h-28 xl:w-full">
                  <img
                    src={sponsor.logoUrl}
                    alt={`${sponsor.name} logo`}
                    className="max-h-20 max-w-full object-contain"
                  />
                </div>
              )}

              <div className="min-w-0 xl:mt-4">
                <div className="text-lg font-black text-white">
                  {sponsor.name}
                </div>

                {sponsor.tagline && (
                  <p className="mt-1 text-sm leading-5 text-slate-300">
                    {sponsor.tagline}
                  </p>
                )}

                {sponsor.websiteUrl && (
                  <a
                    href={sponsor.websiteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl border border-violet-500/40 px-3 text-xs font-black text-violet-200 transition hover:bg-violet-500/10"
                  >
                    Visit sponsor
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_150px_150px] xl:items-stretch">
        <div className="rounded-xl bg-white/[0.035] px-4 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Starts
          </div>
          <div className="mt-1 text-sm font-bold leading-5 text-white">
            <LocalTime timestamp={competition.startsAt} includeZone />
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.035] px-4 py-3">
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Ends
          </div>
          <div className="mt-1 text-sm font-bold leading-5 text-white">
            <LocalTime timestamp={competition.endsAt} includeZone />
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 px-4 py-3">
          <div className="text-2xl font-black leading-none text-white">
            {participantCount}
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Players
          </div>
        </div>

        <div className="rounded-xl bg-slate-900 px-4 py-3">
          <div className="text-2xl font-black leading-none text-white">
            {predictionCount}
          </div>
          <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Calls made
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-200">
          Free entry
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-200">
          Up to 100 points per question
        </span>
        <span className="rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-slate-200">
          Partial credit on accuracy questions
        </span>
      </div>
    </section>
  );
}
