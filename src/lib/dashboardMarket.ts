import type {
  ComparisonData,
  TokenExecutions,
} from "@/types";

export interface DashboardMarketRow {
  ticker: string;
  stockName: string;
  wallStreetPrice: number | null;

  issuerCount: number;
  quotingIssuerCount: number;

  bestBuyIssuer: string | null;
  bestBuyPrice: number | null;
  bestBuyGapPct: number | null;

  bestBreakEvenIssuer: string | null;
  bestBreakEvenPct: number | null;

  deepestLiquidityIssuer: string | null;
  deepestLiquidityUsd: number | null;
}

function finite(
  value: number | null | undefined
): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isFinite(
      value
    )
  );
}

export function approximateBreakEvenPct(
  buyPrice:
    | number
    | null
    | undefined,
  sellPrice:
    | number
    | null
    | undefined
) {
  if (
    !finite(
      buyPrice
    ) ||
    !finite(
      sellPrice
    ) ||
    buyPrice <= 0 ||
    sellPrice <= 0
  ) {
    return null;
  }

  return (
    (
      buyPrice /
      sellPrice -
      1
    ) *
    100
  );
}

export function buildDashboardMarketRows(
  data: ComparisonData,
  executions: Record<
    string,
    TokenExecutions
  >
): DashboardMarketRow[] {
  return Object.entries(
    data.stocks
  )
    .map(
      ([
        ticker,
        stock,
      ]) => {
        const reference =
          data.reference[
            stock.refSymbol
          ];

        const wallStreetPrice =
          reference?.price ??
          reference?.previousClose ??
          null;

        const issuerEntries =
          Object.entries(
            stock.issuers
          );

        let quotingIssuerCount =
          0;

        let bestBuyIssuer:
          string | null =
          null;
        let bestBuyPrice:
          number | null =
          null;

        let bestBreakEvenIssuer:
          string | null =
          null;
        let bestBreakEvenPct:
          number | null =
          null;

        let deepestLiquidityIssuer:
          string | null =
          null;
        let deepestLiquidityUsd:
          number | null =
          null;

        for (
          const [
            issuer,
            token,
          ] of issuerEntries
        ) {
          const tokenExecution =
            executions[
              token.mint
            ];

          const buy =
            tokenExecution
              ?.buy[
                "1000"
              ];

          const sell =
            tokenExecution
              ?.sell[
                "1000"
              ];

          if (
            buy?.status ===
              "ok" &&
            finite(
              buy.effectivePrice
            )
          ) {
            quotingIssuerCount +=
              1;

            if (
              bestBuyPrice ===
                null ||
              buy.effectivePrice <
                bestBuyPrice
            ) {
              bestBuyPrice =
                buy.effectivePrice;
              bestBuyIssuer =
                issuer;
            }
          }

          const breakEven =
            approximateBreakEvenPct(
              buy?.status ===
                "ok"
                ? buy.effectivePrice
                : null,
              sell?.status ===
                "ok"
                ? sell.effectivePrice
                : null
            );

          if (
            breakEven !==
              null &&
            (
              bestBreakEvenPct ===
                null ||
              breakEven <
                bestBreakEvenPct
            )
          ) {
            bestBreakEvenPct =
              breakEven;
            bestBreakEvenIssuer =
              issuer;
          }

          const liquidity =
            data.prices[
              token.mint
            ]?.liquidityUsd;

          if (
            finite(
              liquidity
            ) &&
            (
              deepestLiquidityUsd ===
                null ||
              liquidity >
                deepestLiquidityUsd
            )
          ) {
            deepestLiquidityUsd =
              liquidity;
            deepestLiquidityIssuer =
              issuer;
          }
        }

        const bestBuyGapPct =
          finite(
            bestBuyPrice
          ) &&
          finite(
            wallStreetPrice
          ) &&
          wallStreetPrice >
            0
            ? (
                (
                  bestBuyPrice /
                  wallStreetPrice
                ) -
                1
              ) *
              100
            : null;

        return {
          ticker,
          stockName:
            stock.name,
          wallStreetPrice,
          issuerCount:
            issuerEntries.length,
          quotingIssuerCount,
          bestBuyIssuer,
          bestBuyPrice,
          bestBuyGapPct,
          bestBreakEvenIssuer,
          bestBreakEvenPct,
          deepestLiquidityIssuer,
          deepestLiquidityUsd,
        };
      }
    )
    .sort(
      (
        left,
        right
      ) =>
        left.ticker.localeCompare(
          right.ticker
        )
    );
}

export function median(
  values: Array<
    number |
    null |
    undefined
  >
) {
  const clean =
    values
      .filter(
        finite
      )
      .sort(
        (
          left,
          right
        ) =>
          left -
          right
      );

  if (
    clean.length ===
    0
  ) {
    return null;
  }

  const middle =
    Math.floor(
      clean.length /
      2
    );

  if (
    clean.length %
      2 ===
    1
  ) {
    return clean[
      middle
    ];
  }

  return (
    clean[
      middle -
      1
    ] +
    clean[
      middle
    ]
  ) /
    2;
}
