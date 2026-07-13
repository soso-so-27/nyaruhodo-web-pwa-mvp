import { expect, test } from "@playwright/test";

import { isAppShellResourceError } from "../../src/lib/pwa/recoverAppShell";
import { formatAppErrorDiagnostic } from "../../src/app/error";

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

  test("formats a bounded diagnostic without hiding the digest", () => {
    const error = Object.assign(new Error("home hydration failed"), {
      digest: "abc123",
    });

    expect(formatAppErrorDiagnostic(error)).toBe(
      "Error: home hydration failed / abc123",
    );
  });
});
