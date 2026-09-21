import { randomUUID } from "crypto";

import { readStockRegistry } from "@/lib/stockRegistry";
import { buildHistoryAnalytics } from "@/lib/history/analytics";
import { readHistory } from "@/lib/history/storage";

import {
  COMPETITION_MAX_SOURCE_AGE_MS,
  COMPETITION_MIN_GAP_FOR_CONVERGENCE_QUESTION_PCT,
  COMPETITION_MIN_GAP_FOR_QUESTION_PCT,
  COMPETITION_MIN_ISSUER_SPREAD_PCT,
  COMPETITION_NEAR_BENCHMARK_PCT,
  COMPETITION_SIZE_USD,
} from "@/lib/competitions/config";

import type {
  CompetitionAnswerFormat,
  CompetitionQuestionCandidate,
  CompetitionQuestionOption,
  CompetitionQuestionType,
  CompetitionScoringRules,
  CompetitionSourceEvidence,
} from "@/types/competitions";

import type {
  HistoryIssuerSnapshot,
  HistorySnapshot,
  IssuerHistoryAnalytics,
} from "@/types/history";

const RANGE_SCORING: CompetitionScoringRules = {
  maxPoints: 100,
  oneAwayPoints: 70,
  twoAwayPoints: 40,
  otherPoints: 0,
};

const DIRECTION_SCORING: CompetitionScoringRules = {
  maxPoints: 100,
  oneAwayPoints: 50,
  twoAwayPoints: 0,
  otherPoints: 0,
};

const BINARY_SCORING: CompetitionScoringRules = {
  maxPoints: 100,
  oneAwayPoints: 0,
  twoAwayPoints: 0,
  otherPoints: 0,
};

const ISSUER_SCORING: CompetitionScoringRules = {
  maxPoints: 100,
  oneAwayPoints: 60,
  twoAwayPoints: 30,
  otherPoints: 0,
};

function nextSettlementAt(now: number) {
  const target = new Date(now + 24 * 60 * 60 * 1000);
  target.setUTCMinutes(0, 0, 0);

  if (target.getUTCHours() < 15) {
    target.setUTCHours(15, 0, 0, 0);
  }

  return target.getTime();
}

function indicativeGapPct(
  issuer: HistoryIssuerSnapshot,
  benchmark: number | null
) {
  if (
    issuer.indicativePrice === null ||
    benchmark === null ||
    benchmark <= 0
  ) {
    return null;
  }

  return ((issuer.indicativePrice - benchmark) / benchmark) * 100;
}

