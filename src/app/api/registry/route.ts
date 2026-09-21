import { NextResponse } from "next/server";

import {
  readStockRegistry,
} from "@/lib/stockRegistry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const stocks =
      await readStockRegistry();

    return NextResponse.json(
      { stocks },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Unable to load stock registry",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
