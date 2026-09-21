import type {
  CompetitionLeaderboardRow,
  CompetitionStore,
} from "@/types/competitions";

function shortWallet(wallet: string) {
  return wallet.length <= 10
    ? wallet
    : `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

export function buildCompetitionLeaderboard(
  store: CompetitionStore
): CompetitionLeaderboardRow[] {
  const rows = store.participants.map((participant) => {
    const predictions = store.predictions.filter(
      (prediction) => prediction.wallet === participant.wallet
    );

    const settled = predictions.filter(
      (prediction) => prediction.settledAt !== null
    );

    const exactCalls = settled.filter(
      (prediction) => prediction.correct === true
    ).length;

    const nearCalls = settled.filter(
      (prediction) =>
        prediction.correct === false &&
        prediction.distance !== null &&
        prediction.distance <= 2 &&
        prediction.pointsAwarded > 0
    ).length;

    const points = predictions.reduce(
      (total, prediction) => total + prediction.pointsAwarded,
      0
    );

    const maxPossiblePoints = settled.length * 100;

    return {
      rank: 0,
      wallet: participant.wallet,
      walletShort: shortWallet(participant.wallet),
      displayName: participant.displayName,
      calls: predictions.length,
      settledCalls: settled.length,
      exactCalls,
      nearCalls,
      accuracyPct:
        settled.length > 0
          ? (exactCalls / settled.length) * 100
          : null,
      points,
      maxPossiblePoints,
      pointsEfficiencyPct:
        maxPossiblePoints > 0
          ? (points / maxPossiblePoints) * 100
          : null,
    };
  });

  rows.sort(
    (left, right) =>
      right.points - left.points ||
      (right.pointsEfficiencyPct ?? -1) -
        (left.pointsEfficiencyPct ?? -1) ||
      right.exactCalls - left.exactCalls ||
      left.displayName.localeCompare(right.displayName)
  );

  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
  }));
}
