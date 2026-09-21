import {
  NextResponse,
} from "next/server";

import {
  getStock,
} from "@/lib/stockRegistry";

import {
  captureAllTickerSnapshots,
  captureTickerSnapshot,
} from "@/lib/history/capture";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

function authorized(
  request: Request
) {
  const secret =
    process.env
      .HISTORY_CRON_SECRET;

  if (!secret) {
    return (
      process.env
        .NODE_ENV !==
      "production"
    );
  }

  const header =
    request.headers.get(
      "authorization"
    );

  return header ===
    `Bearer ${secret}`;
}

export async function POST(
  request: Request
) {
  if (
    !authorized(
      request
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized",
      },
      {
        status:
          401,
      }
    );
  }

  try {
    let ticker =
      "";

    try {
      const body =
        await request.json();

      ticker =
        String(
          body?.ticker ??
          ""
        )
          .trim()
          .toUpperCase();
    } catch {
      // Empty body captures all tickers.
    }

    if (
      ticker
    ) {
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
              400,
          }
        );
      }

      const snapshot =
        await captureTickerSnapshot(
          ticker
        );

      return NextResponse.json({
        ok:
          true,

        captured:
          [
            ticker,
          ],

        timestamp:
          snapshot.timestamp,
      });
    }

    const results =
      await captureAllTickerSnapshots();

    return NextResponse.json({
      ok:
        true,

      results,

      timestamp:
        Date.now(),
    });
  } catch (
    error
  ) {
    console.error(
      "[history/capture]",
      error
    );

    return NextResponse.json(
      {
        error:
          "History capture failed",

        details:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );
  }
}
