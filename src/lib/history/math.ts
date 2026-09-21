export function gapPct(
  price: number | null,
  benchmark: number | null
): number | null {
  if (
    price === null ||
    benchmark === null ||
    !Number.isFinite(price) ||
    !Number.isFinite(benchmark) ||
    benchmark <= 0
  ) {
    return null;
  }

  return ((price - benchmark) / benchmark) * 100;
}

export function executionGapPct(
  buy: number | null,
  sell: number | null
): number | null {
  if (
    buy === null ||
    sell === null ||
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0
  ) {
    return null;
  }

  return ((buy - sell) / buy) * 100;
}

export function approxBreakEvenMovePct(
  buy: number | null,
  sell: number | null
): number | null {
  if (
    buy === null ||
    sell === null ||
    !Number.isFinite(buy) ||
    !Number.isFinite(sell) ||
    buy <= 0 ||
    sell <= 0
  ) {
    return null;
  }

  return ((buy / sell) - 1) * 100;
}

export function divergenceAfterBreakEvenPct(
  buyGap: number | null,
  breakEven: number | null
): number | null {
  if (
    buyGap === null ||
    breakEven === null
  ) {
    return null;
  }

  const discount =
    Math.abs(
      Math.min(
        buyGap,
        0
      )
    );

  return Math.max(
    0,
    discount -
      Math.max(
        breakEven,
        0
      )
  );
}

export function median(
  values: number[]
): number | null {
  const clean =
    values
      .filter(
        Number.isFinite
      )
      .sort(
        (
          a,
          b
        ) =>
          a - b
      );

  if (clean.length === 0) {
    return null;
  }

  const middle =
    Math.floor(
      clean.length /
      2
    );

  if (clean.length % 2 === 1) {
    return clean[middle];
  }

  return (
    clean[middle - 1] +
    clean[middle]
  ) / 2;
}

export function percentileRankByMagnitude(
  current: number | null,
  history: number[]
): number | null {
  if (
    current === null ||
    !Number.isFinite(current)
  ) {
    return null;
  }

  const clean =
    history.filter(
      Number.isFinite
    );

  if (clean.length === 0) {
    return null;
  }

  const target =
    Math.abs(
      current
    );

  const atOrBelow =
    clean.filter(
      (
        value
      ) =>
        Math.abs(
          value
        ) <=
        target
    ).length;

  return (
    atOrBelow /
    clean.length
  ) * 100;
}

export function percentileRank(
  current: number | null,
  history: number[]
): number | null {
  if (
    current === null ||
    !Number.isFinite(current)
  ) {
    return null;
  }

  const clean =
    history.filter(
      Number.isFinite
    );

  if (clean.length === 0) {
    return null;
  }

  const atOrBelow =
    clean.filter(
      (
        value
      ) =>
        value <=
        current
    ).length;

  return (
    atOrBelow /
    clean.length
  ) * 100;
}