export function buildCompetitionSourceEvidence(
  snapshot: HistorySnapshot,
  issuerSnapshot: HistoryIssuerSnapshot,
  issuerAnalytics: IssuerHistoryAnalytics,
  generatedAt: number
): CompetitionSourceEvidence {
  return {
    generatedAt,
    tickerSnapshotAt: snapshot.timestamp,
    observations: issuerAnalytics.observations,
    currentBuyGapPct: issuerSnapshot.buyGapPct,
    currentSellGapPct: issuerSnapshot.sellGapPct,
    currentIndicativeGapPct: indicativeGapPct(
      issuerSnapshot,
      snapshot.benchmarkPrice
    ),
    currentApproxBreakEvenMovePct:
      issuerSnapshot.approxBreakEvenMovePct,
    currentPercentile:
      issuerAnalytics.currentDivergenceMagnitudePercentile,
    currentBenchmarkPrice: snapshot.benchmarkPrice,
    currentIndicativePrice: issuerSnapshot.indicativePrice,
    currentExecutableBuyPrice: issuerSnapshot.buy.effectivePrice,
    currentExecutableSellPrice: issuerSnapshot.sell.effectivePrice,
  };
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function rangeOptions(
  value: number,
  step: number,
  prefix: string
): CompetitionQuestionOption[] {
  const base = Math.floor(value / step) * step;

  const cuts = [
    base - step,
    base,
    base + step,
    base + 2 * step,
  ];

  const label = (n: number) => formatPct(n);

  return [
    {
      id: `${prefix}-0`,
      label: `Below ${label(cuts[0])}`,
      ordinal: 0,
      minInclusive: null,
      maxExclusive: cuts[0],
    },
    {
      id: `${prefix}-1`,
      label: `${label(cuts[0])} to ${label(cuts[1])}`,
      ordinal: 1,
      minInclusive: cuts[0],
      maxExclusive: cuts[1],
    },
    {
      id: `${prefix}-2`,
      label: `${label(cuts[1])} to ${label(cuts[2])}`,
      ordinal: 2,
      minInclusive: cuts[1],
      maxExclusive: cuts[2],
    },
    {
      id: `${prefix}-3`,
      label: `${label(cuts[2])} to ${label(cuts[3])}`,
      ordinal: 3,
      minInclusive: cuts[2],
      maxExclusive: cuts[3],
    },
    {
      id: `${prefix}-4`,
      label: `${label(cuts[3])} or above`,
      ordinal: 4,
      minInclusive: cuts[3],
      maxExclusive: null,
    },
  ];
}

function directionOptions(): CompetitionQuestionOption[] {
  return [
    {
      id: "narrower",
      label: "Gap narrows",
      shortLabel: "Narrower",
      ordinal: 0,
    },
    {
      id: "little-change",
      label: "Little change",
      shortLabel: "Little change",
      ordinal: 1,
    },
    {
      id: "wider",
      label: "Gap widens",
      shortLabel: "Wider",
      ordinal: 2,
    },
  ];
}

function binaryOptions(
  yesLabel = "Yes",
  noLabel = "No"
): CompetitionQuestionOption[] {
  return [
    { id: "yes", label: yesLabel, ordinal: 0 },
    { id: "no", label: noLabel, ordinal: 1 },
  ];
}

function issuerOptions(
  issuers: IssuerHistoryAnalytics[]
): CompetitionQuestionOption[] {
  return issuers
    .filter((issuer) => issuer.currentBuyGapPct !== null)
    .sort(
      (a, b) =>
        (a.currentBuyGapPct ?? 0) - (b.currentBuyGapPct ?? 0)
    )
    .map((issuer, index) => ({
      id: `issuer:${issuer.issuer}`,
      label: `${issuer.issuer} · ${issuer.symbol}`,
      shortLabel: issuer.issuer,
      ordinal: index,
      issuer: issuer.issuer,
      symbol: issuer.symbol,
    }));
}

function guidance(
  type: CompetitionQuestionType,
  ticker: string,
  issuer: string | null,
  symbol: string | null
) {
  const wrapper =
    issuer && symbol ? `${issuer} ${symbol}` : ticker;

  const map: Record<
    CompetitionQuestionType,
    { plainEnglish: string; hint: string; dataToWatch: string[] }
  > = {
    gap_range: {
      plainEnglish:
        `Choose the range you think ${wrapper}'s executable $1K BUY gap versus Wall Street will fall into at settlement.`,
      hint:
        "Look at the $1K BUY view and Gap Radar. Negative means the wrapper is cheaper than Wall Street; positive means it is more expensive. Exact range scores 100; nearby ranges can still score.",
      dataToWatch: [
        "Wall Street vs tokenized wrappers · $1K BUY",
        "Gap Radar",
        "Historical Intelligence",
      ],
    },
    gap_direction: {
      plainEnglish:
        `Predict whether ${wrapper}'s distance from Wall Street will narrow, stay broadly similar, or widen.`,
      hint:
        "Movement toward 0% is narrowing. Movement farther away from 0% is widening. The question freezes a small 'little change' band at publication.",
      dataToWatch: [
        "Gap Radar",
        "Historical Intelligence · What actually moved?",
        "Wall Street vs tokenized wrappers · $1K BUY",
      ],
    },
    near_benchmark: {
      plainEnglish:
        `Predict whether ${wrapper}'s executable BUY will return inside the stated band around Wall Street.`,
      hint:
        "Gap Radar moving toward 0% means convergence. This is a binary call because the settlement rule is either inside or outside the frozen band.",
      dataToWatch: [
        "Gap Radar",
        "Historical Intelligence · convergence",
      ],
    },
    below_wall_street: {
      plainEnglish:
        `Predict whether ${wrapper}'s executable $1K BUY will still be cheaper than Wall Street at settlement.`,
      hint:
        "Below 0% means the wrapper is cheaper than Wall Street.",
      dataToWatch: [
        "Wall Street vs tokenized wrappers · $1K BUY",
        "Gap Radar",
      ],
    },
    issuer_cheapest: {
      plainEnglish:
        `Choose which ${ticker} issuer you think will offer the cheapest executable $1K BUY at settlement.`,
      hint:
        "Compare executable BUY prices, not indicative quotes. If your issuer finishes second or third, partial points can still be awarded.",
      dataToWatch: [
        "Wall Street vs tokenized wrappers · $1K BUY",
        "Issuer comparison",
        "Market Depth · $1K",
      ],
    },
    issuer_most_expensive: {
      plainEnglish:
        `Choose which ${ticker} issuer you think will have the most expensive executable $1K BUY at settlement.`,
      hint:
        "Use executable whole-order pricing. Partial points are based on the issuer's settlement rank.",
      dataToWatch: [
        "Wall Street vs tokenized wrappers · $1K BUY",
        "Issuer comparison",
      ],
    },
    break_even_range: {
      plainEnglish:
        `Choose the range you think ${wrapper}'s approximate break-even move will be in at settlement.`,
      hint:
        "Approx. break-even comes from executable BUY and SELL prices. A larger number means more movement is needed to overcome round-trip friction.",
      dataToWatch: [
        "Historical Intelligence · trading friction",
        "Gap Radar tooltip · Approx. break-even move",
        "Market Depth",
      ],
    },
    execution_discount_survives: {
      plainEnglish:
        `Predict whether ${wrapper}'s apparent indicative discount will still exist after pricing an executable $1K BUY.`,
      hint:
        "Compare Indicative with $1K BUY. The discount survives only if the executable BUY is also below Wall Street.",
      dataToWatch: [
        "Wall Street vs tokenized wrappers · Indicative",
        "Wall Street vs tokenized wrappers · $1K BUY",
      ],
    },
    gap_threshold: {
      plainEnglish:
        `Predict whether ${wrapper}'s executable BUY will still be beyond the frozen threshold versus Wall Street.`,
      hint:
        "Use the $1K BUY gap and Gap Radar. This is retained as one binary format, but it no longer dominates the generator.",
      dataToWatch: [
        "Gap Radar",
        "Wall Street vs tokenized wrappers · $1K BUY",
      ],
    },
  };

  return map[type];
}

function addCandidate(
  candidates: CompetitionQuestionCandidate[],
  candidate: Omit<CompetitionQuestionCandidate, "candidateId">
) {
  candidates.push({
    candidateId: randomUUID(),
    ...candidate,
  });
}

function scoreBase(issuer: IssuerHistoryAnalytics) {
  return (
    Math.abs(issuer.currentBuyGapPct ?? 0) * 8 +
    (issuer.currentDivergenceMagnitudePercentile ?? 0) / 12 +
    Math.min(8, issuer.observations / 6)
  );
}

function diversifiedCandidates(
  candidates: CompetitionQuestionCandidate[],
  limit: number
) {
  const sorted = [...candidates].sort(
    (a, b) => b.interestingnessScore - a.interestingnessScore
  );

  const picked: CompetitionQuestionCandidate[] = [];
  const byType = new Map<CompetitionQuestionType, number>();
  const byTicker = new Map<string, number>();

  for (const candidate of sorted) {
    if (picked.length >= limit) break;

    const typeCount = byType.get(candidate.type) ?? 0;
    const tickerCount = byTicker.get(candidate.ticker) ?? 0;

    if (typeCount >= 2 || tickerCount >= 2) continue;

    picked.push(candidate);
    byType.set(candidate.type, typeCount + 1);
    byTicker.set(candidate.ticker, tickerCount + 1);
  }

  for (const candidate of sorted) {
    if (picked.length >= limit) break;

    if (
      !picked.some((item) => item.candidateId === candidate.candidateId)
    ) {
      picked.push(candidate);
    }
  }

  return picked;
}

export async function generateCompetitionCandidates(
  limit = 12
): Promise<CompetitionQuestionCandidate[]> {
  const now = Date.now();
  const settlementAt = nextSettlementAt(now);

  const candidates: CompetitionQuestionCandidate[] = [];

  const registry =
    await readStockRegistry();

  for (const [ticker, stock] of Object.entries(registry)) {
    const history = await readHistory(ticker);
    if (history.length === 0) continue;

    const sortedHistory = [...history].sort(
      (a, b) => a.timestamp - b.timestamp
    );

    const latestSnapshot = sortedHistory[sortedHistory.length - 1];
    const analytics = buildHistoryAnalytics(ticker, sortedHistory);

    if (
      analytics.lastSnapshotAt === null ||
      now - analytics.lastSnapshotAt > COMPETITION_MAX_SOURCE_AGE_MS
    ) {
      continue;
    }

    const validIssuers = analytics.issuers.filter(
      (issuer) =>
        issuer.currentBuyGapPct !== null &&
        latestSnapshot.issuers.some(
          (item) =>
            item.mint === issuer.mint ||
            item.issuer === issuer.issuer
        )
    );

    for (const issuer of validIssuers) {
      const current = issuer.currentBuyGapPct;
      if (current === null) continue;

      const issuerSnapshot =
        latestSnapshot.issuers.find(
          (item) =>
            item.mint === issuer.mint ||
            item.issuer === issuer.issuer
        ) ?? null;

      if (!issuerSnapshot) continue;

      const source = buildCompetitionSourceEvidence(
        latestSnapshot,
        issuerSnapshot,
        issuer,
        now
      );

      const base = scoreBase(issuer);

      if (
        Math.abs(current) >=
        Math.max(0.25, COMPETITION_MIN_GAP_FOR_QUESTION_PCT / 2)
      ) {
        const help = guidance(
          "gap_range",
          ticker,
          issuer.issuer,
          issuer.symbol
        );

        addCandidate(candidates, {
          type: "gap_range",
          answerFormat: "range",
          ticker,
          stockName: stock.name,
          issuer: issuer.issuer,
          symbol: issuer.symbol,
          sizeUsd: COMPETITION_SIZE_USD,
          title: `Where will ${issuer.symbol}'s $1K BUY gap be at settlement?`,
          description:
            `Pick the range for ${issuer.issuer} ${ticker}'s executable BUY gap versus Wall Street. Exact range = 100 points; one range away = 70; two away = 40.`,
          ...help,
          options: rangeOptions(current, 1, "gap"),
          scoring: RANGE_SCORING,
          thresholdPct: null,
          direction: null,
          littleChangeBandPct: null,
          suggestedSettlementAt: settlementAt,
          source,
          interestingnessScore: base + 8,
        });

        const directionHelp = guidance(
          "gap_direction",
          ticker,
          issuer.issuer,
          issuer.symbol
        );

        addCandidate(candidates, {
          type: "gap_direction",
          answerFormat: "direction",
          ticker,
          stockName: stock.name,
          issuer: issuer.issuer,
          symbol: issuer.symbol,
          sizeUsd: COMPETITION_SIZE_USD,
          title: `Will ${issuer.symbol}'s gap narrow, hold, or widen?`,
          description:
            `Compare the absolute executable BUY gap at publication with settlement. A move of less than 0.25 percentage points is treated as little change.`,
          ...directionHelp,
          options: directionOptions(),
          scoring: DIRECTION_SCORING,
          thresholdPct: null,
          direction: null,
          littleChangeBandPct: 0.25,
          suggestedSettlementAt: settlementAt,
          source,
          interestingnessScore: base + 6,
        });
      }

      if (
        Math.abs(current) >=
        COMPETITION_MIN_GAP_FOR_CONVERGENCE_QUESTION_PCT
      ) {
        const help = guidance(
          "near_benchmark",
          ticker,
          issuer.issuer,
          issuer.symbol
        );

        addCandidate(candidates, {
          type: "near_benchmark",
          answerFormat: "binary",
          ticker,
          stockName: stock.name,
          issuer: issuer.issuer,
          symbol: issuer.symbol,
          sizeUsd: COMPETITION_SIZE_USD,
          title: `Will ${issuer.symbol} be back inside ±${COMPETITION_NEAR_BENCHMARK_PCT.toFixed(2)}% of Wall Street?`,
          description:
            `YES settles if the executable BUY gap is inside ±${COMPETITION_NEAR_BENCHMARK_PCT.toFixed(2)}%.`,
          ...help,
          options: binaryOptions(),
          scoring: BINARY_SCORING,
          thresholdPct: COMPETITION_NEAR_BENCHMARK_PCT,
          direction: null,
          littleChangeBandPct: null,
          suggestedSettlementAt: settlementAt,
          source,
          interestingnessScore: base + 5,
        });
      }

      if (current < -0.25) {
        const help = guidance(
          "execution_discount_survives",
          ticker,
          issuer.issuer,
          issuer.symbol
        );

        addCandidate(candidates, {
          type: "execution_discount_survives",
          answerFormat: "binary",
          ticker,
          stockName: stock.name,
          issuer: issuer.issuer,
          symbol: issuer.symbol,
          sizeUsd: COMPETITION_SIZE_USD,
          title: `Will ${issuer.symbol}'s apparent discount survive $1K execution?`,
          description:
            "YES settles only if the wrapper is indicative-below Wall Street and its executable $1K BUY is also below Wall Street.",
          ...help,
          options: binaryOptions(
            "Yes — executable BUY is still below",
            "No — the discount does not survive"
          ),
          scoring: BINARY_SCORING,
          thresholdPct: 0,
          direction: "lte",
          littleChangeBandPct: null,
          suggestedSettlementAt: settlementAt,
          source,
          interestingnessScore: base + 4,
        });
      }

      const breakEven = issuer.currentApproxBreakEvenMovePct;
      if (breakEven !== null && breakEven >= 0) {
        const help = guidance(
          "break_even_range",
          ticker,
          issuer.issuer,
          issuer.symbol
        );

        addCandidate(candidates, {
          type: "break_even_range",
          answerFormat: "range",
          ticker,
          stockName: stock.name,
          issuer: issuer.issuer,
          symbol: issuer.symbol,
          sizeUsd: COMPETITION_SIZE_USD,
          title: `Where will ${issuer.symbol}'s break-even move land?`,
          description:
            "Choose the settlement range for Approx. break-even move. Exact range = 100 points; nearby ranges can still earn partial credit.",
          ...help,
          options: rangeOptions(breakEven, 0.25, "be"),
          scoring: RANGE_SCORING,
          thresholdPct: null,
          direction: null,
          littleChangeBandPct: null,
          suggestedSettlementAt: settlementAt,
          source,
          interestingnessScore: base + 3,
        });
      }
    }

    if (validIssuers.length >= 2) {
      const sortedByGap = [...validIssuers].sort(
        (a, b) =>
          (a.currentBuyGapPct ?? 0) - (b.currentBuyGapPct ?? 0)
      );

      const spread =
        (sortedByGap[sortedByGap.length - 1].currentBuyGapPct ?? 0) -
        (sortedByGap[0].currentBuyGapPct ?? 0);

      if (spread >= COMPETITION_MIN_ISSUER_SPREAD_PCT) {
        const representative = sortedByGap[0];
        const representativeSnapshot =
          latestSnapshot.issuers.find(
            (item) =>
              item.mint === representative.mint ||
              item.issuer === representative.issuer
          );

        if (representativeSnapshot) {
          const source = buildCompetitionSourceEvidence(
            latestSnapshot,
            representativeSnapshot,
            representative,
            now
          );

          const cheapestHelp = guidance(
            "issuer_cheapest",
            ticker,
            null,
            null
          );

          addCandidate(candidates, {
            type: "issuer_cheapest",
            answerFormat: "issuer_choice",
            ticker,
            stockName: stock.name,
            issuer: representative.issuer,
            symbol: representative.symbol,
            sizeUsd: COMPETITION_SIZE_USD,
            title: `Which ${ticker} issuer will have the cheapest $1K BUY?`,
            description:
              "Choose an issuer. Winner scores 100; second-cheapest scores 60; third-cheapest scores 30.",
            ...cheapestHelp,
            options: issuerOptions(validIssuers),
            scoring: ISSUER_SCORING,
            thresholdPct: null,
            direction: null,
            littleChangeBandPct: null,
            suggestedSettlementAt: settlementAt,
            source,
            interestingnessScore: spread * 12 + 8,
          });

          const expensiveHelp = guidance(
            "issuer_most_expensive",
            ticker,
            null,
            null
          );

          addCandidate(candidates, {
            type: "issuer_most_expensive",
            answerFormat: "issuer_choice",
            ticker,
            stockName: stock.name,
            issuer:
              sortedByGap[sortedByGap.length - 1].issuer,
            symbol:
              sortedByGap[sortedByGap.length - 1].symbol,
            sizeUsd: COMPETITION_SIZE_USD,
            title: `Which ${ticker} issuer will have the most expensive $1K BUY?`,
            description:
              "Choose an issuer. Winner scores 100; second-most-expensive scores 60; third scores 30.",
            ...expensiveHelp,
            options: issuerOptions(validIssuers),
            scoring: ISSUER_SCORING,
            thresholdPct: null,
            direction: null,
            littleChangeBandPct: null,
            suggestedSettlementAt: settlementAt,
            source,
            interestingnessScore: spread * 10 + 6,
          });
        }
      }
    }
  }

  return diversifiedCandidates(candidates, limit);
}
