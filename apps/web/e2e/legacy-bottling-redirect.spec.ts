import { expect, test } from "@playwright/test";

import {
  existingBottleId,
  existingReleaseId,
  legacyIncompleteReleaseId,
  legacyPromotedBottleId,
} from "./rpc-fixtures.mjs";

test.describe("legacy Bottling redirects", () => {
  test("permanently redirects a nested Bottling URL to its promoted Bottle", async ({
    page,
    request,
  }) => {
    const legacyPath = `/bottles/${existingBottleId}/bottlings/${existingReleaseId}?source=legacy&tag=one&tag=two`;
    const promotedPath = `/bottles/${legacyPromotedBottleId}?source=legacy&tag=one&tag=two`;

    const response = await request.get(legacyPath, { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(promotedPath);

    await page.goto(legacyPath, { waitUntil: "commit" });
    await expect(page).toHaveURL(promotedPath);
  });

  test("returns not found for invalid or mismatched legacy identity", async ({
    request,
  }) => {
    const paths = [
      `/bottles/not-an-id/bottlings/${existingReleaseId}`,
      `/bottles/${existingBottleId + 1}/bottlings/${existingReleaseId}`,
    ];

    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 });

      expect(response.status()).toBe(404);
      expect(response.headers().location).toBeUndefined();
    }
  });

  test("returns conflict for an incomplete legacy mapping", async ({
    request,
  }) => {
    const response = await request.get(
      `/bottles/${existingBottleId}/bottlings/${legacyIncompleteReleaseId}`,
      { maxRedirects: 0 },
    );

    expect(response.status()).toBe(409);
    expect(response.headers().location).toBeUndefined();
    expect(await response.body()).toHaveLength(0);
  });
});
