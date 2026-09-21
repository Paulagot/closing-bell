import {
  COMPETITION_SETTLEMENT_WINDOW_MS,
} from "@/lib/competitions/config";

import {
  numericOptionForValue,
  scorePrediction,
} from "@/lib/competitions/scoring";

import { readHistory } from "@/lib/history/storage";

import type {
  CompetitionQuestion,
  CompetitionStore,
} from "@/types/competitions";

import type {
  HistoryIssuerSnapshot,
  HistorySnapshot,
} from "@/types/history";

function settlementSnapshot(
  history: HistorySnapshot[],
  settlementAt: number
) {
  return [...history]
    .sort((a, b) => a.timestamp - b.timestamp)
    .find(
      (snapshot) =>
        snapshot.timestamp >= settlementAt &&
        snapshot.timestamp <=
          settlementAt + COMPETITION_SETTLEMENT_WINDOW_MS
    ) ?? null;
}

function issuerForQuestion(
  snapshot: HistorySnapshot,
  question: CompetitionQuestion
) {
  return (
    snapshot.issuers.find(
      (issuer) =>
        issuer.issuer === question.issuer ||
        issuer.symbol === question.symbol
    ) ?? null
  );
}

function indicativeGapPct(
  snapshot: HistorySnapshot,
  issuer: HistoryIssuerSnapshot
) {
  if (
    issuer.indicativePrice === null ||
    snapshot.benchmarkPrice === null ||
    snapshot.benchmarkPrice <= 0
  ) {
    return null;
  }

  return (
    ((issuer.indicativePrice - snapshot.benchmarkPrice) /
      snapshot.benchmarkPrice) *
    100
  );
}

function evidence(
  snapshot: HistorySnapshot,
  issuer: HistoryIssuerSnapshot | null
) {
  return {
    gap: issuer?.buyGapPct ?? null,
    benchmark: snapshot.benchmarkPrice,
    indicative: issuer?.indicativePrice ?? null,
    executableBuy: issuer?.buy.effectivePrice ?? null,
    executableSell: issuer?.sell.effectivePrice ?? null,
    breakEven: issuer?.approxBreakEvenMovePct ?? null,
  };
}

function issuerSettlementRanking(
  snapshot: HistorySnapshot,
  question: CompetitionQuestion
) {
  const valid = question.options
    .map((option) => {
      if (!option.issuer) return null;

      const issuer = snapshot.issuers.find(
        (item) => item.issuer === option.issuer
      );

      if (!issuer || issuer.buyGapPct === null) return null;

      return {
        issuer: option.issuer,
        gap: issuer.buyGapPct,
      };
    })
    .filter(
      (
        row
      ): row is {
        issuer: string;
        gap: number;
      } => row !== null
    );

  if (valid.length < 2) return null;

  valid.sort((a, b) => {
    if (question.type === "issuer_most_expensive") {
      return b.gap - a.gap;
    }

    return a.gap - b.gap;
  });

  return Object.fromEntries(
    valid.map((row, index) => [row.issuer, index])
  );
}

