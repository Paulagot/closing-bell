export type WrapperInfo = {
  issuer: string;
  shortDescription: string;
  backing: string;
  redemption: string;
  availability: string;
  important: string[];
};

export const WRAPPER_INFO: Record<
  string,
  WrapperInfo
> = {
  xStocks: {
    issuer:
      "Backed Assets (JE) Limited",

    shortDescription:
      "A tokenized representation of the underlying equity or ETF. xStocks are designed to provide on-chain economic exposure to the referenced security.",

    backing:
      "xStocks states that each token is backed 1:1 by the underlying security held in regulated custody.",

    redemption:
      "Redemption depends on the xStocks framework, participating venues and user eligibility. Corporate actions can also be reflected through the token's multiplier/rebasing mechanism.",

    availability:
      "Transferable and tradable on supported blockchain venues, including outside normal US market hours, subject to liquidity and jurisdictional restrictions.",

    important: [
      "This is not the same legal product as holding the ordinary share in a brokerage account.",
      "Available liquidity can differ substantially from the underlying stock.",
      "The token can trade above or below the underlying market reference.",
      "Issuer, custody, blockchain and redemption risks are additional to ordinary stock-price risk.",
    ],
  },

  Backpack: {
    issuer:
      "Backpack Securities",

    shortDescription:
      "A tokenized security issued on Solana through Backpack's securities infrastructure.",

    backing:
      "Backpack states that supported tokens can be converted 1:1 into the corresponding traditional security entitlement through Backpack Securities.",

    redemption:
      "Supported tokenized securities can be deposited back into Backpack and converted into the corresponding traditional security entitlement, subject to eligibility and platform requirements.",

    availability:
      "The Solana token can trade 24/7 on supported venues, while the underlying traditional security has its own market hours.",

    important: [
      "The Solana token and the traditional security are different forms of holding the exposure.",
      "Secondary-market liquidity can differ from traditional exchange liquidity.",
      "Conversion and brokerage access can depend on eligibility and jurisdiction.",
      "Blockchain, platform and liquidity risks remain relevant.",
    ],
  },

  Ondo: {
    issuer:
      "Ondo Stocks",

    shortDescription:
      "A tokenized security designed to provide economic exposure to the referenced publicly traded security.",

    backing:
      "Ondo states that its tokenized stocks are fully backed by the corresponding securities and cash in transit, with collateral held through regulated financial institutions.",

    redemption:
      "Direct minting and redemption is subject to eligibility and onboarding. Ondo says eligible holders can redeem supported tokens for stablecoin value when redemption is available.",

    availability:
      "Tokens can be transferred and traded on supported blockchain venues outside traditional market hours. Direct mint/redemption availability can differ from secondary-market trading availability.",

    important: [
      "Holding an Ondo token does not automatically make the holder eligible for direct redemption.",
      "Secondary-market liquidity can differ from the underlying stock market.",
      "The token can trade at a premium or discount to the underlying reference.",
      "Issuer, counterparty, blockchain and jurisdictional risks also apply.",
    ],
  },
};