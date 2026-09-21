const items = [
  {
    title:
      "Indicative ≠ executable",
    body:
      "An indicative token price is a reference. Closing Bell also tests a whole $1K Jupiter order so you can see the price the quoted route actually implies.",
  },
  {
    title:
      "BUY gap vs Wall Street",
    body:
      "This compares an executable on-chain BUY with the latest US-market reference. It describes relative pricing; it is not a guaranteed saving or a cross-market arbitrage profit.",
  },
  {
    title:
      "Approx. break-even move",
    body:
      "This uses the quoted BUY and SELL relationship to estimate the move needed for the current SELL price to reach the current BUY price. It changes with liquidity and routing.",
  },
  {
    title:
      "Issuer matters",
    body:
      "Wrappers tracking the same stock can have different structures, liquidity and execution. Comparing issuers is part of understanding what you are actually trading.",
  },
];

export default function HowToReadClosingBell() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none md:p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
        How to read Closing Bell
      </div>

      <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
        Four numbers worth understanding before you trade
      </h2>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map(
          (
            item
          ) => (
            <article
              key={
                item.title
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/55"
            >
              <div className="text-sm font-black text-slate-950 dark:text-white">
                {
                  item.title
                }
              </div>

              <p className="mt-2 text-[13px] leading-5 text-slate-600 dark:text-slate-400">
                {
                  item.body
                }
              </p>
            </article>
          )
        )}
      </div>
    </section>
  );
}
