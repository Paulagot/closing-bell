export type CompetitionQuestionType =
  | "gap_range"
  | "gap_direction"
  | "near_benchmark"
  | "below_wall_street"
  | "issuer_cheapest"
  | "issuer_most_expensive"
  | "break_even_range"
  | "execution_discount_survives"
  | "gap_threshold";

export type CompetitionQuestionStatus =
  | "open"
  | "locked"
  | "settled"
  | "void";

export type CompetitionAnswerFormat =
  | "binary"
  | "range"
  | "direction"
  | "issuer_choice";

export type CompetitionAnswer =
  string;

export interface CompetitionQuestionOption {
  id: string;
  label: string;
  shortLabel?: string;

  /**
   * ordinal is used for distance scoring on ordered answers such as ranges
   * and narrow / little change / widen.
   */
  ordinal?: number;

  /** Numeric range definition. Null means unbounded on that side. */
  minInclusive?: number | null;
  maxExclusive?: number | null;

  /** Used by issuer-choice questions. */
  issuer?: string | null;
  symbol?: string | null;
}

export interface CompetitionScoringRules {
  maxPoints: number;
  oneAwayPoints: number;
  twoAwayPoints: number;
  otherPoints: number;
}

export interface CompetitionSourceEvidence {
  generatedAt: number;
  tickerSnapshotAt: number;
  observations: number;

  currentBuyGapPct: number | null;
  currentSellGapPct: number | null;
  currentIndicativeGapPct: number | null;
  currentApproxBreakEvenMovePct: number | null;
  currentPercentile: number | null;

  currentBenchmarkPrice: number | null;
  currentIndicativePrice: number | null;
  currentExecutableBuyPrice: number | null;
  currentExecutableSellPrice: number | null;
}

export interface CompetitionQuestion {
  id: string;
  competitionId: string;

  type: CompetitionQuestionType;
  answerFormat: CompetitionAnswerFormat;

  ticker: string;
  stockName: string;

  issuer: string | null;
  symbol: string | null;

  sizeUsd: number;

  title: string;
  description: string;
  plainEnglish: string;
  hint: string;
  dataToWatch: string[];

  options: CompetitionQuestionOption[];
  scoring: CompetitionScoringRules;

  /**
   * Retained for threshold / convergence compatibility and transparent
   * settlement rules.
   */
  thresholdPct: number | null;
  direction: "lte" | "gte" | null;

  /** For gap_direction, movement within this many percentage points is "little change". */
  littleChangeBandPct: number | null;

  publishedAt: number;
  lockAt: number;
  settlementAt: number;

  status: CompetitionQuestionStatus;
  source: CompetitionSourceEvidence;

  /** Winning option after settlement. */
  resultOptionId: string | null;

  settledAt: number | null;
  settlementSnapshotAt: number | null;

  settlementBuyGapPct: number | null;
  settlementBenchmarkPrice: number | null;
  settlementIndicativePrice: number | null;
  settlementExecutableBuyPrice: number | null;
  settlementExecutableSellPrice: number | null;
  settlementApproxBreakEvenMovePct: number | null;

  voidReason: string | null;
}

export interface CompetitionParticipant {
  wallet: string;
  displayName: string;
  joinedAt: number;
  updatedAt: number;
}

export interface CompetitionPrediction {
  id: string;
  competitionId: string;
  questionId: string;
  wallet: string;

  answer: CompetitionAnswer;

  submittedAt: number;
  updatedAt: number;

  settledAt: number | null;

  /** Exact-option match. Partial-credit answers are false, not null. */
  correct: boolean | null;

  /** 0 for exact, 1 for one bucket/rank away, etc. Null before settlement. */
  distance: number | null;

  pointsAwarded: number;
}

export interface CompetitionSponsor {
  name: string;
  tagline: string;
  websiteUrl: string | null;
  logoUrl: string | null;
}

export interface CompetitionPrize {
  place: 1 | 2 | 3;
  title: string;
  description: string;
  imageUrl: string | null;
  valueText: string | null;
}

export interface CompetitionDefinition {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;

  startsAt: number;
  endsAt: number;

  /** Kept for backwards compatibility; max question score is normally 100. */
  pointsPerCorrectCall: number;

  sponsor: CompetitionSponsor | null;
  prizes: CompetitionPrize[];

  createdAt: number;
}

export interface CompetitionStore {
  version: 3;
  competition: CompetitionDefinition;
  participants: CompetitionParticipant[];
  questions: CompetitionQuestion[];
  predictions: CompetitionPrediction[];
}

export interface CompetitionLeaderboardRow {
  rank: number;
  wallet: string;
  walletShort: string;
  displayName: string;

  calls: number;
  settledCalls: number;

  exactCalls: number;
  nearCalls: number;

  /** Exact-option rate, not "all points earned". */
  accuracyPct: number | null;

  points: number;
  maxPossiblePoints: number;
  pointsEfficiencyPct: number | null;
}

export interface CompetitionViewerPrediction {
  answer: CompetitionAnswer;
  settledAt: number | null;
  correct: boolean | null;
  distance: number | null;
  pointsAwarded: number;
}

export interface CompetitionPublicResponse {
  competition: CompetitionDefinition;
  questions: CompetitionQuestion[];
  leaderboard: CompetitionLeaderboardRow[];
  participantCount: number;
  predictionCount: number;

  viewer:
    | {
        wallet: string;
        displayName: string;
        joinedAt: number;
        predictions: Record<string, CompetitionViewerPrediction>;
      }
    | null;

  previewMode: boolean;
}

export interface CompetitionQuestionCandidate {
  candidateId: string;

  type: CompetitionQuestionType;
  answerFormat: CompetitionAnswerFormat;

  ticker: string;
  stockName: string;

  issuer: string | null;
  symbol: string | null;

  sizeUsd: number;

  title: string;
  description: string;
  plainEnglish: string;
  hint: string;
  dataToWatch: string[];

  options: CompetitionQuestionOption[];
  scoring: CompetitionScoringRules;

  thresholdPct: number | null;
  direction: "lte" | "gte" | null;
  littleChangeBandPct: number | null;

  suggestedSettlementAt: number;

  source: CompetitionSourceEvidence;

  /** Internal admin ranking only. It is not player points. */
  interestingnessScore: number;
}
