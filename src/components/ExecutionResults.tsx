"use client";

import {
  useState,
} from "react";

import IssuerBadge from "@/components/IssuerBadge";
import TradeDrawer from "@/components/TradeDrawer";

import type {
  IssuerExecutionResult,
  StockExecutionResponse,
  TradeSide,
} from "@/types";


interface Props {
  data:
    StockExecutionResponse;
}


type TradeSelection = {
  issuer:
    IssuerExecutionResult;

  side:
    TradeSide;
};


function money(
  value:
    | number
    | null
    | undefined
) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }


  return new Intl.NumberFormat(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD",

      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  ).format(
    value
  );
}


function pct(
  value:
    | number
    | null
    | undefined
) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      value
    )
  ) {
    return "—";
  }


  return `${value >= 0 ? "+" : ""}${value.toFixed(
    2
  )}%`;
}


function gap(
  price:
    | number
    | null,

  benchmark:
    | number
    | null
) {

  if (
    price ===
      null ||
    benchmark ===
      null ||
    benchmark <=
      0
  ) {
    return null;
  }


  return (
    (
      price -
      benchmark
    ) /
    benchmark
  ) *
    100;
}


function buySellGapUsd(
  buy:
    | number
    | null,

  sell:
    | number
    | null
) {

  if (
    buy ===
      null ||
    sell ===
      null
  ) {
    return null;
  }


  return (
    buy -
    sell
  );
}


function breakEvenMovePct(
  buy:
    | number
    | null,

  sell:
    | number
    | null
) {

  if (
    buy ===
      null ||
    sell ===
      null ||
    buy <=
      0 ||
    sell <=
      0
  ) {
    return null;
  }


  return (
    (
      buy /
      sell
    ) -
    1
  ) *
    100;
}


function valueClass(
  value:
    | number
    | null
) {

  if (
    value ===
    null
  ) {
    return "text-gray-500 dark:text-slate-500";
  }


  if (
    value <
    0
  ) {
    return "text-emerald-600 dark:text-emerald-400";
  }


  if (
    value >
    0
  ) {
    return "text-rose-600 dark:text-rose-400";
  }


  return "text-gray-600 dark:text-slate-400";
}


function hurdleClass(
  value:
    | number
    | null
) {

  if (
    value ===
    null
  ) {
    return "text-gray-500 dark:text-slate-500";
  }


  if (
    value <
    0.75
  ) {
    return "text-emerald-600 dark:text-emerald-400";
  }


  if (
    value <
    2
  ) {
    return "text-amber-600 dark:text-amber-400";
  }


  return "text-rose-600 dark:text-rose-400";
}


function marketQuality(
  hurdle:
    | number
    | null
) {

  if (
    hurdle ===
    null
  ) {
    return "Incomplete market";
  }


  if (
    hurdle <
    0.75
  ) {
    return "Tight at this size";
  }


  if (
    hurdle <
    2
  ) {
    return "Moderate gap";
  }


  return "Wide at this size";
}


