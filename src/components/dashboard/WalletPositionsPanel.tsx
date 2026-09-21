"use client";

import Link from "next/link";
import WalletExitQuote from "@/components/dashboard/WalletExitQuote";

import type {
  ComparisonData,
  TokenExecutions,
  WalletHolding,
} from "@/types";

import type {
  DashboardIssuerChange,
  DashboardStockIntelligence,
} from "@/types/dashboardIntelligence";

interface Props {
  connected: boolean;
  holdings: WalletHolding[];
  data: ComparisonData;
  executions: Record<string, TokenExecutions>;
  intelligenceByTicker?: Record<string, DashboardStockIntelligence>;
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value >= 100 ? 2 : 4,
  }).format(value);
}

function compactUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function pct(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function issuerIntelligence(
  stock: DashboardStockIntelligence | undefined,
  holding: WalletHolding
): DashboardIssuerChange | null {
  if (!stock) {
    return null;
  }

  const byIssuer = stock.issuers[holding.issuer];

  if (byIssuer) {
    return byIssuer;
  }

  return (
    Object.values(stock.issuers).find(
      (issuer) =>
        issuer.mint === holding.mint ||
        issuer.issuer.toLowerCase() === holding.issuer.toLowerCase()
    ) ?? null
  );
}

function ChangeLine({
  value,
  suffix = "pp",
}: {
  value: number | null;
  suffix?: "pp" | "%";
}) {
  if (
    value === null ||
    !Number.isFinite(value) ||
    Math.abs(value) < 0.005
  ) {
    return null;
  }

  return (
    <div className="mt-1 text-[11px] font-bold tabular-nums text-slate-600 dark:text-slate-400">
      {value > 0 ? "↑" : "↓"} {Math.abs(value).toFixed(2)}
      {suffix} vs previous capture
    </div>
  );
}

function PercentileLine({
  value,
  label,
  unusual = false,
}: {
  value: number | null;
  label: string;
  unusual?: boolean;
}) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  return (
    <div
      className={[
        "mt-1 text-[11px] font-bold tabular-nums",
        unusual ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-400",
      ].join(" ")}
    >
      {value.toFixed(0)}th percentile of {label}
    </div>
  );
}

function historicalRead(
  intelligence: DashboardIssuerChange | null
): string | null {
  if (!intelligence) {
    return null;
  }

  const sellPct = intelligence.sellDivergenceMagnitudePercentile;
  const frictionPct = intelligence.breakEvenPercentile;

  if (intelligence.unusualSellGap && sellPct !== null) {
    return `The current SELL divergence is unusually wide for this wrapper, around the ${sellPct.toFixed(
      0
    )}th percentile of its recorded history.`;
  }

  if (intelligence.unusualFriction && frictionPct !== null) {
    return `Current round-trip friction is unusually high for this wrapper, around the ${frictionPct.toFixed(
      0
    )}th percentile of its recorded history.`;
  }

  if (frictionPct !== null && frictionPct <= 25) {
    return `Current round-trip friction is in the lowest quarter of this wrapper's recorded history.`;
  }

  if (sellPct !== null && sellPct <= 25) {
    return `The current SELL divergence is in the lowest quarter of this wrapper's recorded history.`;
  }

  return null;
}

