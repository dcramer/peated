import { expect, test } from "@playwright/test";

import {
  existingBottleId,
  groupedBottleDetails,
  legacyPromotedBottleId,
  missingBottleId,
  replacementSourceBottleId,
} from "./rpc-fixtures.mjs";

test.describe("Bottle page redirects", () => {
  test.describe.configure({ mode: "serial" });

  test("renders an active Bottle without redirecting", async ({ page }) => {
    await page.goto(`/bottles/${existingBottleId}`);
    await expect(
      page.getByRole("heading", { name: "Lagavulin 16-year-old" }),
    ).toBeVisible();
  });

  test("permanently redirects an exact replacement and preserves its suffix", async ({
    page,
  }) => {
    const sourcePath = `/bottles/${replacementSourceBottleId}/tastings?source=legacy&tag=one&tag=two`;
    const replacementPath = `/bottles/${legacyPromotedBottleId}/tastings?source=legacy&tag=one&tag=two`;

    await page.goto(sourcePath, { waitUntil: "commit" });
    await expect(page).toHaveURL(replacementPath);
  });

  test("redirects a Bottle's legacy Bottlings list to its release family", async ({
    page,
    request,
  }) => {
    const sourcePath = `/bottles/${groupedBottleDetails.id}/bottlings?source=legacy&tag=one&tag=two`;
    const familyPath = `/bottles/${groupedBottleDetails.id}/releases?source=legacy&tag=one&tag=two`;

    const response = await request.get(sourcePath, { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(familyPath);

    await page.goto(sourcePath);
    await expect(page).toHaveURL(familyPath);
    await expect(
      page.getByRole("heading", {
        name: "Lagavulin 16-year-old release family",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Similar bottles", { exact: true }),
    ).toBeVisible();
  });

  test("rejects invalid nested-list Bottle ids", async ({ request }) => {
    for (const bottleId of ["0", "not-an-id"]) {
      const response = await request.get(`/bottles/${bottleId}/bottlings`, {
        maxRedirects: 0,
      });

      expect(response.status()).toBe(404);
    }
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
    const missingPath = `/bottles/${missingBottleId}`;
    await page.goto(missingPath);
    await expect(page).toHaveURL(missingPath);
    await expect(
      page.getByRole("heading", { name: "Not Found" }),
    ).toBeVisible();
  });
});
