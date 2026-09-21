import type {
  CompetitionPrediction,
  CompetitionQuestion,
  CompetitionQuestionOption,
} from "@/types/competitions";

export interface SettlementScoringContext {
  resultOptionId: string;
  /**
   * Optional settlement ranking for issuer-choice questions.
   * 0 means best according to the question (cheapest or most expensive).
   */
  issuerRanks?: Record<string, number>;
}

export function optionById(
  question: CompetitionQuestion,
  id: string
) {
  return question.options.find((option) => option.id === id) ?? null;
}

export function numericOptionForValue(
  options: CompetitionQuestionOption[],
  value: number
) {
  return (
    options.find((option) => {
      const minOk =
        option.minInclusive === undefined ||
        option.minInclusive === null ||
        value >= option.minInclusive;

      const maxOk =
        option.maxExclusive === undefined ||
        option.maxExclusive === null ||
        value < option.maxExclusive;

      return minOk && maxOk;
    }) ?? null
  );
}

export function pointsForDistance(
  question: CompetitionQuestion,
  distance: number
) {
  if (distance <= 0) {
    return question.scoring.maxPoints;
  }

  if (distance === 1) {
    return question.scoring.oneAwayPoints;
  }

  if (distance === 2) {
    return question.scoring.twoAwayPoints;
  }

  return question.scoring.otherPoints;
}

export function scorePrediction(
  question: CompetitionQuestion,
  prediction: CompetitionPrediction,
  context: SettlementScoringContext
) {
  const predicted = optionById(question, prediction.answer);
  const actual = optionById(question, context.resultOptionId);

  if (!predicted || !actual) {
    return {
      correct: false,
      distance: 999,
      points: 0,
    };
  }

  if (prediction.answer === context.resultOptionId) {
    return {
      correct: true,
      distance: 0,
      points: question.scoring.maxPoints,
    };
  }

  if (
    question.answerFormat === "range" ||
    question.answerFormat === "direction"
  ) {
    const predictedOrdinal = predicted.ordinal;
    const actualOrdinal = actual.ordinal;

    if (
      predictedOrdinal === undefined ||
      actualOrdinal === undefined
    ) {
      return {
        correct: false,
        distance: 999,
        points: 0,
      };
    }

    const distance = Math.abs(predictedOrdinal - actualOrdinal);

    return {
      correct: false,
      distance,
      points: pointsForDistance(question, distance),
    };
  }

  if (
    question.answerFormat === "issuer_choice" &&
    context.issuerRanks
  ) {
    const issuer = predicted.issuer;

    if (!issuer) {
      return {
        correct: false,
        distance: 999,
        points: 0,
      };
    }

    const distance = context.issuerRanks[issuer];

    if (distance === undefined) {
      return {
        correct: false,
        distance: 999,
        points: 0,
      };
    }

    return {
      correct: false,
      distance,
      points: pointsForDistance(question, distance),
    };
  }

  return {
    correct: false,
    distance: 1,
    points: question.scoring.otherPoints,
  };
}
