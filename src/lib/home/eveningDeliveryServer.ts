export const SERVER_EVENING_DELIVERY_HOUR = 20;
export const SERVER_EVENING_DELIVERY_TOLERANCE_MINUTES = 5;
export const SERVER_JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ServerDeliveryDateValidation =
  | { ok: true; serverDateKey: string }
  | {
      ok: false;
      error: "delivery_not_yet" | "delivery_window_expired";
      serverDateKey: string;
    };

export function getServerJstDateKey(timestamp = Date.now()) {
  const date = new Date(timestamp + SERVER_JST_OFFSET_MS);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getServerJstDeliveryTime(dateKey: string) {
  return (
    getServerJstDayStartTime(dateKey) +
    SERVER_EVENING_DELIVERY_HOUR * 60 * 60 * 1000
  );
}

export function addServerJstDays(dateKey: string, days: number) {
  return getServerJstDateKey(
    getServerJstDayStartTime(dateKey) + days * 24 * 60 * 60 * 1000,
  );
}

export function validateServerDeliveryDateKey({
  deliveryDateKey,
  now = Date.now(),
}: {
  deliveryDateKey: string;
  now?: number;
}): ServerDeliveryDateValidation {
  const serverDateKey = getServerJstDateKey(now);

  if (deliveryDateKey > serverDateKey) {
    return { ok: false, error: "delivery_not_yet", serverDateKey };
  }

  if (deliveryDateKey < addServerJstDays(serverDateKey, -7)) {
    return { ok: false, error: "delivery_window_expired", serverDateKey };
  }

  if (
    deliveryDateKey === serverDateKey &&
    now <
      getServerJstDeliveryTime(serverDateKey) -
        SERVER_EVENING_DELIVERY_TOLERANCE_MINUTES * 60 * 1000
  ) {
    return { ok: false, error: "delivery_not_yet", serverDateKey };
  }

  return { ok: true, serverDateKey };
}

export function isServerDateKey(value: string) {
  return DATE_KEY_PATTERN.test(value);
}

function getServerJstDayStartTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) - SERVER_JST_OFFSET_MS;
}
