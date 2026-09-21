import type {
  ComparisonData,
  ExecutionOpportunity,
} from "@/types";


/**
 * Build ranked BUY opportunities for a given trade size.
 *
 * To qualify:
 *
 * - stock must have 2+ issuers
 * - at least 2 issuers must have successful Jupiter quotes
 *
 * For buys:
 * lower effective price wins.
 */
export function buildBuyOpportunities(
  data: ComparisonData,
  sizeUsd = 1_000
): ExecutionOpportunity[] {

  const opportunities:
    ExecutionOpportunity[] =
    [];


  for (
    const [
      ticker,
      stock,
    ] of Object.entries(
      data.stocks
    )
  ) {

    const candidates =
      Object.entries(
        stock.issuers
      )
        .map(
          ([
            issuer,
            token,
          ]) => {

            const quote =
              data.executions[
                token.mint
              ]?.buy[
                sizeUsd.toString()
              ];


            if (
              quote?.status !==
                "ok" ||
              quote.effectivePrice ==
                null
            ) {
              return null;
            }


            return {
              issuer,
              effectivePrice:
                quote.effectivePrice,
            };
          }
        )
        .filter(
          (
            item
          ): item is {
            issuer: string;
            effectivePrice: number;
          } =>
            item !==
            null
        );


    if (
      candidates.length <
      2
    ) {
      continue;
    }


    candidates.sort(
      (
        a,
        b
      ) =>
        a.effectivePrice -
        b.effectivePrice
    );


    const best =
      candidates[0];

    const other =
      candidates[
        candidates.length -
          1
      ];


    const savingPct =
      (
        (
          other.effectivePrice -
          best.effectivePrice
        ) /
        other.effectivePrice
      ) *
      100;


    /**
     * Approximate dollar saving for the same
     * exposure/notional.
     */
    const estimatedSavingUsd =
      sizeUsd *
      (
        savingPct /
        100
      );


    opportunities.push({
      ticker,

      stockName:
        stock.name,

      sizeUsd,

      bestIssuer:
        best.issuer,

      otherIssuer:
        other.issuer,

      bestEffectivePrice:
        best.effectivePrice,

      otherEffectivePrice:
        other.effectivePrice,

      estimatedSavingUsd,

      savingPct,
    });
  }


  return opportunities.sort(
    (
      a,
      b
    ) =>
      b.estimatedSavingUsd -
      a.estimatedSavingUsd
  );
}