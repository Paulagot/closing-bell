import fs from "node:fs/promises";
import path from "node:path";


// ─────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────

const ROOT =
  process.cwd();

const ENV_PATH =
  path.join(
    ROOT,
    ".env.local"
  );

const BACKPACK_PATH =
  path.join(
    ROOT,
    "scripts",
    "backpack-securities.json"
  );

const OUTPUT_PATH =
  path.join(
    ROOT,
    "src",
    "data",
    "token-universe.generated.json"
  );

const CSV_PATH =
  path.join(
    ROOT,
    "src",
    "data",
    "token-universe-report.csv"
  );


// ─────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────

async function loadEnvFile() {

  try {

    const text =
      await fs.readFile(
        ENV_PATH,
        "utf8"
      );


    for (
      const rawLine
      of text.split(
        /\r?\n/
      )
    ) {

      const line =
        rawLine.trim();


      if (
        !line ||
        line.startsWith(
          "#"
        )
      ) {
        continue;
      }


      const equals =
        line.indexOf(
          "="
        );


      if (
        equals < 1
      ) {
        continue;
      }


      const key =
        line
          .slice(
            0,
            equals
          )
          .trim();


      let value =
        line
          .slice(
            equals +
              1
          )
          .trim();


      if (
        (
          value.startsWith(
            '"'
          ) &&
          value.endsWith(
            '"'
          )
        ) ||
        (
          value.startsWith(
            "'"
          ) &&
          value.endsWith(
            "'"
          )
        )
      ) {

        value =
          value.slice(
            1,
            -1
          );

      }


      if (
        process.env[
          key
        ] ==
        null
      ) {

        process.env[
          key
        ] =
          value;

      }

    }

  } catch {

    console.warn(
      "⚠ .env.local not found"
    );

  }
}


await loadEnvFile();


const RPC_URL =
  process.env.SOLANA_RPC_URL ||
  "https://api.mainnet-beta.solana.com";

const JUPITER_API_URL =
  process.env.JUPITER_API_URL ||
  "https://api.jup.ag";

const JUPITER_API_KEY =
  process.env.JUPITER_API_KEY ||
  "";

const ONDO_API_KEY =
  process.env.ONDO_API_KEY ||
  "";


// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function firstString(
  ...values
) {

  for (
    const value
    of values
  ) {

    if (
      typeof value ===
        "string" &&
      value.trim()
    ) {

      return value.trim();

    }

  }


  return null;
}


function firstNumber(
  ...values
) {

  for (
    const value
    of values
  ) {

    const number =
      Number(
        value
      );


    if (
      Number.isFinite(
        number
      )
    ) {

      return number;

    }

  }


  return null;
}


async function fetchJson(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {
        ...options,

        signal:
          AbortSignal.timeout(
            30000
          ),
      }
    );


  const text =
    await response.text();


  if (
    !response.ok
  ) {

    throw new Error(
      `${response.status} ${response.statusText}\n${text.slice(
        0,
        500
      )}`
    );

  }


  try {

    return JSON.parse(
      text
    );

  } catch {

    throw new Error(
      `Non-JSON response from ${url}`
    );

  }
}


function normaliseTicker(
  ticker
) {

  return ticker
    ?.trim()
    .toUpperCase() ||
    null;
}


function inferAssetType(
  instrumentType,
  ticker
) {

  const type =
    String(
      instrumentType ||
      ""
    ).toLowerCase();


  if (
    type.includes(
      "etf"
    ) ||
    type.includes(
      "fund"
    )
  ) {

    return "etf";

  }


  if (
    ticker ===
    "SPCX"
  ) {

    return "private_equity";

  }


  return "public_stock";
}


// ─────────────────────────────────────────────
// xStocks
// ─────────────────────────────────────────────

function extractXStocksNodes(
  response
) {

  if (
    Array.isArray(
      response
    )
  ) {
    return response;
  }


  const data =
    response?.data ??
    response;


  return (
    data?.nodes ??
    data?.assets ??
    data?.items ??
    []
  );
}


