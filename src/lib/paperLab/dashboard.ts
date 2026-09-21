import { buildDailyIssuerRanges } from "@/lib/paperLab/dailyRanges";
import { getPaperStrategyRules } from "@/lib/paperLab/config";
import { latestPaperObservations, recentPaperDiscoveryObservations, recentPaperResearchObservations, readPaperTrades } from "@/lib/paperLab/storage";
import type {
  PaperLabDashboard,
  PaperResearchGroup,
  PaperCandidateOutcome,
  PaperLabSummary,
  PaperStrategyPerformance,
  PaperStrategyType,
  PaperTrade,
  PaperTradeDirection,
} from "@/types/paperLab";

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function holdMinutes(trade: PaperTrade) {
  if (!trade.closedAt) return null;
  return (trade.closedAt - trade.openedAt) / 60000;
}

function strategyLabel(strategyType: PaperStrategyType, direction: PaperTradeDirection) {
  const family = strategyType === "momentum" ? "Momentum" : "Convergence";
  return `${family} ${direction === "long" ? "Long" : "Short"}`;
}

function buildStrategyPerformance(
  trades: PaperTrade[],
  strategyType: PaperStrategyType,
  direction: PaperTradeDirection,
  version: string
): PaperStrategyPerformance {
  const matching = trades.filter(
    (trade) => trade.strategyVersion === version && trade.strategyType === strategyType && trade.direction === direction
  );
  const open = matching.filter((trade) => trade.status === "open");
  const completed = matching.filter((trade) => trade.status === "closed");
  const targetHits = completed.filter((trade) => trade.exitReason === "target").length;
  const realisedPnl = completed
    .map((trade) => trade.realisedPnlUsd)
    .filter((value): value is number => value !== null);
  const realisedPct = completed
    .map((trade) => trade.realisedPnlPct)
    .filter((value): value is number => value !== null);

  return {
    strategyVersion: version,
    strategyType,
    direction,
    label: strategyLabel(strategyType, direction),
    openTrades: open.length,
    completedTrades: completed.length,
    targetHits,
    targetHitRatePct: completed.length ? (targetHits / completed.length) * 100 : null,
    averagePnlPct: average(realisedPct),
    realisedPnlUsd: realisedPnl.reduce((sum, value) => sum + value, 0),
  };
}

