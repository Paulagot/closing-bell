import { NextResponse } from "next/server";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";
import {
  setActiveCompetitionSlug,
} from "@/lib/competitions/storage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(request: Request) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const activeSlug =
      await setActiveCompetitionSlug(
        String(body?.slug ?? "")
      );

    return NextResponse.json({
      ok: true,
      activeSlug,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to change active competition",
      },
      { status: 400 }
    );
  }
}
