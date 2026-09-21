type StoredTradeOrder = {
  requestId: string;

  walletAddress: string;

  ticker: string;
  issuer: string;
  side: "buy" | "sell";

  originalTransaction: string;

  createdAt: number;
  expiresAt: number;
};

const ORDER_TTL_MS =
  2 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var closingBellTradeOrders:
    | Map<string, StoredTradeOrder>
    | undefined;
}

const orders =
  globalThis.closingBellTradeOrders ??
  new Map<string, StoredTradeOrder>();

globalThis.closingBellTradeOrders =
  orders;

function cleanup() {
  const now =
    Date.now();

  for (const [
    requestId,
    order,
  ] of orders.entries()) {
    if (
      order.expiresAt <= now
    ) {
      orders.delete(
        requestId
      );
    }
  }
}

export function storeTradeOrder(
  order: Omit<
    StoredTradeOrder,
    "createdAt" | "expiresAt"
  >
) {
  cleanup();

  const now =
    Date.now();

  orders.set(
    order.requestId,
    {
      ...order,
      createdAt: now,
      expiresAt:
        now +
        ORDER_TTL_MS,
    }
  );
}

export function getTradeOrder(
  requestId: string
) {
  cleanup();

  return (
    orders.get(
      requestId
    ) ??
    null
  );
}

export function removeTradeOrder(
  requestId: string
) {
  orders.delete(
    requestId
  );
}