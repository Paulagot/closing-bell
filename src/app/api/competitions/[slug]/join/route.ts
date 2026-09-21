import {
  NextResponse,
} from "next/server";

import {
  verifyCompetitionSignature,
} from "@/lib/competitions/verify";

import {
  updateCompetitionStore,
} from "@/lib/competitions/storage";

import {
  competitionPublicView,
} from "@/lib/competitions/publicView";

import type {
  CompetitionAuthPayload,
} from "@/lib/competitions/authMessage";

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
  const slug =
    String(
      context.params
        .slug ??
      ""
    ).trim();

  try {
    const body =
      await request.json();

    const payload =
      body?.payload as
        CompetitionAuthPayload;

    const signature =
      String(
        body?.signature ??
        ""
      );

    if (
      !payload ||
      payload.action !==
        "join" ||
      !verifyCompetitionSignature(
        payload,
        signature
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Wallet signature could not be verified.",
        },
        {
          status:
            401,
        }
      );
    }

    const displayName =
      String(
        payload.displayName ??
        ""
      )
        .trim()
        .slice(
          0,
          32
        );

    if (
      displayName.length <
      2
    ) {
      return NextResponse.json(
        {
          error:
            "Choose a display name with at least 2 characters.",
        },
        {
          status:
            400,
        }
      );
    }

    const store =
      await updateCompetitionStore(
        slug,
        (
          current
        ) => {
          if (
            payload.competitionId !==
            current.competition.id
          ) {
            throw new Error(
              "Competition ID mismatch"
            );
          }

          const now =
            Date.now();

          const existing =
            current.participants.find(
              (
                participant
              ) =>
                participant.wallet ===
                payload.wallet
            );

          if (
            existing
          ) {
            existing.displayName =
              displayName;

            existing.updatedAt =
              now;
          } else {
            current.participants.push({
              wallet:
                payload.wallet,

              displayName,

              joinedAt:
                now,

              updatedAt:
                now,
            });
          }

          return current;
        }
      );

    return NextResponse.json(
      competitionPublicView(
        store,
        payload.wallet
      )
    );
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
