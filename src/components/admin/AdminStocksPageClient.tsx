"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AppShell from "@/components/shell/AppShell";

import type {
  AssetType,
  MultiplierMode,
  Stock,
} from "@/types";

type Registry =
  Record<
    string,
    Stock
  >;

type WrapperRow = {
  issuer: string;
  symbol: string;
  mint: string;
  decimals: string;
  multiplierMode: MultiplierMode;
  enabled: boolean;
};

const emptyWrapper = (): WrapperRow => ({
  issuer: "xStocks",
  symbol: "",
  mint: "",
  decimals: "8",
  multiplierMode: "xstocks",
  enabled: true,
});

export default function AdminStocksPageClient() {
  const [stocks, setStocks] =
    useState<Registry>({});
  const [loaded, setLoaded] =
    useState(false);
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [editingTicker, setEditingTicker] =
    useState<string | null>(null);

  const [ticker, setTicker] =
    useState("");
  const [name, setName] =
    useState("");
  const [refSymbol, setRefSymbol] =
    useState("");
  const [exchange, setExchange] =
    useState("");
  const [assetType, setAssetType] =
    useState<AssetType>("public_stock");
  const [enabled, setEnabled] =
    useState(true);
  const [wrappers, setWrappers] =
    useState<WrapperRow[]>([
      emptyWrapper(),
    ]);
  const [validation, setValidation] =
    useState<any>(null);

  const orderedStocks =
    useMemo(
      () =>
        Object.entries(stocks).sort(
          ([a], [b]) =>
            a.localeCompare(b)
        ),
      [stocks]
    );

  function authHeaders(
    json = false
  ): Record<string, string> {
    return json
      ? { "Content-Type": "application/json" }
      : {};
  }

  async function loadStocks() {
    setBusy(true);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/stocks",
          {
            cache:
              "no-store",
            headers:
              authHeaders(),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ??
            json.details ??
            "Unable to load stocks"
        );
      }

      setStocks(
        json.stocks ?? {}
      );
      setLoaded(true);
      setMessage(
        "Stock registry loaded."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  function resetForm() {
    setEditingTicker(null);
    setTicker("");
    setName("");
    setRefSymbol("");
    setExchange("");
    setAssetType("public_stock");
    setEnabled(true);
    setWrappers([
      emptyWrapper(),
    ]);
    setValidation(null);
  }

  function editStock(
    key: string,
    stock: Stock
  ) {
    setEditingTicker(key);
    setTicker(key);
    setName(stock.name);
    setRefSymbol(stock.refSymbol);
    setExchange(
      stock.exchange ?? ""
    );
    setAssetType(
      stock.assetType ??
        "public_stock"
    );
    setEnabled(
      stock.enabled !== false
    );
    setWrappers(
      Object.entries(
        stock.issuers
      ).map(
        ([issuer, token]) => ({
          issuer,
          symbol:
            token.symbol,
          mint:
            token.mint,
          decimals:
            String(
              token.decimals ??
                ""
            ),
          multiplierMode:
            token.multiplierMode ??
              "one_to_one",
          enabled:
            token.enabled !==
            false,
        })
      )
    );
    setValidation(null);
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function updateWrapper(
    index: number,
    patch:
      Partial<WrapperRow>
  ) {
    setWrappers(
      (current) =>
        current.map(
          (row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );
    setValidation(null);
  }

  function removeWrapper(
    index: number
  ) {
    setWrappers(
      (current) =>
        current.filter(
          (_, rowIndex) =>
            rowIndex !== index
        )
    );
    setValidation(null);
  }

  function stockPayload() {
    const issuers: Stock["issuers"] =
      {};

    for (
      const row
      of wrappers
    ) {
      issuers[
        row.issuer.trim()
      ] = {
        symbol:
          row.symbol.trim(),
        mint:
          row.mint.trim(),
        decimals:
          Number(
            row.decimals
          ),
        multiplierMode:
          row.multiplierMode,
        enabled:
          row.enabled,
      };
    }

    return {
      ticker:
        ticker
          .trim()
          .toUpperCase(),
      stock: {
        name:
          name.trim(),
        refSymbol:
          refSymbol
            .trim()
            .toUpperCase(),
        exchange:
          exchange.trim(),
        assetType,
        enabled,
        issuers,
      } satisfies Stock,
    };
  }

  async function validate() {
    setBusy(true);
    setMessage(null);
    setValidation(null);

    try {
      const response =
        await fetch(
          "/api/admin/stocks/validate",
          {
            method:
              "POST",
            headers:
              authHeaders(true),
            body:
              JSON.stringify({
                refSymbol,
                wrappers:
                  wrappers.map(
                    (row) => ({
                      ...row,
                      decimals:
                        Number(
                          row.decimals
                        ),
                    })
                  ),
              }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ??
            json.details ??
            "Validation failed"
        );
      }

      setValidation(json);
      setMessage(
        json.ok
          ? "Validation passed."
          : "Validation found one or more problems."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);

    try {
      const payload =
        stockPayload();

      const response =
        await fetch(
          "/api/admin/stocks",
          {
            method:
              "POST",
            headers:
              authHeaders(true),
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ??
            json.details ??
            "Unable to save stock"
        );
      }

      setStocks(
        json.stocks ?? {}
      );
      setLoaded(true);
      setMessage(
        `${payload.ticker} saved.`
      );
      resetForm();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeStock(
    key: string
  ) {
    if (
      !window.confirm(
        `Delete ${key} from the registry? Existing history files are not deleted.`
      )
    ) {
      return;
    }

    setBusy(true);

    try {
      const response =
        await fetch(
          `/api/admin/stocks/${encodeURIComponent(
            key
          )}`,
          {
            method:
              "DELETE",
            headers:
              authHeaders(),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ??
            json.details ??
            "Unable to delete stock"
        );
      }

      setStocks(
        json.stocks ?? {}
      );

      if (
        editingTicker ===
        key
      ) {
        resetForm();
      }

      setMessage(
        `${key} deleted from the registry.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadStocks();
  }, []);

  return (
    <AppShell>
      <main className="app-shell space-y-5 py-6">
        <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">
            Admin
          </div>
          <h1 className="mt-1 text-2xl font-black text-white">
            Stock registry
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Add or edit stocks and tokenized wrappers without changing source code. Disabled items remain stored but are excluded from the public app and new history captures.
          </p>

          <div className="mt-4">
            <button
              type="button"
              onClick={loadStocks}
              disabled={busy}
              className="min-h-11 rounded-xl bg-violet-600 px-4 text-sm font-black text-white disabled:opacity-50"
            >
              {busy ? "Working…" : "Reload registry"}
            </button>
          </div>

          {message && (
            <div className="mt-3 text-sm font-semibold text-slate-300">
              {message}
            </div>
          )}
        </section>

        {loaded && (
          <>
            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-400">
                    {editingTicker
                      ? `Editing ${editingTicker}`
                      : "Add stock"}
                  </div>
                  <h2 className="mt-1 text-xl font-black text-white">
                    Stock and wrapper details
                  </h2>
                </div>
                {editingTicker && (
                  <button
                    type="button"
                    onClick={
                      resetForm
                    }
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300"
                  >
                    Cancel edit
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Field
                  label="Ticker"
                  value={ticker}
                  onChange={
                    setTicker
                  }
                  disabled={
                    Boolean(
                      editingTicker
                    )
                  }
                />
                <Field
                  label="Company name"
                  value={name}
                  onChange={setName}
                />
                <Field
                  label="Finnhub symbol"
                  value={
                    refSymbol
                  }
                  onChange={
                    setRefSymbol
                  }
                />
                <Field
                  label="Exchange"
                  value={
                    exchange
                  }
                  onChange={
                    setExchange
                  }
                  placeholder="NASDAQ / NYSE"
                />

                <label className="grid gap-1 text-xs font-bold text-slate-400">
                  Asset type
                  <select
                    value={
                      assetType
                    }
                    onChange={(event) =>
                      setAssetType(
                        event.target
                          .value as AssetType
                      )
                    }
                    className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                  >
                    <option value="public_stock">
                      Public stock
                    </option>
                    <option value="etf">
                      ETF
                    </option>
                    <option value="private_equity">
                      Private equity
                    </option>
                  </select>
                </label>

                <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-bold text-slate-300">
                  <input
                    type="checkbox"
                    checked={
                      enabled
                    }
                    onChange={(event) =>
                      setEnabled(
                        event.target
                          .checked
                      )
                    }
                  />
                  Stock enabled
                </label>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-black text-white">
                    Wrappers
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setWrappers(
                        (current) => [
                          ...current,
                          emptyWrapper(),
                        ]
                      )
                    }
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300"
                  >
                    + Add wrapper
                  </button>
                </div>

                {wrappers.map(
                  (
                    row,
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:grid-cols-6"
                    >
                      <Field
                        label="Issuer"
                        value={
                          row.issuer
                        }
                        onChange={(
                          value
                        ) =>
                          updateWrapper(
                            index,
                            {
                              issuer:
                                value,
                            }
                          )
                        }
                      />
                      <Field
                        label="Token symbol"
                        value={
                          row.symbol
                        }
                        onChange={(
                          value
                        ) =>
                          updateWrapper(
                            index,
                            {
                              symbol:
                                value,
                            }
                          )
                        }
                      />
                      <div className="lg:col-span-2">
                        <Field
                          label="Solana mint"
                          value={
                            row.mint
                          }
                          onChange={(
                            value
                          ) =>
                            updateWrapper(
                              index,
                              {
                                mint:
                                  value,
                              }
                            )
                          }
                        />
                      </div>
                      <Field
                        label="Decimals"
                        value={
                          row.decimals
                        }
                        onChange={(
                          value
                        ) =>
                          updateWrapper(
                            index,
                            {
                              decimals:
                                value,
                            }
                          )
                        }
                      />

                      <div className="grid gap-2">
                        <label className="grid gap-1 text-xs font-bold text-slate-400">
                          Multiplier
                          <select
                            value={
                              row.multiplierMode
                            }
                            onChange={(event) =>
                              updateWrapper(
                                index,
                                {
                                  multiplierMode:
                                    event
                                      .target
                                      .value as MultiplierMode,
                                }
                              )
                            }
                            className="min-h-11 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                          >
                            <option value="one_to_one">
                              1:1
                            </option>
                            <option value="xstocks">
                              xStocks
                            </option>
                          </select>
                        </label>

                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-400">
                            <input
                              type="checkbox"
                              checked={
                                row.enabled
                              }
                              onChange={(event) =>
                                updateWrapper(
                                  index,
                                  {
                                    enabled:
                                      event
                                        .target
                                        .checked,
                                  }
                                )
                              }
                              className="mr-1"
                            />
                            Enabled
                          </label>
                          {wrappers.length >
                            1 && (
                            <button
                              type="button"
                              onClick={() =>
                                removeWrapper(
                                  index
                                )
                              }
                              className="text-xs font-bold text-rose-400"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>

              {validation && (
                <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-300">
                  <div className="font-black text-white">
                    Finnhub{" "}
                    {validation
                      .reference
                      ?.ok
                      ? "✓"
                      : "✕"}{" "}
                    {validation
                      .reference
                      ?.symbol}{" "}
                    {validation
                      .reference
                      ?.price
                      ? `· $${validation.reference.price}`
                      : ""}
                  </div>
                  <div className="mt-3 space-y-2">
                    {validation
                      .wrappers
                      ?.map(
                        (
                          item: any,
                          index: number
                        ) => (
                          <div
                            key={
                              index
                            }
                          >
                            {item.ok
                              ? "✓"
                              : "✕"}{" "}
                            {item.issuer}{" "}
                            {item.symbol} —{" "}
                            {
                              item.message
                            }
                          </div>
                        )
                      )}
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={
                    validate
                  }
                  disabled={
                    busy
                  }
                  className="rounded-xl border border-violet-700 px-4 py-2.5 text-sm font-black text-violet-300 disabled:opacity-50"
                >
                  Validate
                </button>
                <button
                  type="button"
                  onClick={
                    save
                  }
                  disabled={
                    busy
                  }
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white disabled:opacity-50"
                >
                  Save stock
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
              <h2 className="text-xl font-black text-white">
                Current registry
              </h2>

              <div className="mt-4 grid gap-3">
                {orderedStocks.map(
                  ([
                    key,
                    stock,
                  ]) => (
                    <div
                      key={
                        key
                      }
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
                    >
                      <div>
                        <div className="font-black text-white">
                          {key} ·{" "}
                          {
                            stock.name
                          }
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {
                            Object.keys(
                              stock.issuers
                            ).length
                          }{" "}
                          wrappers ·{" "}
                          {stock.enabled ===
                          false
                            ? "Disabled"
                            : "Active"}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            editStock(
                              key,
                              stock
                            )
                          }
                          className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            removeStock(
                              key
                            )
                          }
                          className="rounded-xl border border-rose-900 px-3 py-2 text-xs font-bold text-rose-400"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-400">
      {label}
      <input
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        disabled={disabled}
        className="min-h-11 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white outline-none focus:border-violet-500 disabled:opacity-50"
      />
    </label>
  );
}
