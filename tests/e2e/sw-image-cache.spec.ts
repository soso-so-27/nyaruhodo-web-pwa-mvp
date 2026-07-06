import http from "node:http";
import { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

test.describe("service worker image cache", () => {
  let server: http.Server;
  let baseUrl = "";
  let requestCount = 0;

  test.beforeEach(async ({ page }) => {
    requestCount = 0;
    server = http.createServer((request, response) => {
      requestCount += 1;
      const isPartial = request.url?.includes("/partial/") ?? false;
      const body =
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#b57"/></svg>';

      response.writeHead(isPartial ? 206 : 200, {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
        "content-length": Buffer.byteLength(body).toString(),
        "content-type": "image/svg+xml",
      });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;

    await page.goto("/manifest.webmanifest");
    await page.evaluate(async () => {
      await Promise.all(
        (await navigator.serviceWorker.getRegistrations()).map((registration) =>
          registration.unregister(),
        ),
      );
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    });
    await page.reload();
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });
      await navigator.serviceWorker.ready;

      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
            once: true,
          });
          registration.active?.postMessage({ type: "noop" });
        });
      }
    });
    await page.reload();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
            once: true,
          });
        });
      }
      (window as Window & { __photoSwTraces?: unknown[] }).__photoSwTraces = [];
      navigator.serviceWorker.addEventListener("message", (event) => {
        const win = window as Window & { __photoSwTraces?: unknown[] };
        win.__photoSwTraces?.push(event.data);
      });
      const cache = await caches.open("neteruneko-photo-image-meta-v1");
      await cache.put(
        `${window.location.origin}/__sw-photo-cache/config`,
        new Response(JSON.stringify({ enabled: true, updatedAt: Date.now() }), {
          headers: { "content-type": "application/json; charset=utf-8" },
        }),
      );
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const cache = await caches.open("neteruneko-photo-image-meta-v1");
          const response = await cache.match(
            `${window.location.origin}/__sw-photo-cache/config`,
          );
          const config = (await response?.json().catch(() => null)) as
            | { enabled?: unknown }
            | null
            | undefined;
          return config?.enabled === true;
        }),
      )
      .toBe(true);
  });

  test.afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("caches 200 storage images by path and transform variant", async ({
    page,
  }) => {
    const basePath = `${baseUrl}/storage/v1/object/sign/cat-photos/sw-cache/photo.svg`;
    const variantPath = `${baseUrl}/storage/v1/object/sign/cat-photos/sw-cache/photo.svg?width=1200&quality=80&token=variant`;
    const partialPath = `${baseUrl}/storage/v1/object/sign/cat-photos/partial/photo.svg`;

    await loadImage(page, `${basePath}?token=first`);
    await loadImage(page, `${basePath}?token=second`);
    expect(requestCount).toBe(1);

    await loadImage(page, variantPath);
    expect(requestCount).toBe(2);

    await page.evaluate(() => {
      navigator.serviceWorker.controller?.postMessage({
        type: "NN_PHOTO_CACHE_PURGE",
        paths: ["sw-cache/photo.svg"],
        reason: "own_photo_deleted",
      });
    });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const traces = (window as Window & { __photoSwTraces?: unknown[] })
            .__photoSwTraces ?? [];
          return JSON.stringify(traces);
        }),
      )
      .toContain("photo_sw_cache_purge");

    await loadImage(page, `${basePath}?token=third`);
    expect(requestCount).toBe(3);

    await loadImage(page, `${partialPath}?token=first`);
    await loadImage(page, `${partialPath}?token=second`);
    expect(requestCount).toBe(5);

    await expect
      .poll(() =>
        page.evaluate(() => {
          const traces = (window as Window & { __photoSwTraces?: unknown[] })
            .__photoSwTraces ?? [];
          return JSON.stringify(traces);
        }),
      )
      .toContain("photo_sw_cache_hit");
  });
});

async function loadImage(page: Page, src: string) {
  await page.evaluate(
    (imageSrc) =>
      new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`image failed: ${imageSrc}`));
        image.src = imageSrc;
        document.body.append(image);
      }),
    src,
  );
}
