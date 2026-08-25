import { expect, test } from "@playwright/test";

import { bottlePeatedIdPath } from "./assertions";
import {
  destinationBottleGroup,
  exactMatchedBottleId,
  existingBottleId,
  missingBottleId,
  replacementSourceBottleId,
} from "./rpc-fixtures.mjs";

test.describe("Bottle page redirects", () => {
  test.describe.configure({ mode: "serial" });

  test("renders an active Bottle without redirecting", async ({ page }) => {
    await page.goto(`/bottles/${existingBottleId}`);
    await expect(
      page.getByRole("heading", { name: destinationBottleGroup.fullName }),
    ).toBeVisible();
  });

  test("permanently redirects an exact replacement and preserves its suffix", async ({
    page,
  }) => {
    const sourcePath = `/bottles/${replacementSourceBottleId}/tastings?source=legacy&tag=one&tag=two`;
    const replacementPath = `/bottles/${exactMatchedBottleId}/tastings?source=legacy&tag=one&tag=two`;

    await page.goto(sourcePath, { waitUntil: "commit" });
    await expect(page).toHaveURL(replacementPath);
  });

  test("rejects noncanonical release-family Bottle ids", async ({ page }) => {
    for (const bottleId of [
      "0",
      "1.5",
      "1e2",
      "9007199254740992",
      "not-an-id",
    ]) {
      await page.goto(`/bottles/${bottleId}/releases`);
      await expect(
        page.getByRole("heading", { name: "Not Found" }),
      ).toBeVisible();
    }
  });

  test("renders not found for a missing Bottle without redirecting", async ({
    page,
  }) => {
    await page.goto(`/bottles/${missingBottleId}`);
    await expect(page).toHaveURL(bottlePeatedIdPath(missingBottleId));
    await expect(
      page.getByRole("heading", { name: "Not Found" }),
    ).toBeVisible();
  });
});
