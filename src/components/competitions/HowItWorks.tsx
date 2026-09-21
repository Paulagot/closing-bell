export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Choose a call",
      text:
        "Questions can be ranges, direction calls, issuer choices or simple YES / NO outcomes. Every option and scoring rule is frozen when the question is published.",
    },
    {
      number: "02",
      title: "Use the data",
      text:
        "Each card explains what the question means, shows the starting market evidence and points you to the Closing Bell chart or historical data worth checking.",
    },
    {
      number: "03",
      title: "Calls lock",
      text:
        "You can change a prediction while it is OPEN. Once the close time arrives it becomes LOCKED and stays visible while Closing Bell waits for settlement.",
    },
    {
      number: "04",
      title: "Accuracy earns points",
      text:
        "Exact answers score most. Range and ranking questions can award partial credit for nearby answers. Settlement always uses stored Closing Bell observations.",
    },
  ];

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 md:p-6">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-violet-700 dark:text-violet-400">
        How it works
      </div>

      <h2 className="mt-1 text-xl font-black text-gray-950 dark:text-white">
        Read the market, make the call, score for accuracy
      </h2>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
          >
            <div className="text-xs font-black text-violet-700 dark:text-violet-400">
              {step.number}
            </div>
            <h3 className="mt-2 text-sm font-black text-gray-950 dark:text-white">
              {step.title}
            </h3>
            <p className="mt-2 text-[13px] leading-5 text-gray-600 dark:text-slate-300">
              {step.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
