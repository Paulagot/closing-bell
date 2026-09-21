import { randomUUID } from "crypto";
import {
  gapPct,
  executionGapPct,
  approxBreakEvenMovePct,
  divergenceAfterBreakEvenPct,
} from "@/lib/history/math";
import {
  readPaperObservations,
  appendPaperObservations,
  updatePaperCandidateOutcomes,
  readPaperTrades,
  writePaperTrades,
} from "@/lib/paperLab/storage";
import { getPaperStrategyRules } from "@/lib/paperLab/config";
import { fetchExactTokenBuyQuote, fetchExactTokenSellQuote } from "@/lib/paperLab/execution";
import type { HistorySnapshot, HistoryExecutionQuote } from "@/types/history";
import { readHistory } from "@/lib/history/storage";
import type {
  PaperCandidateOutcome,
  PaperExecutionSnapshot,
  PaperLabObservation,
  PaperMomentumFeatures,
  PaperStrategyType,
  PaperTrade,
  PaperTradeDirection,
  PaperTradeMark,
} from "@/types/paperLab";

/**
 * The history capture has already obtained Jupiter's $1,000 two-sided routes.
 * Never repeat them for the lab. Older history has effective prices but lacks
 * exact token quantities: it can seed trend research, NOT new paper entries.
 */
function quoteFromHistory(quote: HistoryExecutionQuote): PaperExecutionSnapshot {
  return {
    status: quote.status,
    tokenAmount: quote.tokenAmount ?? null,
    usdcAmount: quote.usdcAmount ?? null,
    effectivePrice: quote.effectivePrice,
    priceImpactPct: quote.priceImpactPct,
    executionCostPct: quote.executionCostPct ?? null,
    routePlan: quote.routePlan ?? [],
  };
}

/** Historic $1,000 observations bootstrap a V4 trend immediately; no backdated
 * transactions are invented and old $50 lab observations cannot contaminate it. */
function historyAsTrendObservations(
  history: HistorySnapshot[], ticker: string, notional: number, version: string, currentTimestamp: number
): PaperLabObservation[] {
  const rows: PaperLabObservation[] = [];
  for (const snap of history.filter((item) => item.timestamp < currentTimestamp && item.canonicalSizeUsd === notional).slice(-12)) {
    for (const issuer of snap.issuers) {
      rows.push({
        id: `history:${snap.timestamp}:${issuer.mint}`, version: 3,
        timestamp: snap.timestamp, capturedAt: snap.capturedAt,
        ticker, stockName: snap.stockName, refSymbol: snap.refSymbol,
        issuer: issuer.issuer, symbol: issuer.symbol, mint: issuer.mint,
        tokenDecimals: issuer.decimals ?? 0, shareMultiplier: issuer.shareMultiplier,
        marketOpen: snap.marketOpen, marketLabel: snap.marketLabel,
        benchmarkPrice: snap.benchmarkPrice, benchmarkTimestamp: snap.benchmarkTimestamp,
        liquidityUsd: issuer.liquidityUsd, notionalUsd: notional,
        buy: quoteFromHistory(issuer.buy), sell: quoteFromHistory(issuer.sell),
        buyGapPct: issuer.buyGapPct, sellGapPct: issuer.sellGapPct,
        executionGapPct: issuer.executionGapPct,
        approxBreakEvenMovePct: issuer.approxBreakEvenMovePct,
        longTheoreticalConvergencePct: issuer.divergenceAfterBreakEvenPct,
        shortTheoreticalConvergencePct: null,
        longRawEligible: false, longPersistentCaptures: 0, longSignalStatus: "no_setup", longSignalReasons: [],
        shortRawEligible: false, shortPersistentCaptures: 0, shortSignalStatus: "no_setup", shortSignalReasons: [],
        momentum: { wrapperMidPrice: null, wrapperMove15mPct: null, wrapperMove1hPct: null, wrapperMove2hPct: null, benchmarkMove15mPct: null, benchmarkMove1hPct: null, benchmarkMove2hPct: null, wrapperPositiveSteps: 0, wrapperNegativeSteps: 0, benchmarkPositiveSteps: 0, benchmarkNegativeSteps: 0, trendStepsAvailable: 0, wrapperTrendStepsAvailable: 0 },
        momentumLongRawEligible: false, momentumLongPersistentCaptures: 0, momentumLongSignalStatus: "no_setup", momentumLongSignalReasons: [],
        momentumShortRawEligible: false, momentumShortPersistentCaptures: 0, momentumShortSignalStatus: "no_setup", momentumShortSignalReasons: [],
        strategyVersion: version,
      });
    }
  }
  return rows;
}


function observationEligible(
  row: PaperLabObservation,
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection
) {
  if (strategyType === "momentum") {
    return direction === "long" ? row.momentumLongRawEligible : row.momentumShortRawEligible;
  }
  return direction === "long" ? row.longRawEligible : row.shortRawEligible;
}

function consecutiveEligible(
  previous: PaperLabObservation[],
  issuer: string,
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection,
  currentEligible: boolean
) {
  if (!currentEligible) return 0;
  let count = 1;
  const rows = previous
    .filter((row) => row.issuer === issuer)
    .sort((a, b) => b.timestamp - a.timestamp);

  for (const row of rows) {
    if (strategyType === "momentum" && row.strategyVersion !== getPaperStrategyRules().version) break;
    if (!observationEligible(row, strategyType, direction)) break;
    count += 1;
  }
  return count;
}

