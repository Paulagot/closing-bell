export const OCTOBER_COMPETITION_SLUG =
  "october-divergence-2026";

export const OCTOBER_COMPETITION_ID =
  "closing-bell-october-2026";

export const COMPETITION_SIZE_USD =
  1000;

export const COMPETITION_SETTLEMENT_WINDOW_MS =
  20 * 60 * 1000;

export const COMPETITION_LOCK_BEFORE_SETTLEMENT_MS =
  60 * 60 * 1000;

export const COMPETITION_MAX_SOURCE_AGE_MS =
  45 * 60 * 1000;

export const COMPETITION_POINTS_PER_CORRECT_CALL =
  100;

export const COMPETITION_NEAR_BENCHMARK_PCT =
  0.5;

export const COMPETITION_MIN_GAP_FOR_QUESTION_PCT =
  0.5;

export const COMPETITION_MIN_GAP_FOR_CONVERGENCE_QUESTION_PCT =
  0.75;

export const COMPETITION_MIN_ISSUER_SPREAD_PCT =
  0.25;

export function competitionPreviewMode() {
  return (
    process.env
      .COMPETITION_PREVIEW_MODE ===
    "true"
  );
}