export async function buildPaperLabDashboard(): Promise<PaperLabDashboard> {
  const rules = getPaperStrategyRules();
  const [trades, latestObservations, discoveryObservations, researchObservations, dailyIssuerRanges] = await Promise.all([
    readPaperTrades(),
    latestPaperObservations(),
    recentPaperDiscoveryObservations(),
    recentPaperResearchObservations(),
    buildDailyIssuerRanges(),
  ]);

  const openTrades = trades
    .filter((trade) => trade.status === "open")
    .sort((a, b) => b.openedAt - a.openedAt);
  const completedTrades = trades
    .filter((trade) => trade.status === "closed")
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));


  // All-time headline: include historical strategy versions as well as the
  // currently active experiment. Version-specific performance stays in the
  // strategy scoreboard below. Never rewrite or migrate saved trade records.
  const realised = completedTrades
    .map((trade) => trade.realisedPnlUsd)
    .filter((value): value is number => value !== null);
  const realisedPct = completedTrades
    .map((trade) => trade.realisedPnlPct)
    .filter((value): value is number => value !== null);
  const unrealised = openTrades
    .map((trade) => trade.currentPnlUsd)
    .filter((value): value is number => value !== null);
  const holds = completedTrades
    .map(holdMinutes)
    .filter((value): value is number => value !== null);
  const targetHits = completedTrades.filter((trade) => trade.exitReason === "target").length;
  const secondaryTargetHits = completedTrades.filter((trade) =>
    (trade.maxFavourablePct ?? trade.realisedPnlPct ?? -Infinity) >=
    (trade.strategyRules?.secondaryTargetPct ?? 1.2)
  ).length;

  const summary: PaperLabSummary = {
    strategyVersion: rules.version,
    paperNotionalUsd: rules.notionalUsd,
    targetPct: rules.targetPct,
    openTrades: openTrades.length,
    completedTrades: completedTrades.length,
    openLongTrades: openTrades.filter((trade) => trade.direction === "long").length,
    openShortTrades: openTrades.filter((trade) => trade.direction === "short").length,
    completedLongTrades: completedTrades.filter((trade) => trade.direction === "long").length,
    completedShortTrades: completedTrades.filter((trade) => trade.direction === "short").length,
    winners: completedTrades.filter((trade) => (trade.realisedPnlUsd ?? 0) > 0).length,
    losers: completedTrades.filter((trade) => (trade.realisedPnlUsd ?? 0) < 0).length,
    targetHits,
    secondaryTargetHits,
    targetHitRatePct: completedTrades.length ? (targetHits / completedTrades.length) * 100 : null,
    realisedPnlUsd: realised.reduce((sum, value) => sum + value, 0),
    unrealisedPnlUsd: unrealised.reduce((sum, value) => sum + value, 0),
    combinedPnlUsd: [...realised, ...unrealised].reduce((sum, value) => sum + value, 0),
    averagePnlUsd: average(realised),
    averagePnlPct: average(realisedPct),
    averageHoldMinutes: average(holds),
    largestWinnerUsd: realised.length ? Math.max(...realised) : null,
    largestLoserUsd: realised.length ? Math.min(...realised) : null,
  };

  const versions = [rules.version, ...new Set(trades.map((trade) => trade.strategyVersion).filter((v) => v !== rules.version))];
  const strategyPerformance: PaperStrategyPerformance[] = versions.flatMap((version) => [
    buildStrategyPerformance(trades, "momentum", "long", version),
    buildStrategyPerformance(trades, "momentum", "short", version),
    buildStrategyPerformance(trades, "convergence", "long", version),
    buildStrategyPerformance(trades, "convergence", "short", version),
  ]).filter((row) => row.strategyVersion === rules.version || row.completedTrades > 0 || row.openTrades > 0);

  const allResearch = researchObservations
    .filter((row) => row.strategyVersion === rules.version)
    .flatMap((row) => row.researchCandidates ?? []);
  const groupKeys = new Set(allResearch.map((c) => `${c.kind}:${c.direction}`));
  const researchPerformance: PaperResearchGroup[] = Array.from(groupKeys).map((key) => {
    const [kind, direction] = key.split(":") as [PaperCandidateOutcome["kind"], PaperCandidateOutcome["direction"]];
    const matching = allResearch.filter((c) => c.kind === kind && c.direction === direction);
    const complete = matching.filter((c) => c.status === "complete");
    const terminals = complete.map((c) => c.terminalPct).filter((v): v is number => v !== null);
    return {
      kind, direction, tracked: matching.length, complete: complete.length,
      hit1Pct: complete.filter((c) => c.firstTargetAt !== null).length,
      hit12Pct: complete.filter((c) => c.secondaryTargetAt !== null).length,
      targetFirst: complete.filter((c) => c.firstTouch === "target").length,
      stoppedFirst: complete.filter((c) => c.firstTouch === "stop").length,
      averageTerminalPct: average(terminals),
      measured24h: matching.filter((c) => c.at24hPct !== null && c.at24hPct !== undefined).length,
      measured48h: matching.filter((c) => c.at48hPct !== null && c.at48hPct !== undefined).length,
      targetBy24h: matching.filter((c) => c.targetBy24h === true).length,
      targetBy48h: matching.filter((c) => c.targetBy48h === true).length,
      stopBy24h: matching.filter((c) => c.stopBy24h === true).length,
      stopBy48h: matching.filter((c) => c.stopBy48h === true).length,
      average24hPct: average(matching.map((c) => c.at24hPct).filter((v): v is number => v !== null && v !== undefined)),
      average48hPct: average(matching.map((c) => c.at48hPct).filter((v): v is number => v !== null && v !== undefined)),
    };
  }).sort((a, b) => b.tracked - a.tracked);

  return {
    generatedAt: Date.now(),
    rules,
    summary,
    strategyPerformance,
    researchPerformance,
    dailyIssuerRanges,
    latestObservations: latestObservations.filter((row) => row.strategyVersion === rules.version),
    discoveryObservations: discoveryObservations.filter((row) => row.strategyVersion === rules.version),
    openTrades,
    completedTrades: completedTrades.slice(0, 250),
  };
}
