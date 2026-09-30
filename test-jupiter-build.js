
const fs = require("fs");
const path = require("path");

// Read your existing .env.local file.
const envPath = path.join(__dirname, ".env.local");

if (!fs.existsSync(envPath)) {
  throw new Error(".env.local not found");
}

const envContent = fs.readFileSync(envPath, "utf8");

const keyLine = envContent
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("JUPITER_API_KEY="));

if (!keyLine) {
  throw new Error("JUPITER_API_KEY not found in .env.local");
}

const apiKey = keyLine
  .split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");

if (!apiKey) {
  throw new Error("JUPITER_API_KEY is empty");
}

// BAx and USDC mint addresses.
const BAx =
  "XsBcnKnZMsPaerLiUQ4eMFy4Fjysot4RugYXYDjiqCP";

const USDC =
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Optional: public wallet address only.
// Leave empty for the initial test.
const TAKER = "FkGpFNm3yBBE2k8u5J1ahHa1qMrXf7GHB7A6Ybm9wQqj";

async function testQuote(label, inputMint, outputMint, amount) {
  console.log(`\n========== ${label} ==========`);

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: "50",
  });

  if (TAKER) {
    params.set("taker", TAKER);
  }

  const url =
    `https://api.jup.ag/swap/v2/build?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
    });

    const body = await response.text();

    let data;

    try {
      data = JSON.parse(body);
    } catch {
      console.log("HTTP status:", response.status);
      console.log("Response:", body);
      return;
    }

    console.log("HTTP status:", response.status);

    if (!response.ok) {
      console.log("ERROR:", data.error || data.message || data);
      console.log("Error code:", data.errorCode ?? null);
      console.log("Request ID:", data.requestId ?? null);
      return;
    }

    console.log("SUCCESS");

    console.log(
      JSON.stringify(
        {
          inAmount: data.inAmount,
          outAmount: data.outAmount,
          priceImpact: data.priceImpact,
          router: data.router,
          routePlan: data.routePlan,
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("REQUEST FAILED:", error.message);
  }
}

async function main() {
  console.log("Testing Jupiter Swap V2 Build");
  console.log("Taker supplied:", Boolean(TAKER));

  await testQuote(
    "BUY BAx — 100 USDC",
    USDC,
    BAx,
    "100000000"
  );

  await testQuote(
    "SELL BAx — 0.50017506 BAx",
    BAx,
    USDC,
    "50017506"
  );
}

main();