export default function ExecutionResults({
  data,
}: Props) {

  const [
    selected,
    setSelected,
  ] =
    useState<
      TradeSelection |
      null
    >(
      null
    );


  // `referencePrice` has already been resolved by /api/quote.
  // Prefer it in every market session. Falling back to previousClose
  // is only for the case where the latest reference is unavailable.
  const benchmark =
    data.referencePrice ??
    data.previousClose ??
    null;


  const benchmarkLabel =
    data.marketStatus.open
      ? "Wall Street"
      : "latest US price";


  /**
   * Best BUY is the lowest executable BUY.
   */
  const bestBuy =
    data.issuers
      .filter(
        (
          issuer
        ) =>
          issuer.buyQuote
            .status ===
            "ok" &&
          issuer.buyQuote
            .effectivePrice !==
            null
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            a.buyQuote
              .effectivePrice ??
            Infinity
          ) -
          (
            b.buyQuote
              .effectivePrice ??
            Infinity
          )
      )[0] ??
    null;


  /**
   * Best SELL is the highest executable SELL.
   */
  const bestSell =
    data.issuers
      .filter(
        (
          issuer
        ) =>
          issuer.sellQuote
            .status ===
            "ok" &&
          issuer.sellQuote
            .effectivePrice !==
            null
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            b.sellQuote
              .effectivePrice ??
            -Infinity
          ) -
          (
            a.sellQuote
              .effectivePrice ??
            -Infinity
          )
      )[0] ??
    null;


  return (
    <div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">

        <div>

          <div className="text-sm font-black text-gray-950 dark:text-white">
            Executable market ·{" "}
            {money(
              data.amountUsd
            )}
          </div>


          <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            BUY and SELL are fresh execution estimates for the same order size
          </div>

        </div>


        {benchmark && (

          <div className="text-right">

            <div className="text-xs text-gray-500 dark:text-slate-400">
              {benchmarkLabel} reference
            </div>


            <div className="font-black text-gray-950 dark:text-white">
              {money(
                benchmark
              )}
            </div>

          </div>

        )}

      </div>


      <div className="grid gap-3 lg:grid-cols-3">

        {data.issuers.map(
          (
            issuer
          ) => {

            const buy =
              issuer.buyQuote;


            const sell =
              issuer.sellQuote;


            const buyAvailable =
              buy.status ===
                "ok" &&
              buy.effectivePrice !==
                null;


            const sellAvailable =
              sell.status ===
                "ok" &&
              sell.effectivePrice !==
                null;


            const buyPrice =
              buyAvailable
                ? buy.effectivePrice
                : null;


            const sellPrice =
              sellAvailable
                ? sell.effectivePrice
                : null;


            const midpointGap =
              gap(
                issuer.midpoint,
                benchmark
              );


            const buyReferenceGap =
              gap(
                buyPrice,
                benchmark
              );


            const sellReferenceGap =
              gap(
                sellPrice,
                benchmark
              );


            const gapUsd =
              buySellGapUsd(
                buyPrice,
                sellPrice
              );


            const hurdle =
              breakEvenMovePct(
                buyPrice,
                sellPrice
              );


            const isBestBuy =
              bestBuy?.mint ===
              issuer.mint;


            const isBestSell =
              bestSell?.mint ===
              issuer.mint;


            return (
              <article
                key={
                  issuer.mint
                }
                className="relative rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 md:p-5"
              >

                {/* Issuer */}

                <div className="flex min-h-7 items-start justify-between gap-2">

                  <div className="flex items-center gap-2">

                    <IssuerBadge
                      issuer={
                        issuer.issuer
                      }
                    />


                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                      {
                        issuer.symbol
                      }
                    </span>

                  </div>


                  <div className="flex flex-wrap justify-end gap-1">

                    {isBestBuy && (

                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                        Best buy
                      </span>

                    )}


                    {isBestSell && (

                      <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                        Best sell
                      </span>

                    )}

                  </div>

                </div>


                {/* Indicative */}

                <div className="mt-5">

                  <div className="text-xs text-gray-500 dark:text-slate-400">
                    Indicative price
                  </div>


                  <div className="mt-1 text-xl font-bold text-gray-950 dark:text-white">
                    {money(
                      issuer.midpoint
                    )}
                  </div>


                  <div
                    className={[
                      "mt-1 text-xs font-semibold",
                      valueClass(
                        midpointGap
                      ),
                    ].join(
                      " "
                    )}
                  >
                    {midpointGap !==
                    null
                      ? `${pct(
                          midpointGap
                        )} vs ${benchmarkLabel}`
                      : "Reference comparison unavailable"}
                  </div>

                </div>


                <div className="my-4 border-t border-gray-100 dark:border-slate-800" />


                {/* Executable market */}

                <div className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
                  Executable market ·{" "}
                  {money(
                    data.amountUsd
                  )}
                </div>


                <div className="mt-3 grid grid-cols-2 gap-2">

                  <ExecutionSide
                    label="BUY"
                    price={
                      buyPrice
                    }
                    referenceGap={
                      buyReferenceGap
                    }
                    benchmarkLabel={
                      benchmarkLabel
                    }
                    available={
                      buyAvailable
                    }
                    error={
                      buy.error
                    }
                    best={
                      isBestBuy
                    }
                  />


                  <ExecutionSide
                    label="SELL"
                    price={
                      sellPrice
                    }
                    referenceGap={
                      sellReferenceGap
                    }
                    benchmarkLabel={
                      benchmarkLabel
                    }
                    available={
                      sellAvailable
                    }
                    error={
                      sell.error
                    }
                    best={
                      isBestSell
                    }
                  />

                </div>


                {/* Decision hurdle */}

                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">

                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
                    Entry / exit hurdle
                  </div>


                  {hurdle !==
                  null ? (

                    <>

                      <div className="mt-3 flex items-end justify-between gap-3">

                        <div>

                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            Executable buy/sell gap
                          </div>


                          <div className="mt-1 font-black text-gray-950 dark:text-white">
                            {money(
                              gapUsd
                            )}
                          </div>

                        </div>


                        <div className="text-right">

                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            Approx. break-even move
                          </div>


                          <div
                            className={[
                              "mt-1 text-xl font-black",
                              hurdleClass(
                                hurdle
                              ),
                            ].join(
                              " "
                            )}
                          >
                            +{hurdle.toFixed(
                              2
                            )}%
                          </div>

                        </div>

                      </div>


                      <div
                        className={[
                          "mt-3 text-xs font-bold",
                          hurdleClass(
                            hurdle
                          ),
                        ].join(
                          " "
                        )}
                      >
                        {marketQuality(
                          hurdle
                        )}
                      </div>


                      <div className="mt-2 text-[11px] leading-4 text-gray-500 dark:text-slate-400">
                        Current SELL execution would need to improve by about this amount to equal the current BUY price. Exit conditions can change.
                      </div>

                    </>

                  ) : (

                    <div className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
                      Both BUY and SELL execution are required to calculate the current round-trip hurdle.
                    </div>

                  )}

                </div>


                {/* Execution details */}

                <div className="mt-4">

                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
                    Execution details
                  </div>


                  <div className="mt-2 grid grid-cols-2 gap-2">

                    <Metric
                      label="Buy vs indicative"
                      value={
                        buyAvailable
                          ? pct(
                              buy.executionCostPct
                            )
                          : "—"
                      }
                    />


                    <Metric
                      label="Sell vs indicative"
                      value={
                        sellAvailable
                          ? pct(
                              sell.executionCostPct
                            )
                          : "—"
                      }
                    />

                  </div>


                  <details className="mt-2 rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950">

                    <summary className="cursor-pointer px-3 py-2 text-[11px] font-bold text-gray-500 dark:text-slate-400">
                      Jupiter route details
                    </summary>


                    <div className="grid grid-cols-2 gap-2 border-t border-gray-100 p-3 dark:border-slate-800">

                      <Metric
                        label="BUY Jupiter fee"
                        value={
                          buyAvailable &&
                          buy.feeBps !==
                            null
                            ? `${(
                                buy.feeBps /
                                100
                              ).toFixed(
                                2
                              )}%`
                            : "—"
                        }
                      />


                      <Metric
                        label="SELL Jupiter fee"
                        value={
                          sellAvailable &&
                          sell.feeBps !==
                            null
                            ? `${(
                                sell.feeBps /
                                100
                              ).toFixed(
                                2
                              )}%`
                            : "—"
                        }
                      />


                      <Metric
                        label="BUY slippage"
                        value={
                          buyAvailable &&
                          buy.slippageBps !==
                            null
                            ? buy.slippageBps ===
                              0
                              ? "0.00% · firm quote"
                              : `${(
                                  buy.slippageBps /
                                  100
                                ).toFixed(
                                  2
                                )}%`
                            : "—"
                        }
                      />


                      <Metric
                        label="SELL slippage"
                        value={
                          sellAvailable &&
                          sell.slippageBps !==
                            null
                            ? sell.slippageBps ===
                              0
                              ? "0.00% · firm quote"
                              : `${(
                                  sell.slippageBps /
                                  100
                                ).toFixed(
                                  2
                                )}%`
                            : "—"
                        }
                      />


                      <Metric
                        label="BUY price impact"
                        value={
                          buyAvailable
                            ? pct(
                                buy.priceImpactPct
                              )
                            : "—"
                        }
                      />


                      <Metric
                        label="SELL price impact"
                        value={
                          sellAvailable
                            ? pct(
                                sell.priceImpactPct
                              )
                            : "—"
                        }
                      />

                    </div>

                  </details>

                </div>


                {/* Actions */}

                <div className="mt-5 grid grid-cols-2 gap-2">

                  <button
                    type="button"
                    disabled={
                      !buyAvailable
                    }
                    onClick={() =>
                      setSelected({
                        issuer,

                        side:
                          "buy",
                      })
                    }
                    className="min-h-11 rounded-xl bg-emerald-600 px-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Buy{" "}
                    {
                      issuer.symbol
                    }
                  </button>


                  <button
                    type="button"
                    disabled={
                      !sellAvailable
                    }
                    onClick={() =>
                      setSelected({
                        issuer,

                        side:
                          "sell",
                      })
                    }
                    className="min-h-11 rounded-xl bg-gray-950 px-3 text-sm font-bold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                  >
                    Sell{" "}
                    {
                      issuer.symbol
                    }
                  </button>

                </div>

              </article>
            );

          }
        )}

      </div>


      <div className="mt-4 text-xs leading-5 text-gray-500 dark:text-slate-400">
        Executable BUY and SELL prices already reflect the quoted route. Execution-vs-indicative and Jupiter price impact are explanatory metrics, not additional percentages to add to the executable price. The approximate break-even move uses today's BUY and SELL conditions and can change as liquidity changes.
      </div>


     {selected && (

  <TradeDrawer
    open
    onClose={() =>
      setSelected(
        null
      )
    }
    ticker={
      data.ticker
    }
    issuer={
      selected
        .issuer
        .issuer
    }
    symbol={
      selected
        .issuer
        .symbol
    }
    mint={
      selected
        .issuer
        .mint
    }
    side={
      selected.side
    }
    amountUsd={
      data.amountUsd
    }
    comparisonTokenAmount={
      selected.side ===
      "sell"
        ? selected
            .issuer
            .sellQuote
            .tokenAmount
        : null
    }
  />

)}

    </div>
  );
}


