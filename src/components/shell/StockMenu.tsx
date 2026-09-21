"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Stock } from "@/types";

export default function StockMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [registry, setRegistry] =
    useState<Record<string, Stock>>({});
  const containerRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        const response =
          await fetch(
            "/api/registry",
            {
              cache:
                "no-store",
            }
          );

        if (!response.ok) {
          return;
        }

        const json =
          await response.json();

        if (!cancelled) {
          setRegistry(
            json.stocks ?? {}
          );
        }
      } catch {
        // Keep the menu usable even if registry refresh fails.
      }
    }

    loadRegistry();

    return () => {
      cancelled = true;
    };
  }, []);

  const stocks = useMemo(
    () =>
      Object.entries(registry)
        .map(([ticker, stock]) => ({
          ticker,
          name: stock.name,
        }))
        .sort((a, b) =>
          a.ticker.localeCompare(
            b.ticker
          )
        ),
    [registry]
  );

  const currentTicker =
    pathname.startsWith("/stock/")
      ? pathname
          .split("/")[2]
          ?.toUpperCase()
      : null;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onPointerDown(
      event: MouseEvent
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      onPointerDown
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        onPointerDown
      );
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen(
            (current) => !current
          )
        }
        className={[
          "inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-bold transition",
          currentTicker
            ? "bg-violet-500/10 text-violet-300"
            : "text-slate-300 hover:bg-slate-900 hover:text-white",
        ].join(" ")}
      >
        Stocks
        {currentTicker
          ? ` · ${currentTicker}`
          : ""}
        <span className="text-[10px] text-slate-500">
          ▼
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[1200] w-72 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
          <div className="border-b border-slate-800 px-4 py-3">
            <div className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
              Supported stocks
            </div>
            <div className="mt-1 text-xs text-slate-400">
              This list updates from the live stock registry.
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {stocks.map((stock) => (
              <Link
                key={stock.ticker}
                href={`/stock/${encodeURIComponent(
                  stock.ticker
                )}`}
                className={[
                  "flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition",
                  stock.ticker ===
                  currentTicker
                    ? "bg-violet-500/10 text-violet-200"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white",
                ].join(" ")}
              >
                <span className="font-black">
                  {stock.ticker}
                </span>
                <span className="truncate text-xs text-slate-500">
                  {stock.name}
                </span>
              </Link>
            ))}

            {stocks.length === 0 && (
              <div className="px-3 py-4 text-xs text-slate-500">
                No stocks are currently enabled.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
