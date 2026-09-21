"use client";

import Link from "next/link";

import type {
  MarketStatus,
  ReferencePrice,
  Stock,
  TokenExecutions,
  TokenPrice,
  WalletHolding,
} from "@/types";

import IssuerBadge from "@/components/IssuerBadge";


interface Props {
  ticker: string;

  stock: Stock;

  prices: Record<
    string,
    TokenPrice
  >;

  executions: Record<
    string,
    TokenExecutions
  >;

  reference:
    | ReferencePrice
    | null;

  marketStatus:
    MarketStatus;

  walletHoldings:
    WalletHolding[];

  executionGeneratedAt?:
    | string
    | null;

  /**
   * Distinguishes "history finished loading but
   * this ticker has no stored quote yet" from the
   * short initial loading state.
   */
  executionSnapshotLoaded?:
    boolean;
}


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


function calculateGap(
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


function gapClasses(
  gap:
    | number
    | null
) {

  if (
    gap ===
    null
  ) {
    return "text-gray-400 dark:text-slate-500";
  }


  if (
    gap <
    0
  ) {
    return "text-emerald-600 dark:text-emerald-400";
  }


  if (
    gap >
    0
  ) {
    return "text-rose-600 dark:text-rose-400";
  }


  return "text-gray-500 dark:text-slate-400";
}


export default function StockCard({
  ticker,
  stock,
  prices,
  executions,
  reference,
  marketStatus,
  walletHoldings,
  executionGeneratedAt,
  executionSnapshotLoaded = false,
}: Props) {

  const benchmark =
    marketStatus.open
      ? reference?.price ??
        reference
          ?.previousClose ??
        null
      : reference
          ?.previousClose ??
        reference?.price ??
        null;


  const benchmarkLabel =
    marketStatus.open
      ? "Wall Street reference"
      : "Latest US close";


  const issuerRows =
    Object.entries(
      stock.issuers
    ).map(
      ([
        issuer,
        token,
      ]) => {

        const price =
          prices[
            token.mint
          ];


        const multiplier =
          price
            ?.shareMultiplier ??
          1;


        const midpoint =
          price
            ?.normalizedPriceUsd ??
          (
            price?.priceUsd !==
              null &&
            price?.priceUsd !==
              undefined
              ? price.priceUsd /
                multiplier
              : null
          );


        const quote =
          executions[
            token.mint
          ]?.buy?.[
            "1000"
          ];


        const executablePrice =
          quote?.status ===
            "ok"
            ? quote.effectivePrice
            : null;


        const midpointGap =
          calculateGap(
            midpoint,
            benchmark
          );


        const executionGap =
          calculateGap(
            executablePrice,
            benchmark
          );


        return {
          issuer,
          token,
          midpoint,
          midpointGap,
          quote,
          executablePrice,
          executionGap,
        };

      }
    );


  const successful =
    issuerRows
      .filter(
        (
          row
        ) =>
          row.executablePrice !==
          null
      )
      .sort(
        (
          a,
          b
        ) =>
          (
            a.executablePrice ??
            Infinity
          ) -
          (
            b.executablePrice ??
            Infinity
          )
      );


  const best =
    successful[0] ??
    null;


  const stockMints =
    new Set(
      Object.values(
        stock.issuers
      ).map(
        (
          token
        ) =>
          token.mint
      )
    );


  const holdings =
    walletHoldings.filter(
      (
        holding
      ) =>
        stockMints.has(
          holding.mint
        )
    );


  const walletValue =
    holdings.reduce(
      (
        total,
        holding
      ) =>
        total +
        (
          holding.valueUsd ??
          0
        ),
      0
    );


  return (
    <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">

      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-5 py-5 dark:border-slate-800 md:px-6">

        <div>

          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">

            <h2 className="text-2xl font-black tracking-tight text-gray-950 dark:text-white">
              {ticker}
            </h2>


            <span className="text-sm text-gray-500 dark:text-slate-400">
              {
                stock.name
              }
            </span>

          </div>


          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">

            <span className="text-gray-400 dark:text-slate-500">
              {benchmarkLabel}
            </span>


            <span className="font-black text-gray-950 dark:text-white">
              {money(
                benchmark
              )}
            </span>

          </div>


          {holdings.length >
            0 && (

            <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">
              Wallet holding{" "}
              {money(
                walletValue
              )}
            </div>

          )}

        </div>


        <Link
          href={`/stock/${ticker}`}
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700"
        >
          Analyse
        </Link>

      </div>


      {/* Desktop column headings */}

      <div className="hidden grid-cols-[1.1fr_1fr_1fr] gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-500 md:grid">

        <div>
          Issuer
        </div>

        <div>
          Indicative midpoint
        </div>

        <div>
          Stored executable $1K BUY
        </div>

      </div>


      <div className="divide-y divide-gray-100 dark:divide-slate-800">

        {issuerRows.map(
          (
            row
          ) => {

            const isBest =
              best?.token.mint ===
              row.token.mint;


            const available =
              row.quote
                ?.status ===
                "ok" &&
              row.executablePrice !==
                null;


            return (
              <div
                key={
                  row.token.mint
                }
                className={[
                  "px-5 py-4 transition md:px-6",
                  isBest
                    ? "bg-emerald-50/40 dark:bg-emerald-950/10"
                    : "",
                ].join(
                  " "
                )}
              >

                <div className="grid gap-4 md:grid-cols-[1.1fr_1fr_1fr] md:items-center">

                  {/* Issuer */}

                  <div className="flex items-center justify-between gap-3 md:block">

                    <div className="flex items-center gap-2">

                      <IssuerBadge
                        issuer={
                          row.issuer
                        }
                      />


                      <span className="text-xs font-semibold text-gray-400 dark:text-slate-500">
                        {
                          row.token.symbol
                        }
                      </span>

                    </div>


                    {isBest && (

                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 md:mt-2 md:inline-flex">
                        Best $1K buy
                      </span>

                    )}

                  </div>


                  {/* Midpoint */}

                  <div>

                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 md:hidden">
                      Midpoint
                    </div>


                    <div className="mt-1 text-lg font-black text-gray-950 dark:text-white">
                      {money(
                        row.midpoint
                      )}
                    </div>


                    <div
                      className={[
                        "mt-0.5 text-xs font-bold",
                        gapClasses(
                          row.midpointGap
                        ),
                      ].join(
                        " "
                      )}
                    >
                      {row.midpointGap !==
                      null
                        ? `${pct(
                            row.midpointGap
                          )} vs ${
                            marketStatus.open
                              ? "Wall Street"
                              : "latest close"
                          }`
                        : "Reference unavailable"}
                    </div>

                  </div>


                  {/* Executable */}

                  <div>

                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500 md:hidden">
                      Stored executable $1K BUY
                    </div>


                    {available ? (

                      <>

                        <div className="mt-1 text-lg font-black text-gray-950 dark:text-white">
                          {money(
                            row.executablePrice
                          )}
                        </div>


                        <div
                          className={[
                            "mt-0.5 text-xs font-bold",
                            gapClasses(
                              row.executionGap
                            ),
                          ].join(
                            " "
                          )}
                        >
                          {row.executionGap !==
                          null
                            ? `${pct(
                                row.executionGap
                              )} vs ${
                                marketStatus.open
                                  ? "Wall Street"
                                  : "latest close"
                              }`
                            : "Reference unavailable"}
                        </div>

                      </>

                    ) : row.quote ? (

                      <>

                        <div className="mt-1 text-sm font-bold text-gray-500 dark:text-slate-400">
                          No live quote
                        </div>


                        <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-600">
                          Not executable at $1K right now
                        </div>

                      </>

                    ) : executionSnapshotLoaded ? (

                      <>

                        <div className="mt-1 text-sm font-bold text-gray-400 dark:text-slate-500">
                          No stored quote yet
                        </div>


                        <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-600">
                          Open this stock to begin collecting history
                        </div>

                      </>

                    ) : (

                      <>

                        <div className="mt-1 text-sm font-bold text-gray-400 dark:text-slate-500">
                          Loading…
                        </div>


                        <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-600">
                          Reading stored $1K snapshot
                        </div>

                      </>

                    )}

                  </div>

                </div>

              </div>
            );

          }
        )}

      </div>


      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 text-[11px] text-gray-400 dark:border-slate-800 dark:text-slate-600 md:px-6">

        <span>
          Midpoint is live/indicative. Stored $1K BUY is the latest captured executable snapshot.
        </span>


        {executionGeneratedAt && (

          <span>
            Snapshot{" "}
            {new Date(
              executionGeneratedAt
            ).toLocaleTimeString(
              [],
              {
                hour:
                  "2-digit",

                minute:
                  "2-digit",
              }
            )}
          </span>

        )}

      </div>

    </section>
  );
}