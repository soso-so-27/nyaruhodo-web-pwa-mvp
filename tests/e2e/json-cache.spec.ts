import { expect, test } from "@playwright/test";

import { writeCachedJson } from "../../src/lib/storage/jsonCache";

test("reclaims only recreatable storage when a write exceeds quota", () => {
  const values = new Map<string, string>([
    ["analytics_event_queue", "x".repeat(2_000)],
    ["nyaruhodo_exchange_own_sleeping_photos", JSON.stringify([{ src: "data:image/png;base64,AAAA" }])],
  ]);
  let firstWrite = true;
  const localStorage = {
    get length() {
      return values.size;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      if (firstWrite) {
        firstWrite = false;
        throw new DOMException("The quota has been exceeded", "QuotaExceededError");
      }
      values.set(key, value);
    },
  };
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener() {},
      localStorage,
    },
  });

  try {
    writeCachedJson("target", { saved: true });
    expect(values.get("target")).toBe('{"saved":true}');
    expect(values.has("analytics_event_queue")).toBe(false);
    expect(values.has("nyaruhodo_exchange_own_sleeping_photos")).toBe(true);
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});
