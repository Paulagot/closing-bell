import { Connection, PublicKey } from "@solana/web3.js";
import type { WalletHolding } from "@/types";
import {
  mintToInfoFromRegistry,
  readStockRegistry,
} from "./stockRegistry";

/** Get a Solana RPC connection */
export function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  return new Connection(url, "confirmed");
}

// Token-2022 program ID (xStocks are Token-2022 mints)
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
// Standard SPL Token program
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

/**
 * Read a wallet's tokenized stock holdings.
 * Checks both Token and Token-2022 programs.
 */
export async function readWalletHoldings(
  walletAddress: string
): Promise<WalletHolding[]> {
  const conn = getConnection();
  const owner = new PublicKey(walletAddress);
  const holdings: WalletHolding[] = [];

  const registry =
    await readStockRegistry();

  // Build a set of all known stock mints for fast lookup
  const knownMints = new Set<string>();
  for (const stock of Object.values(registry)) {
    for (const issuer of Object.values(stock.issuers)) {
      knownMints.add(issuer.mint);
    }
  }

  // Fetch token accounts from both programs
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    try {
      const accounts = await conn.getParsedTokenAccountsByOwner(owner, { programId });

      for (const { account } of accounts.value) {
        const parsed = account.data.parsed?.info;
        if (!parsed) continue;

        const mint = parsed.mint as string;
        if (!knownMints.has(mint)) continue;

        const balance = parsed.tokenAmount?.uiAmount || 0;
        if (balance <= 0) continue;

        const info = mintToInfoFromRegistry(registry, mint);
        if (!info) continue;

        holdings.push({
          mint,
          symbol: info.symbol,
          issuer: info.issuer,
          ticker: info.ticker,
          balance,
          valueUsd: null, // Filled in by the caller with price data
        });
      }
    } catch (err) {
      console.error(`Error reading ${programId.toBase58()} accounts:`, err);
    }
  }

  return holdings;
}
