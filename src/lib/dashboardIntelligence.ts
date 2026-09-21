import type {
  HistoryIssuerSnapshot,
  HistorySnapshot,
} from "@/types/history";

import type {
  DashboardActivityItem,
  DashboardIntelligenceResponse,
  DashboardIssuerChange,
  DashboardStockIntelligence,
} from "@/types/dashboardIntelligence";

const HOUR_MS = 60 * 60 * 1000;
const HALF_HOUR_MS = 30 * 60 * 1000;
const MIN_PERCENTILE_OBSERVATIONS = 8;
const UNUSUAL_PERCENTILE = 90;
const MIN_ACTIVITY_GAP_MOVE_PP = 0.25;
const MAX_ACTIVITY_ITEMS = 5;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function delta(
  current: number | null,
  previous: number | null
) {
  return finite(current) && finite(previous)
    ? current - previous
    : null;
}


function percentChange(
  current: number | null,
  previous: number | null
) {
  if (
    !finite(current) ||
    !finite(previous) ||
    previous === 0
  ) {
    return null;
  }

  return ((current / previous) - 1) * 100;
}

function percentileRankByMagnitude(
  current: number | null,
  history: number[]
) {
  if (!finite(current) || history.length < MIN_PERCENTILE_OBSERVATIONS) {
    return null;
  }

  const magnitude = Math.abs(current);
  const clean = history.filter(finite).map(Math.abs);

  if (clean.length < MIN_PERCENTILE_OBSERVATIONS) {
    return null;
  }

  const below = clean.filter((value) => value < magnitude).length;
  const equal = clean.filter((value) => value === magnitude).length;

  return ((below + equal * 0.5) / clean.length) * 100;
}

function percentileRank(
  current: number | null,
  history: number[]
) {
  if (!finite(current) || history.length < MIN_PERCENTILE_OBSERVATIONS) {
    return null;
  }

  const clean = history.filter(finite);

  if (clean.length < MIN_PERCENTILE_OBSERVATIONS) {
    return null;
  }

  const below = clean.filter((value) => value < current).length;
  const equal = clean.filter((value) => value === current).length;

  return ((below + equal * 0.5) / clean.length) * 100;
}

function issuerFrom(
  snapshot: HistorySnapshot | null,
  mint: string,
  issuerName: string
) {
  if (!snapshot) {
    return null;
  }

  return (
    snapshot.issuers.find((issuer) => issuer.mint === mint) ??
    snapshot.issuers.find((issuer) => issuer.issuer === issuerName) ??
    null
  );
}

function snapshotNear(
  history: HistorySnapshot[],
  targetTimestamp: number,
  toleranceMs: number
) {
  let best: HistorySnapshot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const snapshot of history) {
    const distance = Math.abs(
      snapshot.timestamp - targetTimestamp
    );

    if (distance < bestDistance) {
      best = snapshot;
      bestDistance = distance;
    }
  }

  return bestDistance <= toleranceMs
    ? best
    : null;
}

function tightestExecution(snapshot: HistorySnapshot | null) {
  if (!snapshot) {
    return {
      issuer: null as string | null,
      value: null as number | null,
    };
  }

  let bestIssuer: string | null = null;
  let bestValue: number | null = null;

  for (const issuer of snapshot.issuers) {
    const value = issuer.approxBreakEvenMovePct;

    if (!finite(value)) {
      continue;
    }

    if (bestValue === null || value < bestValue) {
      bestValue = value;
      bestIssuer = issuer.issuer;
    }
  }

  return {
    issuer: bestIssuer,
    value: bestValue,
  };
}

function allRoutesAvailable(snapshot: HistorySnapshot | null) {
  return Boolean(
    snapshot &&
      snapshot.issuers.length > 0 &&
      snapshot.issuers.every(
        (issuer) =>
          issuer.buy.status === "ok" && issuer.sell.status === "ok"
      )
  );
}

function pp(value: number) {
  return `${Math.abs(value).toFixed(2)} percentage point${
    Math.abs(value) === 1 ? "" : "s"
  }`;
}

function pct(value: number) {
  return `${value.toFixed(2)}%`;
}

