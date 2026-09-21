import { NextResponse } from "next/server";
import { requireCompetitionAdmin } from "@/lib/competitions/admin";
import { buildPaperLabDashboard } from "@/lib/paperLab/dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await buildPaperLabDashboard());
  } catch (error) {
    console.error("[admin/lab]", error);
    return NextResponse.json(
      {
        error: "Unable to load Paper Lab",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
