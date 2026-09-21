"use client";

import {
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";

import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";

import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui";

import {
  PhantomWalletAdapter,
} from "@solana/wallet-adapter-phantom";

import {
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-solflare";

import "@solana/wallet-adapter-react-ui/styles.css";

const RPC_URL =
  "https://api.mainnet-beta.solana.com";

/**
 * Wallet Adapter currently pulls React Native / React 19
 * typings through its mobile-wallet dependency, while this
 * Next 14 app correctly uses React 18.
 *
 * Runtime behaviour is unaffected; this only bridges the
 * incompatible duplicate React type definitions during
 * `next build`.
 */
const ConnectionProviderCompat =
  ConnectionProvider as unknown as ComponentType<any>;

const SolanaWalletProviderCompat =
  SolanaWalletProvider as unknown as ComponentType<any>;

const WalletModalProviderCompat =
  WalletModalProvider as unknown as ComponentType<any>;

export default function WalletProvider({
  children,
}: {
  children: ReactNode;
}) {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProviderCompat
      endpoint={RPC_URL}
    >
      <SolanaWalletProviderCompat
        wallets={wallets}
        autoConnect
      >
        <WalletModalProviderCompat>
          {children}
        </WalletModalProviderCompat>
      </SolanaWalletProviderCompat>
    </ConnectionProviderCompat>
  );
}
