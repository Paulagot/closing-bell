import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  PublicKey,
} from "@solana/web3.js";

import type {
  TradeExecuteResponse,
} from "@/types/trading";


export const dynamic =
  "force-dynamic";

export const revalidate =
  0;


const JUPITER_EXECUTE_URL =
  "https://api.jup.ag/swap/v2/execute";


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function isValidWallet(
  address: string
) {

  try {

    new PublicKey(
      address
    );


    return true;

  } catch {

    return false;

  }

}


// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────

export async function POST(
  request: NextRequest
) {

  try {

    // ─────────────────────────────────────────
    // Live trading switch
    // ─────────────────────────────────────────

    const liveTradingEnabled =
      process.env
        .ENABLE_LIVE_TRADING ===
      "true";


    if (
      !liveTradingEnabled
    ) {

      return NextResponse.json(
        {
          error:
            "Live trading is disabled",
        },
        {
          status:
            403,
        }
      );

    }


    // ─────────────────────────────────────────
    // Jupiter API key
    // ─────────────────────────────────────────

    const apiKey =
      process.env
        .JUPITER_API_KEY;


    if (
      !apiKey
    ) {

      return NextResponse.json(
        {
          error:
            "JUPITER_API_KEY is not configured",
        },
        {
          status:
            500,
        }
      );

    }


    // ─────────────────────────────────────────
    // Request
    // ─────────────────────────────────────────

    const body =
      await request.json();


    const requestId =
      String(
        body?.requestId ??
        ""
      ).trim();


    const walletAddress =
      String(
        body?.walletAddress ??
        ""
      ).trim();


    const signedTransaction =
      String(
        body?.signedTransaction ??
        ""
      ).trim();


    // ─────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────

    if (
      !requestId
    ) {

      return NextResponse.json(
        {
          error:
            "Missing Jupiter request ID",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !walletAddress ||
      !isValidWallet(
        walletAddress
      )
    ) {

      return NextResponse.json(
        {
          error:
            "Invalid wallet address",
        },
        {
          status:
            400,
        }
      );

    }


    if (
      !signedTransaction
    ) {

      return NextResponse.json(
        {
          error:
            "Missing signed transaction",
        },
        {
          status:
            400,
        }
      );

    }


    // ─────────────────────────────────────────
    // Execute with Jupiter
    // ─────────────────────────────────────────
    //
    // Do NOT put this through our 2.1-second
    // quote scheduler.
    //
    // Jupiter gives /swap/v2/execute its own much
    // higher rate limit and this is an actual
    // user trade, so it should execute immediately.
    // ─────────────────────────────────────────

    const jupiterResponse =
      await fetch(
        JUPITER_EXECUTE_URL,
        {
          method:
            "POST",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            "x-api-key":
              apiKey,
          },

          body:
            JSON.stringify({
              signedTransaction,
              requestId,
            }),

          cache:
            "no-store",

          signal:
            AbortSignal.timeout(
              30_000
            ),
        }
      );


    const text =
      await jupiterResponse.text();


    let result:
      any;


    try {

      result =
        JSON.parse(
          text
        );

    } catch {

      console.error(
        "[trade/execute] Jupiter returned invalid JSON",
        {
          status:
            jupiterResponse.status,

          response:
            text.slice(
              0,
              500
            ),
        }
      );


      return NextResponse.json(
        {
          error:
            "Jupiter returned an invalid execution response",
        },
        {
          status:
            502,
        }
      );

    }


    // ─────────────────────────────────────────
    // Jupiter HTTP failure
    // ─────────────────────────────────────────

    if (
      !jupiterResponse.ok
    ) {

      console.error(
        "[trade/execute] Jupiter rejected execution",
        {
          status:
            jupiterResponse.status,

          requestId,

          walletAddress,

          response:
            result,
        }
      );


      return NextResponse.json(
        {
          error:
            result?.error ??
            result?.errorMessage ??
            "Jupiter trade execution failed",

          code:
            typeof result?.code ===
            "number"
              ? result.code
              : jupiterResponse.status,
        },
        {
          status:
            jupiterResponse.status,

          headers: {
            "Cache-Control":
              "private, no-store",
          },
        }
      );

    }


    // ─────────────────────────────────────────
    // Normalize response
    // ─────────────────────────────────────────

    const status =
      String(
        result?.status ??
        ""
      );


    const successful =
      status.toLowerCase() ===
        "success" ||
      (
        Boolean(
          result?.signature
        ) &&
        !result?.error
      );


    const response:
      TradeExecuteResponse = {

      status:
        successful
          ? "Success"
          : "Failed",

      signature:
        typeof result
          ?.signature ===
        "string"
          ? result.signature
          : undefined,

      code:
        typeof result
          ?.code ===
        "number"
          ? result.code
          : successful
            ? 0
            : -1,

      totalInputAmount:
        result
          ?.totalInputAmount !==
        undefined &&
        result
          ?.totalInputAmount !==
        null
          ? String(
              result
                .totalInputAmount
            )
          : undefined,

      totalOutputAmount:
        result
          ?.totalOutputAmount !==
        undefined &&
        result
          ?.totalOutputAmount !==
        null
          ? String(
              result
                .totalOutputAmount
            )
          : undefined,

      inputAmountResult:
        result
          ?.inputAmountResult !==
        undefined &&
        result
          ?.inputAmountResult !==
        null
          ? String(
              result
                .inputAmountResult
            )
          : undefined,

      outputAmountResult:
        result
          ?.outputAmountResult !==
        undefined &&
        result
          ?.outputAmountResult !==
        null
          ? String(
              result
                .outputAmountResult
            )
          : undefined,

      error:
        result?.error
          ? String(
              result.error
            )
          : result?.errorMessage
            ? String(
                result
                  .errorMessage
              )
            : undefined,

    };


    console.log(
      "[trade/execute]",
      {
        status:
          response.status,

        signature:
          response.signature ??
          null,

        requestId,
      }
    );


    return NextResponse.json(
      response,
      {
        status:
          successful
            ? 200
            : 502,

        headers: {
          "Cache-Control":
            "private, no-store",
        },
      }
    );

  } catch (
    error
  ) {

    console.error(
      "[trade/execute]",
      error
    );


    const timeout =
      error instanceof Error &&
      (
        error.name ===
          "TimeoutError" ||
        error.name ===
          "AbortError"
      );


    return NextResponse.json(
      {
        error:
          timeout
            ? "Jupiter execution timed out"
            : "Unable to execute trade",

        details:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          timeout
            ? 504
            : 500,
      }
    );

  }

}