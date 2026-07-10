import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const shotsDir = path.resolve(process.cwd(), "artifacts", "board-v2-v11");

test.beforeAll(() => {
  fs.rmSync(shotsDir, { recursive: true, force: true });
  fs.mkdirSync(shotsDir, { recursive: true });
});

for (const count of [31, 3]) {
  test(`captures board-v2 comparison set with ${count} photos`, async ({ page }) => {
    await page.addInitScript((photoCount) => {
      const colors = ["#bd745d", "#839bb3", "#ad9272", "#7b9b83", "#c38a78"];
      const ratios = [
        [4, 3],
        [3, 4],
        [16, 9],
        [1, 1],
        [5, 4],
      ];
      const first = new Date("2026-07-10T12:00:00+09:00").getTime();
      const photos = Array.from({ length: photoCount }, (_, index) => {
        const [ratioWidth, ratioHeight] = ratios[index % ratios.length];
        const canvas = document.createElement("canvas");
        canvas.width = ratioWidth * 120;
        canvas.height = ratioHeight * 120;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas is unavailable");
        }
        context.fillStyle = colors[index % colors.length];
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "rgba(255,255,255,.55)";
        context.beginPath();
        context.arc(canvas.width * 0.36, canvas.height * 0.44, Math.min(canvas.width, canvas.height) * 0.18, 0, Math.PI * 2);
        context.arc(canvas.width * 0.64, canvas.height * 0.44, Math.min(canvas.width, canvas.height) * 0.18, 0, Math.PI * 2);
        context.fill();

        return {
          id: `board-shot-${first - index * 600000}`,
          catId: "board-shot-cat",
          ownerCatId: "board-shot-cat",
          src: canvas.toDataURL("image/png"),
          createdAt: first - index * 600000,
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "daily",
          theme: "sleeping",
          shared: true,
        };
      });

      localStorage.setItem("nyaruhodo_exchange_own_sleeping_photos", JSON.stringify(photos));
      localStorage.setItem("nyaruhodo_exchange_kept_photos", "[]");
      localStorage.removeItem("nyaruhodo_board_v2_preferences");
    }, count);

    await page.goto("/prototypes/board-v2");
    await expect(page.getByTestId("board-v2-layout")).toBeVisible();

    for (const [layout, frame] of [
      ["crop", "f1"],
      ["crop", "f3"],
      ["natural", "f2"],
      ["natural", "f3"],
    ]) {
      await page.getByTestId(`board-v2-layout-${layout}`).click();
      await page.getByTestId(`board-v2-frame-${frame}`).click();
      await page.waitForTimeout(450);
      await page.screenshot({
        path: path.join(shotsDir, `board-v2-${count}-${layout}-${frame}.png`),
        fullPage: true,
      });
    }
  });
}
