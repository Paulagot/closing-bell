import type { XStocksMultiplier } from "@/types";

const XSTOCKS_API =
  "https://api.xstocks.fi/api/v2";

const CACHE_MS =
  5 * 60 * 1000;

type CacheEntry = {
  value: XStocksMultiplier;
  expiresAt: number;
};

const multiplierCache =
  new Map<string, CacheEntry>();

function asPositiveNumber(
  value: unknown
): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : null;
}

/**
 * The xStocks API has changed versions over time,
 * so keep this parser intentionally defensive.
 *
 * We only accept an explicitly named multiplier
 * field. We do NOT recursively grab arbitrary
 * numbers from the response.
 */
function extractMultiplier(
  payload: unknown
): number | null {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const data =
    payload as Record<string, unknown>;

  const directKeys = [
    "currentMultiplier",
    "current_multiplier",
    "activeMultiplier",
    "active_multiplier",
    "multiplier",
  ];

  for (const key of directKeys) {
    const value =
      data[key];

    const direct =
      asPositiveNumber(value);

    if (direct !== null) {
      return direct;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      const nested =
        value as Record<string, unknown>;

      for (const nestedKey of [
        "value",
        "multiplier",
        "amount",
      ]) {
        const parsed =
          asPositiveNumber(
            nested[nestedKey]
          );

        if (parsed !== null) {
          return parsed;
        }
      }
    }
  }

  if (
    data.data &&
    typeof data.data === "object"
  ) {
    return extractMultiplier(
      data.data
    );
  }

  return null;
}

function extractActivationTimestamp(
  payload: unknown
): string | null {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    return null;
  }

  const data =
    payload as Record<string, unknown>;

  const candidates = [
    data.activationTimestamp,
    data.activationDateTime,
    data.activation_time,
    data.activationTime,
  ];

  for (const value of candidates) {
    if (
      typeof value === "string" &&
      value.trim()
    ) {
      return value;
    }
  }

  if (
    data.data &&
    typeof data.data === "object"
  ) {
    return extractActivationTimestamp(
      data.data
    );
  }

  return null;
}

export async function fetchXStocksMultiplier(
  symbol: string
): Promise<XStocksMultiplier> {
  const normalized =
    symbol.trim();

  const cached =
    multiplierCache.get(
      normalized
    );

  if (
    cached &&
    cached.expiresAt > Date.now()
  ) {
    return cached.value;
  }

  const url =
    `${XSTOCKS_API}/public/assets/` +
    `${encodeURIComponent(normalized)}` +
    `/multiplier?network=Solana`;

  const response =
    await fetch(url, {
      headers: {
        Accept:
          "application/json",
      },
      cache:
        "no-store",
    });

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `xStocks multiplier request failed ` +
      `${response.status}: ` +
      `${body.slice(0, 250)}`
    );
  }

  const payload: unknown =
    await response.json();

  const multiplier =
    extractMultiplier(
      payload
    );

  if (
    multiplier === null
  ) {
    throw new Error(
      `xStocks multiplier missing or ` +
      `unrecognised for ${symbol}`
    );
  }

  const value: XStocksMultiplier = {
    symbol:
      normalized,

    multiplier,

    source:
      "xstocks_api",

    fetchedAt:
      Date.now(),

    activationTimestamp:
      extractActivationTimestamp(
        payload
      ),
  };

  multiplierCache.set(
    normalized,
    {
      value,
      expiresAt:
        Date.now() +
        CACHE_MS,
    }
  );

  return value;
}

/**
 * Returns the economic share multiplier for
 * any Closing Bell wrapper.
 *
 * Non-xStocks wrappers are presently treated as
 * 1:1. We can replace this later if an issuer
 * exposes a dynamic conversion ratio.
 */
export async function getShareMultiplier(
  issuer: string,
  symbol: string
): Promise<number> {
  if (
    issuer !== "xStocks"
  ) {
    return 1;
  }

  const result =
    await fetchXStocksMultiplier(
      symbol
    );

  return result.multiplier;
}