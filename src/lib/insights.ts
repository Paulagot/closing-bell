import type { StockExecutionResponse } from "@/types";
import type { IssuerHistoryAnalytics } from "@/types/history";

export type HistoricalInsightStatus = "available" | "early" | "waiting";

export interface HistoricalInsight {
  id: string;
  question: string;
  headline: string;
  body: string;
  status: HistoricalInsightStatus;
}

interface Input {
  issuer: IssuerHistoryAnalytics;
  firstSnapshotAt: number | null;
  lastSnapshotAt: number | null;
  liveExecutions?: Record<string, StockExecutionResponse>;
}

const MIN_CONTEXT = 5;
const MIN_PATTERN = 5;
const UNUSUAL_PERCENTILE = 90;

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const money = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
      }).format(n);

function hoursBetween(a: number | null, b: number | null) {
  return a !== null && b !== null && b > a ? (b - a) / 3_600_000 : 0;
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} minutes`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function latestPoint(issuer: IssuerHistoryAnalytics) {
  return issuer.gap48h[issuer.gap48h.length - 1] ?? null;
}

function marketMove(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const usable = issuer.gap48h.filter(
    (point) =>
      point.benchmarkPrice !== null &&
      point.buyPrice !== null &&
      point.benchmarkPrice > 0 &&
      point.buyPrice > 0
  );

  if (usable.length < 2) {
    return {
      id: "market-move",
      question: "What actually moved?",
      headline: "Not enough absolute-price history yet",
      body: "Closing Bell needs at least two recorded observations containing both the Wall Street benchmark and executable $1K BUY price before it can separate the underlying stock move from wrapper divergence.",
      status: "waiting",
    };
  }

  const first = usable[0];
  const last = usable[usable.length - 1];

  const benchmarkMove =
    ((last.benchmarkPrice! - first.benchmarkPrice!) /
      first.benchmarkPrice!) *
    100;

  const wrapperMove =
    ((last.buyPrice! - first.buyPrice!) /
      first.buyPrice!) *
    100;

  const gapMove =
    first.buyGapPct !== null && last.buyGapPct !== null
      ? last.buyGapPct - first.buyGapPct
      : null;

  const gapText =
    gapMove === null
      ? ""
      : gapMove < 0
        ? ` The executable BUY moved ${Math.abs(gapMove).toFixed(2)} percentage points further below Wall Street over the same window.`
        : ` The executable BUY moved ${Math.abs(gapMove).toFixed(2)} percentage points back toward or above Wall Street over the same window.`;

  return {
    id: "market-move",
    question: "What actually moved?",
    headline: `Wall Street ${pct(benchmarkMove)} · executable BUY ${pct(wrapperMove)}`,
    body: `Across the available 48-hour recorded window, the Wall Street benchmark moved from ${money(first.benchmarkPrice)} to ${money(last.benchmarkPrice)}, while the wrapper's $1K executable BUY moved from ${money(first.buyPrice)} to ${money(last.buyPrice)}.${gapText} This separates movement in the underlying stock from convergence or divergence in the wrapper.`,
    status: usable.length >= MIN_CONTEXT ? "available" : "early",
  };
}

function benchmarkFor(response: StockExecutionResponse) {
  return response.marketStatus.open
    ? response.referencePrice ?? response.previousClose ?? null
    : response.previousClose ?? response.referencePrice ?? null;
}

function liveBuyGap(
  response: StockExecutionResponse | undefined,
  issuerName: string
) {
  if (!response) return null;
  const row = response.issuers.find((x) => x.issuer === issuerName);
  const buy = row?.buyQuote.effectivePrice ?? null;
  const benchmark = benchmarkFor(response);
  if (buy === null || benchmark === null || benchmark <= 0) return null;
  return ((buy - benchmark) / benchmark) * 100;
}

function maturity(input: Input): HistoricalInsight {
  const hours = hoursBetween(input.firstSnapshotAt, input.lastSnapshotAt);

  if (input.issuer.observations < MIN_CONTEXT) {
    return {
      id: "maturity",
      question: "How much history is behind this?",
      headline: "The history is only just starting",
      body: `Closing Bell has ${input.issuer.observations} recorded observation${input.issuer.observations === 1 ? "" : "s"} for this wrapper. Treat the current range as an early read rather than a normal trading pattern.`,
      status: "waiting",
    };
  }

  if (hours < 24) {
    return {
      id: "maturity",
      question: "How much history is behind this?",
      headline: "Useful intraday context, but not a full day yet",
      body: `There are ${input.issuer.observations} recorded observations spanning about ${Math.max(1, Math.round(hours))} hours. This can show whether the current reading is unusual today, but it cannot yet answer a full 24-hour convergence question.`,
      status: "early",
    };
  }

  return {
    id: "maturity",
    question: "How much history is behind this?",
    headline: "Historical context is building",
    body: `Closing Bell has ${input.issuer.observations} recorded observations across about ${Math.round(hours)} hours. Longer-lived patterns become more useful as more market sessions are collected.`,
    status: input.issuer.observations >= 20 ? "available" : "early",
  };
}