function startOfUtcDay(timestamp: number) {
  const d = new Date(timestamp);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function convergenceEntryReasons(
  direction: PaperTradeDirection,
  quoteOk: boolean,
  benchmarkOk: boolean,
  marketOk: boolean,
  liquidityOk: boolean,
  directionalEdge: boolean,
  enoughRoom: boolean,
  persistentCaptures: number,
  requiredPersistence: number,
  targetPct: number
) {
  const reasons: string[] = [];
  if (!quoteOk) reasons.push("Executable $1,000 BUY and SELL routes, including real token quantities, are required.");
  if (!benchmarkOk) reasons.push("A current Wall Street reference price is required.");
  if (!marketOk) reasons.push("New entries are paused while the regular Wall Street session is closed.");
  if (!liquidityOk) reasons.push("Reported liquidity is below the research threshold.");
  if (!directionalEdge) {
    reasons.push(
      direction === "long"
        ? "The executable BUY is not below the Wall Street reference."
        : "The executable SELL is not above the Wall Street reference."
    );
  }
  if (!enoughRoom) {
    reasons.push(
      direction === "long"
        ? `The current long divergence does not leave ${targetPct.toFixed(2)}% of theoretical room after execution friction.`
        : `The current short premium does not leave ${targetPct.toFixed(2)}% of theoretical room after execution friction.`
    );
  }
  if (persistentCaptures < requiredPersistence) {
    reasons.push(`The setup has not persisted for ${requiredPersistence} captures yet.`);
  }
  if (!reasons.length) {
    reasons.push(
      direction === "long"
        ? "All convergence-long research rules are currently met."
        : "All convergence-short research rules are currently met."
    );
  }
  return reasons;
}

function momentumEntryReasons(
  direction: PaperTradeDirection,
  quoteOk: boolean,
  marketOk: boolean,
  liquidityOk: boolean,
  wrapperTrendOk: boolean,
  wrapperStepsOk: boolean,
  frictionOk: boolean,
  persistentCaptures: number,
  requiredPersistence: number,
  lookbackCaptures: number,
  minAlignedSteps: number,
  trendSteps: number,
  maxBreakEvenPct: number
) {
  const reasons: string[] = [];
  if (!quoteOk) reasons.push("Executable $1,000 BUY and SELL routes, including real token quantities, are required.");
  if (!marketOk) reasons.push("Momentum market-session restriction is enabled.");
  if (!liquidityOk) reasons.push("Reported liquidity is below the research threshold.");
  if (!wrapperTrendOk) {
    reasons.push(
      direction === "long"
        ? `The wrapper is not up over the ${lookbackCaptures}-capture momentum window.`
        : `The wrapper is not down over the ${lookbackCaptures}-capture momentum window.`
    );
  }
  if (!wrapperStepsOk) {
    reasons.push(
      direction === "long"
        ? `The wrapper has fewer than ${minAlignedSteps} rising steps in the last ${trendSteps} moves.`
        : `The wrapper has fewer than ${minAlignedSteps} falling steps in the last ${trendSteps} moves.`
    );
  }
  if (!frictionOk) {
    reasons.push(`Quoted round-trip break-even friction is above the ${maxBreakEvenPct.toFixed(2)}% momentum threshold.`);
  }
  if (persistentCaptures < requiredPersistence) {
    reasons.push(`The momentum setup has not persisted for ${requiredPersistence} captures yet.`);
  }
  if (!reasons.length) {
    reasons.push(
      direction === "long"
        ? "On-chain wrapper momentum is rising with executable liquidity."
        : "On-chain wrapper momentum is falling with executable liquidity."
    );
  }
  return reasons;
}

function recentTradeBlocksEntry(
  trades: PaperTrade[],
  ticker: string,
  issuer: string,
  timestamp: number,
  cooldownHours: number,
  direction: PaperTradeDirection,
  strategyType: PaperStrategyType,
  strategyVersion: string
) {
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  return trades.some((trade) => {
    if (trade.ticker !== ticker || trade.issuer !== issuer) return false;
    if (trade.direction !== direction || trade.strategyType !== strategyType || trade.strategyVersion !== strategyVersion) return false;
    if (trade.status === "open") return true;
    return timestamp - trade.openedAt < cooldownMs;
  });
}

/** Open exposure is shared by all issuers, strategies and versions for a stock. */
function existingStockDirectionTrade(trades: PaperTrade[], ticker: string, direction: PaperTradeDirection) {
  return trades.some((trade) =>
    trade.status === "open" && trade.ticker.toUpperCase() === ticker.toUpperCase() && trade.direction === direction
  );
}

function dailyTradeCount(trades: PaperTrade[], timestamp: number, direction: PaperTradeDirection, strategyVersion: string) {
  const start = startOfUtcDay(timestamp);
  const end = start + 24 * 60 * 60 * 1000;
  return trades.filter(
    (trade) => trade.strategyVersion === strategyVersion && trade.direction === direction && trade.openedAt >= start && trade.openedAt < end
  ).length;
}

function createTrade(
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection,
  observation: PaperLabObservation,
  rules: ReturnType<typeof getPaperStrategyRules>
): PaperTrade | null {
  const sourceQuote = direction === "long" ? observation.buy : observation.sell;
  const tokenAmount = sourceQuote.tokenAmount;
  const entryCostUsd = sourceQuote.usdcAmount;
  if (!tokenAmount || tokenAmount <= 0 || !entryCostUsd || entryCostUsd <= 0) return null;

  return {
    version: 3,
    id: randomUUID(),
    strategyType,
    direction,
    status: "open",
    strategyVersion: rules.version,
    strategyRules: { ...rules },
    ticker: observation.ticker,
    stockName: observation.stockName,
    refSymbol: observation.refSymbol,
    issuer: observation.issuer,
    symbol: observation.symbol,
    mint: observation.mint,
    tokenDecimals: observation.tokenDecimals,
    shareMultiplier: observation.shareMultiplier,
    openedAt: observation.timestamp,
    openedAtIso: observation.capturedAt,
    closedAt: null,
    closedAtIso: null,
    exitReason: null,
    entryObservationId: observation.id,
    entryCostUsd,
    tokenAmount,
    shareEquivalentAmount: tokenAmount * observation.shareMultiplier,
    entryEffectivePrice: sourceQuote.effectivePrice,
    entryBenchmarkPrice: observation.benchmarkPrice,
    entryBuyGapPct: observation.buyGapPct,
    entrySellGapPct: observation.sellGapPct,
    entryExecutionGapPct: observation.executionGapPct,
    entryBreakEvenPct: observation.approxBreakEvenMovePct,
    entryTheoreticalConvergencePct:
      direction === "long"
        ? observation.longTheoreticalConvergencePct
        : observation.shortTheoreticalConvergencePct,
    entryLiquidityUsd: observation.liquidityUsd,
    entryMarketOpen: observation.marketOpen,
    entryMomentum: strategyType === "momentum" ? { ...observation.momentum } : null,
    currentExitUsd: null,
    currentPnlUsd: null,
    currentPnlPct: null,
    maxExitUsd: null,
    minExitUsd: null,
    maxFavourablePct: null,
    maxAdversePct: null,
    realisedExitUsd: null,
    realisedPnlUsd: null,
    realisedPnlPct: null,
    marks: [],
  };
}

function shortTheoreticalConvergencePct(sellGap: number | null, breakEven: number | null) {
  if (sellGap === null || breakEven === null) return null;
  const premium = Math.max(sellGap, 0);
  return Math.max(0, premium - Math.max(breakEven, 0));
}

function midPrice(row: Pick<PaperLabObservation, "buy" | "sell">) {
  const buy = row.buy?.effectivePrice;
  const sell = row.sell?.effectivePrice;
  if (buy === null || buy === undefined || sell === null || sell === undefined) return null;
  if (!Number.isFinite(buy) || !Number.isFinite(sell) || buy <= 0 || sell <= 0) return null;
  return (buy + sell) / 2;
}

function pctChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return null;
  return ((current / previous) - 1) * 100;
}

