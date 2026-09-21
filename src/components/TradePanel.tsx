"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  VersionedTransaction,
} from "@solana/web3.js";

import {
  useWallet,
} from "@solana/wallet-adapter-react";

import type {
  Stock,
  TradeSide,
} from "@/types";

import type {
  TradeExecuteResponse,
  TradeOrderResponse,
} from "@/types/trading";

import IssuerBadge from "@/components/IssuerBadge";

interface Props {
  ticker: string;
  stock: Stock;
}

const PRESETS = [
  100,
  1000,
  10000,
];

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
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }
  ).format(
    value
  );
}

function pctFromBps(
  bps:
    | number
    | null
    | undefined
) {
  if (
    bps === null ||
    bps === undefined
  ) {
    return "Automatic";
  }

  return `${(
    bps /
    100
  ).toFixed(
    2
  )}%`;
}

export default function TradePanel({
  ticker,
  stock,
}: Props) {
  const {
    publicKey,
    connected,
    signTransaction,
  } =
    useWallet();

  const issuers =
    useMemo(
      () =>
        Object.entries(
          stock.issuers
        ),
      [
        stock.issuers,
      ]
    );

  const [
    issuer,
    setIssuer,
  ] =
    useState(
      issuers[0]?.[0] ??
        ""
    );

  const [
    side,
    setSide,
  ] =
    useState<TradeSide>(
      "buy"
    );

  const [
    amountUsd,
    setAmountUsd,
  ] =
    useState(
      100
    );

  const [
    customAmount,
    setCustomAmount,
  ] =
    useState(
      "100"
    );

  const [
    order,
    setOrder,
  ] =
    useState<TradeOrderResponse | null>(
      null
    );

  const [
    execution,
    setExecution,
  ] =
    useState<TradeExecuteResponse | null>(
      null
    );

  const [
    loadingQuote,
    setLoadingQuote,
  ] =
    useState(
      false
    );

  const [
    executing,
    setExecuting,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    now,
    setNow,
  ] =
    useState(
      Date.now()
    );

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  /*
   * Any material selection change invalidates
   * the previous executable order.
   */
  useEffect(() => {
    setOrder(
      null
    );

    setExecution(
      null
    );

    setError(
      null
    );
  }, [
    issuer,
    side,
    amountUsd,
  ]);

  const quoteAgeSeconds =
    order
      ? Math.floor(
          (
            now -
            order.quoteCreatedAt
          ) /
            1000
        )
      : 0;

  /*
   * Conservative client-side freshness guard.
   *
   * Jupiter's own block-height/RFQ expiry is
   * still authoritative.
   */
  const stale =
    order !== null &&
    quoteAgeSeconds >= 20;

  async function getTradeQuote() {
    if (
      !publicKey
    ) {
      setError(
        "Connect your wallet first."
      );

      return;
    }

    setLoadingQuote(
      true
    );

    setError(
      null
    );

    setOrder(
      null
    );

    setExecution(
      null
    );

    try {
      const response =
        await fetch(
          "/api/trade/order",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ticker,
                issuer,
                side,
                amountUsd,
                taker:
                  publicKey.toBase58(),
              }),
          }
        );

      const text =
        await response.text();

      let json:
        TradeOrderResponse & {
          error?: string;
          details?: string;
        };

      try {
        json =
          JSON.parse(
            text
          );
      } catch {
        throw new Error(
          `Trade quote returned ${response.status} instead of JSON`
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          json.error ??
            json.details ??
            "Unable to get trade quote"
        );
      }

      setOrder(
        json
      );

      setNow(
        Date.now()
      );
    } catch (
      quoteError
    ) {
      setError(
        quoteError instanceof Error
          ? quoteError.message
          : String(
              quoteError
            )
      );
    } finally {
      setLoadingQuote(
        false
      );
    }
  }

  async function executeTrade() {
    if (
      !publicKey ||
      !signTransaction
    ) {
      setError(
        "Your connected wallet cannot sign this transaction."
      );

      return;
    }

    if (
      !order ||
      order.status !==
        "ready" ||
      !order.transaction ||
      !order.requestId
    ) {
      setError(
        "Request a fresh executable quote first."
      );

      return;
    }

    if (stale) {
      setError(
        "This quote is stale. Refresh the trade quote before signing."
      );

      return;
    }

    setExecuting(
      true
    );

    setError(
      null
    );

    try {
      const transaction =
        VersionedTransaction.deserialize(
          Uint8Array.from(
            atob(
              order.transaction
            ),
            (character) =>
              character.charCodeAt(
                0
              )
          )
        );

      /*
       * Wallet adapter adds the user's signature.
       * Existing partial signatures, including
       * those required by Jupiter routes, remain
       * on the VersionedTransaction.
       */
      const signed =
        await signTransaction(
          transaction
        );

      const bytes =
        signed.serialize();

      let binary =
        "";

      for (
        let index = 0;
        index <
        bytes.length;
        index++
      ) {
        binary +=
          String.fromCharCode(
            bytes[index]
          );
      }

      const signedTransaction =
        btoa(
          binary
        );

      const response =
        await fetch(
          "/api/trade/execute",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                requestId:
                  order.requestId,

                walletAddress:
                  publicKey.toBase58(),

                signedTransaction,
              }),
          }
        );

      const text =
        await response.text();

      let json:
        TradeExecuteResponse & {
          details?: string;
        };

      try {
        json =
          JSON.parse(
            text
          );
      } catch {
        throw new Error(
          `Trade execution returned ${response.status} instead of JSON`
        );
      }

      if (
        !response.ok
      ) {
        throw new Error(
          json.error ??
            json.details ??
            "Trade execution failed"
        );
      }

      setExecution(
        json
      );

      /*
       * Other components can listen for this
       * later to refresh wallet holdings.
       */
      window.dispatchEvent(
        new CustomEvent(
          "closingbell:wallet-refresh"
        )
      );
    } catch (
      tradeError
    ) {
      setError(
        tradeError instanceof Error
          ? tradeError.message
          : String(
              tradeError
            )
      );
    } finally {
      setExecuting(
        false
      );
    }
  }

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          Trade
        </div>

        <h2 className="mt-1 text-2xl font-bold text-gray-950">
          Trade {ticker}
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Choose the wrapper you want
          to trade. Closing Bell gets
          a fresh Jupiter order before
          your wallet signs anything.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Side
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                "buy",
                "sell",
              ] as TradeSide[]
            ).map(
              (
                value
              ) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setSide(
                      value
                    )
                  }
                  className={[
                    "min-h-11 rounded-xl border px-4 text-sm font-semibold capitalize",
                    side ===
                    value
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                  ].join(
                    " "
                  )}
                >
                  {
                    value
                  }
                </button>
              )
            )}
          </div>

          <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Issuer
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {issuers.map(
              ([
                issuerName,
                token,
              ]) => (
                <button
                  key={
                    issuerName
                  }
                  type="button"
                  onClick={() =>
                    setIssuer(
                      issuerName
                    )
                  }
                  className={[
                    "min-h-14 rounded-xl border p-3 text-left",
                    issuer ===
                    issuerName
                      ? "border-gray-950 bg-gray-50"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  ].join(
                    " "
                  )}
                >
                  <IssuerBadge
                    issuer={
                      issuerName
                    }
                  />

                  <div className="mt-1 text-xs text-gray-500">
                    {
                      token.symbol
                    }
                  </div>
                </button>
              )
            )}
          </div>

          <div className="mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            USD equivalent
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {PRESETS.map(
              (
                preset
              ) => (
                <button
                  key={
                    preset
                  }
                  type="button"
                  onClick={() => {
                    setAmountUsd(
                      preset
                    );

                    setCustomAmount(
                      String(
                        preset
                      )
                    );
                  }}
                  className={[
                    "min-h-11 rounded-xl border text-sm font-semibold",
                    amountUsd ===
                    preset
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-200 bg-white text-gray-700",
                  ].join(
                    " "
                  )}
                >
                  $
                  {preset.toLocaleString()}
                </button>
              )
            )}
          </div>

          <form
            className="mt-2 flex gap-2"
            onSubmit={(
              event
            ) => {
              event.preventDefault();

              const value =
                Number(
                  customAmount
                );

              if (
                Number.isFinite(
                  value
                ) &&
                value >=
                  1 &&
                value <=
                  100_000
              ) {
                setAmountUsd(
                  value
                );
              }
            }}
          >
            <input
              type="number"
              min="1"
              max="100000"
              step="1"
              value={
                customAmount
              }
              onChange={(
                event
              ) =>
                setCustomAmount(
                  event
                    .target
                    .value
                )
              }
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-gray-400"
              placeholder="Custom USD amount"
            />

            <button
              type="submit"
              className="min-h-11 rounded-xl border border-gray-200 px-4 text-sm font-semibold"
            >
              Set
            </button>
          </form>

          {!connected ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Connect your Solana wallet
              before requesting an
              executable order.
            </div>
          ) : (
            <button
              type="button"
              disabled={
                loadingQuote
              }
              onClick={
                getTradeQuote
              }
              className="mt-5 min-h-12 w-full rounded-xl bg-gray-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingQuote
                ? "Getting fresh quote…"
                : "Get fresh trade quote"}
            </button>
          )}
        </div>

        <div>
          {!order &&
            !execution && (
              <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm leading-6 text-gray-500">
                A fresh executable
                quote will appear here
                before anything is sent
                to your wallet.
              </div>
            )}

          {order && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <IssuerBadge
                    issuer={
                      order.issuer
                    }
                  />

                  <div className="mt-2 text-lg font-bold text-gray-950">
                    {
                      order.side ===
                      "buy"
                        ? "Buy"
                        : "Sell"
                    }{" "}
                    {
                      order.symbol
                    }
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-bold text-gray-950">
                    {money(
                      order.effectivePrice
                    )}
                  </div>

                  <div className="text-xs text-gray-500">
                    effective price /
                    share
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <TradeMetric
                  label="USD equivalent"
                  value={money(
                    order.amountUsd
                  )}
                />

                <TradeMetric
                  label="Share equivalent"
                  value={order.shareEquivalentAmount.toLocaleString(
                    "en-US",
                    {
                      maximumFractionDigits:
                        6,
                    }
                  )}
                />

                <TradeMetric
                  label="Price impact"
                  value={
                    order.priceImpactPct ===
                    null
                      ? "—"
                      : `${order.priceImpactPct.toFixed(
                          2
                        )}%`
                  }
                />

                <TradeMetric
                  label="Slippage protection"
                  value={pctFromBps(
                    order.slippageBps
                  )}
                />

                <TradeMetric
                  label="Router"
                  value={
                    order.router ??
                    "—"
                  }
                />

                <TradeMetric
                  label="Jupiter fee"
                  value={
                    order.feeBps !==
                    null
                      ? `${(
                          order.feeBps /
                          100
                        ).toFixed(
                          2
                        )}%`
                      : "—"
                  }
                />
              </div>

              {order.routePlan.length >
                0 && (
                <div className="mt-3 text-xs text-gray-500">
                  Route:{" "}
                  {order.routePlan.join(
                    " → "
                  )}
                </div>
              )}

              <div className="mt-4 rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-600">
                This is a new executable
                Jupiter quote, not the
                earlier comparison quote.
                Sign promptly because
                routes and prices can
                expire.
              </div>

              {stale && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This quote is more than
                  20 seconds old. Refresh
                  it before trading.
                </div>
              )}

              {order.status ===
                "disabled" && (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-800">
                  <strong>
                    Pass 3 safety mode.
                  </strong>{" "}
                  Jupiter successfully
                  built the quote, but
                  live wallet signing is
                  currently disabled.
                </div>
              )}

              {order.status ===
                "unavailable" && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {
                    order.error ??
                    "This trade cannot currently be executed."
                  }
                </div>
              )}

              {order.status ===
                "ready" && (
                <button
                  type="button"
                  disabled={
                    stale ||
                    executing
                  }
                  onClick={
                    executeTrade
                  }
                  className="mt-4 min-h-12 w-full rounded-xl bg-green-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {executing
                    ? "Waiting for wallet / confirmation…"
                    : `Sign & ${side === "buy" ? "buy" : "sell"} ${order.symbol}`}
                </button>
              )}
            </div>
          )}

          {execution && (
            <div
              className={[
                "mt-4 rounded-2xl border p-4",
                execution.status ===
                "Success"
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50",
              ].join(
                " "
              )}
            >
              <div className="font-bold">
                {execution.status ===
                "Success"
                  ? "Trade confirmed"
                  : "Trade failed"}
              </div>

              {execution.signature && (
                <a
                  href={`https://solscan.io/tx/${execution.signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-semibold underline"
                >
                  View transaction on
                  Solscan
                </a>
              )}

              {execution.error && (
                <div className="mt-2 text-sm">
                  {
                    execution.error
                  }
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TradeMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <div className="text-xs text-gray-500">
        {label}
      </div>

      <div className="mt-1 break-words font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}