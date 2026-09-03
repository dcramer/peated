import { expect, test } from "./test";

import { existingBottleId } from "./rpc-fixtures.mjs";

test.describe("retired bottling routes", () => {
  test("returns not found for every retired route", async ({ page }) => {
    const paths = [
      `/bottles/${existingBottleId}/bottlings`,
      `/bottles/${existingBottleId}/bottlings/new`,
      `/bottles/${existingBottleId}/bottlings/9303`,
      `/bottles/${existingBottleId}/bottlings/9303/edit`,
      `/bottles/${existingBottleId}/releases/9303/edit`,
    ];

    for (const path of paths) {
      const response = await page.goto(path);

      expect.soft(response?.status(), path).toBe(404);
      await expect.soft(page, path).toHaveURL(path);
    }
  });
});