function findSolanaDeployment(
  asset
) {

  const deployments =
    asset?.tokenDeployments ??
    asset?.deployments ??
    asset?.tokens ??
    [];


  if (
    !Array.isArray(
      deployments
    )
  ) {
    return null;
  }


  return (
    deployments.find(
      (deployment) => {

        const network =
          String(
            deployment?.network ??
            deployment?.networkName ??
            deployment?.blockchain ??
            deployment?.chain ??
            deployment?.chainName ??
            ""
          ).toLowerCase();


        return (
          network.includes(
            "solana"
          ) ||
          network ===
            "sol"
        );

      }
    ) ??
    null
  );
}


function normaliseXStocksAsset(
  asset
) {

  const symbol =
    firstString(
      asset?.symbol,
      asset?.identifier,
      asset?.tokenSymbol,
      asset?.ticker
    );


  if (
    !symbol
  ) {
    return null;
  }


  const ticker =
    normaliseTicker(
      firstString(
        asset?.underlyingTicker,
        asset?.underlying?.ticker,
        asset?.underlyingAsset?.ticker,
        asset?.referenceTicker,
        symbol.replace(
          /x$/i,
          ""
        )
      )
    );


  const deployment =
    findSolanaDeployment(
      asset
    );


  if (
    !deployment
  ) {
    return null;
  }


  const mint =
    firstString(
      deployment?.address,
      deployment?.tokenAddress,
      deployment?.contractAddress,
      deployment?.mint,
      deployment?.tokenMint
    );


  if (
    !mint ||
    !ticker
  ) {
    return null;
  }


  return {
    ticker,

    name:
      firstString(
        asset?.name,
        asset?.assetName,
        asset?.underlying?.name,
        asset?.underlyingAsset?.name
      ) ??
      ticker,

    assetType:
      inferAssetType(
        firstString(
          asset?.instrumentType,
          asset?.assetType,
          asset?.underlying
            ?.instrumentType
        ),
        ticker
      ),

    issuer:
      "xStocks",

    symbol,

    mint,

    decimals:
      firstNumber(
        deployment?.decimals,
        asset?.decimals
      ),

    verification: {
      level:
        "official_api",

      source:
        "xStocks Assets API",

      sourceUrl:
        "https://api.backed.fi/api-docs/"
    }
  };
}


async function fetchXStocks() {

  console.log(
    "\n── xStocks ──"
  );


  const bases = [
    "https://api.backed.fi/api/v2/public/assets",
    "https://api.xstocks.fi/api/v2/public/assets"
  ];


  let lastError =
    null;


  for (
    const base
    of bases
  ) {

    try {

      const results =
        [];


      for (
        let page = 1;
        page <= 20;
        page++
      ) {

        const url =
          `${base}?page=${page}&pageSize=100`;


        const response =
          await fetchJson(
            url
          );


        const nodes =
          extractXStocksNodes(
            response
          );


        if (
          !Array.isArray(
            nodes
          ) ||
          nodes.length ===
            0
        ) {
          break;
        }


        for (
          const asset
          of nodes
        ) {

          const parsed =
            normaliseXStocksAsset(
              asset
            );


          if (
            parsed
          ) {
            results.push(
              parsed
            );
          }

        }


        if (
          nodes.length <
          100
        ) {
          break;
        }

      }


      if (
        results.length ===
        0
      ) {

        throw new Error(
          "API responded but no Solana token deployments could be parsed."
        );

      }


      console.log(
        `✓ ${results.length} Solana xStocks found`
      );


      return results;

    } catch (error) {

      lastError =
        error;


      console.warn(
        `⚠ ${base} failed:`,
        error.message
      );

    }

  }


  throw new Error(
    `Unable to load xStocks: ${String(
      lastError
    )}`
  );
}


// ─────────────────────────────────────────────
// Ondo
// ─────────────────────────────────────────────

