import type {
  CompetitionPrize,
  CompetitionSponsor,
} from "@/types/competitions";

interface Props {
  sponsor: CompetitionSponsor | null;
  prizes: CompetitionPrize[];
}

function ordinal(place: number) {
  if (place === 1) return "1st";
  if (place === 2) return "2nd";
  return "3rd";
}

export default function SponsorPanel({
  sponsor,
  prizes,
}: Props) {
  const xAccount = (
    process.env.NEXT_PUBLIC_SPONSOR_X_ACCOUNT ?? ""
  )
    .trim()
    .replace(/^@/, "");

  const xUrl = xAccount
    ? `https://x.com/${encodeURIComponent(xAccount)}`
    : null;

  return (
    <section className="rounded-3xl border border-violet-800/70 bg-violet-950/20 p-5">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-400">
        Sponsor & prizes
      </div>

      {sponsor ? (
        <div className="mt-3">
          {sponsor.logoUrl && (
            <div className="mb-4 flex min-h-20 items-center justify-center rounded-2xl border border-slate-800 bg-white p-4">
              <img
                src={sponsor.logoUrl}
                alt={`${sponsor.name} logo`}
                className="max-h-14 max-w-full object-contain"
              />
            </div>
          )}

          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
            Presented by
          </div>

          <h2 className="mt-1 text-xl font-black text-white">
            {sponsor.name}
          </h2>

          {sponsor.tagline && (
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {sponsor.tagline}
            </p>
          )}

          {sponsor.websiteUrl && (
            <a
              href={sponsor.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl border border-violet-700 px-3 py-2 text-xs font-black text-violet-200 hover:bg-violet-950"
            >
              Visit sponsor
            </a>
          )}
        </div>
      ) : (
        <div className="mt-3">
          <h2 className="text-lg font-black text-white">
            Independent Closing Bell competition
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            This competition is not currently sponsored.
          </p>
        </div>
      )}

      <div className="mt-5 border-t border-slate-800 pt-5">
        {prizes.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-wide text-amber-400">
              Competition prizes
            </div>

            {prizes.map((prize) => (
              <article
                key={`${prize.place}-${prize.title}`}
                className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
              >
                <div className="flex gap-3">
                  {prize.imageUrl && (
                    <img
                      src={prize.imageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-slate-800 object-cover"
                    />
                  )}

                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wide text-amber-400">
                      {ordinal(prize.place)} prize
                    </div>
                    <div className="mt-0.5 font-black text-white">
                      {prize.title}
                    </div>
                    {prize.valueText && (
                      <div className="mt-1 text-xs font-bold text-emerald-300">
                        {prize.valueText}
                      </div>
                    )}
                  </div>
                </div>

                {prize.description && (
                  <p className="mt-3 text-xs leading-5 text-slate-400">
                    {prize.description}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div>
            <div className="font-black text-white">
              No prize attached
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Players can still compete for leaderboard position and bragging rights.
            </p>
          </div>
        )}
      </div>

      {!sponsor && xUrl && (
        <div className="mt-5 border-t border-slate-800 pt-5">
          <p className="text-xs leading-5 text-slate-400">
            Interested in sponsoring a future Closing Bell competition?
          </p>
          <a
            href={xUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-xl bg-violet-600 px-4 py-3 text-center text-xs font-black text-white hover:bg-violet-500"
          >
            Contact us on X
          </a>
        </div>
      )}
    </section>
  );
}
