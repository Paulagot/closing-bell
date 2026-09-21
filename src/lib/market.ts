import type { MarketStatus } from "@/types";

/**
 * US regular stock-market session:
 *
 * 09:30 ET → 16:00 ET
 *
 * This deliberately describes the REGULAR TradFi session.
 *
 * Tokenized equities on Solana may continue trading outside
 * these hours, which is exactly what the dashboard wants to
 * highlight.
 */
export function getMarketStatus(): MarketStatus {
  const now = new Date();

  /**
   * Use Intl.formatToParts rather than:
   *
   * new Date(now.toLocaleString(...))
   *
   * This avoids reparsing a locale-formatted date string and
   * handles EST / EDT automatically via America/New_York.
   */
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = getPart("weekday");
  const hour = Number(getPart("hour"));
  const minute = Number(getPart("minute"));

  const mins = hour * 60 + minute;

  const etTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(now);

  /**
   * Saturday / Sunday.
   */
  if (weekday === "Sat" || weekday === "Sun") {
    return {
      open: false,
      label: "Weekend",
      etTime,
    };
  }

  /**
   * Regular market session:
   *
   * 09:30 → 16:00 ET
   */
  const regularOpen = 9 * 60 + 30;
  const regularClose = 16 * 60;

  if (
    mins >= regularOpen &&
    mins < regularClose
  ) {
    return {
      open: true,
      label: "Market Open",
      etTime,
    };
  }

  /**
   * Before the regular session.
   *
   * We call all weekday time before 09:30 "Pre-Market".
   *
   * For this application's purpose that's useful because
   * Wall Street's regular reference session is still closed.
   */
  if (mins < regularOpen) {
    return {
      open: false,
      label: "Pre-Market",
      etTime,
    };
  }

  /**
   * After 16:00 ET.
   */
  return {
    open: false,
    label: "After Hours",
    etTime,
  };
}


/**
 * Format USD.
 *
 * Examples:
 * 123.456  → $123.46
 * 1234.5   → $1,234.50
 */
export function fmtUsd(
  n: number | null | undefined
): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }

  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


/**
 * Format percentage with explicit sign.
 *
 * Examples:
 *  0.52 → +0.52%
 * -1.14 → -1.14%
 */
export function fmtPct(
  n: number | null | undefined
): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }

  return (
    (n >= 0 ? "+" : "") +
    n.toFixed(2) +
    "%"
  );
}


/**
 * Format a compact USD value.
 *
 * Examples:
 * 100        → $100
 * 1,000      → $1.0K
 * 250,000    → $250.0K
 * 1,200,000  → $1.2M
 */
export function fmtCompact(
  n: number | null | undefined
): string {
  if (n == null || !Number.isFinite(n)) {
    return "—";
  }

  const abs = Math.abs(n);

  if (abs >= 1_000_000_000) {
    return (
      "$" +
      (n / 1_000_000_000).toFixed(1) +
      "B"
    );
  }

  if (abs >= 1_000_000) {
    return (
      "$" +
      (n / 1_000_000).toFixed(1) +
      "M"
    );
  }

  if (abs >= 1_000) {
    return (
      "$" +
      (n / 1_000).toFixed(1) +
      "K"
    );
  }

  return "$" + n.toFixed(0);
}