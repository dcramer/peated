import { expect, test } from "./test";

import {
  exactMatchedBottleId,
  missingBottleId,
  replacementSourceBottleId,
} from "./rpc-fixtures.mjs";

test.describe("Bottle page redirects", () => {
  test.describe.configure({ mode: "serial" });

  test("permanently redirects an exact replacement and preserves its suffix", async ({
    page,
    request,
  }) => {
    const sourcePath = `/bottles/${replacementSourceBottleId}/tastings?source=legacy&tag=one&tag=two`;
    const replacementPath = new RegExp(
      `/bottles/${exactMatchedBottleId}-[^/?#]+/tastings\\?source=legacy&tag=one&tag=two$`,
    );

    const response = await request.get(sourcePath, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toMatch(replacementPath);
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
        page.getByRole("heading", { name: "Nothing lives here" }),
      ).toBeVisible();
    }
  });

  test("renders not found for a missing Bottle without redirecting", async ({
    page,
  }) => {
    await page.goto(`/bottles/${missingBottleId}`);
    await expect(page).toHaveURL(`/bottles/${missingBottleId}`);
    await expect(
      page.getByRole("heading", { name: "Nothing lives here" }),
    ).toBeVisible();
  });
});
