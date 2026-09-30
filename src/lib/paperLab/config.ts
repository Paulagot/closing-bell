import type { PaperStrategyRules } from "@/types/paperLab";

function envNumber(name: string, fallback: number) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
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

  return Number.isFinite(parsed)
    ? parsed
    : null;
}

function envBoolean(name: string, fallback: boolean) {
  const raw = process.env[name];

  if (!raw) {
    return fallback;
  }

  const normalised = raw
    .trim()
    .toLowerCase();

  if (
    ["1", "true", "yes", "on"].includes(normalised)
  ) {
    return true;
  }

  if (
    ["0", "false", "no", "off"].includes(normalised)
  ) {
    return false;
  }

  return fallback;
}

function clampMinuteOfDay(value: number) {
  return Math.max(
    0,
    Math.min(
      1439,
      Math.round(value)
    )
  );
}

function minutesToClock(minutes: number) {
  const safeMinutes =
    clampMinuteOfDay(minutes);

  const hours =
    Math.floor(
      safeMinutes / 60
    );

  const mins =
    safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function getPaperStrategyRules(): PaperStrategyRules {
  /**
   * V5 default is six NEW longs
   * per strategy per UTC day.
   *
   * PAPER_MAX_NEW_TRADES_PER_DAY
   * remains as the legacy fallback.
   */
  const legacyDailyCap =
    Math.max(
      1,
      Math.round(
        envNumber(
          "PAPER_MAX_NEW_TRADES_PER_DAY",
          6
        )
      )
    );

  const trendSteps =
    Math.max(
      2,
      Math.round(
        envNumber(
          "PAPER_MOMENTUM_TREND_STEPS",
          3
        )
      )
    );

  /**
   * Drift Reversal uses numeric minutes
   * internally in the engine.
   *
   * Defaults:
   * 08:30 New York = 510 minutes
   * 09:15 New York = 555 minutes
   */
  const driftReversalStartMinutesEt =
    clampMinuteOfDay(
      envNumber(
        "PAPER_DRIFT_REVERSAL_START_MINUTES_ET",
        8 * 60 + 30
      )
    );

  const driftReversalEndMinutesEt =
    clampMinuteOfDay(
      envNumber(
        "PAPER_DRIFT_REVERSAL_END_MINUTES_ET",
        9 * 60 + 15
      )
    );

  return {
    version:
      process.env.PAPER_STRATEGY_VERSION ||
      "v5.0-parallel-long-research",

    notionalUsd:
      envNumber(
        "PAPER_TRADE_NOTIONAL_USD",
        1000
      ),

    targetPct:
      envNumber(
        "PAPER_TARGET_PCT",
        1
      ),

    secondaryTargetPct:
      Math.max(
        0,
        envNumber(
          "PAPER_SECONDARY_TARGET_PCT",
          1.2
        )
      ),

    maxQuoteImpactPct:
      Math.max(
        0,
        envNumber(
          "PAPER_MAX_QUOTE_IMPACT_PCT",
          1
        )
      ),

    stopPct:
      process.env.PAPER_STOP_PCT === undefined
        ? -1.5
        : optionalEnvNumber(
            "PAPER_STOP_PCT"
          ),

    maxHoldHours:
      Math.max(
        0,
        envNumber(
          "PAPER_MAX_HOLD_HOURS",
          24
        )
      ),

    /**
     * Applied independently to:
     * - extreme_momentum
     * - discount_recovery
     * - wrapper_lag
     * - drift_reversal
     */
    maxNewLongTradesPerDay:
      Math.max(
        1,
        Math.round(
          envNumber(
            "PAPER_MAX_NEW_LONG_TRADES_PER_DAY",
            legacyDailyCap
          )
        )
      ),

    /**
     * Retained only for historical
     * compatibility.
     *
     * V5 opens no new shorts.
     */
    maxNewShortTradesPerDay:
      Math.max(
        0,
        Math.round(
          envNumber(
            "PAPER_MAX_NEW_SHORT_TRADES_PER_DAY",
            0
          )
        )
      ),

    minPersistentCaptures:
      Math.max(
        1,
        Math.round(
          envNumber(
            "PAPER_MIN_PERSISTENT_CAPTURES",
            2
          )
        )
      ),

    minLiquidityUsd:
      Math.max(
        0,
        envNumber(
          "PAPER_MIN_LIQUIDITY_USD",
          20000
        )
      ),

    cooldownHours:
      Math.max(
        0,
        envNumber(
          "PAPER_SIGNAL_COOLDOWN_HOURS",
          24
        )
      ),

    /**
     * Legacy convergence/momentum
     * research settings.
     *
     * These no longer create V5 trades.
     */
    requireMarketOpenForEntries:
      envBoolean(
        "PAPER_REQUIRE_MARKET_OPEN",
        true
      ),

    momentumRequireMarketOpen:
      envBoolean(
        "PAPER_MOMENTUM_REQUIRE_MARKET_OPEN",
        false
      ),

    momentumLookbackCaptures:
      Math.max(
        2,
        Math.round(
          envNumber(
            "PAPER_MOMENTUM_LOOKBACK_CAPTURES",
            4
          )
        )
      ),

    momentumTrendSteps:
      trendSteps,

    momentumMinAlignedSteps:
      Math.min(
        trendSteps,
        Math.max(
          1,
          Math.round(
            envNumber(
              "PAPER_MOMENTUM_MIN_ALIGNED_STEPS",
              2
            )
          )
        )
      ),

    momentumMaxBreakEvenPct:
      Math.max(
        0,
        envNumber(
          "PAPER_MOMENTUM_MAX_BREAK_EVEN_PCT",
          1
        )
      ),

    /**
     * Strategy A
     * Extreme Momentum
     *
     * 2h wrapper move >= +1.50%
     * break-even <= 0.30%
     */
    extremeMomentumMin2hPct:
      envNumber(
        "PAPER_EXTREME_MOMENTUM_MIN_2H_PCT",
        1.5
      ),

    extremeMomentumMaxBreakEvenPct:
      Math.max(
        0,
        envNumber(
          "PAPER_EXTREME_MOMENTUM_MAX_BREAK_EVEN_PCT",
          0.3
        )
      ),

    /**
     * Strategy B
     * Discount Recovery
     *
     * BUY gap <= -1.00%
     * narrows >= 0.75pp over ~1h
     * break-even <= 0.60%
     */
    discountRecoveryMaxBuyGapPct:
      envNumber(
        "PAPER_DISCOUNT_RECOVERY_MAX_BUY_GAP_PCT",
        -1
      ),

    discountRecoveryMinNarrowing1hPct:
      Math.max(
        0,
        envNumber(
          "PAPER_DISCOUNT_RECOVERY_MIN_NARROWING_1H_PCT",
          0.75
        )
      ),

    discountRecoveryMaxBreakEvenPct:
      Math.max(
        0,
        envNumber(
          "PAPER_DISCOUNT_RECOVERY_MAX_BREAK_EVEN_PCT",
          0.6
        )
      ),

    /**
     * Strategy C
     * Wrapper Lag
     *
     * wrapper 1h return
     * minus benchmark 1h return
     * <= -1.00pp
     *
     * break-even <= 0.20%
     */
    wrapperLagMaxLag1hPct:
      envNumber(
        "PAPER_WRAPPER_LAG_MAX_1H_PCT",
        -1
      ),

    wrapperLagMaxBreakEvenPct:
      Math.max(
        0,
        envNumber(
          "PAPER_WRAPPER_LAG_MAX_BREAK_EVEN_PCT",
          0.2
        )
      ),

    /**
     * Strategy D
     * Pre-open Drift Reversal
     *
     * LONG only
     *
     * 08:30–09:15 America/New_York
     * BUY gap <= -0.50%
     * break-even <= 0.35%
     *
     * No ticker whitelist.
     */
    driftReversalMaxBuyGapPct:
      envNumber(
        "PAPER_DRIFT_REVERSAL_MAX_BUY_GAP_PCT",
        -0.5
      ),

    driftReversalMaxBreakEvenPct:
      Math.max(
        0,
        envNumber(
          "PAPER_DRIFT_REVERSAL_MAX_BREAK_EVEN_PCT",
          0.35
        )
      ),

    /**
     * Numeric versions used by the engine.
     */
    driftReversalStartMinutesEt,
    driftReversalEndMinutesEt,

    /**
     * Display versions used by the dashboard.
     */
    driftReversalWindowStartEt:
      minutesToClock(
        driftReversalStartMinutesEt
      ),

    driftReversalWindowEndEt:
      minutesToClock(
        driftReversalEndMinutesEt
      ),
  };
}

