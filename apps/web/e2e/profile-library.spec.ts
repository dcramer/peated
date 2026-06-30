import { expect, type Page, test } from "@playwright/test";

import { existingBottle, testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("profile library", () => {
  test("saves a bottle to Library without adding it to Favorites", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bottleId =
      existingBottle.id +
      (testInfo.project.name.includes("mobile") ? 100_000 : 0) +
      (Date.now() % 100_000);
    const savedBottleName = `${existingBottle.brand.name} 16-year-old ${bottleId}`;

    await signIn(context, {
      accessToken: [
        testAccessToken,
        "library",
        testInfo.project.name,
        testInfo.workerIndex,
        testInfo.retry,
        runId,
      ].join("-"),
    });

    await page.goto(`/bottles/${bottleId}`, {
      waitUntil: "commit",
    });

    const favoritesButton = page.locator(
      'button[data-collection-action="favorites"]',
    );
    const libraryButton = page.locator(
      'button[data-collection-action="library"]',
    );

    await expect(favoritesButton).toBeVisible();
    await expect(libraryButton).toBeVisible();
    await expect(favoritesButton).toBeEnabled();
    await expect(libraryButton).toBeEnabled();
    await expect(favoritesButton).toHaveAttribute("aria-pressed", "false");
    await expect(libraryButton).toHaveAttribute("aria-pressed", "false");

    await libraryButton.click();
    await expect(libraryButton).toHaveAttribute("aria-pressed", "true");
    await expect(favoritesButton).toHaveAttribute("aria-pressed", "false");

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });
    const savedBottleRow = page.locator("tr").filter({
      hasText: savedBottleName,
    });
    await expect(
      page.getByRole("link", { name: savedBottleName }).first(),
    ).toBeVisible();
    await expect(
      savedBottleRow.getByRole("img", { name: "In Library" }),
    ).toBeVisible();
    await expect(
      savedBottleRow.getByRole("img", { name: "Favorite" }),
    ).toHaveCount(0);
    await expect(
      page.getByText("No library bottles recorded yet."),
    ).toHaveCount(0);

    await page.goto(`/users/${testUser.username}/favorites`, {
      waitUntil: "commit",
    });
    await expect(
      page.getByText("No favorites recorded yet.").filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: savedBottleName })).toHaveCount(
      0,
    );
    await expectNoHorizontalOverflow(page);
  });
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      { message: "page should not create horizontal overflow" },
    )
    .toBeLessThanOrEqual(1);
}
