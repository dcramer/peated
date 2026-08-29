import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  existingBottle,
  homeBottle,
  tastingNotes,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("activity feed", () => {
  test("renders tasting and Library addition activity", async ({
    context,
    page,
  }) => {
    await signIn(context);
    await page.goto("/", { waitUntil: "commit" });

    const tastingActivity = page
      .locator("li")
      .filter({ hasText: tastingNotes })
      .first();
    await expect(
      tastingActivity.getByRole("link", {
        name: homeBottle.group.fullName,
      }),
    ).toBeVisible();
    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(
      page.getByText("A second tasting from the same session."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: existingBottle.group.fullName }),
    ).toBeVisible();
    const collectionLink = page
      .getByRole("main")
      .getByRole("link", { name: "Library" });
    await expect(collectionLink).toBeVisible();
    await expect(collectionLink).toHaveAttribute(
      "href",
      `/users/${testUser.username}/library`,
    );
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("fills profile activity after hiding a Favorites-only page", async ({
    context,
    page,
  }) => {
    await signIn(context);
    await page.goto(`/users/${testUser.username}/activity`, {
      waitUntil: "commit",
    });

    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(
      page.getByText("A second tasting from the same session."),
    ).toBeVisible();
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test(
    "shows every tasting in a session on touch screens",
    {
      tag: "@mobile",
    },
    async ({ context, page }) => {
      await signIn(context);
      await page.goto("/", { waitUntil: "commit" });
      await expect(page.getByText(tastingNotes)).toBeVisible();
      await expect(
        page.getByText("A second tasting from the same session."),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: existingBottle.group.fullName }),
      ).toBeVisible();
    },
  );
});