function buildGapMoveActivity(
  ticker: string,
  current: HistoryIssuerSnapshot,
  hourAgo: HistoryIssuerSnapshot | null,
  observedAt: number
): DashboardActivityItem | null {
  const change = delta(current.buyGapPct, hourAgo?.buyGapPct ?? null);

  if (!finite(change) || Math.abs(change) < MIN_ACTIVITY_GAP_MOVE_PP) {
    return null;
  }

  const widened =
    finite(hourAgo?.buyGapPct) && finite(current.buyGapPct)
      ? Math.abs(current.buyGapPct) > Math.abs(hourAgo.buyGapPct)
      : false;

  return {
    id: `${ticker}:${current.mint}:gap-move:${observedAt}`,
    kind: "gap_move",
    ticker,
    issuer: current.issuer,
    headline: `${ticker} · ${current.issuer}`,
    detail: `Executable BUY gap ${widened ? "widened" : "narrowed"} ${pp(
      change
    )} in the last hour.`,
    observedAt,
    importance: Math.abs(change),
  };
}

function buildStockIntelligence(
  ticker: string,
  historyInput: HistorySnapshot[]
): {
  stock: DashboardStockIntelligence;
  activity: DashboardActivityItem[];
} {
  const history = [...historyInput].sort((a, b) => a.timestamp - b.timestamp);
  const latest = history[history.length - 1] ?? null;
  const previous = history[history.length - 2] ?? null;
  const oneHour = latest
    ? snapshotNear(
        history,
        latest.timestamp - HOUR_MS,
        HALF_HOUR_MS
      )
    : null;

  const currentTightest = tightestExecution(latest);
  const hourTightest = tightestExecution(oneHour);
  const currentAllRoutes = allRoutesAvailable(latest);
  const previousAllRoutes = allRoutesAvailable(previous);

  const issuers: Record<string, DashboardIssuerChange> = {};
  const activity: DashboardActivityItem[] = [];

  for (const current of latest?.issuers ?? []) {
    const previousIssuer = issuerFrom(previous, current.mint, current.issuer);
    const hourIssuer = issuerFrom(oneHour, current.mint, current.issuer);

    const buyGapHistory = history
      .map((snapshot) => issuerFrom(snapshot, current.mint, current.issuer)?.buyGapPct)
      .filter(finite);

    const sellGapHistory = history
      .map((snapshot) => issuerFrom(snapshot, current.mint, current.issuer)?.sellGapPct)
      .filter(finite);

    const breakEvenHistory = history
      .map(
        (snapshot) =>
          issuerFrom(snapshot, current.mint, current.issuer)
            ?.approxBreakEvenMovePct
      )
      .filter(finite);

    const liquidityHistory = history
      .map(
        (snapshot) =>
          issuerFrom(snapshot, current.mint, current.issuer)?.liquidityUsd
      )
      .filter(finite);

    const divergenceMagnitudePercentile = percentileRankByMagnitude(
      current.buyGapPct,
      buyGapHistory
    );

    const sellDivergenceMagnitudePercentile = percentileRankByMagnitude(
      current.sellGapPct,
      sellGapHistory
    );

    const breakEvenPercentile = percentileRank(
      current.approxBreakEvenMovePct,
      breakEvenHistory
    );

    const liquidityPercentile = percentileRank(
      current.liquidityUsd,
      liquidityHistory
    );

    const unusualGap =
      divergenceMagnitudePercentile !== null &&
      divergenceMagnitudePercentile >= UNUSUAL_PERCENTILE;

    const unusualSellGap =
      sellDivergenceMagnitudePercentile !== null &&
      sellDivergenceMagnitudePercentile >= UNUSUAL_PERCENTILE;

    const unusualFriction =
      breakEvenPercentile !== null &&
      breakEvenPercentile >= UNUSUAL_PERCENTILE;

    issuers[current.issuer] = {
      issuer: current.issuer,
      symbol: current.symbol,
      mint: current.mint,
      buyAvailable: current.buy.status === "ok",
      sellAvailable: current.sell.status === "ok",
      currentBuyGapPct: current.buyGapPct,
      currentSellGapPct: current.sellGapPct,
      currentBreakEvenPct: current.approxBreakEvenMovePct,
      currentLiquidityUsd: current.liquidityUsd,
      buyGapChangeSinceLastPctPoints: delta(
        current.buyGapPct,
        previousIssuer?.buyGapPct ?? null
      ),
      buyGapChange1hPctPoints: delta(
        current.buyGapPct,
        hourIssuer?.buyGapPct ?? null
      ),
      sellGapChangeSinceLastPctPoints: delta(
        current.sellGapPct,
        previousIssuer?.sellGapPct ?? null
      ),
      sellGapChange1hPctPoints: delta(
        current.sellGapPct,
        hourIssuer?.sellGapPct ?? null
      ),
      breakEvenChangeSinceLastPctPoints: delta(
        current.approxBreakEvenMovePct,
        previousIssuer?.approxBreakEvenMovePct ?? null
      ),
      liquidityChangeSinceLastPct: percentChange(
        current.liquidityUsd,
        previousIssuer?.liquidityUsd ?? null
      ),
      divergenceMagnitudePercentile,
      sellDivergenceMagnitudePercentile,
      breakEvenPercentile,
      liquidityPercentile,
      unusualGap,
      unusualSellGap,
      unusualFriction,
    };

    const gapMove = buildGapMoveActivity(
      ticker,
      current,
      hourIssuer,
      latest?.timestamp ?? Date.now()
    );

    if (gapMove) {
      activity.push(gapMove);
    }

    if (unusualGap && finite(current.buyGapPct)) {
      activity.push({
        id: `${ticker}:${current.mint}:unusual-gap:${latest?.timestamp ?? 0}`,
        kind: "unusual_gap",
        ticker,
        issuer: current.issuer,
        headline: `${ticker} · ${current.issuer}`,
        detail: `Current executable BUY gap of ${pct(
          current.buyGapPct
        )} is around the ${divergenceMagnitudePercentile!.toFixed(
          0
        )}th percentile of its recorded history.`,
        observedAt: latest?.timestamp ?? Date.now(),
        importance: 1 + divergenceMagnitudePercentile! / 100,
      });
    }
  }

  if (
    latest &&
    oneHour &&
    currentTightest.issuer &&
    hourTightest.issuer &&
    currentTightest.issuer !== hourTightest.issuer
  ) {
    activity.push({
      id: `${ticker}:tightest:${latest.timestamp}`,
      kind: "tightest_execution_changed",
      ticker,
      issuer: currentTightest.issuer,
      headline: `${ticker} · ${currentTightest.issuer}`,
      detail: `${currentTightest.issuer} moved from behind ${hourTightest.issuer} to the tightest quoted $1K round-trip execution.`,
      observedAt: latest.timestamp,
      importance: 1.5,
    });
  }

  if (latest && currentAllRoutes && previous && !previousAllRoutes) {
    activity.push({
      id: `${ticker}:all-routes:${latest.timestamp}`,
      kind: "all_routes_available",
      ticker,
      issuer: null,
      headline: ticker,
      detail: `All ${latest.issuers.length} tracked issuers now have executable $1K BUY and SELL routes.`,
      observedAt: latest.timestamp,
      importance: 1.25,
    });
  }

  return {
    stock: {
      ticker,
      stockName: latest?.stockName ?? ticker,
      snapshotCount: history.length,
      latestSnapshotAt: latest?.timestamp ?? null,
      previousSnapshotAt: previous?.timestamp ?? null,
      comparison1hAt: oneHour?.timestamp ?? null,
      allIssuerRoutesAvailable: currentAllRoutes,
      unusualNow: Object.values(issuers).some(
        (issuer) => issuer.unusualGap || issuer.unusualFriction
      ),
      tightestExecutionIssuer: currentTightest.issuer,
      tightestExecutionPct: currentTightest.value,
      issuers,
    },
    activity,
  };
}

