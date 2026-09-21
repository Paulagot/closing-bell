import {
  promises as fs,
} from "fs";

import path from "path";

import type {
  HistorySnapshot,
} from "@/types/history";

const MAX_SNAPSHOTS_PER_TICKER =
  60 * 24 * 45 / 15;

function historyDirectory() {
  return (
    process.env
      .HISTORY_DATA_DIR ??
    path.join(
      process.cwd(),
      "data",
      "history"
    )
  );
}

function safeTicker(
  ticker: string
) {
  return ticker
    .toUpperCase()
    .replace(
      /[^A-Z0-9._-]/g,
      ""
    );
}

function tickerPath(
  ticker: string
) {
  return path.join(
    historyDirectory(),
    `${safeTicker(
      ticker
    )}.json`
  );
}

async function ensureDirectory() {
  await fs.mkdir(
    historyDirectory(),
    {
      recursive:
        true,
    }
  );
}

export async function readHistory(
  ticker: string
): Promise<HistorySnapshot[]> {
  await ensureDirectory();

  try {
    const raw =
      await fs.readFile(
        tickerPath(
          ticker
        ),
        "utf8"
      );

    const parsed =
      JSON.parse(
        raw
      );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (
          item
        ) =>
          item &&
          typeof item.timestamp ===
            "number"
      )
      .sort(
        (
          a,
          b
        ) =>
          a.timestamp -
          b.timestamp
      );
  } catch (
    error
  ) {
    const code =
      (
        error as NodeJS.ErrnoException
      ).code;

    if (code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function appendHistorySnapshot(
  snapshot: HistorySnapshot
) {
  await ensureDirectory();

  const existing =
    await readHistory(
      snapshot.ticker
    );

  const minimumGapMs =
    60 * 1000;

  const last =
    existing[
      existing.length - 1
    ];

  if (
    last &&
    Math.abs(
      last.timestamp -
      snapshot.timestamp
    ) <
      minimumGapMs
  ) {
    return last;
  }

  const next =
    [
      ...existing,
      snapshot,
    ].slice(
      -MAX_SNAPSHOTS_PER_TICKER
    );

  const file =
    tickerPath(
      snapshot.ticker
    );

  const temporary =
    `${file}.${process.pid}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      next,
      null,
      2
    ),
    "utf8"
  );

  await fs.rename(
    temporary,
    file
  );

  return snapshot;
}

export async function lastSnapshotAgeMs(
  ticker: string
): Promise<number | null> {
  const history =
    await readHistory(
      ticker
    );

  const last =
    history[
      history.length - 1
    ];

  if (!last) {
    return null;
  }

  return Math.max(
    0,
    Date.now() -
      last.timestamp
  );
}
