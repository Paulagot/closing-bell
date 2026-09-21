import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { verifyCompetitionSignature } from "@/lib/competitions/verify";
import { competitionPreviewMode } from "@/lib/competitions/config";
import { updateCompetitionStore } from "@/lib/competitions/storage";
import { competitionPublicView } from "@/lib/competitions/publicView";

import type { CompetitionAuthPayload } from "@/lib/competitions/authMessage";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: { slug: string } }
) {
  const slug = String(context.params.slug ?? "").trim();

  try {
    const body = await request.json();

    const payload = body?.payload as CompetitionAuthPayload;
    const signature = String(body?.signature ?? "");

    if (
      !payload ||
      payload.action !== "predict" ||
      !payload.answer ||
      !payload.questionId ||
      !verifyCompetitionSignature(payload, signature)
    ) {
      return NextResponse.json(
        { error: "Wallet signature could not be verified." },
        { status: 401 }
      );
    }

    // Capture the narrowed optional fields before entering the updater
    // callback. TypeScript does not preserve property narrowing across
    // closures because the original payload object could theoretically
    // be mutated.
    const answer = payload.answer;
    const questionId = payload.questionId;

    const store = await updateCompetitionStore(slug, (current) => {
      if (payload.competitionId !== current.competition.id) {
        throw new Error("Competition ID mismatch");
      }

      const participant = current.participants.find(
        (item) => item.wallet === payload.wallet
      );

      if (!participant) {
        throw new Error(
          "Join the competition before making a call."
        );
      }

      const question = current.questions.find(
        (item) => item.id === questionId
      );

      if (!question) {
        throw new Error("Question not found.");
      }

      if (
        !question.options.some(
          (option) => option.id === answer
        )
      ) {
        throw new Error("That answer is not valid for this question.");
      }

      const now = Date.now();

      const competitionOpen =
        now >= current.competition.startsAt &&
        now < current.competition.endsAt;

      if (!competitionOpen && !competitionPreviewMode()) {
        throw new Error(
          "The competition is not open for calls yet."
        );
      }

      if (
        question.status !== "open" ||
        now >= question.lockAt
      ) {
        throw new Error("This call is locked.");
      }

      const existing = current.predictions.find(
        (prediction) =>
          prediction.questionId === question.id &&
          prediction.wallet === payload.wallet
      );

      if (existing) {
        existing.answer = answer;
        existing.updatedAt = now;
      } else {
        current.predictions.push({
          id: randomUUID(),
          competitionId: current.competition.id,
          questionId: question.id,
          wallet: payload.wallet,
          answer,
          submittedAt: now,
          updatedAt: now,
          settledAt: null,
          correct: null,
          distance: null,
          pointsAwarded: 0,
        });
      }

      return current;
    });

    return NextResponse.json(
      competitionPublicView(store, payload.wallet)
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}
