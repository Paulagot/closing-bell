export type JupiterRequestPriority =
  | "trade"
  | "interactive"
  | "background";

interface CachedResponse {
  expiresAt: number;
  status: number;
  statusText: string;
  headers: Array<[string, string]>;
  body: string;
}

interface QueueTask {
  id: number;
  priority: JupiterRequestPriority;
  createdAt: number;
  run: () => Promise<void>;
}

interface SchedulerState {
  queue: QueueTask[];
  running: boolean;
  lastRequestAt: number;
  nextTaskId: number;
  cache: Map<string, CachedResponse>;
  inFlight: Map<string, Promise<CachedResponse>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __closingBellJupiterScheduler:
    | SchedulerState
    | undefined;
}

const state: SchedulerState =
  globalThis.__closingBellJupiterScheduler ??
  {
    queue: [],
    running: false,
    lastRequestAt: 0,
    nextTaskId: 1,
    cache: new Map(),
    inFlight: new Map(),
  };

globalThis.__closingBellJupiterScheduler =
  state;

function intervalMs() {
  const configured =
    Number(
      process.env
        .JUPITER_MIN_INTERVAL_MS ??
      ""
    );

  if (
    Number.isFinite(
      configured
    ) &&
    configured >=
      500
  ) {
    return configured;
  }

  /**
   * Free Jupiter organisations are currently
   * limited to roughly one request every two
   * seconds. Give ourselves a small safety margin.
   *
   * If the account is upgraded, set
   * JUPITER_MIN_INTERVAL_MS explicitly.
   */
  return 2100;
}

function priorityRank(
  priority: JupiterRequestPriority
) {
  switch (
    priority
  ) {
    case "trade":
      return 0;

    case "interactive":
      return 1;

    default:
      return 2;
  }
}

function cloneCachedResponse(
  cached: CachedResponse
) {
  return new Response(
    cached.body,
    {
      status:
        cached.status,

      statusText:
        cached.statusText,

      headers:
        cached.headers,
    }
  );
}

function cleanExpiredCache() {
  const now =
    Date.now();

  for (
    const [
      key,
      value,
    ]
    of state.cache
  ) {
    if (
      value.expiresAt <=
      now
    ) {
      state.cache.delete(
        key
      );
    }
  }
}

async function pumpQueue() {
  if (
    state.running
  ) {
    return;
  }

  state.running =
    true;

  try {
    while (
      state.queue.length >
      0
    ) {
      state.queue.sort(
        (
          a,
          b
        ) => {
          const priorityDiff =
            priorityRank(
              a.priority
            ) -
            priorityRank(
              b.priority
            );

          if (
            priorityDiff !==
            0
          ) {
            return priorityDiff;
          }

          return (
            a.createdAt -
            b.createdAt
          );
        }
      );

      const task =
        state.queue.shift();

      if (!task) {
        continue;
      }

      const elapsed =
        Date.now() -
        state.lastRequestAt;

      const waitMs =
        Math.max(
          0,
          intervalMs() -
            elapsed
        );

      if (
        waitMs >
        0
      ) {
        await new Promise(
          (
            resolve
          ) =>
            setTimeout(
              resolve,
              waitMs
            )
        );
      }

      state.lastRequestAt =
        Date.now();

      await task.run();
    }
  } finally {
    state.running =
      false;

    if (
      state.queue.length >
      0
    ) {
      void pumpQueue();
    }
  }
}

function enqueue<T>(
  priority: JupiterRequestPriority,
  work: () => Promise<T>
): Promise<T> {
  return new Promise<T>(
    (
      resolve,
      reject
    ) => {
      state.queue.push({
        id:
          state.nextTaskId++,

        priority,

        createdAt:
          Date.now(),

        run:
          async () => {
            try {
              resolve(
                await work()
              );
            } catch (
              error
            ) {
              reject(
                error
              );
            }
          },
      });

      void pumpQueue();
    }
  );
}

interface ScheduledFetchOptions {
  priority?:
    JupiterRequestPriority;

  /**
   * Only use caching for quote/reference GETs.
   * Never cache wallet-bound signing transactions.
   */
  cacheTtlMs?:
    number;

  cacheKey?:
    string;
}

export async function scheduledJupiterFetch(
  url: string,
  options: RequestInit = {},
  schedulerOptions: ScheduledFetchOptions = {}
): Promise<Response> {
  const {
    priority = "interactive",
    cacheTtlMs = 0,
    cacheKey =
      `${options.method ?? "GET"}:${url}`,
  } =
    schedulerOptions;

  cleanExpiredCache();

  if (
    cacheTtlMs >
    0
  ) {
    const cached =
      state.cache.get(
        cacheKey
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      console.log(
        `[jupiter] cache hit ${cacheKey.slice(
          0,
          90
        )}`
      );

      return cloneCachedResponse(
        cached
      );
    }

    const existing =
      state.inFlight.get(
        cacheKey
      );

    if (
      existing
    ) {
      console.log(
        `[jupiter] reusing in-flight ${cacheKey.slice(
          0,
          90
        )}`
      );

      return cloneCachedResponse(
        await existing
      );
    }

    let resolveInFlight!:
      (
        value:
          CachedResponse
      ) => void;

    let rejectInFlight!:
      (
        reason?:
          unknown
      ) => void;

    const inFlight =
      new Promise<CachedResponse>(
        (
          resolve,
          reject
        ) => {
          resolveInFlight =
            resolve;

          rejectInFlight =
            reject;
        }
      );

    state.inFlight.set(
      cacheKey,
      inFlight
    );

    try {
      const cachedResponse =
        await enqueue(
          priority,
          async () => {
            const response =
              await fetch(
                url,
                options
              );

            const body =
              await response.text();

            const value:
              CachedResponse = {
              expiresAt:
                Date.now() +
                (
                  response.ok
                    ? cacheTtlMs
                    : 0
                ),

              status:
                response.status,

              statusText:
                response.statusText,

              headers:
                Array.from(
                  response.headers
                    .entries()
                ),

              body,
            };

            if (
              response.ok
            ) {
              state.cache.set(
                cacheKey,
                value
              );
            }

            return value;
          }
        );

      resolveInFlight(
        cachedResponse
      );

      return cloneCachedResponse(
        cachedResponse
      );
    } catch (
      error
    ) {
      rejectInFlight(
        error
      );

      throw error;
    } finally {
      state.inFlight.delete(
        cacheKey
      );
    }
  }

  return enqueue(
    priority,
    () =>
      fetch(
        url,
        options
      )
  );
}

export function getJupiterSchedulerStats() {
  cleanExpiredCache();

  return {
    queued:
      state.queue.length,

    cached:
      state.cache.size,

    inFlight:
      state.inFlight.size,

    minIntervalMs:
      intervalMs(),
  };
}
