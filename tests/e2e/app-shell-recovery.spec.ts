import { expect, test } from "@playwright/test";

import { isAppShellResourceError } from "../../src/lib/pwa/recoverAppShell";

test.describe("app shell recovery", () => {
  test("recognizes stale deployment chunk failures", () => {
    expect(isAppShellResourceError(new Error("Loading chunk 312 failed"))).toBe(
      true,
    );
    expect(
      isAppShellResourceError(
        new TypeError("Failed to fetch dynamically imported module"),
      ),
    ).toBe(true);
    expect(isAppShellResourceError(new Error("invalid local record"))).toBe(
      false,
    );
  });
});
