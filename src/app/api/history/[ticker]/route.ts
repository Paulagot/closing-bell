import {
  NextResponse,
} from "next/server";

import {
  getStock,
} from "@/lib/stockRegistry";

import {
  buildHistoryAnalytics,
} from "@/lib/history/analytics";

import {
  captureTickerSnapshot,
} from "@/lib/history/capture";

import {
  lastSnapshotAgeMs,
  readHistory,
} from "@/lib/history/storage";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const STALE_AFTER_MS =
  15 * 60 * 1000;

const inFlight =
  new Map<
    string,
    Promise<unknown>
  >();

async function bootstrapIfNeeded(
  ticker: string
) {
  const age =
    await lastSnapshotAgeMs(
      ticker
    );

  if (
    age !==
      null &&
    age <
      STALE_AFTER_MS
  ) {
    return;
  }

  const existing =
    inFlight.get(
      ticker
    );

  if (
    existing
  ) {
    await existing;
    return;
  }

  const task =
    captureTickerSnapshot(
      ticker
    )
      .catch(
        (
          error
        ) => {
          console.warn(
            `[history] Opportunistic ${ticker} capture failed`,
            error
          );
        }
      )
      .finally(
        () => {
          inFlight.delete(
            ticker
          );
        }
      );

  inFlight.set(
    ticker,
    task
  );

  await task;
}

export async function GET(
  _request: Request,
  context: {
    params: {
      ticker: string;
    };
  }
) {
  const ticker =
    String(
      context.params
        .ticker ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    !(await getStock(
      ticker
    ))
  ) {
    return NextResponse.json(
      {
        error:
          "Ticker is not supported by Closing Bell",
      },
      {
        status:
          404,
      }
    );
  }

  await bootstrapIfNeeded(
    ticker
  );

  const history =
    await readHistory(
      ticker
    );

  return NextResponse.json(
    buildHistoryAnalytics(
      ticker,
      history
    ),
    {
      headers: {
        "Cache-Control":
          "private, no-store",
      },
    }
  );
}