export default function WalletPositionsPanel({
  connected,
  holdings,
  data,
  executions,
  intelligenceByTicker = {},
}: Props) {
  if (!connected) {
    return (
      <section className="rounded-3xl border border-violet-200 bg-violet-50/70 p-5 shadow-sm dark:border-violet-900/70 dark:bg-violet-950/20 dark:shadow-none">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
          Your positions
        </div>

        <div className="mt-2 text-lg font-black text-slate-950 dark:text-white">
          See the market through your own holdings
        </div>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          Connect your Solana wallet to see supported tokenized-stock holdings and how the current exit conditions for your own wrapper compare with its recorded history.
        </p>

        <div className="mt-3 text-xs font-bold text-violet-700 dark:text-violet-300">
          Use <strong>Connect wallet</strong> in the header to load your holding stats.
        </div>
      </section>
    );
  }

  if (holdings.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-none">
        <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
          Your positions
        </div>

        <div className="mt-2 font-black text-slate-950 dark:text-white">Wallet connected</div>

        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
          No supported Closing Bell tokenized-stock holdings were found in this wallet. You can still compare every tracked market below.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm dark:border-violet-900/70 dark:bg-violet-950/15 dark:shadow-none">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-violet-700 dark:text-violet-400">
            Your positions
          </div>

          <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-white">
            Current exit conditions for what you hold
          </h2>

          <p className="mt-2 max-w-3xl text-[13px] leading-5 text-slate-600 dark:text-slate-400">
            This view stays focused on the wrapper already in your wallet: its current $1K SELL quote, divergence from Wall Street, quoted round-trip friction and liquidity, plus how those readings compare with its own stored history.
          </p>
        </div>

        <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
          {holdings.length} {holdings.length === 1 ? "holding" : "holdings"}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {holdings.map((holding) => {
          const stock = data.stocks[holding.ticker];
          const reference = stock ? data.reference[stock.refSymbol] : null;
          const wallStreetPrice =
            reference?.price ?? reference?.previousClose ?? null;

          const indicativeNormalized = data.prices[holding.mint]?.normalizedPriceUsd ?? null;
          const indicativeRaw = data.prices[holding.mint]?.priceUsd ?? null;

          const shareBalance =
            holding.shareEquivalentBalance ??
            holding.balance * (holding.shareMultiplier ?? 1);

          const indicativeValue = indicativeNormalized !== null
            ? shareBalance * indicativeNormalized
            : indicativeRaw !== null ? holding.balance * indicativeRaw : null;

          const ownSell = executions[holding.mint]?.sell["1000"];
          // The $1K SELL effective price is a size-dependent estimate, not an
          // exact quote for this wallet's token quantity.
          const approximateSellValue = ownSell?.status === "ok" &&
            ownSell.effectivePrice !== null && Number.isFinite(ownSell.effectivePrice)
            ? shareBalance * ownSell.effectivePrice : null;
          const stockIntelligence = intelligenceByTicker[holding.ticker];
          const history = issuerIntelligence(stockIntelligence, holding);
          const read = historicalRead(history);

          return (
            <article
              key={holding.mint}
              className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-black text-slate-950 dark:text-white">
                    {holding.ticker}{" "}
                    <span className="text-slate-600 dark:text-slate-400">· {holding.issuer}</span>
                  </div>

                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                    {holding.balance.toFixed(4)} {holding.symbol}
                    {approximateSellValue !== null ? ` · approx. SELL ${money(approximateSellValue)}` : indicativeValue !== null ? ` · indicative ${money(indicativeValue)}` : ""}
                  </div>
                </div>

                <Link
                  href={`/stock/${encodeURIComponent(holding.ticker)}`}
                  className="text-xs font-black text-violet-700 hover:text-violet-600 dark:text-violet-300 dark:hover:text-violet-200"
                >
                  Analyse →
                </Link>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Metric
                  label="Your issuer $1K SELL"
                  value={
                    ownSell?.status === "ok"
                      ? money(ownSell.effectivePrice)
                      : "Quote unavailable"
                  }
                />

                <Metric
                  label="SELL gap vs Wall Street"
                  value={pct(history?.currentSellGapPct ?? null)}
                  change={
                    history?.sellGapChangeSinceLastPctPoints ?? null
                  }
                  changeSuffix="pp"
                  percentile={
                    history?.sellDivergenceMagnitudePercentile ?? null
                  }
                  percentileLabel="SELL divergence history"
                  unusual={history?.unusualSellGap ?? false}
                />

                <Metric
                  label="Quoted round-trip friction"
                  value={pct(history?.currentBreakEvenPct ?? null)}
                  change={
                    history?.breakEvenChangeSinceLastPctPoints ?? null
                  }
                  changeSuffix="pp"
                  percentile={history?.breakEvenPercentile ?? null}
                  percentileLabel="friction history"
                  unusual={history?.unusualFriction ?? false}
                />

                <Metric
                  label="Reported liquidity"
                  value={compactUsd(history?.currentLiquidityUsd ?? null)}
                  change={history?.liquidityChangeSinceLastPct ?? null}
                  changeSuffix="%"
                  percentile={history?.liquidityPercentile ?? null}
                  percentileLabel="liquidity history"
                />
              </div>

              <WalletExitQuote ticker={holding.ticker} mint={holding.mint} tokenAmount={holding.balance} />

              {read && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 px-3 py-2 text-[12px] font-semibold leading-5 text-slate-700 dark:text-slate-300">
                  {read}
                </div>
              )}

              <div className="mt-3 text-[11px] leading-5 text-slate-600 dark:text-slate-400">
                The header approximates SELL proceeds at the $1K quoted rate (or explicitly labels an indicative fallback). Only the on-demand exact-balance SELL quote reflects your current token quantity. Neither figure includes your cost basis or guarantees a fill.
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  change = null,
  changeSuffix = "pp",
  percentile = null,
  percentileLabel = "history",
  unusual = false,
}: {
  label: string;
  value: string;
  change?: number | null;
  changeSuffix?: "pp" | "%";
  percentile?: number | null;
  percentileLabel?: string;
  unusual?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {label}
      </div>

      <div className="mt-1 font-black tabular-nums text-slate-950 dark:text-slate-200">
        {value}
      </div>

      <ChangeLine value={change} suffix={changeSuffix} />
      <PercentileLine
        value={percentile}
        label={percentileLabel}
        unusual={unusual}
      />
    </div>
  );
}