async function fetchOndo() {

  console.log(
    "\n── Ondo ──"
  );


  if (
    !ONDO_API_KEY
  ) {

    console.warn(
      "⚠ ONDO_API_KEY is empty. Ondo skipped."
    );


    return [];
  }


  const response =
    await fetchJson(
      "https://api.gm.ondo.finance/v1/assets/all/metadata",
      {
        headers: {
          "x-api-key":
            ONDO_API_KEY,
        },
      }
    );


  if (
    !Array.isArray(
      response
    )
  ) {

    throw new Error(
      "Unexpected Ondo metadata response"
    );

  }


  const results =
    [];


  for (
    const asset
    of response
  ) {

    const solana =
      asset?.addresses
        ?.find(
          (address) =>
            address
              ?.networkChainId ===
            "solana-900"
        );


    if (
      !solana?.address
    ) {
      continue;
    }


    const ticker =
      normaliseTicker(
        asset?.ticker
      );


    if (
      !ticker
    ) {
      continue;
    }


    results.push({
      ticker,

      name:
        asset?.name ??
        ticker,

      assetType:
        inferAssetType(
          asset?.tags
            ?.instrumentType,
          ticker
        ),

      issuer:
        "Ondo",

      symbol:
        asset.symbol,

      mint:
        solana.address,

      decimals:
        firstNumber(
          solana.decimals
        ),

      verification: {
        level:
          "official_api",

        source:
          "Ondo Global Markets API",

        sourceUrl:
          "https://docs.ondo.finance/api-reference/assets/get-metadata-for-all-supported-assets"
      }
    });

  }


  console.log(
    `✓ ${results.length} Ondo Solana assets found`
  );


  return results;
}


// ─────────────────────────────────────────────
// Backpack
// ─────────────────────────────────────────────

async function fetchBackpack() {

  console.log(
    "\n── Backpack Securities ──"
  );


  const raw =
    await fs.readFile(
      BACKPACK_PATH,
      "utf8"
    );


  const source =
    JSON.parse(
      raw
    );


  const results =
    source.map(
      (asset) => ({
        ticker:
          normaliseTicker(
            asset.ticker
          ),

        name:
          asset.name,

        assetType:
          asset.ticker ===
            "SPCX"
            ? "private_equity"
            : "public_stock",

        issuer:
          "Backpack",

        symbol:
          asset.symbol,

        mint:
          asset.mint,

        decimals:
          null,

        verification: {
          level:
            asset.sourceType,

          source:
            asset.sourceType ===
            "official_page"
              ? "Backpack Securities"
              : "Secondary canonical-token source",

          sourceUrl:
            asset.sourceUrl
        }
      })
    );


  console.log(
    `✓ ${results.length} Backpack records loaded`
  );


  return results;
}


// ─────────────────────────────────────────────
// Solana chain verification
// ─────────────────────────────────────────────

async function verifyMints(
  records
) {

  console.log(
    "\n── Solana verification ──"
  );


  const uniqueMints =
    [
      ...new Set(
        records.map(
          (record) =>
            record.mint
        )
      )
    ];


  const result =
    new Map();


  const chunkSize =
    40;


  for (
    let start = 0;
    start <
    uniqueMints.length;
    start +=
      chunkSize
  ) {

    const chunk =
      uniqueMints.slice(
        start,
        start +
          chunkSize
      );


    const payload =
      chunk.map(
        (
          mint,
          index
        ) => ({
          jsonrpc:
            "2.0",

          id:
            index,

          method:
            "getTokenSupply",

          params: [
            mint,
            {
              commitment:
                "confirmed"
            }
          ]
        })
      );


    try {

      const response =
        await fetch(
          RPC_URL,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify(
                payload
              ),

            signal:
              AbortSignal.timeout(
                30000
              )
          }
        );


      const body =
        await response.json();


      for (
        let i = 0;
        i <
        chunk.length;
        i++
      ) {

        const mint =
          chunk[i];


        const rpc =
          body.find(
            (entry) =>
              entry.id ===
              i
          );


        const decimals =
          rpc?.result
            ?.value
            ?.decimals;


        result.set(
          mint,
          {
            exists:
              typeof decimals ===
              "number",

            decimals:
              typeof decimals ===
              "number"
                ? decimals
                : null,

            error:
              rpc?.error
                ?.message ??
              null
          }
        );

      }

    } catch (error) {

      for (
        const mint
        of chunk
      ) {

        result.set(
          mint,
          {
            exists:
              false,

            decimals:
              null,

            error:
              String(
                error
              )
          }
        );

      }

    }

  }


  const verified =
    [...result.values()]
      .filter(
        (item) =>
          item.exists
      )
      .length;


  console.log(
    `✓ ${verified}/${uniqueMints.length} mints confirmed by Solana RPC`
  );


  return result;
}