function currentGap(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const current = issuer.currentBuyGapPct;
  const percentile = issuer.currentDivergenceMagnitudePercentile;

  if (current === null) {
    return {
      id: "current-gap",
      question: "Is the current executable gap unusual?",
      headline: "Current executable gap unavailable",
      body: "The latest recorded observation does not contain a usable $1K executable BUY gap.",
      status: "waiting",
    };
  }

  if (issuer.observations < MIN_CONTEXT || percentile === null) {
    return {
      id: "current-gap",
      question: "Is the current executable gap unusual?",
      headline:
        current < 0
          ? `Current BUY is ${Math.abs(current).toFixed(2)}% below Wall Street`
          : `Current BUY is ${current.toFixed(2)}% above Wall Street`,
      body: `The latest recorded Wall Street benchmark is ${money(latestPoint(issuer)?.benchmarkPrice)} and the $1K executable BUY is ${money(latestPoint(issuer)?.buyPrice)}. There are not enough recorded observations yet to say how unusual this reading is.`,
      status: "early",
    };
  }

  if (percentile >= UNUSUAL_PERCENTILE) {
    return {
      id: "current-gap",
      question: "Is the current executable gap unusual?",
      headline: "This is one of the larger gaps observed so far",
      body: `The current $1K executable BUY is ${money(latestPoint(issuer)?.buyPrice)} versus a recorded Wall Street benchmark of ${money(latestPoint(issuer)?.benchmarkPrice)}, a gap of ${pct(current)}. Its magnitude is larger than about ${percentile.toFixed(0)}% of observations collected for this wrapper.`,
      status: issuer.observations >= 20 ? "available" : "early",
    };
  }

  return {
    id: "current-gap",
    question: "Is the current executable gap unusual?",
    headline: "The current gap is within the recent observed range",
    body: `The current $1K executable BUY is ${money(latestPoint(issuer)?.buyPrice)} versus a recorded Wall Street benchmark of ${money(latestPoint(issuer)?.benchmarkPrice)}, a gap of ${pct(current)}. Its magnitude ranks around the ${percentile.toFixed(0)}th percentile of observations collected so far.`,
    status: issuer.observations >= 20 ? "available" : "early",
  };
}

function distanceFromMedian(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const current = issuer.currentBuyGapPct;
  const med = issuer.medianBuyGap24hPct ?? issuer.medianBuyGap7dPct;

  if (current === null || med === null) {
    return {
      id: "median-distance",
      question: "How far is it from recent normal?",
      headline: "A recent median is still forming",
      body: "Closing Bell needs more usable recorded BUY observations before it can describe the distance from the recent median.",
      status: "waiting",
    };
  }

  const distance = current - med;
  return {
    id: "median-distance",
    question: "How far is it from recent normal?",
    headline: `${Math.abs(distance).toFixed(2)} percentage points from the recent median`,
    body: `The current BUY gap is ${pct(current)} and the recent median is ${pct(med)}. Returning to that median would require a ${Math.abs(distance).toFixed(2)} percentage-point change in the wrapper's relative price versus Wall Street.`,
    status: issuer.observations >= MIN_CONTEXT ? "available" : "early",
  };
}

