"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useWallet,
} from "@solana/wallet-adapter-react";

import AppShell from "@/components/shell/AppShell";
import HomeCompetitionPreview from "@/components/dashboard/HomeCompetitionPreview";
import HowToReadClosingBell from "@/components/dashboard/HowToReadClosingBell";
import MarketOverviewTable from "@/components/dashboard/MarketOverviewTable";
import WalletPositionsPanel from "@/components/dashboard/WalletPositionsPanel";
import WhatsHappeningNow from "@/components/dashboard/WhatsHappeningNow";

import {
  approximateBreakEvenPct,
  buildDashboardMarketRows,
  median,
} from "@/lib/dashboardMarket";

import type {
  ComparisonData,
  TokenExecutions,
  WalletHolding,
} from "@/types";

import type {
  CompetitionPublicResponse,
} from "@/types/competitions";

import type {
  DashboardIntelligenceResponse,
} from "@/types/dashboardIntelligence";

const REFRESH_INTERVAL_MS =
  60_000;

interface DashboardExecutionSnapshot {
  generatedAt: string;

  executions: Record<
    string,
    TokenExecutions
  >;
}

export default function Home() {
  const {
    publicKey,
  } =
    useWallet();

  const [
    data,
    setData,
  ] =
    useState<
      ComparisonData |
      null
    >(
      null
    );

  const [
    executionSnapshot,
    setExecutionSnapshot,
  ] =
    useState<
      DashboardExecutionSnapshot |
      null
    >(
      null
    );

  const [
    competition,
    setCompetition,
  ] =
    useState<
      CompetitionPublicResponse |
      null
    >(
      null
    );

  const [
    intelligence,
    setIntelligence,
  ] =
    useState<
      DashboardIntelligenceResponse |
      null
    >(
      null
    );

  const [
    intelligenceLoading,
    setIntelligenceLoading,
  ] =
    useState(
      true
    );

  const [
    intelligenceError,
    setIntelligenceError,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    competitionLoading,
    setCompetitionLoading,
  ] =
    useState(
      true
    );

  const [
    competitionError,
    setCompetitionError,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const [
    holdings,
    setHoldings,
  ] =
    useState<
      WalletHolding[]
    >(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    executionLoading,
    setExecutionLoading,
  ] =
    useState(
      true
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
    executionError,
    setExecutionError,
  ] =
    useState<
      string |
      null
    >(
      null
    );

  const requestInFlight =
    useRef(
      false
    );

  const executionRequestInFlight =
    useRef(
      false
    );

  const walletRequestInFlight =
    useRef(
      false
    );

  const loadedWalletAddress =
    useRef<
      string |
      null
    >(
      null
    );

  const mountedRef =
    useRef(
      false
    );

  const refreshTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > |
      null
    >(
      null
    );

  const loadData =
    useCallback(
      async () => {
        if (
          requestInFlight.current
        ) {
          return;
        }

        requestInFlight.current =
          true;

        if (
          mountedRef.current
        ) {
          setLoading(
            true
          );

          setError(
            null
          );
        }

        try {
          const response =
            await fetch(
              "/api/prices",
              {
                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Market data returned ${response.status}`
            );
          }

          const json:
            ComparisonData =
            await response.json();

          if (
            mountedRef.current
          ) {
            setData(
              json
            );
          }
        } catch (
          loadError
        ) {
          if (
            mountedRef.current
          ) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : String(
                    loadError
                  )
            );
          }
        } finally {
          requestInFlight.current =
            false;

          if (
            mountedRef.current
          ) {
            setLoading(
              false
            );
          }
        }
      },
      []
    );

  const loadExecutionSnapshot =
    useCallback(
      async () => {
        if (
          executionRequestInFlight
            .current
        ) {
          return;
        }

        executionRequestInFlight
          .current =
          true;

        if (
          mountedRef.current
        ) {
          setExecutionLoading(
            true
          );

          setExecutionError(
            null
          );
        }

        try {
          const response =
            await fetch(
              "/api/dashboard-execution",
              {
                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Execution snapshot returned ${response.status}`
            );
          }

          const json:
            DashboardExecutionSnapshot =
            await response.json();

          if (
            mountedRef.current
          ) {
            setExecutionSnapshot(
              json
            );
          }
        } catch (
          loadError
        ) {
          if (
            mountedRef.current
          ) {
            setExecutionError(
              loadError instanceof Error
                ? loadError.message
                : String(
                    loadError
                  )
            );
          }
        } finally {
          executionRequestInFlight
            .current =
            false;

          if (
            mountedRef.current
          ) {
            setExecutionLoading(
              false
            );
          }
        }
      },
      []
    );

  const loadIntelligence =
    useCallback(
      async () => {
        if (
          mountedRef.current
        ) {
          setIntelligenceLoading(
            true
          );

          setIntelligenceError(
            null
          );
        }

        try {
          const response =
            await fetch(
              "/api/dashboard-intelligence",
              {
                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Dashboard intelligence returned ${response.status}`
            );
          }

          const json:
            DashboardIntelligenceResponse =
            await response.json();

          if (
            mountedRef.current
          ) {
            setIntelligence(
              json
            );
          }
        } catch (
          loadError
        ) {
          if (
            mountedRef.current
          ) {
            setIntelligenceError(
              loadError instanceof Error
                ? loadError.message
                : String(
                    loadError
                  )
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setIntelligenceLoading(
              false
            );
          }
        }
      },
      []
    );

  const loadCompetition =
    useCallback(
      async () => {
        setCompetitionLoading(
          true
        );

        setCompetitionError(
          null
        );

        try {
          const wallet =
            publicKey?.toBase58();

          const query =
            wallet
              ? `?wallet=${encodeURIComponent(
                  wallet
                )}`
              : "";

          const response =
            await fetch(
              `/api/competitions/active${query}`,
              {
                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            throw new Error(
              `Competition returned ${response.status}`
            );
          }

          const json:
            CompetitionPublicResponse =
            await response.json();

          if (
            mountedRef.current
          ) {
            setCompetition(
              json
            );
          }
        } catch (
          loadError
        ) {
          if (
            mountedRef.current
          ) {
            setCompetitionError(
              loadError instanceof Error
                ? loadError.message
                : String(
                    loadError
                  )
            );
          }
        } finally {
          if (
            mountedRef.current
          ) {
            setCompetitionLoading(
              false
            );
          }
        }
      },
      [
        publicKey,
      ]
    );

  const loadWallet =
    useCallback(
      async (
        force =
          false
      ) => {
        if (
          !publicKey
        ) {
          loadedWalletAddress.current =
            null;

          if (
            mountedRef.current
          ) {
            setHoldings(
              []
            );
          }

          return;
        }

        const address =
          publicKey.toBase58();

        if (
          !force &&
          loadedWalletAddress
            .current ===
            address
        ) {
          return;
        }

        if (
          walletRequestInFlight
            .current
        ) {
          return;
        }

        walletRequestInFlight
          .current =
          true;

        try {
          const response =
            await fetch(
              `/api/wallet?address=${address}`,
              {
                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            return;
          }

          const json =
            await response.json();

          loadedWalletAddress.current =
            address;

          if (
            mountedRef.current
          ) {
            setHoldings(
              json.holdings ??
              []
            );
          }
        } catch (
          walletError
        ) {
          console.warn(
            "[wallet] Could not read holdings:",
            walletError
          );
        } finally {
          walletRequestInFlight
            .current =
            false;
        }
      },
      [
        publicKey,
      ]
    );

  useEffect(
    () => {
      mountedRef.current =
        true;

      loadData();

      loadExecutionSnapshot();
      loadIntelligence();

      return () => {
        mountedRef.current =
          false;
      };
    },
    [
      loadData,
      loadExecutionSnapshot,
      loadIntelligence,
    ]
  );

  useEffect(
    () => {
      loadCompetition();

      loadWallet();
    },
    [
      loadCompetition,
      loadWallet,
    ]
  );

  useEffect(
    () => {
      function refreshWallet() {
        loadedWalletAddress.current =
          null;

        loadWallet(
          true
        );
      }

      window.addEventListener(
        "closingbell:wallet-refresh",
        refreshWallet
      );

      return () => {
        window.removeEventListener(
          "closingbell:wallet-refresh",
          refreshWallet
        );
      };
    },
    [
      loadWallet,
    ]
  );

  useEffect(
    () => {
      if (
        !data
      ) {
        return;
      }

      if (
        refreshTimer.current
      ) {
        clearTimeout(
          refreshTimer.current
        );
      }

      refreshTimer.current =
        setTimeout(
          () => {
            loadData();
          },
          REFRESH_INTERVAL_MS
        );

      return () => {
        if (
          refreshTimer.current
        ) {
          clearTimeout(
            refreshTimer.current
          );
        }
      };
    },
    [
      data?.timestamp,
      loadData,
    ]
  );

  const executions =
    executionSnapshot
      ?.executions ??
    data?.executions ??
    {};

  const marketRows =
    useMemo(
      () =>
        data
          ? buildDashboardMarketRows(
              data,
              executions
            )
          : [],
      [
        data,
        executions,
      ]
    );

  const stockCount =
    Object.keys(
      data?.stocks ??
      {}
    ).length;

  const issuerCount =
    new Set(
      Object.values(
        data?.stocks ??
        {}
      ).flatMap(
        (
          stock
        ) =>
          Object.keys(
            stock.issuers
          )
      )
    ).size;

  const stocksWithBuy =
    marketRows.filter(
      (
        row
      ) =>
        row.quotingIssuerCount >
        0
    ).length;

  const wrapperBreakEvens =
    useMemo(
      () => {
        if (
          !data
        ) {
          return [];
        }

        return Object.values(
          data.stocks
        ).flatMap(
          (
            stock
          ) =>
            Object.values(
              stock.issuers
            ).map(
              (
                token
              ) => {
                const quotes =
                  executions[
                    token.mint
                  ];

                return approximateBreakEvenPct(
                  quotes?.buy[
                    "1000"
                  ]?.status ===
                    "ok"
                    ? quotes.buy[
                        "1000"
                      ]
                        .effectivePrice
                    : null,
                  quotes?.sell[
                    "1000"
                  ]?.status ===
                    "ok"
                    ? quotes.sell[
                        "1000"
                      ]
                        .effectivePrice
                    : null
                );
              }
            )
        );
      },
      [
        data,
        executions,
      ]
    );

  const medianBreakEven =
    median(
      wrapperBreakEvens
    );

  const openCallsByTicker =
    useMemo(
      () => {
        const result:
          Record<
            string,
            number
          > =
          {};

        const now =
          Date.now();

        for (
          const question
          of competition
            ?.questions ??
          []
        ) {
          if (
            question.status !==
              "open" ||
            now >=
              question.lockAt
          ) {
            continue;
          }

          result[
            question.ticker
          ] =
            (
              result[
                question.ticker
              ] ??
              0
            ) +
            1;
        }

        return result;
      },
      [
        competition,
      ]
    );

  const openCallTitlesByTicker =
    useMemo(
      () => {
        const result:
          Record<
            string,
            string[]
          > =
          {};

        const now =
          Date.now();

        for (
          const question
          of competition
            ?.questions ??
          []
        ) {
          if (
            question.status !==
              "open" ||
            now >=
              question.lockAt
          ) {
            continue;
          }

          if (
            !result[
              question.ticker
            ]
          ) {
            result[
              question.ticker
            ] =
              [];
          }

          result[
            question.ticker
          ].push(
            question.title
          );
        }

        return result;
      },
      [
        competition,
      ]
    );

  const marketStatus =
    data?.marketStatus;

  async function refreshDashboard() {
    await Promise.all([
      loadData(),
      loadExecutionSnapshot(),
      loadIntelligence(),
      loadCompetition(),
      loadWallet(
        true
      ),
    ]);
  }

  return (
    <AppShell>
      <main className="app-shell space-y-5 py-5 md:py-8">
        <header className="rounded-3xl border border-slate-800 bg-slate-950 p-5 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            {marketStatus && (
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-black",
                  marketStatus.open
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-violet-500/10 text-violet-300",
                ].join(
                  " "
                )}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    marketStatus.open
                      ? "bg-emerald-500"
                      : "bg-violet-500",
                  ].join(
                    " "
                  )}
                />
                {
                  marketStatus.label
                }
              </span>
            )}
          </div>

          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">
            The price you see isn&apos;t the price you pay.
          </h1>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300 md:text-base">
            Closing Bell compares real $1,000 executable BUY and SELL quotes across tracked tokenized-stock issuers on Solana, shows how they relate to Wall Street, and gives you market calls to test your read.
          </p>

          <p className="mt-2 max-w-4xl text-[13px] leading-5 text-slate-400">
            Tracking {stockCount} tokenized stocks across {issuerCount} issuers. {stocksWithBuy} of {stockCount} currently have at least one executable $1K BUY quote.
          </p>

          {marketStatus && (
            <div className="mt-4 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              ET time{" "}
              {
                marketStatus.etTime
              }
            </div>
          )}
        </header>

        {marketStatus &&
          !marketStatus.open && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900/60 dark:bg-violet-950/20">
              <div className="text-xs font-black text-violet-800 dark:text-violet-300">
                Wall Street is closed. Solana is still trading.
              </div>

              <div className="mt-1 text-[12px] leading-5 text-violet-700 dark:text-violet-400/80">
                Closing Bell uses the latest available US-market price as the benchmark and keeps executable Solana quotes separate from that reference.
              </div>
            </div>
          )}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-300">
                Market pulse
              </div>

              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                Live execution snapshot across the tracked universe.
              </p>
            </div>

            <button
              type="button"
              onClick={
                refreshDashboard
              }
              disabled={
                loading ||
                executionLoading
              }
              className="min-h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {loading ||
              executionLoading
                ? "Refreshing…"
                : "Refresh live market"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <PulseStat
              label="Stocks tracked"
              value={
                stockCount.toString()
              }
            />

            <PulseStat
              label="Issuers compared"
              value={
                issuerCount.toString()
              }
            />

            <PulseStat
              label="Stocks with $1K BUY"
              value={`${stocksWithBuy}/${stockCount}`}
            />

            <PulseStat
              label="Median quoted break-even"
              value={
                medianBreakEven ===
                null
                  ? "—"
                  : `${medianBreakEven.toFixed(
                      2
                    )}%`
              }
            />
          </div>

          <div className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
            Break-even is calculated from the current $1K BUY/SELL quote relationship. It is a trading-friction diagnostic, not a forecast or promised return.
          </div>
        </section>

        <WhatsHappeningNow
          data={
            intelligence
          }
          loading={
            intelligenceLoading
          }
          error={
            intelligenceError
          }
        />

        <HomeCompetitionPreview
          data={
            competition
          }
          loading={
            competitionLoading
          }
          error={
            competitionError
          }
        />

        {data && (
          <WalletPositionsPanel
            connected={
              Boolean(
                publicKey
              )
            }
            holdings={
              holdings
            }
            data={
              data
            }
            executions={
              executions
            }
            intelligenceByTicker={
              intelligence?.stocks ??
              {}
            }
          />
        )}

        {loading &&
          !data && (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-500 dark:shadow-none">
              Loading tokenized-stock markets…
            </div>
          )}

        {error && (
          <div className="rounded-2xl border border-red-900 bg-red-950/20 px-4 py-3 text-xs text-red-300">
            {
              error
            }
          </div>
        )}

        {executionError && (
          <div className="rounded-2xl border border-amber-900 bg-amber-950/20 px-4 py-3 text-xs text-amber-300">
            Indicative market data is available, but the cached $1K execution snapshot could not be loaded. Stock detail pages can still request live execution directly.
          </div>
        )}

        {data && (
          <MarketOverviewTable
            rows={
              marketRows
            }
            openCallsByTicker={
              openCallsByTicker
            }
            openCallTitlesByTicker={
              openCallTitlesByTicker
            }
            activeCompetitionSlug={
              competition?.competition.slug ??
              null
            }
            intelligenceByTicker={
              intelligence?.stocks ??
              {}
            }
          />
        )}

        <HowToReadClosingBell />

        <footer className="pb-5 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
          Jupiter Price V3 supplies indicative on-chain market data. Jupiter Swap V2 supplies executable comparison pricing. The US equity feed supplies the underlying stock reference. BUY gaps and issuer comparisons are descriptive market diagnostics, not guaranteed savings, arbitrage opportunities or investment recommendations. Not financial advice.
        </footer>
      </main>
    </AppShell>
  );
}

function PulseStat({
  label,
  value,
}: {
  label:
    string;

  value:
    string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/55">
      <div className="text-[11px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-xl font-black tabular-nums text-slate-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}
