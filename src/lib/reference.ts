import type {
  ReferencePrice,
} from "@/types";

/**
 * Fetch the underlying TradFi quote from Finnhub.
 *
 * Finnhub quote fields:
 *
 * c  current/latest price
 * d  change
 * dp percent change
 * h  high
 * l  low
 * o  open
 * pc previous close
 * t  timestamp
 */
export async function fetchReferencePrice(
  symbol: string
): Promise<ReferencePrice | null> {
  const apiKey =
    process.env.FINNHUB_API_KEY;

  if (
    !apiKey ||
    apiKey ===
      "your_finnhub_api_key_here"
  ) {
    return null;
  }

  try {
    const params =
      new URLSearchParams({
        symbol,
        token: apiKey,
      });

    const res =
      await fetch(
        `https://finnhub.io/api/v1/quote?${params}`,
        {
          signal:
            AbortSignal.timeout(
              10000
            ),
          cache:
            "no-store",
        }
      );

    if (!res.ok) {
      console.warn(
        `[finnhub] ${symbol} returned ${res.status}`
      );

      return null;
    }

    const data =
      await res.json();

    const current =
      Number(data.c);

    if (
      !Number.isFinite(
        current
      ) ||
      current <= 0
    ) {
      return null;
    }

    return {
      symbol,

      price:
        current,

      previousClose:
        Number.isFinite(
          Number(data.pc)
        ) &&
        Number(data.pc) >
          0
          ? Number(
              data.pc
            )
          : null,

      open:
        Number.isFinite(
          Number(data.o)
        ) &&
        Number(data.o) >
          0
          ? Number(
              data.o
            )
          : null,

      high:
        Number.isFinite(
          Number(data.h)
        ) &&
        Number(data.h) >
          0
          ? Number(
              data.h
            )
          : null,

      low:
        Number.isFinite(
          Number(data.l)
        ) &&
        Number(data.l) >
          0
          ? Number(
              data.l
            )
          : null,

      change:
        Number(
          data.d || 0
        ),

      changePct:
        Number(
          data.dp || 0
        ),

      timestamp:
        Number(
          data.t || 0
        ) * 1000,
    };
  } catch (err) {
    console.error(
      `[finnhub] Error for ${symbol}:`,
      err
    );

    return null;
  }
}


/**
 * Fetch several reference prices.
 *
 * Finnhub's free allowance is much higher than our
 * Jupiter throughput, so 150 ms spacing is adequate
 * for this small initial universe.
 */
export async function fetchReferencePrices(
  symbols: string[]
): Promise<
  Record<
    string,
    ReferencePrice
  >
> {
  const results: Record<
    string,
    ReferencePrice
  > = {};

  for (
    let i = 0;
    i < symbols.length;
    i++
  ) {
    const symbol =
      symbols[i];

    const price =
      await fetchReferencePrice(
        symbol
      );

    if (price) {
      results[
        symbol
      ] = price;
    }

    if (
      i <
      symbols.length - 1
    ) {
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            150
          )
      );
    }
  }

  return results;
}
