"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import ThemeToggle from "@/components/ThemeToggle";
import StockMenu from "@/components/shell/StockMenu";

const WalletMultiButton = dynamic(
  async () => {
    const mod = await import("@solana/wallet-adapter-react-ui");
    return mod.WalletMultiButton;
  },
  { ssr: false }
);

interface Props {
  children: ReactNode;
}

export default function AppShell({
  children,
}: Props) {
  const pathname = usePathname();

  const homeActive = pathname === "/";
  const competitionsActive = pathname.startsWith("/competitions");

  const navLink = (active: boolean) =>
    [
      "inline-flex min-h-10 shrink-0 items-center rounded-xl px-3 text-sm font-bold transition",
      active
        ? "bg-violet-500/10 text-violet-300"
        : "text-slate-300 hover:bg-slate-900 hover:text-white",
    ].join(" ");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-950 transition-colors dark:bg-[#090d12] dark:text-white">
      <header className="sticky top-0 z-[1000] border-b border-slate-800/90 bg-[#090d12]/95 backdrop-blur">
        <div className="app-shell py-2">
          <div className="flex min-h-12 items-center gap-2">
            <Link
              href="/"
              className="shrink-0 text-[17px] font-black tracking-tight text-white sm:text-lg md:mr-4 md:text-xl"
            >
              Closing Bell
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
              <Link href="/" className={navLink(homeActive)}>
                Home
              </Link>

              <StockMenu />

              <Link
                href="/competitions"
                className={navLink(competitionsActive)}
              >
                Competitions
              </Link>
            </nav>

            <div className="relative z-[1200] ml-auto flex shrink-0 items-center gap-2">
              <ThemeToggle />

              <div className="closing-bell-wallet relative z-[1300] min-w-0">
                <WalletMultiButton />
              </div>
            </div>
          </div>

          <nav className="mobile-shell-nav mt-2 flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 pt-2 sm:hidden">
            <Link href="/" className={navLink(homeActive)}>
              Home
            </Link>

            <StockMenu />

            <Link
              href="/competitions"
              className={navLink(competitionsActive)}
            >
              Competitions
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <style jsx global>{`
        .wallet-adapter-dropdown {
          position: relative;
          z-index: 1400 !important;
        }

        .wallet-adapter-dropdown-list {
          z-index: 9999 !important;
        }

        .wallet-adapter-modal {
          z-index: 9999 !important;
        }

        .closing-bell-wallet .wallet-adapter-button {
          min-height: 40px;
          border-radius: 12px;
        }

        .mobile-shell-nav {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .mobile-shell-nav::-webkit-scrollbar {
          display: none;
        }

        @media (max-width: 639px) {
          .closing-bell-wallet .wallet-adapter-button {
            max-width: 132px;
            min-height: 40px;
            padding-left: 12px;
            padding-right: 12px;
            font-size: 12px;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }

          .closing-bell-wallet .wallet-adapter-button-start-icon {
            margin-right: 7px;
          }
        }
      `}</style>
    </div>
  );
}
