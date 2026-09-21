interface Props {
  timestamp:
    number;
}

export default function LiveQuoteTimestamp({
  timestamp,
}: Props) {
  return (
    <div
      title={new Date(
        timestamp
      ).toLocaleString()}
      className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500"
    >
      Live quote ·{" "}
      {new Date(
        timestamp
      ).toLocaleTimeString(
        [],
        {
          hour:
            "2-digit",

          minute:
            "2-digit",

          second:
            "2-digit",
        }
      )}
    </div>
  );
}
