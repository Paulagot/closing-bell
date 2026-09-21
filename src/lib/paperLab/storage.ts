import { promises as fs } from "fs";
import path from "path";
import type { PaperCandidateOutcome, PaperLabObservation, PaperTrade } from "@/types/paperLab";

const MAX_OBSERVATIONS_PER_TICKER = 60 * 24 * 45 / 15 * 8;
const MAX_COMPLETED_TRADES = 5000;
let writeQueue: Promise<unknown> = Promise.resolve();

function labDirectory() {
  return process.env.LAB_DATA_DIR ?? path.join(process.cwd(), "data", "lab");
}

function observationsDirectory() {
  return path.join(labDirectory(), "observations");
}

function tradesPath() {
  return path.join(labDirectory(), "paper-trades.json");
}

function safeTicker(ticker: string) {
  return ticker.toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

function observationPath(ticker: string) {
  return path.join(observationsDirectory(), `${safeTicker(ticker)}.json`);
}

async function ensureDirectories() {
  await fs.mkdir(observationsDirectory(), { recursive: true });
}

async function atomicWrite(file: string, value: unknown) {
  await ensureDirectories();
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(temporary, file);
}

export async function readPaperObservations(ticker: string): Promise<PaperLabObservation[]> {
  await ensureDirectories();
  try {
    const parsed = JSON.parse(await fs.readFile(observationPath(ticker), "utf8"));
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((row) => row && typeof row.timestamp === "number")
      .map((row) => ({
        ...row,
        version: 3,
        longTheoreticalConvergencePct:
          row.longTheoreticalConvergencePct ?? row.theoreticalConvergencePct ?? null,
        shortTheoreticalConvergencePct:
          row.shortTheoreticalConvergencePct ?? null,
        longRawEligible:
          row.longRawEligible ?? row.rawEligible ?? false,
        longPersistentCaptures:
          row.longPersistentCaptures ?? row.persistentCaptures ?? 0,
        longSignalStatus:
          row.longSignalStatus ?? row.signalStatus ?? "no_setup",
        longSignalReasons:
          Array.isArray(row.longSignalReasons)
            ? row.longSignalReasons
            : Array.isArray(row.signalReasons)
              ? row.signalReasons
              : [],
        shortRawEligible:
          row.shortRawEligible ?? false,
        shortPersistentCaptures:
          row.shortPersistentCaptures ?? 0,
        shortSignalStatus:
          row.shortSignalStatus ?? "no_setup",
        shortSignalReasons:
          Array.isArray(row.shortSignalReasons) ? row.shortSignalReasons : [],
        momentum: {
          wrapperMidPrice: row.momentum?.wrapperMidPrice ?? null,
          wrapperMove15mPct: row.momentum?.wrapperMove15mPct ?? null,
          wrapperMove1hPct: row.momentum?.wrapperMove1hPct ?? null,
          wrapperMove2hPct: row.momentum?.wrapperMove2hPct ?? null,
          benchmarkMove15mPct: row.momentum?.benchmarkMove15mPct ?? null,
          benchmarkMove1hPct: row.momentum?.benchmarkMove1hPct ?? null,
          benchmarkMove2hPct: row.momentum?.benchmarkMove2hPct ?? null,
          wrapperPositiveSteps: row.momentum?.wrapperPositiveSteps ?? 0,
          wrapperNegativeSteps: row.momentum?.wrapperNegativeSteps ?? 0,
          benchmarkPositiveSteps: row.momentum?.benchmarkPositiveSteps ?? 0,
          benchmarkNegativeSteps: row.momentum?.benchmarkNegativeSteps ?? 0,
          trendStepsAvailable: row.momentum?.trendStepsAvailable ?? 0,
          wrapperTrendStepsAvailable: row.momentum?.wrapperTrendStepsAvailable ?? row.momentum?.trendStepsAvailable ?? 0,
        },
        discovery: row.discovery ?? {gapCross: null, gapReferenceFresh: false, gapReversal: null, wrapperTurn: null, frictionChangePct: null, events: []},
        momentumLongRawEligible: row.momentumLongRawEligible ?? false,
        momentumLongPersistentCaptures: row.momentumLongPersistentCaptures ?? 0,
        momentumLongSignalStatus: row.momentumLongSignalStatus ?? "no_setup",
        momentumLongSignalReasons: Array.isArray(row.momentumLongSignalReasons) ? row.momentumLongSignalReasons : [],
        momentumShortRawEligible: row.momentumShortRawEligible ?? false,
        momentumShortPersistentCaptures: row.momentumShortPersistentCaptures ?? 0,
        momentumShortSignalStatus: row.momentumShortSignalStatus ?? "no_setup",
        momentumShortSignalReasons: Array.isArray(row.momentumShortSignalReasons) ? row.momentumShortSignalReasons : [],
      })) as PaperLabObservation[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function appendPaperObservations(
  ticker: string,
  rows: PaperLabObservation[]
): Promise<void> {
  if (!rows.length) return;
  const task = writeQueue.then(async () => {
    const existing = await readPaperObservations(ticker);
    const ids = new Set(existing.map((row) => row.id));
    const merged = [...existing, ...rows.filter((row) => !ids.has(row.id))]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-MAX_OBSERVATIONS_PER_TICKER);
    await atomicWrite(observationPath(ticker), merged);
  });
  writeQueue = task.catch(() => undefined);
  await task;
}

/** Update only the new version's already-recorded research candidates. No old
 * observations/trades are rewritten or retroactively invented. */
export async function updatePaperCandidateOutcomes(
  ticker: string,
  outcomes: Map<string, PaperCandidateOutcome[]>
): Promise<void> {
  if (!outcomes.size) return;
  const task = writeQueue.then(async () => {
    const rows = await readPaperObservations(ticker);
    let changed = false;
    for (const row of rows) {
      const next = outcomes.get(row.id);
      if (!next) continue;
      row.researchCandidates = next;
      changed = true;
    }
    if (changed) await atomicWrite(observationPath(ticker), rows);
  });
  writeQueue = task.catch(() => undefined);
  await task;
}

export async function recentPaperResearchObservations(limit = 30000): Promise<PaperLabObservation[]> {
  const minimumTimestamp = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await ensureDirectories();
  const files = await fs.readdir(observationsDirectory()).catch(() => [] as string[]);
  const rows: PaperLabObservation[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const recent = await readPaperObservations(file.slice(0, -5));
    rows.push(...recent.filter((row) => row.timestamp >= minimumTimestamp && (row.researchCandidates?.length ?? 0) > 0).slice(-limit));
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export async function readPaperTrades(): Promise<PaperTrade[]> {
  await ensureDirectories();
  await writeQueue.catch(() => undefined);
  try {
    const parsed = JSON.parse(await fs.readFile(tradesPath(), "utf8"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((trade) => {
      const rules = trade?.strategyRules ?? {};
      const legacyCap = Number.isFinite(rules.maxNewTradesPerDay)
        ? rules.maxNewTradesPerDay
        : 4;
      return {
        ...trade,
        version: 3,
        strategyType: trade?.strategyType === "momentum" ? "momentum" : "convergence",
        direction: trade?.direction === "short" ? "short" : "long",
        entryMomentum: trade?.entryMomentum ?? null,
        strategyRules: {
          ...rules,
          maxNewLongTradesPerDay:
            Number.isFinite(rules.maxNewLongTradesPerDay)
              ? rules.maxNewLongTradesPerDay
              : legacyCap,
          maxNewShortTradesPerDay:
            Number.isFinite(rules.maxNewShortTradesPerDay)
              ? rules.maxNewShortTradesPerDay
              : legacyCap,
          requireMarketOpenForEntries:
            typeof rules.requireMarketOpenForEntries === "boolean"
              ? rules.requireMarketOpenForEntries
              : false,
          momentumRequireMarketOpen: typeof rules.momentumRequireMarketOpen === "boolean" ? rules.momentumRequireMarketOpen : true,
          momentumLookbackCaptures:
            Number.isFinite(rules.momentumLookbackCaptures) ? rules.momentumLookbackCaptures : 4,
          momentumTrendSteps:
            Number.isFinite(rules.momentumTrendSteps) ? rules.momentumTrendSteps : 3,
          momentumMinAlignedSteps:
            Number.isFinite(rules.momentumMinAlignedSteps) ? rules.momentumMinAlignedSteps : 2,
          momentumMaxBreakEvenPct:
            Number.isFinite(rules.momentumMaxBreakEvenPct) ? rules.momentumMaxBreakEvenPct : 1,
        },
      };
    }) as PaperTrade[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function writePaperTrades(trades: PaperTrade[]): Promise<void> {
  const task = writeQueue.then(async () => {
    const open = trades.filter((trade) => trade.status === "open");
    const closed = trades
      .filter((trade) => trade.status === "closed")
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, MAX_COMPLETED_TRADES);
    await atomicWrite(tradesPath(), [...open, ...closed]);
  });
  writeQueue = task.catch(() => undefined);
  await task;
}

export async function latestPaperObservations(): Promise<PaperLabObservation[]> {
  await ensureDirectories();
  const files = await fs.readdir(observationsDirectory()).catch(() => [] as string[]);
  const result: PaperLabObservation[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const ticker = file.slice(0, -5);
    const rows = await readPaperObservations(ticker);
    const latestByIssuer = new Map<string, PaperLabObservation>();
    for (const row of rows) latestByIssuer.set(row.issuer, row);
    result.push(...latestByIssuer.values());
  }
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

/** Read a bounded recent discovery event feed, not just each issuer's latest row. */
export async function recentPaperDiscoveryObservations(limit = 60): Promise<PaperLabObservation[]> {
  await ensureDirectories();
  const files = await fs.readdir(observationsDirectory()).catch(() => [] as string[]);
  const observations: PaperLabObservation[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const rows = await readPaperObservations(file.slice(0, -5));
    observations.push(...rows.filter((row) => (row.discovery?.events?.length ?? 0) > 0).slice(-limit));
  }
  return observations.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}
