const baseUrl =
  process.env.CAPTURE_BASE_URL ??
  "http://localhost:3000";

const secret =
  process.env.HISTORY_CRON_SECRET ??
  "";

const INTERVAL_MS =
  15 * 60 * 1000;


async function capture() {

  const startedAt =
    new Date();


  console.log(
    `[history-watch] capture starting ${startedAt.toLocaleString()}`
  );


  try {

    const response =
      await fetch(
        `${baseUrl.replace(/\/$/, "")}/api/history/capture`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...(secret
              ? {
                  Authorization:
                    `Bearer ${secret}`,
                }
              : {}),
          },

          body:
            JSON.stringify({}),
        }
      );


    const text =
      await response.text();


    console.log(
      `[history-watch] ${response.status} ${text}`
    );


    if (
      !response.ok
    ) {

      console.error(
        "[history-watch] capture failed"
      );

    }

  } catch (
    error
  ) {

    console.error(
      "[history-watch] request error:",
      error
    );

  }


  const next =
    new Date(
      Date.now() +
      INTERVAL_MS
    );


  console.log(
    `[history-watch] next capture at ${next.toLocaleString()}`
  );

}


console.log(
  `[history-watch] running every 15 minutes against ${baseUrl}`
);


if (
  secret
) {

  console.log(
    "[history-watch] auth secret loaded"
  );

} else {

  console.warn(
    "[history-watch] WARNING: no HISTORY_CRON_SECRET is set"
  );

}


// Run immediately.
await capture();


// Then repeat every 15 minutes.
setInterval(
  capture,
  INTERVAL_MS
);


// Keep the process alive.
process.stdin.resume();
