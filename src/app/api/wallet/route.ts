import {
  Connection,
  PublicKey,
} from "@solana/web3.js";

import {
  NextResponse,
} from "next/server";

import {
  readWalletHoldings,
} from "@/lib/solana";

import {
  USDC_MINT,
} from "@/lib/tokens";


export const dynamic =
  "force-dynamic";


export async function GET(
  request: Request
) {

  const {
    searchParams,
  } =
    new URL(
      request.url
    );


  const address =
    searchParams.get(
      "address"
    );


  if (!address) {

    return NextResponse.json(
      {
        error:
          "Missing address param",
      },
      {
        status:
          400,
      }
    );

  }


  if (
    address.length <
      32 ||
    address.length >
      44
  ) {

    return NextResponse.json(
      {
        error:
          "Invalid Solana address",
      },
      {
        status:
          400,
      }
    );

  }


  const rpcUrl =
    process.env
      .SOLANA_RPC_URL;


  if (!rpcUrl) {

    return NextResponse.json(
      {
        error:
          "SOLANA_RPC_URL is not configured",
      },
      {
        status:
          500,
      }
    );

  }


  try {

    const wallet =
      new PublicKey(
        address
      );


    const connection =
      new Connection(
        rpcUrl,
        "confirmed"
      );


    /**
     * Load stock holdings and USDC independently.
     *
     * The existing readWalletHoldings function
     * already works for the registered stock
     * wrappers.
     */
    const [
      holdings,
      usdcAccounts,
    ] =
      await Promise.all([

        readWalletHoldings(
          address
        ),

        connection
          .getParsedTokenAccountsByOwner(
            wallet,
            {
              mint:
                new PublicKey(
                  USDC_MINT
                ),
            }
          ),

      ]);


    const usdcBalance =
      usdcAccounts.value.reduce(
        (
          total,
          account
        ) => {

          const amount =
            Number(
              account.account
                .data.parsed
                ?.info
                ?.tokenAmount
                ?.uiAmountString ??
              "0"
            );


          return (
            total +
            (
              Number.isFinite(
                amount
              )
                ? amount
                : 0
            )
          );

        },
        0
      );


    return NextResponse.json({
      holdings,
      usdcBalance,
    });

  } catch (
    err
  ) {

    console.error(
      "Wallet read error:",
      err
    );


    return NextResponse.json(
      {
        error:
          "Failed to read wallet",

        details:
          String(
            err
          ),
      },
      {
        status:
          500,
      }
    );

  }

}
