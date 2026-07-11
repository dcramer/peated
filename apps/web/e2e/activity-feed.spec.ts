import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import { existingBottle, tastingNotes, testUser } from "./rpc-fixtures.mjs";

test.describe("activity feed", () => {
  test("renders tasting and Library addition activity", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });

    await expect(
      page.getByRole("link", { name: existingBottle.fullName }).first(),
    ).toBeVisible();
    await expect(page.getByText(tastingNotes)).toBeVisible();
    const collectionAddRow = page.locator("li").filter({
      hasText: `${testUser.username} added 1 bottle to Library`,
    });
    await expect(collectionAddRow).toBeVisible();
    await expect(
      collectionAddRow.getByRole("link", { name: "Library" }),
    ).toHaveAttribute("href", `/users/${testUser.username}/library`);
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("fills profile activity after hiding a Favorites-only page", async ({
    page,
  }) => {
    await page.goto(`/users/${testUser.username}`, { waitUntil: "commit" });

    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
