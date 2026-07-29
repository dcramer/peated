import { expect, test } from "@playwright/test";

import { existingBottleId } from "./rpc-fixtures.mjs";

test.describe("retired bottling routes", () => {
  for (const path of [
    `/bottles/${existingBottleId}/bottlings`,
    `/bottles/${existingBottleId}/bottlings/new`,
    `/bottles/${existingBottleId}/bottlings/9303`,
    `/bottles/${existingBottleId}/bottlings/9303/edit`,
    `/bottles/${existingBottleId}/releases/9303/edit`,
  ]) {
    test(`returns not found for ${path}`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page).toHaveURL(path);
    });
  }
});
