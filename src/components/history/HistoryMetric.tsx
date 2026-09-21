interface Props {
  label: string;
  value: string;
  help?: string;
}

export default function HistoryMetric({
  label,
  value,
  help,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-slate-500">
        {label}

        {help && (
          <span
            title={help}
            className="cursor-help normal-case tracking-normal text-violet-500"
          >
            ⓘ
          </span>
        )}
      </div>

      <div className="mt-1 text-lg font-black tabular-nums text-gray-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}