function executionReality(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const point = latestPoint(issuer);

  if (!point || point.indicativeGapPct === null || point.buyGapPct === null) {
    return {
      id: "execution-reality",
      question: "Does the headline price survive execution?",
      headline: "Not enough data to compare indicative and executable pricing",
      body: "The latest recorded point needs both an indicative gap and an executable BUY gap.",
      status: "waiting",
    };
  }

  const indicative = point.indicativeGapPct;
  const executable = point.buyGapPct;

  if (indicative < 0 && executable >= 0) {
    return {
      id: "execution-reality",
      question: "Does the headline price survive execution?",
      headline: "The apparent discount disappears at executable BUY pricing",
      body: `The indicative wrapper price was ${money(point.indicativePrice)} (${pct(indicative)} versus Wall Street), but the recorded $1K executable BUY was ${money(point.buyPrice)} (${pct(executable)}). The headline discount did not survive execution.`,
      status: "available",
    };
  }

  if (indicative < 0 && executable < 0) {
    return {
      id: "execution-reality",
      question: "Does the headline price survive execution?",
      headline: "The discount is still visible after BUY execution",
      body: `The indicative wrapper price was ${money(point.indicativePrice)} (${pct(indicative)}) and the recorded $1K executable BUY was ${money(point.buyPrice)} (${pct(executable)}). Execution changed the apparent discount by ${Math.abs(executable - indicative).toFixed(2)} percentage points.`,
      status: "available",
    };
  }

  return {
    id: "execution-reality",
    question: "Does the headline price survive execution?",
    headline: "Executable pricing changes the headline gap",
    body: `The indicative wrapper price was ${money(point.indicativePrice)} (${pct(indicative)}) and the recorded $1K executable BUY was ${money(point.buyPrice)} (${pct(executable)}). Closing Bell uses the executable figure when describing what a user could actually trade.`,
    status: "available",
  };
}

function friction(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const be = issuer.currentApproxBreakEvenMovePct;
  const percentile = issuer.currentBreakEvenPercentile;

  if (be === null) {
    return {
      id: "friction",
      question: "How much movement is needed to overcome BUY/SELL friction?",
      headline: "Current round-trip friction is unavailable",
      body: "A matched executable BUY and SELL observation is required to estimate the approximate break-even move.",
      status: "waiting",
    };
  }

  return {
    id: "friction",
    question: "How much movement is needed to overcome BUY/SELL friction?",
    headline: `Approx. break-even move: ${pct(be)}`,
    body:
      percentile === null
        ? `The latest recorded $1K BUY is ${money(latestPoint(issuer)?.buyPrice)} and SELL is ${money(latestPoint(issuer)?.sellPrice)}. This is the approximate relative move required for the current SELL price to equal the current BUY price. More history is needed to judge whether this is unusually high or low.`
        : `The latest recorded $1K BUY is ${money(latestPoint(issuer)?.buyPrice)} and SELL is ${money(latestPoint(issuer)?.sellPrice)}. This break-even reading is around the ${percentile.toFixed(0)}th percentile of recorded observations.`,
    status: percentile === null ? "early" : "available",
  };
}

function convergence(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const events = issuer.similarDivergenceEvents;

  if (events === 0) {
    return {
      id: "convergence",
      question: "What happened after large gaps?",
      headline: "No mature 24-hour divergence episodes yet",
      body: "A qualifying episode starts when the recorded $1K executable BUY moves at least 0.75% from Wall Street. It needs a full 24-hour outcome window before Closing Bell can classify whether it returned inside ±0.50%.",
      status: "waiting",
    };
  }

  if (events < MIN_PATTERN) {
    return {
      id: "convergence",
      question: "What happened after large gaps?",
      headline: "The first convergence outcomes are appearing",
      body: `${events} mature divergence episode${events === 1 ? "" : "s"} ${events === 1 ? "has" : "have"} completed a 24-hour window.${issuer.convergenceRatePct === null ? "" : ` ${issuer.convergenceRatePct.toFixed(0)}% reached back inside ±0.50% of Wall Street.`} This is still too small a sample to treat as a recurring pattern.`,
      status: "early",
    };
  }

  return {
    id: "convergence",
    question: "What happened after large gaps?",
    headline: `${issuer.convergenceRatePct?.toFixed(0) ?? "—"}% of mature gaps converged within 24 hours`,
    body: `${events} mature divergence episodes have been observed. ${issuer.convergenceFailures} did not return inside ±0.50% within 24 hours.${issuer.medianMinutesToConvergence === null ? "" : ` When convergence occurred, the median time was ${durationLabel(issuer.medianMinutesToConvergence)}.`}`,
    status: events >= 20 ? "available" : "early",
  };
}

function usOpen(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  if (issuer.openObservations === 0) {
    return {
      id: "us-open",
      question: "What tends to happen around the US open?",
      headline: "No complete US-open comparison yet",
      body: "Closing Bell needs a recorded observation before 9:30 ET and another around 10:00–10:30 ET on the same day before it can compare whether the wrapper gap narrowed after Wall Street opened.",
      status: "waiting",
    };
  }

  return {
    id: "us-open",
    question: "What tends to happen around the US open?",
    headline:
      issuer.openNarrowedPct === null
        ? "US-open history is still forming"
        : `${issuer.openNarrowedPct.toFixed(0)}% of observed opens narrowed the gap`,
    body: `${issuer.openObservations} complete US-open comparison${issuer.openObservations === 1 ? "" : "s"} ${issuer.openObservations === 1 ? "is" : "are"} available. ${issuer.openObservations < MIN_PATTERN ? "That is useful context, but still too few sessions to call a pattern." : "This compares the last recorded gap before 9:30 ET with a recorded gap during the first hour after the open."}`,
    status: issuer.openObservations >= MIN_PATTERN ? "available" : "early",
  };
}

