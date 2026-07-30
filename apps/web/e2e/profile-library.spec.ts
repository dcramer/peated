import { expect, type Locator, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";

import { existingBottle, testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("profile library", () => {
  test("saves a bottle and updates its Library status", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);

    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bottleId =
      existingBottle.id +
      (testInfo.project.name.includes("mobile") ? 100_000 : 0) +
      (Date.now() % 100_000);
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

    const libraryButton = page.locator(
      'button[data-collection-action="library"]',
    );

    await libraryButton.click();
    await expect(libraryButton).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });
    const savedBottleRow = libraryBottleRow(page, bottleId);
    await expect(savedBottleRow).toBeVisible();

    const statusButton = savedBottleRow.locator(
      'button[data-status="unset"]:visible',
    );
    await statusButton.click();
    await page.getByRole("menuitem", { name: "Sealed" }).click();
    await expect(
      savedBottleRow.locator('button[data-status="sealed"]:visible'),
    ).toBeVisible();

    await page.reload({ waitUntil: "commit" });
    await expect(
      libraryBottleRow(page, bottleId).locator(
        'button[data-status="sealed"]:visible',
      ),
    ).toBeVisible();
  });

  test("filters Library entries from the profile tab", async ({
    context,
    page,
  }, testInfo) => {
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const bottleId =
      existingBottle.id +
      600_000 +
      (testInfo.project.name.includes("mobile") ? 100_000 : 0) +
      (Date.now() % 100_000);
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

    await page.goto(`/bottles/${bottleId}`, {
      waitUntil: "commit",
    });
    await page.locator('button[data-collection-action="library"]').click();
    await expect(
      page.locator('button[data-collection-action="library"]'),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/users/${testUser.username}/library?cursor=2`, {
      waitUntil: "commit",
    });
    await expect(libraryBottleLink(page, bottleId)).toBeVisible();

    await page.getByRole("searchbox", { name: "Search library" }).fill("zzzz");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/library\?query=zzzz$/);
    await expect(libraryBottleLink(page, bottleId)).toHaveCount(0);

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(libraryBottleLink(page, bottleId)).toBeVisible();

    await page.goto(`/users/${testUser.username}/library?cursor=2`, {
      waitUntil: "commit",
    });
    await page.getByRole("button", { name: /^brand:/i }).click();
    await page.getByPlaceholder("Search brand").fill(existingBottle.brand.name);
    await expect(
      page.getByRole("button", { name: existingBottle.brand.name }),
    ).toBeVisible();
    await page.getByRole("button", { name: existingBottle.brand.name }).click();
    await expect(page).toHaveURL(
      `/users/${testUser.username}/library?brand=${existingBottle.brand.id}`,
    );
    await expect(libraryBottleLink(page, bottleId)).toBeVisible();
  });

  test("lets the owner edit the image and remove a Library entry", async ({
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
    const bottleId =
      existingBottle.id +
      200_000 +
      (testInfo.project.name.includes("mobile") ? 100_000 : 0) +
      (Date.now() % 100_000);
    const savedBottleName = `${existingBottle.brand.name} 16-year-old ${bottleId}`;

    await signIn(context, { accessToken });
    await page.goto(`/bottles/${bottleId}`, {
      waitUntil: "commit",
    });
    await page.locator('button[data-collection-action="library"]').click();

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });
    const savedBottleRow = libraryBottleRow(page, bottleId);

    const addImageButton = savedBottleRow.getByRole("button", {
      name: `Add image for ${savedBottleName}`,
    });
    await uploadLibraryImage(page, addImageButton);

    await expect(
      savedBottleRow.getByRole("img", {
        name: `Photo of ${savedBottleName}`,
      }),
    ).toHaveAttribute("src", /library-replaced-\d+\.webp$/);

    const viewImageButton = savedBottleRow.getByRole("button", {
      name: `View image for ${savedBottleName}`,
    });
    await expect(viewImageButton).toBeVisible();
    await viewImageButton.click();
    await expect(
      page.getByRole("heading", { name: `Photo of ${savedBottleName}` }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

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
      page.getByRole("button", { name: "Bottle options" }),
    ).toHaveCount(0);

    await signIn(context, { accessToken });
    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });

    await savedBottleRow
      .getByRole("button", { name: "Bottle options" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: "Remove from Library" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Remove from Library" }).click();

    await expect(savedBottleRow).toHaveCount(0);
  });
});

async function uploadLibraryImage(page: Page, trigger: Locator) {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await trigger.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "library-label.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
}

function libraryBottleLink(page: Page, bottleId: number) {
  return page.locator(`a[href="/bottles/${bottleId}"]`).first();
}

function libraryBottleRow(page: Page, bottleId: number) {
  return page.locator("tr").filter({
    has: page.locator(`a[href="/bottles/${bottleId}"]`),
  });
}
