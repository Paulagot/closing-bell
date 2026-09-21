import {
  NextResponse,
} from "next/server";

import {
  competitionPublicView,
} from "@/lib/competitions/publicView";

import {
  getActiveCompetitionSlug,
  readCompetitionStore,
  updateCompetitionStore,
} from "@/lib/competitions/storage";

import {
  settleDueQuestions,
} from "@/lib/competitions/settlement";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export async function GET(
  request: Request
) {
  const url =
    new URL(
      request.url
    );

  const viewerWallet =
    url.searchParams.get(
      "wallet"
    );

  try {
    const slug =
      await getActiveCompetitionSlug();

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

    const store =
      await readCompetitionStore(
        slug
      );

    return NextResponse.json(
      competitionPublicView(
        store,
        viewerWallet
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
    return NextResponse.json(
      {
        error:
          "Unable to load active competition",

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