function previousIssuerRows(previous: PaperLabObservation[], issuer: string) {
  return previous
    .filter((row) => row.issuer === issuer)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function valueAtCapture<T>(rows: T[], capturesBack: number, value: (row: T) => number | null) {
  const row = rows[capturesBack - 1];
  return row ? value(row) : null;
}

function directionalSteps(
  current: number | null,
  rows: PaperLabObservation[],
  steps: number,
  value: (row: PaperLabObservation) => number | null
) {
  const sequence: Array<number | null> = [current];
  for (let i = 0; i < steps; i += 1) sequence.push(rows[i] ? value(rows[i]) : null);

  let positive = 0;
  let negative = 0;
  let available = 0;
  for (let i = 0; i < steps; i += 1) {
    const newer = sequence[i];
    const older = sequence[i + 1];
    if (newer === null || older === null) continue;
    available += 1;
    if (newer > older) positive += 1;
    if (newer < older) negative += 1;
  }
  return { positive, negative, available };
}

function buildMomentumFeatures(
  currentMid: number | null,
  benchmarkPrice: number | null,
  previousRows: PaperLabObservation[],
  trendSteps: number
): PaperMomentumFeatures {
  const previousMid = (row: PaperLabObservation) => midPrice(row);
  const previousBenchmark = (row: PaperLabObservation) => row.benchmarkPrice;

  const wrapperSteps = directionalSteps(currentMid, previousRows, trendSteps, previousMid);
  const benchmarkSteps = directionalSteps(benchmarkPrice, previousRows, trendSteps, previousBenchmark);

  return {
    wrapperMidPrice: currentMid,
    wrapperMove15mPct: pctChange(currentMid, valueAtCapture(previousRows, 1, previousMid)),
    wrapperMove1hPct: pctChange(currentMid, valueAtCapture(previousRows, 4, previousMid)),
    wrapperMove2hPct: pctChange(currentMid, valueAtCapture(previousRows, 8, previousMid)),
    benchmarkMove15mPct: pctChange(benchmarkPrice, valueAtCapture(previousRows, 1, previousBenchmark)),
    benchmarkMove1hPct: pctChange(benchmarkPrice, valueAtCapture(previousRows, 4, previousBenchmark)),
    benchmarkMove2hPct: pctChange(benchmarkPrice, valueAtCapture(previousRows, 8, previousBenchmark)),
    wrapperPositiveSteps: wrapperSteps.positive,
    wrapperNegativeSteps: wrapperSteps.negative,
    benchmarkPositiveSteps: benchmarkSteps.positive,
    benchmarkNegativeSteps: benchmarkSteps.negative,
    trendStepsAvailable: Math.min(wrapperSteps.available, benchmarkSteps.available),
    wrapperTrendStepsAvailable: wrapperSteps.available,
  };
}

/** Candidate log is uncapped and independent of daily portfolio trade limits.
 * Price-proxy follow-up uses the standard $1,000 BUY/SELL effective quotes; it
 * does not consume Jupiter calls and must never be reported as executed P&L. */
function makeResearchCandidates(
  time: number,
  buy: PaperExecutionSnapshot,
  sell: PaperExecutionSnapshot,
  move30m: number | null,
  move1h: number | null,
  gapCross: "negative_to_positive" | "positive_to_negative" | null,
  gapNarrowing: boolean,
  currentGap: number | null,
  gapIsFresh: boolean,
  wrapperTurn: "up" | "down" | null
): PaperCandidateOutcome[] {
  const candidates: PaperCandidateOutcome[] = [];
  const add = (kind: PaperCandidateOutcome["kind"], direction: PaperTradeDirection) => {
    const entry = direction === "long" ? buy.effectivePrice : sell.effectivePrice;
    if (entry === null || !Number.isFinite(entry) || entry <= 0) return;
    // Without both executable entry routes, this is only an observation.
    if (buy.status !== "ok" || sell.status !== "ok") return;
    candidates.push({
      kind, direction, enteredAt: time, entryEffectivePrice: entry,
      firstTargetPct: null, firstTargetAt: null, secondaryTargetAt: null,
      firstStopAt: null, firstTouch: null,
      maxFavourablePct: null, maxAdversePct: null, terminalPct: null,
      lastSeenAt: time, status: "tracking",
      at4hPct: null, at24hPct: null, at48hPct: null,
      targetBy24h: null, targetBy48h: null, stopBy24h: null, stopBy48h: null,
    });
  };
  // Historical evidence: agreement of 30-minute and one-hour signs. No
  // retrospective optimisation of hard thresholds; require only positive signs.
  if (move30m !== null && move1h !== null) {
    if (move30m > 0 && move1h > 0) add("sustained_momentum", "long");
    if (move30m < 0 && move1h < 0) add("sustained_momentum", "short");
  }
  // Gap-based signals are research-only and require a demonstrably fresh
  // reference so weekend changes cannot masquerade as genuine convergence.
  if (gapIsFresh && gapCross) add("gap_cross", gapCross === "positive_to_negative" ? "long" : "short");
  if (gapIsFresh && gapNarrowing && currentGap !== null) add("gap_narrowing", currentGap < 0 ? "long" : "short");
  if (wrapperTurn) add("wrapper_turn", wrapperTurn === "up" ? "long" : "short");
  return candidates;
}

function updateResearchOutcomes(
  previous: PaperLabObservation[], current: PaperLabObservation[], timestamp: number
): Map<string, PaperCandidateOutcome[]> {
  const updates = new Map<string, PaperCandidateOutcome[]>();
  const currentByMint = new Map(current.map((row) => [row.mint, row]));
  const horizonMs = 48 * 60 * 60 * 1000;
  const checkpoint4 = 4 * 60 * 60 * 1000;
  const checkpoint24 = 24 * 60 * 60 * 1000;
  for (const previousRow of previous) {
    if (!previousRow.researchCandidates?.some((candidate) => candidate.status === "tracking")) continue;
    if (previousRow.timestamp >= timestamp) continue;
    const next = currentByMint.get(previousRow.mint);
    const elapsed = timestamp - previousRow.timestamp;
    const updated = previousRow.researchCandidates.map((candidate) => {
      if (candidate.status !== "tracking") return candidate;
      const exit = next && (candidate.direction === "long" ? next.sell : next.buy);
      const exitPrice = exit?.status === "ok" ? exit.effectivePrice : null;
      const outcome = { ...candidate };
      if (exitPrice !== null && exitPrice !== undefined && Number.isFinite(exitPrice) && exitPrice > 0) {
        // Long: buy now, sell later. Short: sell now, buy later; the latter is
        // a simplified proxy and NOT the exact-token synthetic cover quote.
        const pct = candidate.direction === "long"
          ? (exitPrice / candidate.entryEffectivePrice - 1) * 100
          : (1 - exitPrice / candidate.entryEffectivePrice) * 100;
        outcome.maxFavourablePct = outcome.maxFavourablePct === null ? pct : Math.max(outcome.maxFavourablePct, pct);
        outcome.maxAdversePct = outcome.maxAdversePct === null ? pct : Math.min(outcome.maxAdversePct, pct);
        outcome.terminalPct = pct;
        outcome.lastSeenAt = timestamp;
        if (elapsed >= checkpoint4 && outcome.at4hPct == null) outcome.at4hPct = pct;
        if (elapsed >= checkpoint24 && outcome.at24hPct == null) {
          outcome.at24hPct = pct;
          outcome.targetBy24h = outcome.firstTargetAt !== null || pct >= 1;
          outcome.stopBy24h = outcome.firstStopAt !== null || pct <= -1;
        }
        if (elapsed >= horizonMs && outcome.at48hPct == null) {
          outcome.at48hPct = pct;
          outcome.targetBy48h = outcome.firstTargetAt !== null || pct >= 1;
          outcome.stopBy48h = outcome.firstStopAt !== null || pct <= -1;
        }
        if (pct >= 1 && outcome.firstTargetAt === null) {
          outcome.firstTargetAt = timestamp;
          outcome.firstTargetPct = 1;
        }
        if (pct >= 1.2 && outcome.secondaryTargetAt === null) outcome.secondaryTargetAt = timestamp;
        if (pct <= -1 && outcome.firstStopAt === null) outcome.firstStopAt = timestamp;
        // Check a sampled point only; cannot know ordering between captures.
        if (outcome.firstTouch === null) {
          if (pct >= 1) outcome.firstTouch = "target";
          else if (pct <= -1) outcome.firstTouch = "stop";
        }
      }
      if (elapsed >= horizonMs && outcome.at48hPct !== null && outcome.at48hPct !== undefined) outcome.status = "complete";
      return outcome;
    });
    updates.set(previousRow.id, updated);
  }
  return updates;
}

// Serialize the read/decide/write transaction across tickers in this process.
// Storage's write queue alone cannot prevent two concurrent captures reading
// the same old portfolio and independently admitting duplicate exposure.
let labCaptureQueue: Promise<unknown> = Promise.resolve();

export function capturePaperLabForSnapshot(snapshot: HistorySnapshot): Promise<PaperLabObservation[]> {
  const task = labCaptureQueue.then(() => capturePaperLabForSnapshotSerial(snapshot));
  labCaptureQueue = task.catch(() => undefined);
  return task;
}

async function capturePaperLabForSnapshotSerial(snapshot: HistorySnapshot) {
  const rules = getPaperStrategyRules();
  // A stale PAPER_TRADE_NOTIONAL_USD=50 override must never relabel $1,000 quotes.
  if (Math.abs(rules.notionalUsd - snapshot.canonicalSizeUsd) > 0.000001) {
    throw new Error(`Paper notional $${rules.notionalUsd} disagrees with history quote $${snapshot.canonicalSizeUsd}. Set PAPER_TRADE_NOTIONAL_USD=${snapshot.canonicalSizeUsd}.`);
  }
  const oldLabObservations = await readPaperObservations(snapshot.ticker);
  const historical = await readHistory(snapshot.ticker);
  const v4LabObservations = oldLabObservations.filter((row) => row.strategyVersion === rules.version && row.notionalUsd === rules.notionalUsd);
  const bootstrap = historyAsTrendObservations(historical, snapshot.ticker, rules.notionalUsd, rules.version, snapshot.timestamp);
  // Stored lab observations supersede synthetic history rows for their timestamps.
  const existingKeys = new Set(v4LabObservations.map((row) => `${row.timestamp}:${row.mint}`));
  const previous = [...bootstrap.filter((row) => !existingKeys.has(`${row.timestamp}:${row.mint}`)), ...v4LabObservations]
    .sort((a, b) => a.timestamp - b.timestamp);
  const trades = await readPaperTrades();
  // A retried capture must not create a second set of entries for an identical
  // ticker/timestamp. Existing candidates and marks are left untouched.
  if (v4LabObservations.some((row) => row.timestamp === snapshot.timestamp)) return [];
  const newRows: PaperLabObservation[] = [];
  let mutableLongTradeCount = dailyTradeCount(trades, snapshot.timestamp, "long", rules.version);
  let mutableShortTradeCount = dailyTradeCount(trades, snapshot.timestamp, "short", rules.version);

  for (const issuerRow of snapshot.issuers) {
    const decimals = issuerRow.decimals;
    if (decimals === undefined || decimals === null) continue;

    // Reuse the same executable $1,000 routes already stored by history.
    const buyQuote = quoteFromHistory(issuerRow.buy);
    const sellQuote = quoteFromHistory(issuerRow.sell);

    const buyGap = gapPct(buyQuote.effectivePrice, snapshot.benchmarkPrice);
    const sellGap = gapPct(sellQuote.effectivePrice, snapshot.benchmarkPrice);
    const executionGap = executionGapPct(buyQuote.effectivePrice, sellQuote.effectivePrice);
    const breakEven = approxBreakEvenMovePct(buyQuote.effectivePrice, sellQuote.effectivePrice);
    const longTheoretical = divergenceAfterBreakEvenPct(buyGap, breakEven);
    const shortTheoretical = shortTheoreticalConvergencePct(sellGap, breakEven);

    const quoteOk = buyQuote.status === "ok" && sellQuote.status === "ok" &&
      buyQuote.effectivePrice !== null && buyQuote.effectivePrice > 0 &&
      sellQuote.effectivePrice !== null && sellQuote.effectivePrice > 0 &&
      buyQuote.tokenAmount !== null && buyQuote.tokenAmount > 0 &&
      sellQuote.tokenAmount !== null && sellQuote.tokenAmount > 0 &&
      buyQuote.usdcAmount !== null && buyQuote.usdcAmount > 0 &&
      sellQuote.usdcAmount !== null && sellQuote.usdcAmount > 0;
    // Reported liquidity alone does not establish route capacity. Both
    // whole-order quotes must exist, and extreme quoted impact is rejected.
    const quoteImpactOk = [buyQuote.priceImpactPct, sellQuote.priceImpactPct]
      .every((impact) => impact !== null && Number.isFinite(impact) && Math.abs(impact) <= (rules.maxQuoteImpactPct ?? 1));
    const executableOk = quoteOk && quoteImpactOk;
    // Only a timestamped, recent underlying quote can establish convergence.
    // On-chain momentum deliberately does NOT depend on this reference.
    const benchmarkOk = snapshot.benchmarkPrice !== null && snapshot.benchmarkPrice > 0 &&
      snapshot.benchmarkTimestamp !== null &&
      snapshot.benchmarkTimestamp <= snapshot.timestamp + 60_000 &&
      snapshot.timestamp - snapshot.benchmarkTimestamp <= 30 * 60_000;
    const marketOk = !rules.requireMarketOpenForEntries || snapshot.marketOpen;
    const momentumMarketOk = !rules.momentumRequireMarketOpen || snapshot.marketOpen;
    const liquidityOk = issuerRow.liquidityUsd !== null && issuerRow.liquidityUsd >= rules.minLiquidityUsd;

    const discounted = buyGap !== null && buyGap < 0;
    const enoughLongRoom = longTheoretical !== null && longTheoretical >= rules.targetPct;
    const longRawEligible = executableOk && benchmarkOk && marketOk && liquidityOk && discounted && enoughLongRoom;
    const longPersistentCaptures = consecutiveEligible(
      v4LabObservations,
      issuerRow.issuer,
      "convergence",
      "long",
      longRawEligible
    );
    const longBaseReady = longRawEligible && longPersistentCaptures >= rules.minPersistentCaptures;
    const longBlocked = recentTradeBlocksEntry(
      trades,
      snapshot.ticker,
      issuerRow.issuer,
      snapshot.timestamp,
      rules.cooldownHours,
      "long",
      "convergence",
      rules.version
    );
    const longDailyCapReached = mutableLongTradeCount >= rules.maxNewLongTradesPerDay;
    let longSignalStatus: PaperLabObservation["longSignalStatus"] = "no_setup";
    if (longBaseReady && !longBlocked && !longDailyCapReached) longSignalStatus = "candidate";
    else if (longRawEligible || longPersistentCaptures > 0) longSignalStatus = "watch";
    const longReasons = convergenceEntryReasons(
      "long",
      quoteOk,
      benchmarkOk,
      marketOk,
      liquidityOk,
      discounted,
      enoughLongRoom,
      longPersistentCaptures,
      rules.minPersistentCaptures,
      rules.targetPct
    );
    if (!quoteImpactOk) longReasons.push("Whole-order price impact exceeds the configured limit.");
    if (longBlocked) longReasons.push("A convergence-long paper trade for this wrapper is already open or still inside its cooldown period.");
    if (longDailyCapReached) longReasons.push("The daily long paper-entry cap has been reached.");

    const premium = sellGap !== null && sellGap > 0;
    const enoughShortRoom = shortTheoretical !== null && shortTheoretical >= rules.targetPct;
    // V4.3 long-only: retain short fields for legacy history, but never admit new shorts.
    const shortRawEligible = false;
    const shortPersistentCaptures = consecutiveEligible(
      v4LabObservations,
      issuerRow.issuer,
      "convergence",
      "short",
      shortRawEligible
    );
    const shortBaseReady = shortRawEligible && shortPersistentCaptures >= rules.minPersistentCaptures;
    const shortBlocked = recentTradeBlocksEntry(
      trades,
      snapshot.ticker,
      issuerRow.issuer,
      snapshot.timestamp,
      rules.cooldownHours,
      "short",
      "convergence",
      rules.version
    );
    const shortDailyCapReached = mutableShortTradeCount >= rules.maxNewShortTradesPerDay;
    let shortSignalStatus: PaperLabObservation["shortSignalStatus"] = "no_setup";
    if (shortBaseReady && !shortBlocked && !shortDailyCapReached) shortSignalStatus = "candidate";
    // Long-only: no new short watches/candidates. Preserve historical short observations in storage.
    const shortReasons = convergenceEntryReasons(
      "short",
      quoteOk,
      benchmarkOk,
      marketOk,
      liquidityOk,
      premium,
      enoughShortRoom,
      shortPersistentCaptures,
      rules.minPersistentCaptures,
      rules.targetPct
    );
    if (!quoteImpactOk) shortReasons.push("Whole-order price impact exceeds the configured limit.");
    if (shortBlocked) shortReasons.push("A convergence-short paper trade for this wrapper is already open or still inside its cooldown period.");
    if (shortDailyCapReached) shortReasons.push("The daily short paper-entry cap has been reached.");

    const issuerPrevious = previousIssuerRows(previous, issuerRow.issuer);
    const currentMid =
      buyQuote.effectivePrice !== null && sellQuote.effectivePrice !== null
        ? (buyQuote.effectivePrice + sellQuote.effectivePrice) / 2
        : null;
    const momentum = buildMomentumFeatures(
      currentMid,
      snapshot.benchmarkPrice,
      issuerPrevious,
      rules.momentumTrendSteps
    );

    const lookbackIndex = rules.momentumLookbackCaptures;
    const wrapperLookbackPrice = valueAtCapture(issuerPrevious, lookbackIndex, (row) => midPrice(row));
    const wrapperLookbackMove = pctChange(currentMid, wrapperLookbackPrice);

    const momentumDataReady =
      wrapperLookbackMove !== null &&
      momentum.wrapperTrendStepsAvailable >= rules.momentumTrendSteps;
    const frictionOk = breakEven !== null && breakEven >= 0 && breakEven <= rules.momentumMaxBreakEvenPct;
    // A few basis points of quote noise should not count as a $1,000 momentum
    // entry. This provisional floor is NOT inferred to be a profitable rule:
    // compare candidates and outcomes before tuning it.
    const minMomentumMovePct = Math.max(0.25, (breakEven ?? 0) * 1.5);
    const recent30mMove = pctChange(currentMid, valueAtCapture(issuerPrevious, 2, (row) => midPrice(row)));

    const wrapperLongTrend = momentumDataReady && wrapperLookbackMove >= minMomentumMovePct &&
      recent30mMove !== null && recent30mMove > 0;
    const wrapperLongSteps = momentum.wrapperPositiveSteps >= rules.momentumMinAlignedSteps;
    const momentumLongRawEligible =
      executableOk &&
      momentumMarketOk &&
      liquidityOk &&
      momentumDataReady &&
      wrapperLongTrend &&
      wrapperLongSteps &&
      frictionOk;
    const momentumLongPersistentCaptures = consecutiveEligible(
      v4LabObservations,
      issuerRow.issuer,
      "momentum",
      "long",
      momentumLongRawEligible
    );
    const momentumLongBaseReady =
      momentumLongRawEligible && momentumLongPersistentCaptures >= rules.minPersistentCaptures;
    const momentumLongBlocked = recentTradeBlocksEntry(
      trades,
      snapshot.ticker,
      issuerRow.issuer,
      snapshot.timestamp,
      rules.cooldownHours,
      "long",
      "momentum",
      rules.version
    );
    const momentumLongDailyCapReached = mutableLongTradeCount >= rules.maxNewLongTradesPerDay;
    let momentumLongSignalStatus: PaperLabObservation["momentumLongSignalStatus"] = "no_setup";
    if (momentumLongBaseReady && !momentumLongBlocked && !momentumLongDailyCapReached) momentumLongSignalStatus = "candidate";
    else if (
      momentumLongRawEligible ||
      momentumLongPersistentCaptures > 0 ||
      (momentumDataReady && wrapperLongTrend)
    ) momentumLongSignalStatus = "watch";
    const momentumLongReasons = momentumEntryReasons(
      "long",
      quoteOk,
      momentumMarketOk,
      liquidityOk,
      wrapperLongTrend,
      wrapperLongSteps,
      frictionOk,
      momentumLongPersistentCaptures,
      rules.minPersistentCaptures,
      rules.momentumLookbackCaptures,
      rules.momentumMinAlignedSteps,
      rules.momentumTrendSteps,
      rules.momentumMaxBreakEvenPct
    );
    if (!quoteImpactOk) momentumLongReasons.push("Whole-order price impact exceeds the configured limit.");
    if (!momentumDataReady) momentumLongReasons.unshift("More history is needed before the momentum window can be evaluated.");
    if (momentumDataReady && !wrapperLongTrend) momentumLongReasons.push(`Entry requires at least +${minMomentumMovePct.toFixed(3)}% over the lookback and a rising 30-minute trend (provisional execution-aware floor).`);
    if (momentumLongBlocked) momentumLongReasons.push("A momentum-long paper trade for this wrapper is already open or still inside its cooldown period.");
    if (momentumLongDailyCapReached) momentumLongReasons.push("The daily long paper-entry cap has been reached.");

    const wrapperShortTrend = momentumDataReady && wrapperLookbackMove <= -minMomentumMovePct &&
      recent30mMove !== null && recent30mMove < 0;
    const wrapperShortSteps = momentum.wrapperNegativeSteps >= rules.momentumMinAlignedSteps;
    const momentumShortRawEligible =
      false && executableOk &&
      momentumMarketOk &&
      liquidityOk &&
      momentumDataReady &&
      wrapperShortTrend &&
      wrapperShortSteps &&
      frictionOk;
    const momentumShortPersistentCaptures = consecutiveEligible(
      v4LabObservations,
      issuerRow.issuer,
      "momentum",
      "short",
      momentumShortRawEligible
    );
    const momentumShortBaseReady =
      momentumShortRawEligible && momentumShortPersistentCaptures >= rules.minPersistentCaptures;
    const momentumShortBlocked = recentTradeBlocksEntry(
      trades,
      snapshot.ticker,
      issuerRow.issuer,
      snapshot.timestamp,
      rules.cooldownHours,
      "short",
      "momentum",
      rules.version
    );
    const momentumShortDailyCapReached = mutableShortTradeCount >= rules.maxNewShortTradesPerDay;
    let momentumShortSignalStatus: PaperLabObservation["momentumShortSignalStatus"] = "no_setup";
    if (momentumShortBaseReady && !momentumShortBlocked && !momentumShortDailyCapReached) momentumShortSignalStatus = "candidate";
    else if (
      momentumShortRawEligible ||
      momentumShortPersistentCaptures > 0 ||
      (momentumDataReady && wrapperShortTrend)
    ) { /* Long-only: retain price-trend calculations for research, but do not emit short signals. */ }
    const momentumShortReasons = momentumEntryReasons(
      "short",
      quoteOk,
      momentumMarketOk,
      liquidityOk,
      wrapperShortTrend,
      wrapperShortSteps,
      frictionOk,
      momentumShortPersistentCaptures,
      rules.minPersistentCaptures,
      rules.momentumLookbackCaptures,
      rules.momentumMinAlignedSteps,
      rules.momentumTrendSteps,
      rules.momentumMaxBreakEvenPct
    );
    if (!quoteImpactOk) momentumShortReasons.push("Whole-order price impact exceeds the configured limit.");
    if (!momentumDataReady) momentumShortReasons.unshift("More history is needed before the momentum window can be evaluated.");
    if (momentumDataReady && !wrapperShortTrend) momentumShortReasons.push(`Entry requires at least -${minMomentumMovePct.toFixed(3)}% over the lookback and a falling 30-minute trend (provisional execution-aware floor).`);
    if (momentumShortBlocked) momentumShortReasons.push("A momentum-short paper trade for this wrapper is already open or still inside its cooldown period.");
    if (momentumShortDailyCapReached) momentumShortReasons.push("The daily short paper-entry cap has been reached.");

    // Discovery events are observations only; they never consume a trade slot.
    // A gap is context while the market is closed, not proof of live mispricing.
    const priorRow = issuerPrevious[0];
    const priorGap = priorRow?.buyGapPct ?? null;
    const gapCross = buyGap === null || priorGap === null
      ? null
      : priorGap <= 0 && buyGap > 0 ? "negative_to_positive" as const
      : priorGap >= 0 && buyGap < 0 ? "positive_to_negative" as const : null;
    const priorAbsGap = priorGap === null ? null : Math.abs(priorGap);
    const gapReversal = buyGap === null || priorAbsGap === null
      ? null : priorAbsGap - Math.abs(buyGap) >= 0.1 ? "toward_zero" as const
      : Math.abs(buyGap) - priorAbsGap >= 0.1 ? "away_from_zero" as const : null;
    const oldMid = issuerPrevious[0] ? midPrice(issuerPrevious[0]) : null;
    const olderMid = issuerPrevious[1] ? midPrice(issuerPrevious[1]) : null;
    const wrapperTurn = currentMid === null || oldMid === null || olderMid === null
      ? null : oldMid < olderMid && currentMid > oldMid ? "up" as const
      : oldMid > olderMid && currentMid < oldMid ? "down" as const : null;
    const frictionChangePct = breakEven === null || priorRow?.approxBreakEvenMovePct == null
      ? null : breakEven - priorRow.approxBreakEvenMovePct;
    const discoveryEvents = [
      ...(gapCross ? [`${snapshot.marketOpen && benchmarkOk ? "Gap" : "Apparent gap (stale reference)"} crossed ${gapCross === "negative_to_positive" ? "above" : "below"} zero`] : []),
      ...(gapReversal === "toward_zero" ? [snapshot.marketOpen && benchmarkOk ? "Gap moved toward zero" : "Apparent gap narrowed (stale reference)"] : []),
      ...(wrapperTurn ? [`On-chain wrapper reversed ${wrapperTurn}`] : []),
      ...(frictionChangePct !== null && frictionChangePct < -0.1 ? ["Round-trip friction improved >0.1 percentage points"] : []),
    ];
    const gapReferenceFresh = snapshot.marketOpen && benchmarkOk;
    const researchCandidates = makeResearchCandidates(
      snapshot.timestamp, buyQuote, sellQuote,
      pctChange(currentMid, valueAtCapture(issuerPrevious, 2, (row) => midPrice(row))),
      momentum.wrapperMove1hPct, gapCross, gapReversal === "toward_zero", buyGap,
      gapReferenceFresh, wrapperTurn
    ).filter((candidate) => candidate.direction === "long"); // Preserve old short research; collect only long hypotheses going forward.
    const discovery = { gapCross, gapReferenceFresh, gapReversal, wrapperTurn, frictionChangePct, events: discoveryEvents };

    const observation: PaperLabObservation = {
      version: 3,
      id: randomUUID(),
      timestamp: snapshot.timestamp,
      capturedAt: snapshot.capturedAt,
      ticker: snapshot.ticker,
      stockName: snapshot.stockName,
      refSymbol: snapshot.refSymbol,
      issuer: issuerRow.issuer,
      symbol: issuerRow.symbol,
      mint: issuerRow.mint,
      tokenDecimals: decimals,
      shareMultiplier: issuerRow.shareMultiplier,
      marketOpen: snapshot.marketOpen,
      marketLabel: snapshot.marketLabel,
      benchmarkPrice: snapshot.benchmarkPrice,
      benchmarkTimestamp: snapshot.benchmarkTimestamp,
      liquidityUsd: issuerRow.liquidityUsd,
      notionalUsd: rules.notionalUsd,
      buy: buyQuote,
      sell: sellQuote,
      buyGapPct: buyGap,
      sellGapPct: sellGap,
      executionGapPct: executionGap,
      approxBreakEvenMovePct: breakEven,
      longTheoreticalConvergencePct: longTheoretical,
      shortTheoreticalConvergencePct: shortTheoretical,
      longRawEligible,
      longPersistentCaptures,
      longSignalStatus,
      longSignalReasons: longReasons,
      shortRawEligible,
      shortPersistentCaptures,
      shortSignalStatus,
      shortSignalReasons: shortReasons,
      momentum,
      momentumLongRawEligible,
      momentumLongPersistentCaptures,
      momentumLongSignalStatus,
      momentumLongSignalReasons: momentumLongReasons,
      momentumShortRawEligible,
      momentumShortPersistentCaptures,
      momentumShortSignalStatus,
      momentumShortSignalReasons: momentumShortReasons,
      strategyVersion: rules.version,
      researchCandidates,
      discovery,
    };

    newRows.push(observation);

    const potentialEntries: Array<{
      strategyType: PaperStrategyType;
      direction: PaperTradeDirection;
      status: PaperLabObservation["longSignalStatus"];
    }> = [
      { strategyType: "momentum", direction: "long", status: momentumLongSignalStatus },
      { strategyType: "convergence", direction: "long", status: longSignalStatus },
    ];

    for (const entry of potentialEntries) {
      if (entry.status !== "candidate") continue;
      // Block duplicate stock+direction exposure across ALL issuers, versions
      // and strategy families; preserve previously opened duplicates as history.
      if (existingStockDirectionTrade(trades, snapshot.ticker, entry.direction)) {
        const reason = "Entry blocked: an open position already exists for this stock and direction (all issuers/strategies).";
        if (entry.strategyType === "momentum" && entry.direction === "long") {
          observation.momentumLongSignalStatus = "watch";
          observation.momentumLongSignalReasons.push(reason);
        } else if (entry.strategyType === "momentum" && entry.direction === "short") {
          observation.momentumShortSignalStatus = "watch";
          observation.momentumShortSignalReasons.push(reason);
        } else if (entry.direction === "long") {
          observation.longSignalStatus = "watch";
          observation.longSignalReasons.push(reason);
        } else {
          observation.shortSignalStatus = "watch";
          observation.shortSignalReasons.push(reason);
        }
        continue;
      }
      if (entry.direction === "long" && mutableLongTradeCount >= rules.maxNewLongTradesPerDay) continue;
      if (entry.direction === "short" && mutableShortTradeCount >= rules.maxNewShortTradesPerDay) continue;

      const trade = createTrade(entry.strategyType, entry.direction, observation, rules);
      if (!trade) continue;
      trades.push(trade);
      if (entry.direction === "long") mutableLongTradeCount += 1;
      else mutableShortTradeCount += 1;
    }
  }

  // Follow-up previously recorded candidates only after new prices arrive.
  // Do not retroactively create or overwrite history-based simulated trades.
  const candidateUpdates = updateResearchOutcomes(v4LabObservations, newRows, snapshot.timestamp);
  await updatePaperCandidateOutcomes(snapshot.ticker, candidateUpdates);
  await appendPaperObservations(snapshot.ticker, newRows);
  await markOpenPaperTrades(trades, snapshot.ticker, snapshot.benchmarkPrice, snapshot.timestamp);
  return newRows;
}

export async function markOpenPaperTrades(
  suppliedTrades?: PaperTrade[],
  tickerFilter?: string,
  benchmarkPrice: number | null = null,
  timestamp = Date.now()
) {
  const trades = suppliedTrades ?? await readPaperTrades();
  let changed = false;
  const quoteCache = new Map<string, Promise<Awaited<ReturnType<typeof fetchExactTokenSellQuote>>>>();

  for (const trade of trades) {
    if (trade.status !== "open") continue;
    if (tickerFilter && trade.ticker !== tickerFilter) continue;

    const cacheKey = [
      trade.direction,
      trade.mint,
      trade.tokenDecimals,
      trade.tokenAmount.toFixed(12),
      trade.shareMultiplier.toFixed(12),
      trade.direction === "short" ? trade.entryCostUsd.toFixed(8) : "",
    ].join(":");

    let quotePromise = quoteCache.get(cacheKey);
    if (!quotePromise) {
      quotePromise = trade.direction === "long"
        ? fetchExactTokenSellQuote(
            trade.mint,
            trade.tokenDecimals,
            trade.tokenAmount,
            trade.shareMultiplier
          )
        : fetchExactTokenBuyQuote(
            trade.mint,
            trade.tokenDecimals,
            trade.tokenAmount,
            trade.shareMultiplier,
            trade.entryCostUsd
          );
      quoteCache.set(cacheKey, quotePromise);
    }
    const quote = await quotePromise;

    const markUsd = quote.usdcAmount;
    const pnlUsd = markUsd === null
      ? null
      : trade.direction === "long"
        ? markUsd - trade.entryCostUsd
        : trade.entryCostUsd - markUsd;
    const pnlPct = pnlUsd === null ? null : (pnlUsd / trade.entryCostUsd) * 100;

    const mark: PaperTradeMark = {
      timestamp,
      capturedAt: new Date(timestamp).toISOString(),
      markStatus: quote.status,
      markUsd,
      markEffectivePrice: quote.effectivePrice,
      pnlUsd,
      pnlPct,
      benchmarkPrice,
      ...(quote.error ? { error: quote.error } : {}),
    };

    trade.marks = [...trade.marks, mark].slice(-500);
    if (markUsd !== null && pnlUsd !== null && pnlPct !== null) {
      trade.currentExitUsd = markUsd;
      trade.currentPnlUsd = pnlUsd;
      trade.currentPnlPct = pnlPct;
      trade.maxExitUsd = trade.maxExitUsd === null ? markUsd : Math.max(trade.maxExitUsd, markUsd);
      trade.minExitUsd = trade.minExitUsd === null ? markUsd : Math.min(trade.minExitUsd, markUsd);
      trade.maxFavourablePct = trade.maxFavourablePct === null ? pnlPct : Math.max(trade.maxFavourablePct, pnlPct);
      trade.maxAdversePct = trade.maxAdversePct === null ? pnlPct : Math.min(trade.maxAdversePct, pnlPct);

      const heldHours = (timestamp - trade.openedAt) / (60 * 60 * 1000);
      let reason: PaperTrade["exitReason"] = null;
      if (pnlPct >= trade.strategyRules.targetPct) reason = "target";
      else if (trade.strategyRules.stopPct !== null && pnlPct <= trade.strategyRules.stopPct) reason = "stop";
      else if (heldHours >= trade.strategyRules.maxHoldHours) reason = "timeout";

      if (reason) {
        trade.status = "closed";
        trade.closedAt = timestamp;
        trade.closedAtIso = new Date(timestamp).toISOString();
        trade.exitReason = reason;
        trade.realisedExitUsd = markUsd;
        trade.realisedPnlUsd = pnlUsd;
        trade.realisedPnlPct = pnlPct;
      }
    }
    changed = true;
  }

  if (changed || suppliedTrades) await writePaperTrades(trades);
  return trades;
}
