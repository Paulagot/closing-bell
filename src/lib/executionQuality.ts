import type { ExecutionQuote } from "@/types";

export type ExecutionQuality =
  | "good"
  | "fair"
  | "poor"
  | "not_viable"
  | "unavailable";

export interface ExecutionQualityResult {
  quality: ExecutionQuality;
  label: string;
  shortLabel: string;
  explanation: string | null;
}

/**
 * Closing Bell execution-quality classification.
 *
 * We consider both:
 * - execution cost vs the issuer midpoint
 * - Jupiter-reported price impact
 *
 * These thresholds are intentionally conservative.
 * We can tune them later once we have historical data.
 */
export function getExecutionQuality(
  quote: ExecutionQuote
): ExecutionQualityResult {
  if (quote.status !== "ok") {
    return {
      quality: "unavailable",
      label: "Execution unavailable",
      shortLabel: "Unavailable",
      explanation:
        quote.error ??
        "No executable route is currently available.",
    };
  }

  const executionCost =
    Math.abs(
      quote.executionCostPct ?? 0
    );

  const priceImpact =
    Math.abs(
      quote.priceImpactPct ?? 0
    );

  /**
   * Extreme execution.
   *
   * At this point the quoted route should not be
   * presented as a normal executable market price.
   */
  if (
    executionCost >= 10 ||
    priceImpact >= 10
  ) {
    return {
      quality: "not_viable",
      label: "Not viable at this size",
      shortLabel: "Not viable",
      explanation:
        "Available on-chain liquidity is too shallow for this order size. " +
        "The token's indicative midpoint may still be normal, but executing " +
        "this trade through the available route would move the market substantially.",
    };
  }

  if (
    executionCost >= 3 ||
    priceImpact >= 3
  ) {
    return {
      quality: "poor",
      label: "Poor liquidity",
      shortLabel: "Poor",
      explanation:
        "The available route has limited liquidity for this order size, " +
        "so the executable price is materially worse than the indicative midpoint.",
    };
  }

  if (
    executionCost >= 1 ||
    priceImpact >= 1
  ) {
    return {
      quality: "fair",
      label: "Fair execution",
      shortLabel: "Fair",
      explanation:
        "Execution is available, but this order causes a noticeable difference " +
        "from the token's indicative midpoint.",
    };
  }

  return {
    quality: "good",
    label: "Good execution",
    shortLabel: "Good",
    explanation: null,
  };
}

export function executionQualityClasses(
  quality: ExecutionQuality
): {
  card: string;
  badge: string;
  notice: string;
} {
  switch (quality) {
    case "good":
      return {
        card:
          "border-green-200 bg-green-50/30",
        badge:
          "border-green-200 bg-green-50 text-green-700",
        notice:
          "border-green-200 bg-green-50 text-green-800",
      };

    case "fair":
      return {
        card:
          "border-amber-200 bg-amber-50/20",
        badge:
          "border-amber-200 bg-amber-50 text-amber-700",
        notice:
          "border-amber-200 bg-amber-50 text-amber-800",
      };

    case "poor":
      return {
        card:
          "border-orange-200 bg-orange-50/20",
        badge:
          "border-orange-200 bg-orange-50 text-orange-700",
        notice:
          "border-orange-200 bg-orange-50 text-orange-800",
      };

    case "not_viable":
      return {
        card:
          "border-red-200 bg-red-50/30",
        badge:
          "border-red-200 bg-red-50 text-red-700",
        notice:
          "border-red-200 bg-red-50 text-red-800",
      };

    default:
      return {
        card:
          "border-gray-200 bg-white",
        badge:
          "border-gray-200 bg-gray-50 text-gray-600",
        notice:
          "border-gray-200 bg-gray-50 text-gray-700",
      };
  }
}