// ─────────────────────────────────────────────
// Jupiter midpoint availability
// ─────────────────────────────────────────────

async function checkJupiter(
  records
) {

  console.log(
    "\n── Jupiter Price V3 ──"
  );


  const mints =
    [
      ...new Set(
        records.map(
          (record) =>
            record.mint
        )
      )
    ];


  const available =
    new Set();


  for (
    let start = 0;
    start <
    mints.length;
    start +=
      50
  ) {

    const chunk =
      mints.slice(
        start,
        start +
          50
      );


    try {

      const params =
        new URLSearchParams({
          ids:
            chunk.join(
              ","
            )
        });


      const response =
        await fetchJson(
          `${JUPITER_API_URL}/price/v3?${params}`,
          {
            headers: {
              Accept:
                "application/json",

              ...(JUPITER_API_KEY
                ? {
                    "x-api-key":
                      JUPITER_API_KEY
                  }
                : {})
            }
          }
        );


      for (
        const mint
        of chunk
      ) {

        if (
          typeof response?.[
            mint
          ]?.usdPrice ===
          "number"
        ) {

          available.add(
            mint
          );

        }

      }

    } catch (error) {

      console.warn(
        "⚠ Jupiter check failed:",
        error.message
      );

    }

  }


  console.log(
    `✓ ${available.size}/${mints.length} have a Price V3 midpoint`
  );


  return available;
}


// ─────────────────────────────────────────────
// Merge
// ─────────────────────────────────────────────

function mergeUniverse(
  records,
  chainVerification,
  jupiterAvailable
) {

  const assets =
    {};


  for (
    const record
    of records
  ) {

    const ticker =
      record.ticker;


    if (
      !ticker
    ) {
      continue;
    }


    assets[
      ticker
    ] ??= {
      ticker,

      name:
        record.name ??
        ticker,

      refSymbol:
        record.assetType ===
        "private_equity"
          ? null
          : ticker,

      assetType:
        record.assetType ??
        "public_stock",

      issuers:
        {}
    };


    if (
      assets[
        ticker
      ].name ===
        ticker &&
      record.name
    ) {

      assets[
        ticker
      ].name =
        record.name;

    }


    const chain =
      chainVerification.get(
        record.mint
      ) ?? {
        exists:
          false,

        decimals:
          null,

        error:
          "Not checked"
      };


    const official =
      record
        .verification
        .level ===
        "official_api" ||
      record
        .verification
        .level ===
        "official_page";


    assets[
      ticker
    ].issuers[
      record.issuer
    ] = {
      symbol:
        record.symbol,

      mint:
        record.mint,

      decimals:
        chain.decimals ??
        record.decimals ??
        null,

      verification:
        record.verification,

      solanaVerified:
        chain.exists,

      rpcError:
        chain.error,

      jupiterPriceAvailable:
        jupiterAvailable.has(
          record.mint
        ),

      tradeVerified:
        official &&
        chain.exists
    };

  }


  /**
   * Closing Bell is specifically about competing
   * wrappers, so the generated master universe only
   * retains underlyings with 2+ issuers.
   */
  return Object.fromEntries(
    Object.entries(
      assets
    )
      .filter(
        ([, asset]) =>
          Object.keys(
            asset.issuers
          ).length >=
          2
      )
      .sort(
        (
          [a],
          [b]
        ) =>
          a.localeCompare(
            b
          )
      )
  );
}


// ─────────────────────────────────────────────
// CSV report
// ─────────────────────────────────────────────

function csvEscape(
  value
) {

  const string =
    String(
      value ??
      ""
    );


  if (
    /[",\n]/.test(
      string
    )
  ) {

    return `"${string.replace(
      /"/g,
      '""'
    )}"`;

  }


  return string;
}