function ExecutionSide({
  label,
  price,
  referenceGap,
  benchmarkLabel,
  available,
  error,
  best,
}: {
  label:
    "BUY" |
    "SELL";

  price:
    | number
    | null;

  referenceGap:
    | number
    | null;

  benchmarkLabel:
    string;

  available:
    boolean;

  error?:
    string;

  best:
    boolean;
}) {

  return (
    <div
      className={[
        "rounded-xl border p-3",
        best
          ? "border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/20"
          : "border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-950",
      ].join(
        " "
      )}
    >

      <div className="flex items-center justify-between gap-2">

        <div className="text-[11px] font-black uppercase tracking-wide text-gray-500 dark:text-slate-400">
          {label}
        </div>


        {best && (

          <div className="text-[11px] font-black uppercase text-violet-600 dark:text-violet-400">
            Best
          </div>

        )}

      </div>


      {available ? (

        <>

          <div className="mt-1 text-xl font-black text-gray-950 dark:text-white">
            {money(
              price
            )}
          </div>


          <div
            className={[
              "mt-1 text-[11px] font-bold",
              valueClass(
                referenceGap
              ),
            ].join(
              " "
            )}
          >
            {referenceGap !==
            null
              ? `${pct(
                  referenceGap
                )} vs ${benchmarkLabel}`
              : "Reference unavailable"}
          </div>

        </>

      ) : (

        <>

          <div className="mt-2 text-sm font-bold text-gray-500 dark:text-slate-400">
            Unavailable
          </div>


          <div
            className="mt-1 truncate text-[11px] text-gray-500 dark:text-slate-400"
            title={
              error ??
              undefined
            }
          >
            No executable {label} quote
          </div>

        </>

      )}

    </div>
  );
}


function Metric({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {

  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900">

      <div className="text-[11px] text-gray-500 dark:text-slate-400">
        {label}
      </div>


      <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
        {value}
      </div>

    </div>
  );
}