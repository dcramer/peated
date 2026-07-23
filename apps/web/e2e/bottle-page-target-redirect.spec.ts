import { expect, test } from "@playwright/test";

import {
  bottleGroupId,
  conflictingPageTargetBottleId,
  exactReplacementSourceBottleId,
  existingBottleId,
  legacyPromotedBottleId,
  missingPageTargetBottleId,
  retiredParentBottleId,
} from "./rpc-fixtures.mjs";

test.describe("Bottle page target redirects", () => {
  test.describe.configure({ mode: "serial" });

  test("renders an active exact Bottle without redirecting", async ({
    page,
  }) => {
    await page.goto(`/bottles/${existingBottleId}`);
    await expect(
      page.getByRole("heading", { name: "Lagavulin 16-year-old" }),
    ).toBeVisible();
  });

  test("permanently redirects an exact replacement and preserves its suffix", async ({
    page,
  }) => {
    const sourcePath = `/bottles/${exactReplacementSourceBottleId}/tastings?source=legacy&tag=one&tag=two`;
    const replacementPath = `/bottles/${legacyPromotedBottleId}/tastings?source=legacy&tag=one&tag=two`;

    await page.goto(sourcePath, { waitUntil: "commit" });
    await expect(page).toHaveURL(replacementPath);
  });

  test("redirects a retired parent directly to its generic group", async ({
    page,
  }) => {
    const sourcePath = `/bottles/${retiredParentBottleId}/tastings?source=legacy&tag=one&tag=two`;
    const groupPath = `/bottle-groups/${bottleGroupId}?source=legacy&tag=one&tag=two`;

    await page.goto(sourcePath);
    await expect(page).toHaveURL(groupPath);
    await expect(
      page.getByRole("heading", {
        name: "Lagavulin 16-year-old release family",
      }),
    ).toBeVisible();
    await expect(page.getByText("Exact release not specified")).toBeVisible();
  });

  test("does not redirect missing or conflicting page targets", async ({
    page,
  }) => {
    const missingPath = `/bottles/${missingPageTargetBottleId}`;
    await page.goto(missingPath);
    await expect(page).toHaveURL(missingPath);
    await expect(
      page.getByRole("heading", { name: "Not Found" }),
    ).toBeVisible();

    const conflictPath = `/bottles/${conflictingPageTargetBottleId}`;
    await page.goto(conflictPath);
    await expect(page).toHaveURL(conflictPath);
    await expect(page.getByRole("heading", { name: "Error" })).toBeVisible();
  });
});