function createCsv(
  assets
) {

  const rows = [
    [
      "Ticker",
      "Name",
      "Asset Type",
      "Issuer",
      "Issuer Symbol",
      "Solana Mint",
      "Decimals",
      "Verification",
      "Solana Verified",
      "Jupiter Price",
      "Trade Verified",
      "Source"
    ]
  ];


  for (
    const asset
    of Object.values(
      assets
    )
  ) {

    for (
      const [
        issuer,
        token
      ]
      of Object.entries(
        asset.issuers
      )
    ) {

      rows.push([
        asset.ticker,
        asset.name,
        asset.assetType,
        issuer,
        token.symbol,
        token.mint,
        token.decimals,
        token
          .verification
          .level,
        token.solanaVerified,
        token.jupiterPriceAvailable,
        token.tradeVerified,
        token
          .verification
          .sourceUrl
      ]);

    }

  }


  return rows
    .map(
      (row) =>
        row
          .map(
            csvEscape
          )
          .join(
            ","
          )
    )
    .join(
      "\n"
    );
}


// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {

  console.log(
    "Closing Bell — Token Universe Refresh"
  );


  const [
    xStocks,
    ondo,
    backpack
  ] =
    await Promise.all([
      fetchXStocks(),
      fetchOndo(),
      fetchBackpack()
    ]);


  const allRecords = [
    ...xStocks,
    ...ondo,
    ...backpack
  ];


  const chainVerification =
    await verifyMints(
      allRecords
    );


  const jupiterAvailable =
    await checkJupiter(
      allRecords
    );


  const assets =
    mergeUniverse(
      allRecords,
      chainVerification,
      jupiterAvailable
    );


  const assetValues =
    Object.values(
      assets
    );


  const threeIssuer =
    assetValues.filter(
      (asset) =>
        Object.keys(
          asset.issuers
        ).length >=
        3
    );


  const fullyTradeVerified =
    assetValues.filter(
      (asset) => {

        const tokens =
          Object.values(
            asset.issuers
          );


        return (
          tokens.length >=
            2 &&
          tokens.filter(
            (token) =>
              token.tradeVerified
          ).length >=
            2
        );

      }
    );


  const output = {
    generatedAt:
      new Date()
        .toISOString(),

    summary: {
      xStocks:
        xStocks.length,

      ondo:
        ondo.length,

      backpack:
        backpack.length,

      multiIssuer:
        assetValues.length,

      threeIssuer:
        threeIssuer.length,

      tradeVerified:
        fullyTradeVerified.length
    },

    assets
  };


  await fs.mkdir(
    path.dirname(
      OUTPUT_PATH
    ),
    {
      recursive:
        true
    }
  );


  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      output,
      null,
      2
    ) +
      "\n",
    "utf8"
  );


  await fs.writeFile(
    CSV_PATH,
    createCsv(
      assets
    ) +
      "\n",
    "utf8"
  );


  console.log(
    "\n════════════════════════════════════"
  );

  console.log(
    "Closing Bell universe generated"
  );

  console.log(
    "════════════════════════════════════"
  );

  console.log(
    `xStocks Solana assets: ${xStocks.length}`
  );

  console.log(
    `Ondo Solana assets:    ${ondo.length}`
  );

  console.log(
    `Backpack records:      ${backpack.length}`
  );

  console.log(
    `Multi-issuer assets:   ${assetValues.length}`
  );

  console.log(
    `3+ issuer assets:      ${threeIssuer.length}`
  );

  console.log(
    `Trade verified:        ${fullyTradeVerified.length}`
  );


  if (
    threeIssuer.length
  ) {

    console.log(
      "\n3+ ISSUER ASSETS"
    );


    for (
      const asset
      of threeIssuer
    ) {

      console.log(
        `${asset.ticker.padEnd(
          8
        )} ${Object.keys(
          asset.issuers
        ).join(
          " + "
        )}`
      );

    }

  }


  console.log(
    `\nJSON: ${path.relative(
      ROOT,
      OUTPUT_PATH
    )}`
  );

  console.log(
    `CSV:  ${path.relative(
      ROOT,
      CSV_PATH
    )}`
  );
}


main().catch(
  (error) => {

    console.error(
      "\n❌ Token universe refresh failed"
    );

    console.error(
      error
    );

    process.exit(
      1
    );

  }
);