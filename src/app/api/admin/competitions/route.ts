import { NextResponse } from "next/server";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";
import {
  createCompetition,
  getActiveCompetitionSlug,
  listCompetitions,
} from "@/lib/competitions/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const [competitions, activeSlug] =
      await Promise.all([
        listCompetitions(),
        getActiveCompetitionSlug(),
      ]);

    return NextResponse.json({
      competitions,
      activeSlug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load competitions",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();

    const competition = await createCompetition({
      slug: String(body?.slug ?? ""),
      name: String(body?.name ?? ""),
      shortName: String(body?.shortName ?? ""),
      description: String(body?.description ?? ""),
      startsAt: Number(body?.startsAt),
      endsAt: Number(body?.endsAt),
    });

    return NextResponse.json(
      { ok: true, competition },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create competition",
      },
      { status: 400 }
    );
  }
}
