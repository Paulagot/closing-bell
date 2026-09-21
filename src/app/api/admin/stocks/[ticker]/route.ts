import { NextResponse } from "next/server";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";

import {
  deleteStock,
  getStockAdmin,
} from "@/lib/stockRegistry";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: {
    params: {
      ticker: string;
    };
  }
) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const ticker =
    String(
      context.params.ticker ?? ""
    )
      .trim()
      .toUpperCase();

  if (
    !(await getStockAdmin(ticker))
  ) {
    return NextResponse.json(
      {
        error:
          "Stock not found",
      },
      { status: 404 }
    );
  }

  try {
    const stocks =
      await deleteStock(ticker);

    return NextResponse.json({
      ok: true,
      stocks,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Unable to delete stock",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}
