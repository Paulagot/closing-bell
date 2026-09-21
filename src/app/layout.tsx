import type { Metadata } from "next";
import WalletProvider from "@/components/WalletProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Closing Bell — Tokenized Stock Execution on Solana",
  description:
    "Compare tokenized stocks across issuers on Solana. See live execution prices, market drift, liquidity, and the best route to trade.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <WalletProvider>
          <div className="min-h-screen w-full">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
