import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  existingBottle,
  homeBottle,
  tastingNotes,
  testUser,
} from "./rpc-fixtures.mjs";

test.describe("activity feed", () => {
  test("renders tasting and Library addition activity", async ({ page }) => {
    await page.goto("/", { waitUntil: "commit" });

    const tastingActivity = page
      .locator("li")
      .filter({ hasText: tastingNotes })
      .first();
    await expect(
      tastingActivity.getByRole("link", {
        name: homeBottle.group.fullName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(page.getByText("1/2")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Previous tasting" }),
    ).toBeDisabled();
    await page.getByRole("button", { name: "Next tasting" }).click();
    await expect(page.getByText("2/2")).toBeVisible();
    await expect(page.getByText(tastingNotes)).toBeHidden();
    await expect(
      page.getByRole("link", { name: existingBottle.group.fullName }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Previous tasting" }).click();
    await expect(page.getByText("1/2")).toBeVisible();
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
    await page.goto(`/users/${testUser.username}/activity`, {
      waitUntil: "commit",
    });

    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(page.getByText("1/2")).toBeVisible();
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("supports swiping between tastings on touch screens", async ({
    page,
  }, testInfo) => {
    test.skip(!testInfo.project.name.includes("mobile"), "Mobile-only flow");

    await page.goto("/", { waitUntil: "commit" });
    await expect(page.getByText("1/2")).toBeVisible();

    await page.getByTestId("tasting-session-slides").evaluate((element) => {
      const start = new Touch({
        identifier: 1,
        target: element,
        clientX: 300,
        clientY: 200,
      });
      const end = new Touch({
        identifier: 1,
        target: element,
        clientX: 50,
        clientY: 200,
      });
      element.dispatchEvent(
        new TouchEvent("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [start],
          changedTouches: [start],
        }),
      );
      element.dispatchEvent(
        new TouchEvent("touchend", {
          bubbles: true,
          cancelable: true,
          touches: [],
          changedTouches: [end],
        }),
      );
    });

    await expect(page.getByText("2/2")).toBeVisible();
    await expect(
      page.getByRole("link", { name: existingBottle.group.fullName }),
    ).toBeVisible();
  });
});
