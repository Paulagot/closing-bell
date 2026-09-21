import type { PaperStrategyRules } from "@/types/paperLab";

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalEnvNumber(name: string) {
  const raw = process.env[name];
  if (!raw || raw.trim().toLowerCase() === "off" || raw.trim().toLowerCase() === "disabled") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function envBoolean(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const normalised = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalised)) return true;
  if (["0", "false", "no", "off"].includes(normalised)) return false;
  return fallback;
}

export function getPaperStrategyRules(): PaperStrategyRules {
  const legacyDailyCap = Math.max(1, Math.round(envNumber("PAPER_MAX_NEW_TRADES_PER_DAY", 4)));
  const trendSteps = Math.max(2, Math.round(envNumber("PAPER_MOMENTUM_TREND_STEPS", 3)));

  return {
    version: process.env.PAPER_STRATEGY_VERSION || "v4.4-1000-daily-range-research",
    notionalUsd: envNumber("PAPER_TRADE_NOTIONAL_USD", 1000),
    targetPct: envNumber("PAPER_TARGET_PCT", 1),
    secondaryTargetPct: Math.max(0, envNumber("PAPER_SECONDARY_TARGET_PCT", 1.2)),
    maxQuoteImpactPct: Math.max(0, envNumber("PAPER_MAX_QUOTE_IMPACT_PCT", 1)),
    stopPct: process.env.PAPER_STOP_PCT === undefined ? -1.5 : optionalEnvNumber("PAPER_STOP_PCT"),
    maxHoldHours: envNumber("PAPER_MAX_HOLD_HOURS", 24),
    maxNewLongTradesPerDay: Math.max(1, Math.round(envNumber("PAPER_MAX_NEW_LONG_TRADES_PER_DAY", legacyDailyCap))),
    maxNewShortTradesPerDay: Math.max(1, Math.round(envNumber("PAPER_MAX_NEW_SHORT_TRADES_PER_DAY", legacyDailyCap))),
    minPersistentCaptures: Math.max(1, Math.round(envNumber("PAPER_MIN_PERSISTENT_CAPTURES", 2))),
    minLiquidityUsd: Math.max(0, envNumber("PAPER_MIN_LIQUIDITY_USD", 20000)),
    cooldownHours: Math.max(0, envNumber("PAPER_SIGNAL_COOLDOWN_HOURS", 24)),
    requireMarketOpenForEntries: envBoolean("PAPER_REQUIRE_MARKET_OPEN", true),
    momentumRequireMarketOpen: envBoolean("PAPER_MOMENTUM_REQUIRE_MARKET_OPEN", false),
    momentumLookbackCaptures: Math.max(2, Math.round(envNumber("PAPER_MOMENTUM_LOOKBACK_CAPTURES", 4))),
    momentumTrendSteps: trendSteps,
    momentumMinAlignedSteps: Math.min(
      trendSteps,
      Math.max(1, Math.round(envNumber("PAPER_MOMENTUM_MIN_ALIGNED_STEPS", 2)))
    ),
    momentumMaxBreakEvenPct: Math.max(0, envNumber("PAPER_MOMENTUM_MAX_BREAK_EVEN_PCT", 1)),
  };
}
