import { expect, type Page, test } from "@playwright/test";

import { existingBottle, testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("profile library", () => {
  test("saves a bottle and updates its Library status", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bottleId = existingBottle.id;
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

    await page.goto(`/addBottle?bottle=${bottleId}`, {
      waitUntil: "commit",
    });

    const libraryButton = page.getByRole("button", { name: "Add to Library" });
    await libraryButton.click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });
    const savedBottleRow = libraryBottleRow(page, bottleId);
    await expect(savedBottleRow).toBeVisible();

    await savedBottleRow.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Mark as sealed" }).click();
    await expect(savedBottleRow.getByText("Sealed")).toBeVisible();

    await page.reload({ waitUntil: "commit" });
    await expect(
      libraryBottleRow(page, bottleId).getByText("Sealed"),
    ).toBeVisible();
  });

  test("filters Library entries from the profile tab", async ({
    context,
    page,
  }, testInfo) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bottleId = existingBottle.id;
    await signIn(context, {
      accessToken: [
        testAccessToken,
        "library-filters",
        testInfo.project.name,
        testInfo.workerIndex,
        testInfo.retry,
        runId,
      ].join("-"),
    });

    await page.goto(`/addBottle?bottle=${bottleId}`, {
      waitUntil: "commit",
    });
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto(`/users/${testUser.username}/library?cursor=2`, {
      waitUntil: "commit",
    });
    await expect(libraryBottleLink(page, bottleId)).toBeVisible();

    await page
      .getByRole("searchbox", { name: "Find in this library" })
      .fill("zzzz");
    await page.getByRole("button", { name: "Find" }).click();
    await expect(page).toHaveURL(/\/library\?query=zzzz$/);
    await expect(libraryBottleLink(page, bottleId)).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(libraryBottleLink(page, bottleId)).toBeVisible();

    await page.goto(`/users/${testUser.username}/library?cursor=2`, {
      waitUntil: "commit",
    });
    await page
      .getByRole("button", {
        name: new RegExp(`^${existingBottle.brand.name}\\b`),
      })
      .click();
    await expect(page).toHaveURL(
      `/users/${testUser.username}/library?brand=${existingBottle.brand.id}`,
    );
    await expect(libraryBottleLink(page, bottleId)).toBeVisible();
  });

  test("lets the owner remove a Library entry", async ({
    context,
    page,
  }, testInfo) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const accessToken = [
      testAccessToken,
      "library-image",
      testInfo.project.name,
      testInfo.workerIndex,
      testInfo.retry,
      runId,
    ].join("-");
    const bottleId = existingBottle.id;

    await signIn(context, { accessToken });
    await page.goto(`/addBottle?bottle=${bottleId}`, {
      waitUntil: "commit",
    });
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });
    const savedBottleRow = libraryBottleRow(page, bottleId);

    await signIn(context, {
      accessToken,
      user: {
        ...testUser,
        id: testUser.id + 1,
        username: "library-viewer",
        email: "library-viewer@example.com",
      },
    });
    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });
    await expect(
      libraryBottleLink(page, bottleId).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Actions for / }),
    ).toHaveCount(0);

    await signIn(context, { accessToken });
    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });

    await savedBottleRow.getByRole("button", { name: /^Actions for / }).click();
    await expect(
      page.getByRole("menuitem", { name: "Remove from library" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Remove from library" }).click();

    await expect(savedBottleRow).toHaveCount(0);
  });
});

function libraryBottleLink(page: Page, bottleId: number) {
  return page.locator(`a[href="/bottles/${bottleId}"]`).first();
}

function libraryBottleRow(page: Page, bottleId: number) {
  return page
    .locator("li")
    .filter({
      has: page.locator(`a[href="/bottles/${bottleId}"]`),
    })
    .filter({ visible: true });
}
