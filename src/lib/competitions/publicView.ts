import { buildCompetitionLeaderboard } from "@/lib/competitions/leaderboard";
import { competitionPreviewMode } from "@/lib/competitions/config";

import type {
  CompetitionPublicResponse,
  CompetitionStore,
} from "@/types/competitions";

export function competitionPublicView(
  store: CompetitionStore,
  viewerWallet: string | null
): CompetitionPublicResponse {
  const viewerParticipant = viewerWallet
    ? store.participants.find(
        (participant) => participant.wallet === viewerWallet
      ) ?? null
    : null;

  const predictions = viewerWallet
    ? Object.fromEntries(
        store.predictions
          .filter((prediction) => prediction.wallet === viewerWallet)
          .map((prediction) => [
            prediction.questionId,
            {
              answer: prediction.answer,
              settledAt: prediction.settledAt,
              correct: prediction.correct,
              distance: prediction.distance,
              pointsAwarded: prediction.pointsAwarded,
            },
          ])
      )
    : {};

  return {
    competition: store.competition,
    questions: [...store.questions].sort(
      (left, right) => left.lockAt - right.lockAt
    ),
    leaderboard: buildCompetitionLeaderboard(store),
    participantCount: store.participants.length,
    predictionCount: store.predictions.length,
    viewer: viewerParticipant
      ? {
          wallet: viewerParticipant.wallet,
          displayName: viewerParticipant.displayName,
          joinedAt: viewerParticipant.joinedAt,
          predictions,
        }
      : null,
    previewMode: competitionPreviewMode(),
  };
}
