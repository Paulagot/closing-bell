import {
  NextResponse,
} from "next/server";

import {
  readStockRegistry,
} from "@/lib/stockRegistry";

import {
  readHistory,
} from "@/lib/history/storage";

import {
  buildDashboardIntelligence,
} from "@/lib/dashboardIntelligence";

import type {
  HistorySnapshot,
} from "@/types/history";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export async function GET() {
  try {
    const registry =
      await readStockRegistry();

    const histories: Record<
      string,
      HistorySnapshot[]
    > = {};

    await Promise.all(
      Object.keys(
        registry
      ).map(
        async (
          ticker
        ) => {
          histories[
            ticker
          ] =
            await readHistory(
              ticker
            );
        }
      )
    );

    return NextResponse.json(
      buildDashboardIntelligence(
        histories
      ),
      {
        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );
  } catch (
    error
  ) {
    console.error(
      "[dashboard-intelligence]",
      error
    );

    return NextResponse.json(
      {
        error:
          "Dashboard intelligence could not be built",
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
