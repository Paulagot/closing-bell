import {
  NextResponse,
} from "next/server";

import {
  requireCompetitionAdmin,
} from "@/lib/competitions/admin";

import {
  updateCompetitionStore,
} from "@/lib/competitions/storage";

import {
  settleDueQuestions,
} from "@/lib/competitions/settlement";

export const dynamic =
  "force-dynamic";

export async function POST(
  request:
    Request,
  context: {
    params: {
      slug:
        string;
    };
  }
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

  const slug =
    String(
      context.params
        .slug ??
      ""
    ).trim();

  try {
    await updateCompetitionStore(
      slug,
      async (
        store
      ) => {
        await settleDueQuestions(
          store
        );
      }
    );

    return NextResponse.json({
      ok:
        true,
    });
  } catch (
    error
  ) {
    return NextResponse.json(
      {
        error:
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