function settleQuestionFromSnapshot(
  question: CompetitionQuestion,
  snapshot: HistorySnapshot
) {
  if (
    question.type === "issuer_cheapest" ||
    question.type === "issuer_most_expensive"
  ) {
    const ranks = issuerSettlementRanking(snapshot, question);
    if (!ranks) return null;

    const winnerIssuer = Object.entries(ranks).sort(
      (a, b) => a[1] - b[1]
    )[0]?.[0];

    const resultOption = question.options.find(
      (option) => option.issuer === winnerIssuer
    );

    if (!resultOption) return null;

    return {
      resultOptionId: resultOption.id,
      issuerRanks: ranks,
      ...evidence(snapshot, null),
    };
  }

  const issuer = issuerForQuestion(snapshot, question);

  if (
    !issuer ||
    issuer.buy.status !== "ok" ||
    issuer.buyGapPct === null
  ) {
    return null;
  }

  const gap = issuer.buyGapPct;

  if (question.type === "gap_range") {
    const option = numericOptionForValue(question.options, gap);
    if (!option) return null;

    return {
      resultOptionId: option.id,
      ...evidence(snapshot, issuer),
    };
  }

  if (question.type === "break_even_range") {
    const value = issuer.approxBreakEvenMovePct;
    if (value === null) return null;

    const option = numericOptionForValue(question.options, value);
    if (!option) return null;

    return {
      resultOptionId: option.id,
      ...evidence(snapshot, issuer),
    };
  }

  if (question.type === "gap_direction") {
    const start = question.source.currentBuyGapPct;
    if (start === null) return null;

    const changeInMagnitude = Math.abs(gap) - Math.abs(start);
    const band = question.littleChangeBandPct ?? 0.25;

    const resultOptionId =
      Math.abs(changeInMagnitude) < band
        ? "little-change"
        : changeInMagnitude < 0
          ? "narrower"
          : "wider";

    return {
      resultOptionId,
      ...evidence(snapshot, issuer),
    };
  }

  if (question.type === "near_benchmark") {
    const target = question.thresholdPct ?? 0.5;

    return {
      resultOptionId:
        Math.abs(gap) <= target ? "yes" : "no",
      ...evidence(snapshot, issuer),
    };
  }

  if (question.type === "below_wall_street") {
    return {
      resultOptionId: gap < 0 ? "yes" : "no",
      ...evidence(snapshot, issuer),
    };
  }

  if (question.type === "execution_discount_survives") {
    const indicativeGap = indicativeGapPct(snapshot, issuer);
    if (indicativeGap === null) return null;

    return {
      resultOptionId:
        indicativeGap < 0 && gap < 0 ? "yes" : "no",
      ...evidence(snapshot, issuer),
    };
  }

  if (
    question.type === "gap_threshold" &&
    question.thresholdPct !== null &&
    question.direction !== null
  ) {
    const yes =
      question.direction === "lte"
        ? gap <= question.thresholdPct
        : gap >= question.thresholdPct;

    return {
      resultOptionId: yes ? "yes" : "no",
      ...evidence(snapshot, issuer),
    };
  }

  return null;
}

export async function settleDueQuestions(
  store: CompetitionStore
) {
  const now = Date.now();
  let changed = false;

  for (const question of store.questions) {
    if (
      question.status === "settled" ||
      question.status === "void"
    ) {
      continue;
    }

    if (
      now >= question.lockAt &&
      question.status === "open"
    ) {
      question.status = "locked";
      changed = true;
    }

    if (now < question.settlementAt) {
      continue;
    }

    const history = await readHistory(question.ticker);
    const snapshot = settlementSnapshot(
      history,
      question.settlementAt
    );

    if (!snapshot) {
      if (
        now >
        question.settlementAt +
          COMPETITION_SETTLEMENT_WINDOW_MS
      ) {
        question.status = "void";
        question.voidReason =
          "No complete stored settlement observation was available inside the settlement window.";
        changed = true;
      }

      continue;
    }

    const result = settleQuestionFromSnapshot(question, snapshot);

    if (!result) {
      question.status = "void";
      question.voidReason =
        "The settlement observation did not contain enough data to settle the question.";
      question.settlementSnapshotAt = snapshot.timestamp;
      changed = true;
      continue;
    }

    question.status = "settled";
    question.resultOptionId = result.resultOptionId;
    question.settledAt = now;
    question.settlementSnapshotAt = snapshot.timestamp;

    question.settlementBuyGapPct = result.gap;
    question.settlementBenchmarkPrice = result.benchmark;
    question.settlementIndicativePrice = result.indicative;
    question.settlementExecutableBuyPrice = result.executableBuy;
    question.settlementExecutableSellPrice = result.executableSell;
    question.settlementApproxBreakEvenMovePct = result.breakEven;

    for (const prediction of store.predictions) {
      if (
        prediction.questionId !== question.id ||
        prediction.settledAt !== null
      ) {
        continue;
      }

  const scored = scorePrediction(question, prediction, {
  resultOptionId: result.resultOptionId,
  issuerRanks:
    "issuerRanks" in result
      ? result.issuerRanks
      : undefined,
});

      prediction.settledAt = now;
      prediction.correct = scored.correct;
      prediction.distance = scored.distance;
      prediction.pointsAwarded = scored.points;
    }

    changed = true;
  }

  return changed;
}