export function buildDashboardIntelligence(
  histories: Record<string, HistorySnapshot[]>
): DashboardIntelligenceResponse {
  const stocks: Record<string, DashboardStockIntelligence> = {};
  const activity: DashboardActivityItem[] = [];
  let latestSnapshotAt: number | null = null;

  for (const [ticker, history] of Object.entries(histories)) {
    const built = buildStockIntelligence(ticker, history);
    stocks[ticker] = built.stock;
    activity.push(...built.activity);

    if (
      built.stock.latestSnapshotAt !== null &&
      (latestSnapshotAt === null ||
        built.stock.latestSnapshotAt > latestSnapshotAt)
    ) {
      latestSnapshotAt = built.stock.latestSnapshotAt;
    }
  }

  const dedupedByTicker = new Map<string, DashboardActivityItem[]>();

  for (const item of activity) {
    const items = dedupedByTicker.get(item.ticker) ?? [];
    items.push(item);
    dedupedByTicker.set(item.ticker, items);
  }

  const balanced = Array.from(dedupedByTicker.values())
    .map((items) =>
      items.sort(
        (left, right) =>
          right.importance - left.importance ||
          right.observedAt - left.observedAt
      )[0]
    )
    .sort(
      (left, right) =>
        right.importance - left.importance ||
        right.observedAt - left.observedAt
    )
    .slice(0, MAX_ACTIVITY_ITEMS);

  return {
    generatedAt: new Date().toISOString(),
    latestSnapshotAt,
    activity: balanced,
    stocks,
  };
}
