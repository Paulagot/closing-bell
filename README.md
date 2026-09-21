# Stocklana Compare

**Cross-issuer comparison for tokenized stocks on Solana.**

Same stock, different issuers, different prices. Compare tokenized equities across xStocks, Ondo, Backpack, and PreStocks — see who has the best price, the tightest spread, the least slippage, and understand the legal structure behind each token.

Built for the [Stocklana Hackathon](https://hackathons.solana.com/hackathons/stocklana) (Sept 2026, $100K prizes).

## What it does

- **Price comparison** — live on-chain prices for every issuer's version of the same stock (e.g. TSLAx vs TSLAON)
- **Slippage at real trade sizes** — Jupiter Quote API shows what you'd actually pay for a $100, $1K, or $10K trade, not just the mid-price
- **Drift from reference** — compares on-chain price to the real stock price (via Finnhub), especially useful after hours when the gap widens
- **Wallet connect** — connect Phantom/Solflare to see your holdings and get alerts when a cheaper issuer exists
- **Legal structure comparison** — tracker certificate vs total-return note vs redeemable share — these are not the same product

## Quick start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/stocklana-compare.git
cd stocklana-compare

# 2. Install
npm install

# 3. Set up env
cp .env.example .env.local
# Edit .env.local — at minimum add a Finnhub API key (free at finnhub.io)

# 4. Run
npm run dev
# Open http://localhost:3000
```

## Environment variables

| Variable | Required | Free tier | Description |
|----------|----------|-----------|-------------|
| `SOLANA_RPC_URL` | No | Yes | Solana RPC. Default: public mainnet (rate limited). Get a free one at [helius.dev](https://helius.dev) |
| `JUPITER_API_URL` | No | Yes | Jupiter API. Default: `lite-api.jup.ag` (no key, rate limited) |
| `FINNHUB_API_KEY` | No | Yes | Stock reference prices. Free at [finnhub.io](https://finnhub.io) (60 calls/min) |

**Everything works without any API keys** — you just won't see reference stock prices without Finnhub.

## Architecture

```
Browser (React + Tailwind + wallet-adapter)
    ↓
Next.js API routes (server-side, no CORS issues)
    ↓
├── Jupiter Price API v2 → on-chain prices for all tokenized stock mints
├── Jupiter Quote API    → slippage at $100 / $1K / $10K trade sizes
├── Finnhub API          → real stock prices for drift comparison
└── Solana RPC           → wallet token account reads
```

**Why server-side API routes?** Jupiter's APIs have CORS restrictions from browsers. Running the fetches server-side in Next.js API routes avoids this entirely. The browser only talks to `/api/prices` and `/api/wallet`.

## Data sources (all free)

| Data | Source | Cost |
|------|--------|------|
| On-chain token prices | Jupiter Price API (lite) | Free, rate limited |
| Swap quotes / slippage | Jupiter Quote API (lite) | Free, rate limited |
| Stock reference prices | Finnhub | Free (60 calls/min) |
| Wallet holdings | Solana RPC | Free (public node) |
| Mint addresses | Hardcoded from Solscan | n/a |

## Token registry

All mint addresses are verified from Solscan. xStocks use vanity "Xs..." prefixes, Ondo tokens end with "...ondo". See `src/lib/tokens.ts` for the full registry.

To add a new stock or issuer, add its mint address to `STOCK_REGISTRY` in that file.

## Deploy

```bash
# Build
npm run build

# Deploy to Vercel (recommended, free)
npx vercel
```

Or push to GitHub and connect to Vercel — it auto-deploys.

## Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- @solana/wallet-adapter (Phantom, Solflare)
- @solana/web3.js

## License

MIT
