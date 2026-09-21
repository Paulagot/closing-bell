import type { IssuerMeta } from "@/types";

export const USDC_MINT =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const USDC_DECIMALS = 6;

export const ISSUER_META: Record<string, IssuerMeta> = {
  xStocks: {
    fullName: "xStocks",
    structure: "Tokenized security",
    backing: "Underlying equity exposure",
    redemption: "Issuer redemption subject to eligibility",
    color: "#6366f1",
  },

  Ondo: {
    fullName: "Ondo Global Markets",
    structure: "Tokenized security",
    backing: "Underlying equity exposure",
    redemption: "Issuer redemption subject to eligibility",
    color: "#2563eb",
  },

  Backpack: {
    fullName: "Backpack Securities",
    structure: "Tokenized security",
    backing: "Underlying equity exposure",
    redemption: "Issuer redemption subject to eligibility",
    color: "#f97316",
  },
};
