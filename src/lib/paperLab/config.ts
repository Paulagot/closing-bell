import type { PaperStrategyRules } from "@/types/paperLab";

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalEnvNumber(name: string) {
  const raw = process.env[name];

  if (
    !raw ||
    raw.trim().toLowerCase() === "off" ||
    raw.trim().toLowerCase() === "disabled"
  ) {
    return null;
  }

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
  /**
   * V5 default is six NEW longs per strategy per UTC day.
   * PAPER_MAX_NEW_TRADES_PER_DAY is retained as a legacy fallback.
   */
  const legacyDailyCap = Math.max(
    1,
    Math.round(envNumber("PAPER_MAX_NEW_TRADES_PER_DAY", 6))
  );

  const trendSteps = Math.max(
    2,
    Math.round(envNumber("PAPER_MOMENTUM_TREND_STEPS", 3))
  );

  return {
    version:
      process.env.PAPER_STRATEGY_VERSION ||
      "v5.0-parallel-long-research",

    notionalUsd: envNumber("PAPER_TRADE_NOTIONAL_USD", 1000),

    targetPct: envNumber("PAPER_TARGET_PCT", 1),

    secondaryTargetPct: Math.max(
      0,
      envNumber("PAPER_SECONDARY_TARGET_PCT", 1.2)
    ),

    maxQuoteImpactPct: Math.max(
      0,
      envNumber("PAPER_MAX_QUOTE_IMPACT_PCT", 1)
    ),

    stopPct:
      process.env.PAPER_STOP_PCT === undefined
        ? -1.5
        : optionalEnvNumber("PAPER_STOP_PCT"),

    maxHoldHours: Math.max(
      0,
      envNumber("PAPER_MAX_HOLD_HOURS", 24)
    ),

    /**
     * IMPORTANT:
     * The engine applies this cap independently to:
     *   - extreme_momentum
     *   - discount_recovery
     *   - wrapper_lag
     */
    maxNewLongTradesPerDay: Math.max(
      1,
      Math.round(
        envNumber(
          "PAPER_MAX_NEW_LONG_TRADES_PER_DAY",
          legacyDailyCap
        )
      )
    ),

    /**
     * Retained for historical data/config compatibility only.
     * V5 never admits a new short trade.
     */
    maxNewShortTradesPerDay: Math.max(
      0,
      Math.round(
        envNumber(
          "PAPER_MAX_NEW_SHORT_TRADES_PER_DAY",
          0
        )
      )
    ),

    minPersistentCaptures: Math.max(
      1,
      Math.round(envNumber("PAPER_MIN_PERSISTENT_CAPTURES", 2))
    ),

    minLiquidityUsd: Math.max(
      0,
      envNumber("PAPER_MIN_LIQUIDITY_USD", 20000)
    ),

    cooldownHours: Math.max(
      0,
      envNumber("PAPER_SIGNAL_COOLDOWN_HOURS", 24)
    ),

    /**
     * Legacy convergence/momentum research settings are retained
     * so existing observation fields and old dashboard logic remain usable.
     * These two legacy strategies no longer open new trades in V5.
     */
    requireMarketOpenForEntries: envBoolean(
      "PAPER_REQUIRE_MARKET_OPEN",
      true
    ),

    momentumRequireMarketOpen: envBoolean(
      "PAPER_MOMENTUM_REQUIRE_MARKET_OPEN",
      false
    ),

    momentumLookbackCaptures: Math.max(
      2,
      Math.round(
        envNumber("PAPER_MOMENTUM_LOOKBACK_CAPTURES", 4)
      )
    ),

    momentumTrendSteps: trendSteps,

    momentumMinAlignedSteps: Math.min(
      trendSteps,
      Math.max(
        1,
        Math.round(
          envNumber("PAPER_MOMENTUM_MIN_ALIGNED_STEPS", 2)
        )
      )
    ),

    momentumMaxBreakEvenPct: Math.max(
      0,
      envNumber("PAPER_MOMENTUM_MAX_BREAK_EVEN_PCT", 1)
    ),

    /**
     * V5 Strategy A — Extreme Momentum
     * Backtest research starting point:
     *   2h wrapper move >= +1.5%
     *   break-even <= 0.30%
     */
    extremeMomentumMin2hPct: envNumber(
      "PAPER_EXTREME_MOMENTUM_MIN_2H_PCT",
      1.5
    ),

    extremeMomentumMaxBreakEvenPct: Math.max(
      0,
      envNumber(
        "PAPER_EXTREME_MOMENTUM_MAX_BREAK_EVEN_PCT",
        0.3
      )
    ),

    /**
     * V5 Strategy B — Discount Recovery
     * Starting point:
     *   current BUY gap <= -1.0%
     *   negative gap narrows >= 0.75 percentage points in ~1h
     *   break-even <= 0.60%
     */
    discountRecoveryMaxBuyGapPct: envNumber(
      "PAPER_DISCOUNT_RECOVERY_MAX_BUY_GAP_PCT",
      -1
    ),

    discountRecoveryMinNarrowing1hPct: Math.max(
      0,
      envNumber(
        "PAPER_DISCOUNT_RECOVERY_MIN_NARROWING_1H_PCT",
        0.75
      )
    ),

    discountRecoveryMaxBreakEvenPct: Math.max(
      0,
      envNumber(
        "PAPER_DISCOUNT_RECOVERY_MAX_BREAK_EVEN_PCT",
        0.6
      )
    ),

    /**
     * V5 Strategy C — Wrapper Lag
     * Starting point:
     *   wrapper 1h return - benchmark 1h return <= -1.0pp
     *   break-even <= 0.20%
     */
    wrapperLagMaxLag1hPct: envNumber(
      "PAPER_WRAPPER_LAG_MAX_1H_PCT",
      -1
    ),

    wrapperLagMaxBreakEvenPct: Math.max(
      0,
      envNumber(
        "PAPER_WRAPPER_LAG_MAX_BREAK_EVEN_PCT",
        0.2
      )
    ),

    /**
     * V5 Strategy D — Pre-open Drift Reversal (LONG only)
     * Prospective research starting point:
     *   08:30–09:15 America/New_York
     *   current BUY gap <= -0.50% versus the last available stock reference
     *   break-even <= 0.35%
     *
     * No ticker whitelist is applied prospectively.
     */
    driftReversalMaxBuyGapPct: envNumber(
      "PAPER_DRIFT_REVERSAL_MAX_BUY_GAP_PCT",
      -0.5
    ),

    driftReversalMaxBreakEvenPct: Math.max(
      0,
      envNumber(
        "PAPER_DRIFT_REVERSAL_MAX_BREAK_EVEN_PCT",
        0.35
      )
    ),

    driftReversalStartMinutesEt: Math.max(
      0,
      Math.min(
        1439,
        Math.round(
          envNumber(
            "PAPER_DRIFT_REVERSAL_START_MINUTES_ET",
            8 * 60 + 30
          )
        )
      )
    ),

    driftReversalEndMinutesEt: Math.max(
      0,
      Math.min(
        1439,
        Math.round(
          envNumber(
            "PAPER_DRIFT_REVERSAL_END_MINUTES_ET",
            9 * 60 + 15
          )
        )
      )
    ),
  };
}