function reliability(issuer: IssuerHistoryAnalytics): HistoricalInsight {
  const a = issuer.quoteAvailabilityPct;

  if (a === null) {
    return {
      id: "reliability",
      question: "How consistently has this wrapper been executable?",
      headline: "Quote reliability is not available yet",
      body: "There are not enough recorded observations to estimate matched executable BUY-and-SELL availability.",
      status: "waiting",
    };
  }

  return {
    id: "reliability",
    question: "How consistently has this wrapper been executable?",
    headline:
      a >= 90
        ? "Executable quotes have been consistently available"
        : a >= 70
          ? "Executable quote availability has been mixed"
          : "Executable quotes have often been unavailable",
    body: `Both executable BUY and SELL quotes were available in ${a.toFixed(0)}% of recorded observations for this wrapper.`,
    status: issuer.observations >= MIN_CONTEXT ? "available" : "early",
  };
}

function depth(
  issuer: IssuerHistoryAnalytics,
  live: Record<string, StockExecutionResponse> | undefined
): HistoricalInsight {
  const g100 = liveBuyGap(live?.["100"], issuer.issuer);
  const g1k = liveBuyGap(live?.["1000"], issuer.issuer);
  const g10k = liveBuyGap(live?.["10000"], issuer.issuer);
  const count = [g100, g1k, g10k].filter((x): x is number => x !== null).length;

  if (count < 2) {
    return {
      id: "depth",
      question: "Does the relative gap survive larger order sizes?",
      headline: "Run more live sizes to compare market depth",
      body: "Closing Bell needs live execution results at multiple sizes before it can explain whether the relative gap persists or is consumed by execution at larger size.",
      status: "waiting",
    };
  }

  if (g1k !== null && g10k !== null) {
    if (g1k < 0 && g10k >= 0) {
      return {
        id: "depth",
        question: "Does the relative gap survive larger order sizes?",
        headline: "The $1K discount does not survive at $10K",
        body: `The live executable BUY gap is ${pct(g1k)} at $1K but ${pct(g10k)} at $10K. The apparent discount is consumed as order size increases.`,
        status: "available",
      };
    }

    if (g1k < 0 && g10k < 0) {
      const retained = Math.abs(g10k) / Math.max(0.0001, Math.abs(g1k));
      return retained >= 0.7
        ? {
            id: "depth",
            question: "Does the relative gap survive larger order sizes?",
            headline: "The discount remains visible at $10K",
            body: `The live executable BUY gap is ${pct(g1k)} at $1K and ${pct(g10k)} at $10K. Most of the relative discount remains at the larger tested size.`,
            status: "available",
          }
        : {
            id: "depth",
            question: "Does the relative gap survive larger order sizes?",
            headline: "The discount weakens as trade size increases",
            body: `The live executable BUY gap is ${pct(g1k)} at $1K and ${pct(g10k)} at $10K. Larger-size execution consumes a meaningful part of the relative discount.`,
            status: "available",
          };
    }

    return {
      id: "depth",
      question: "Does the relative gap survive larger order sizes?",
      headline: "Order size changes the executable relationship with Wall Street",
      body: `The live executable BUY gap is ${pct(g1k)} at $1K and ${pct(g10k)} at $10K. A small-size gap should not be assumed to remain unchanged for a larger trade.`,
      status: "available",
    };
  }

  return {
    id: "depth",
    question: "Does the relative gap survive larger order sizes?",
    headline: "Partial depth comparison available",
    body: `Live executable gaps are available for ${count} of the three standard sizes. Run the missing size to complete the $100 / $1K / $10K comparison.`,
    status: "early",
  };
}

export function buildHistoricalInsights(input: Input): HistoricalInsight[] {
  return [
    maturity(input),
    marketMove(input.issuer),
    currentGap(input.issuer),
    distanceFromMedian(input.issuer),
    executionReality(input.issuer),
    friction(input.issuer),
    convergence(input.issuer),
    usOpen(input.issuer),
    reliability(input.issuer),
    depth(input.issuer, input.liveExecutions),
  ];
}
