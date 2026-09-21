interface Props {
  timestamp:
    | number
    | null;

  prefix?:
    string;
}

export default function SnapshotStamp({
  timestamp,
  prefix = "Snapshot",
}: Props) {
  if (
    timestamp ===
    null
  ) {
    return null;
  }

  return (
    <div
      title={new Date(
        timestamp
      ).toLocaleString()}
      className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500"
    >
      {prefix} ·{" "}
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
