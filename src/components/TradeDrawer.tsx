"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  VersionedTransaction,
} from "@solana/web3.js";

import {
  useWallet,
} from "@solana/wallet-adapter-react";

import type {
  TradeExecuteResponse,
  TradeOrderResponse,
} from "@/types/trading";

import type {
  TradeSide,
} from "@/types";

import IssuerBadge from "@/components/IssuerBadge";


interface Props {
  open: boolean;

  onClose: () => void;

  ticker: string;

  issuer: string;

  symbol: string;

  mint: string;

  side: TradeSide;

  /**
   * Amount used on the comparison screen.
   *
   * BUY uses this directly as the default USDC
   * amount.
   */
  amountUsd: number;

  /**
   * For SELL this should be the raw token
   * quantity from the comparison SELL quote.
   *
   * It gives the drawer the token quantity that
   * approximately represented amountUsd when
   * the user ran the comparison.
   */
  comparisonTokenAmount?:
    | number
    | null;
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


function tokenNumber(
  value:
    | number
    | null
    | undefined,
  maximumFractionDigits =
    8
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


  return value.toLocaleString(
    "en-US",
    {
      maximumFractionDigits,
    }
  );

}


function inputNumber(
  value:
    number
) {

  if (
    !Number.isFinite(
      value
    )
  ) {
    return "";
  }


  return String(
    Number(
      value.toFixed(
        9
      )
    )
  );

}


export default function TradeDrawer({
  open,
  onClose,
  ticker,
  issuer,
  symbol,
  mint,
  side,
  amountUsd,
  comparisonTokenAmount = null,
}: Props) {

  const {
    publicKey,
    signTransaction,
  } =
    useWallet();


  const [
    order,
    setOrder,
  ] =
    useState<
      TradeOrderResponse |
      null
    >(
      null
    );


  const [
    execution,
    setExecution,
  ] =
    useState<
      TradeExecuteResponse |
      null
    >(
      null
    );


  const [
    loading,
    setLoading,
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
    useState<
      string |
      null
    >(
      null
    );


  const [
    balanceLoading,
    setBalanceLoading,
  ] =
    useState(
      false
    );


  const [
    tokenBalance,
    setTokenBalance,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  const [
    usdcBalance,
    setUsdcBalance,
  ] =
    useState<
      number |
      null
    >(
      null
    );


  /**
   * BUY input is USDC.
   */
  const [
    buyAmount,
    setBuyAmount,
  ] =
    useState(
      String(
        amountUsd
      )
    );


  /**
   * SELL input is exact wrapper-token units.
   */
  const [
    sellAmount,
    setSellAmount,
  ] =
    useState(
      comparisonTokenAmount !==
        null
        ? inputNumber(
            comparisonTokenAmount
          )
        : ""
    );


  const parsedBuyAmount =
    Number(
      buyAmount
    );


  const parsedSellAmount =
    Number(
      sellAmount
    );


  const buyAmountValid =
    Number.isFinite(
      parsedBuyAmount
    ) &&
    parsedBuyAmount >=
      1 &&
    parsedBuyAmount <=
      100_000;


  const sellAmountValid =
    Number.isFinite(
      parsedSellAmount
    ) &&
    parsedSellAmount >
      0;


  const insufficientUsdc =
    side ===
      "buy" &&
    usdcBalance !==
      null &&
    buyAmountValid &&
    parsedBuyAmount >
      usdcBalance +
        0.000001;


  const insufficientTokens =
    side ===
      "sell" &&
    tokenBalance !==
      null &&
    sellAmountValid &&
    parsedSellAmount >
      tokenBalance +
        0.000000001;


  /**
   * Approximate USD value of the token amount
   * before a new quote has been requested.
   *
   * Once we have an order we use Jupiter's
   * actual expected USDC output instead.
   */
  const sellApproxUsd =
    order &&
    side ===
      "sell"
      ? order.outputDisplay
      : (
          comparisonTokenAmount &&
          comparisonTokenAmount >
            0
            ? parsedSellAmount *
              (
                amountUsd /
                comparisonTokenAmount
              )
            : null
        );


  const invalidateOrder =
    useCallback(
      () => {

        setOrder(
          null
        );

        setExecution(
          null
        );

        setError(
          null
        );

      },
      []
    );


const loadBalances =
    useCallback(
      async () => {

        if (
          !open ||
          !publicKey ||
          !mint
        ) {

          setTokenBalance(
            null
          );

          setUsdcBalance(
            null
          );

          return;
        }


        setBalanceLoading(
          true
        );

        setTokenBalance(
          null
        );

        setUsdcBalance(
          null
        );


        try {

          const response =
            await fetch(
              `/api/wallet?address=${encodeURIComponent(
                publicKey.toBase58()
              )}`,
              {
                cache:
                  "no-store",
              }
            );


          if (
            !response.ok
          ) {

            throw new Error(
              `Wallet API returned ${response.status}`
            );

          }


          const json =
            await response.json();


          const returnedUsdcBalance =
            Number(
              json?.usdcBalance
            );


          setUsdcBalance(
            Number.isFinite(
              returnedUsdcBalance
            )
              ? returnedUsdcBalance
              : 0
          );


          const holdings =
            Array.isArray(
              json?.holdings
            )
              ? json.holdings
              : [];


          const holding =
            holdings.find(
              (
                item: {
                  mint?: string;
                  balance?: number;
                }
              ) =>
                item?.mint ===
                mint
            );


          const balance =
            Number(
              holding?.balance ??
              0
            );


          setTokenBalance(
            Number.isFinite(
              balance
            )
              ? balance
              : 0
          );

        } catch (
          balanceError
        ) {

          console.warn(
            "[TradeDrawer] Could not load wallet balances:",
            balanceError
          );

          setTokenBalance(
            null
          );

          setUsdcBalance(
            null
          );

        } finally {

          setBalanceLoading(
            false
          );

        }

      },
      [
        open,
        publicKey,
        mint,
      ]
    );


  useEffect(
    () => {

      if (!open) {
        return;
      }


      setOrder(
        null
      );

      setExecution(
        null
      );

      setError(
        null
      );


      setBuyAmount(
        String(
          amountUsd
        )
      );


      setSellAmount(
        comparisonTokenAmount !==
          null
          ? inputNumber(
              comparisonTokenAmount
            )
          : ""
      );


      const previous =
        document.body.style
          .overflow;


      document.body.style.overflow =
        "hidden";


      return () => {

        document.body.style.overflow =
          previous;

      };

    },
    [
      open,
      issuer,
      side,
      amountUsd,
      comparisonTokenAmount,
    ]
  );


  useEffect(
    () => {

      loadBalances();

    },
    [
      loadBalances,
    ]
  );


  if (!open) {
    return null;
  }


  function setSellPercent(
    percentage: number
  ) {

    if (
      tokenBalance ===
        null ||
      tokenBalance <=
        0
    ) {
      return;
    }


    const next =
      tokenBalance *
      percentage;


    setSellAmount(
      inputNumber(
        next
      )
    );


    invalidateOrder();

  }


  function setSellMax() {

    if (
      tokenBalance ===
        null
    ) {
      return;
    }


    setSellAmount(
      inputNumber(
        tokenBalance
      )
    );


    invalidateOrder();

  }


  async function getFreshOrder() {

    if (!publicKey) {

      setError(
        "Connect your wallet first."
      );

      return;

    }


    if (!mint) {

      setError(
        "This token is not available."
      );

      return;

    }


    if (
      side ===
      "buy"
    ) {

      if (
        !buyAmountValid
      ) {

        setError(
          "Enter a USDC amount between $1 and $100,000."
        );

        return;

      }


      if (
        insufficientUsdc
      ) {

        setError(
          `Insufficient USDC balance. You currently have ${money(
            usdcBalance
          )} USDC available.`
        );

        return;

      }

    } else {

      if (
        !sellAmountValid
      ) {

        setError(
          `Enter the amount of ${symbol} you want to sell.`
        );

        return;

      }


      if (
        tokenBalance !==
          null &&
        tokenBalance <=
          0
      ) {

        setError(
          `Your wallet does not currently hold any ${symbol}.`
        );

        return;

      }


      if (
        insufficientTokens
      ) {

        setError(
          `Insufficient ${symbol} balance. You have ${tokenNumber(
            tokenBalance
          )} ${symbol} available.`
        );

        return;

      }

    }


    setLoading(
      true
    );


    setError(
      null
    );


    setOrder(
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

                ...(side ===
                "buy"
                  ? {
                      amountUsd:
                        parsedBuyAmount,
                    }
                  : {
                      tokenAmount:
                        sellAmount,
                    }),

                taker:
                  publicKey.toBase58(),
              }),
          }
        );


      const json =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          json.error ??
          json.details ??
          "Fresh trade quote unavailable"
        );

      }


      setOrder(
        json
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

      setLoading(
        false
      );

    }

  }


  async function executeTrade() {

    if (
      !order ||
      order.status !==
        "ready" ||
      !order.transaction ||
      !order.requestId ||
      !publicKey ||
      !signTransaction
    ) {

      setError(
        "A fresh executable order is required."
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
            (
              character
            ) =>
              character.charCodeAt(
                0
              )
          )
        );


      const signed =
        await signTransaction(
          transaction
        );


      const bytes =
        signed.serialize();


      let binary =
        "";


      for (
        let index =
          0;
        index <
          bytes.length;
        index++
      ) {

        binary +=
          String.fromCharCode(
            bytes[
              index
            ]
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


      const json =
        await response.json();


      if (
        !response.ok
      ) {

        throw new Error(
          json.error ??
          "Trade execution failed"
        );

      }


      setExecution(
        json
      );


      window.dispatchEvent(
        new CustomEvent(
          "closingbell:wallet-refresh"
        )
      );


      /**
       * RPC balances can lag the transaction
       * confirmation very slightly.
       */
      window.setTimeout(
        () => {

          loadBalances();

        },
        1500
      );

    } catch (
      executeError
    ) {

      setError(
        executeError instanceof Error
          ? executeError.message
          : String(
              executeError
            )
      );

    } finally {

      setExecuting(
        false
      );

    }

  }


  const minimumOutputDisplay =
    order &&
    order.minimumOutputAmount &&
    order.outputAmount !==
      "0"
      ? (
          order.outputDisplay *
          (
            Number(
              order.minimumOutputAmount
            ) /
            Number(
              order.outputAmount
            )
          )
        )
      : null;


  const canRequestQuote =
    side ===
      "buy"
      ? (
          buyAmountValid &&
          !insufficientUsdc
        )
      : (
          sellAmountValid &&
          !insufficientTokens &&
          (
            tokenBalance ===
              null ||
            tokenBalance >
              0
          )
        );


  return (
    <div className="fixed inset-0 z-[110]">

      <button
        type="button"
        aria-label="Close trade"
        onClick={
          onClose
        }
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
      />


      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-gray-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">

        <div className="p-5 md:p-7">

          {/* Header */}

          <div className="flex items-start justify-between gap-4">

            <div>

              <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                Fresh executable order
              </div>


              <div className="mt-3 flex items-center gap-2">

                <IssuerBadge
                  issuer={
                    issuer
                  }
                />


                <span className="text-sm text-gray-500 dark:text-slate-400">
                  {symbol}
                </span>

              </div>


              <h2 className="mt-3 text-3xl font-black capitalize text-gray-950 dark:text-white">
                {side}{" "}
                {ticker}
              </h2>


              <div className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                Comparison size{" "}
                {money(
                  amountUsd
                )}
              </div>

            </div>


            <button
              type="button"
              onClick={
                onClose
              }
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl dark:border-slate-700 dark:text-white"
            >
              ×
            </button>

          </div>


          {/* Wallet */}

          <div className="mt-7 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">

            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
              Your wallet
            </div>


            {!publicKey ? (

              <div className="mt-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                Connect your wallet to trade.
              </div>

            ) : balanceLoading ? (

              <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                Reading balances…
              </div>

            ) : (

              <div className="mt-3 grid grid-cols-2 gap-3">

                <div>

                  <div className="text-xs text-gray-400 dark:text-slate-500">
                    USDC available
                  </div>

                  <div className="mt-1 font-black text-gray-950 dark:text-white">
                    {usdcBalance !==
                    null
                      ? money(
                          usdcBalance
                        )
                      : "—"}
                  </div>

                </div>


                <div>

                  <div className="text-xs text-gray-400 dark:text-slate-500">
                    {symbol} available
                  </div>

                  <div className="mt-1 font-black text-gray-950 dark:text-white">
                    {tokenBalance !==
                    null
                      ? `${tokenNumber(
                          tokenBalance
                        )} ${symbol}`
                      : "—"}
                  </div>

                </div>

              </div>

            )}

          </div>


          {/* BUY amount */}

          {side ===
          "buy" && (

            <div className="mt-7">

              <label className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
                Amount to spend
              </label>


              <div className="mt-2 flex rounded-2xl border border-gray-200 bg-white focus-within:border-violet-500 dark:border-slate-700 dark:bg-slate-950">

                <span className="flex items-center px-4 text-lg font-black text-gray-400 dark:text-slate-500">
                  $
                </span>


                <input
                  type="number"
                  min="1"
                  max="100000"
                  step="0.01"
                  value={
                    buyAmount
                  }
                  onChange={(
                    event
                  ) => {

                    setBuyAmount(
                      event.target
                        .value
                    );

                    invalidateOrder();

                  }}
                  className="min-h-16 min-w-0 flex-1 bg-transparent px-1 text-2xl font-black text-gray-950 outline-none dark:text-white"
                />


                <span className="flex items-center px-4 text-sm font-bold text-gray-400 dark:text-slate-500">
                  USDC
                </span>

              </div>


              <div className="mt-2 flex justify-between gap-3 text-xs">

                <span className="text-gray-400 dark:text-slate-500">
                  You compared{" "}
                  {money(
                    amountUsd
                  )}
                </span>


                <span className="font-semibold text-gray-600 dark:text-slate-300">
                  Available{" "}
                  {usdcBalance !==
                  null
                    ? money(
                        usdcBalance
                      )
                    : "—"}
                </span>

              </div>


              {insufficientUsdc && (

                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                  <strong>
                    Insufficient USDC balance.
                  </strong>{" "}
                  You have{" "}
                  {money(
                    usdcBalance
                  )}{" "}
                  available.
                </div>

              )}

            </div>

          )}


          {/* SELL amount */}

          {side ===
          "sell" && (

            <div className="mt-7">

              <label className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
                Amount to sell
              </label>


              <div className="mt-2 flex rounded-2xl border border-gray-200 bg-white focus-within:border-violet-500 dark:border-slate-700 dark:bg-slate-950">

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={
                    sellAmount
                  }
                  onChange={(
                    event
                  ) => {

                    setSellAmount(
                      event.target
                        .value
                    );

                    invalidateOrder();

                  }}
                  className="min-h-16 min-w-0 flex-1 bg-transparent px-4 text-2xl font-black text-gray-950 outline-none dark:text-white"
                />


                <span className="flex items-center px-4 text-sm font-bold text-gray-400 dark:text-slate-500">
                  {symbol}
                </span>

              </div>


              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">

                <div className="text-xs text-gray-400 dark:text-slate-500">

                  {sellApproxUsd !==
                    null &&
                  Number.isFinite(
                    sellApproxUsd
                  )
                    ? `≈ ${money(
                        sellApproxUsd
                      )}`
                    : `Comparison was ${money(
                        amountUsd
                      )}`}

                </div>


                <div className="text-xs font-semibold text-gray-600 dark:text-slate-300">
                  Available{" "}
                  {tokenBalance !==
                  null
                    ? `${tokenNumber(
                        tokenBalance
                      )} ${symbol}`
                    : "—"}
                </div>

              </div>


              <div className="mt-3 grid grid-cols-4 gap-2">

                <PercentButton
                  label="25%"
                  onClick={() =>
                    setSellPercent(
                      0.25
                    )
                  }
                disabled={
  tokenBalance === null ||
  tokenBalance <= 0
}
                />


                <PercentButton
                  label="50%"
                  onClick={() =>
                    setSellPercent(
                      0.5
                    )
                  }
               disabled={
  tokenBalance === null ||
  tokenBalance <= 0
}
                />


                <PercentButton
                  label="75%"
                  onClick={() =>
                    setSellPercent(
                      0.75
                    )
                  }
              disabled={
  tokenBalance === null ||
  tokenBalance <= 0
}
                />


                <PercentButton
                  label="MAX"
                  onClick={
                    setSellMax
                  }
               disabled={
  tokenBalance === null ||
  tokenBalance <= 0
}
                />

              </div>


              {insufficientTokens && (

                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">

                  <div className="font-bold">
                    Insufficient {symbol} balance
                  </div>


                  <div className="mt-1">
                    You are trying to sell{" "}
                    {tokenNumber(
                      parsedSellAmount
                    )}{" "}
                    {symbol}, but your wallet contains{" "}
                    {tokenNumber(
                      tokenBalance
                    )}{" "}
                    {symbol}.
                  </div>


                  <button
                    type="button"
                    onClick={
                      setSellMax
                    }
                    className="mt-2 font-bold underline"
                  >
                    Sell max
                  </button>

                </div>

              )}


              {tokenBalance ===
                0 && (

                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  Your connected wallet does not currently hold any{" "}
                  {symbol}.
                </div>

              )}

            </div>

          )}


          {/* Fresh quote button */}

          {!execution && (

            <div className="mt-7">

              <p className="text-xs leading-5 text-gray-400 dark:text-slate-500">
                A new Jupiter order will be requested for the amount above. The executable price may differ from the comparison because market liquidity and routes can change.
              </p>


              <button
                type="button"
                disabled={
                  loading ||
                  !publicKey ||
                  !canRequestQuote
                }
                onClick={
                  getFreshOrder
                }
                className="mt-4 min-h-12 w-full rounded-xl bg-violet-600 px-4 text-sm font-bold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Getting fresh quote…"
                  : order
                    ? "Refresh trade quote"
                    : "Get fresh trade quote"}
              </button>

            </div>

          )}


          {/* Quote */}

          {order &&
          !execution && (

            <div className="mt-7">

              <div className="rounded-2xl border border-gray-200 p-4 dark:border-slate-800">

                <div className="flex items-start justify-between gap-4">

                  <div>

                    <div className="text-xs font-medium text-gray-400 dark:text-slate-500">
                      Executable{" "}
                      {side.toUpperCase()}{" "}
                      price / share
                    </div>


                    <div className="mt-1 text-3xl font-black text-gray-950 dark:text-white">
                      {money(
                        order.effectivePrice
                      )}
                    </div>

                  </div>


                  <div className="text-right">

                    {side ===
                    "buy" ? (

                      <>

                        <div className="text-xs text-gray-400 dark:text-slate-500">
                          Spend
                        </div>

                        <div className="mt-1 font-black text-gray-950 dark:text-white">
                          {money(
                            order.inputDisplay
                          )}
                        </div>

                      </>

                    ) : (

                      <>

                        <div className="text-xs text-gray-400 dark:text-slate-500">
                          Est. receive
                        </div>

                        <div className="mt-1 font-black text-gray-950 dark:text-white">
                          {money(
                            order.outputDisplay
                          )}
                        </div>

                      </>

                    )}

                  </div>

                </div>


                <div className="mt-5 grid grid-cols-2 gap-3">

                  <Metric
                    label={
                      side ===
                      "buy"
                        ? "Quoted receive"
                        : `${symbol} sold`
                    }
                    value={
                      side ===
                      "buy"
                        ? `${tokenNumber(
                            order.outputDisplay,
                            9
                          )} ${symbol}`
                        : `${tokenNumber(
                            order.inputDisplay,
                            9
                          )} ${symbol}`
                    }
                  />


                  <Metric
                    label={
                      side ===
                      "buy"
                        ? "Minimum protected"
                        : "Quoted receive"
                    }
                    value={
                      side ===
                      "buy"
                        ? (
                            minimumOutputDisplay !==
                            null
                              ? `${tokenNumber(
                                  minimumOutputDisplay,
                                  9
                                )} ${symbol}`
                              : "—"
                          )
                        : `${money(
                            order.outputDisplay
                          )} USDC`
                    }
                  />


                  {side ===
                  "sell" && (
                    <Metric
                      label="Minimum protected"
                      value={
                        minimumOutputDisplay !==
                        null
                          ? `${money(
                              minimumOutputDisplay
                            )} USDC`
                          : "—"
                      }
                    />
                  )}


                  <Metric
                    label="Jupiter fee"
                    value={
                      order.feeBps ===
                      null
                        ? "—"
                        : `${(
                            order.feeBps /
                            100
                          ).toFixed(
                            2
                          )}%`
                    }
                  />


                  <Metric
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


                  <Metric
                    label="Router"
                    value={
                      order.router ??
                      "—"
                    }
                  />


                  <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900">

                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400">

                      Slippage protection

                      <span
                        title="Jupiter automatically sets the maximum adverse price movement allowed before the trade fails. This is a protection limit, not an expected trading cost."
                        className="cursor-help font-bold text-violet-600 dark:text-violet-400"
                      >
                        ⓘ
                      </span>

                    </div>


                    <div className="mt-1 font-bold text-gray-950 dark:text-white">

                      {order.slippageBps !==
                      null
                        ? order.slippageBps ===
                          0
                          ? "0.00% · firm quote"
                          : `${(
                              order.slippageBps /
                              100
                            ).toFixed(
                              2
                            )}%`
                        : "Automatic"}

                    </div>


                    <div className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">
                      {order.slippageBps ===
                      0
                        ? "Quoted and protected output are the same"
                        : "Maximum adverse movement allowed before the trade fails"}
                    </div>

                  </div>

                </div>

              </div>


              {order.status ===
                "disabled" && (

                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
                  Live signing is disabled.
                </div>

              )}


              {order.status ===
                "ready" && (

                <button
                  type="button"
                  disabled={
                    executing
                  }
                  onClick={
                    executeTrade
                  }
                  className="mt-4 min-h-12 w-full rounded-xl bg-green-600 px-4 font-bold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {executing
                    ? "Waiting for wallet…"
                    : side ===
                      "buy"
                      ? `Sign & buy ${symbol}`
                      : `Sign & sell ${tokenNumber(
                          order.inputDisplay
                        )} ${symbol}`}
                </button>

              )}

            </div>

          )}


          {execution && (

            <div className="mt-7 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900 dark:border-green-900 dark:bg-green-950/30 dark:text-green-200">

              <div className="font-bold">
                Trade confirmed
              </div>


              <div className="mt-1 text-sm">
                Your wallet balances will refresh automatically.
              </div>


              {execution.signature && (

                <a
                  href={`https://solscan.io/tx/${execution.signature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm font-bold underline"
                >
                  View on Solscan
                </a>

              )}

            </div>

          )}


          {error && (

            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>

          )}

        </div>

      </aside>

    </div>
  );

}


function PercentButton({
  label,
  onClick,
  disabled,
}: {
  label: string;

  onClick:
    () => void;

  disabled:
    boolean;
}) {

  return (
    <button
      type="button"
      onClick={
        onClick
      }
      disabled={
        disabled
      }
      className="min-h-9 rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-600 transition hover:border-violet-400 hover:text-violet-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
    >
      {label}
    </button>
  );

}


function Metric({
  label,
  value,
}: {
  label: string;

  value: string;
}) {

  return (
    <div className="rounded-xl bg-gray-50 p-3 dark:bg-slate-900">

      <div className="text-xs text-gray-500 dark:text-slate-400">
        {label}
      </div>


      <div className="mt-1 break-words font-bold text-gray-950 dark:text-white">
        {value}
      </div>

    </div>
  );

}