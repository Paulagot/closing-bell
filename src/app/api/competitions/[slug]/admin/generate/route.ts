import {
  NextResponse,
} from "next/server";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";

import {
  generateCompetitionCandidates,
} from "@/lib/competitions/questionGenerator";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    Request
) {
  if (
    !requireCompetitionAdmin(
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
    const candidates =
      await generateCompetitionCandidates(
        12
      );

    return NextResponse.json({
      candidates,
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
          "Unable to generate competition questions",

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
