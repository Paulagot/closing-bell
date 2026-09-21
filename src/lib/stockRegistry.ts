import { promises as fs } from "fs";
import path from "path";

import seed from "@/data/stock-registry.seed.json";

import type {
  IssuerToken,
  Stock,
} from "@/types";

export type StockRegistry = Record<string, Stock>;

interface StockRegistryStore {
  version: 1;
  stocks: StockRegistry;
  updatedAt: number;
}

export interface MintInfo {
  ticker: string;
  stockName: string;
  issuer: string;
  symbol: string;
  mint: string;
  decimals?: number;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function registryDirectory() {
  return (
    process.env.STOCK_DATA_DIR ??
    path.join(process.cwd(), "data", "config")
  );
}

function registryPath() {
  return path.join(registryDirectory(), "stocks.json");
}

async function ensureDirectory() {
  await fs.mkdir(registryDirectory(), { recursive: true });
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}

function normalizeIssuerToken(
  token: IssuerToken
): IssuerToken {
  return {
    symbol: String(token.symbol ?? "").trim(),
    mint: String(token.mint ?? "").trim(),
    decimals:
      token.decimals === undefined
        ? undefined
        : Number(token.decimals),
    multiplierMode:
      token.multiplierMode ?? "one_to_one",
    enabled:
      token.enabled !== false,
  };
}

function normalizeStock(
  stock: Stock
): Stock {
  const issuers: Record<string, IssuerToken> = {};

  for (const [issuer, token] of Object.entries(stock.issuers ?? {})) {
    const issuerName = issuer.trim();

    if (!issuerName) {
      continue;
    }

    issuers[issuerName] = normalizeIssuerToken(token);
  }

  return {
    name: String(stock.name ?? "").trim(),
    refSymbol: String(stock.refSymbol ?? "").trim().toUpperCase(),
    assetType: stock.assetType ?? "public_stock",
    exchange: String(stock.exchange ?? "").trim(),
    enabled: stock.enabled !== false,
    issuers,
  };
}

function normalizeStore(raw: unknown): StockRegistryStore {
  const candidate =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};

  const rawStocks =
    candidate.stocks &&
    typeof candidate.stocks === "object"
      ? (candidate.stocks as Record<string, Stock>)
      : {};

  const stocks: StockRegistry = {};

  for (const [ticker, stock] of Object.entries(rawStocks)) {
    const normalizedTicker = normalizeTicker(ticker);

    if (!normalizedTicker) {
      continue;
    }

    stocks[normalizedTicker] = normalizeStock(stock);
  }

  return {
    version: 1,
    stocks,
    updatedAt:
      typeof candidate.updatedAt === "number"
        ? candidate.updatedAt
        : Date.now(),
  };
}

function initialStore(): StockRegistryStore {
  return normalizeStore({
    version: 1,
    stocks: seed.stocks,
    updatedAt: Date.now(),
  });
}

async function atomicWrite(
  store: StockRegistryStore
) {
  await ensureDirectory();

  const file = registryPath();
  const temporary =
    `${file}.${process.pid}.${Date.now()}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(store, null, 2),
    "utf8"
  );

  await fs.rename(temporary, file);
}

async function readStoreUnsafe():
  Promise<StockRegistryStore> {
  await ensureDirectory();

  try {
    const raw = await fs.readFile(
      registryPath(),
      "utf8"
    );

    return normalizeStore(
      JSON.parse(raw)
    );
  } catch (error) {
    const code =
      (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      const initial = initialStore();
      await atomicWrite(initial);
      return initial;
    }

    throw error;
  }
}

export async function readStockRegistryAdmin():
  Promise<StockRegistry> {
  await writeQueue.catch(() => undefined);

  const store = await readStoreUnsafe();
  return store.stocks;
}

export async function readStockRegistry():
  Promise<StockRegistry> {
  const all = await readStockRegistryAdmin();
  const enabled: StockRegistry = {};

  for (const [ticker, stock] of Object.entries(all)) {
    if (stock.enabled === false) {
      continue;
    }

    const issuers = Object.fromEntries(
      Object.entries(stock.issuers).filter(
        ([, token]) => token.enabled !== false
      )
    );

    if (Object.keys(issuers).length === 0) {
      continue;
    }

    enabled[ticker] = {
      ...stock,
      issuers,
    };
  }

  return enabled;
}

export async function getStock(
  ticker: string
): Promise<Stock | null> {
  const registry = await readStockRegistry();
  return registry[normalizeTicker(ticker)] ?? null;
}

export async function getStockAdmin(
  ticker: string
): Promise<Stock | null> {
  const registry = await readStockRegistryAdmin();
  return registry[normalizeTicker(ticker)] ?? null;
}

export async function getAllMints():
  Promise<string[]> {
  const registry = await readStockRegistry();

  return Object.values(registry).flatMap(
    (stock) =>
      Object.values(stock.issuers).map(
        (token) => token.mint
      )
  );
}

export function mintToInfoFromRegistry(
  registry: StockRegistry,
  mint: string
): MintInfo | null {
  for (const [ticker, stock] of Object.entries(registry)) {
    for (const [issuer, token] of Object.entries(stock.issuers)) {
      if (token.mint === mint) {
        return {
          ticker,
          stockName: stock.name,
          issuer,
          symbol: token.symbol,
          mint: token.mint,
          decimals: token.decimals,
        };
      }
    }
  }

  return null;
}

export async function mintToInfo(
  mint: string
): Promise<MintInfo | null> {
  return mintToInfoFromRegistry(
    await readStockRegistry(),
    mint
  );
}

export async function upsertStock(
  ticker: string,
  stock: Stock
): Promise<StockRegistry> {
  const normalizedTicker = normalizeTicker(ticker);

  if (!normalizedTicker) {
    throw new Error("Ticker is required");
  }

  const task = writeQueue.then(async () => {
    const store = await readStoreUnsafe();

    store.stocks[normalizedTicker] =
      normalizeStock(stock);

    store.updatedAt = Date.now();

    await atomicWrite(store);

    return store.stocks;
  });

  writeQueue = task.catch(() => undefined);

  return task;
}

export async function deleteStock(
  ticker: string
): Promise<StockRegistry> {
  const normalizedTicker = normalizeTicker(ticker);

  const task = writeQueue.then(async () => {
    const store = await readStoreUnsafe();

    delete store.stocks[normalizedTicker];
    store.updatedAt = Date.now();

    await atomicWrite(store);

    return store.stocks;
  });

  writeQueue = task.catch(() => undefined);

  return task;
}
