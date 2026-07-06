import { expect, type Locator, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";

import {
  displayImageBottleId,
  displayImageUrl,
  existingBottle,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("profile library", () => {
  test("renders a bottle display image fallback on the detail page", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: [
        testAccessToken,
        "display-image",
        testInfo.project.name,
      ].join("-"),
    });

    await page.goto(`/bottles/${displayImageBottleId}`, {
      waitUntil: "commit",
    });

    await expect(
      page.getByRole("heading", { name: "Lagavulin Display Image Reserve" }),
    ).toBeVisible();
    const displayImage = page.locator(`img[src="${displayImageUrl}"]`);

    if (testInfo.project.name.includes("mobile")) {
      await expect(displayImage).toHaveCount(1);
    } else {
      await expect(displayImage).toBeVisible();
    }

    const schemaTexts = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) =>
        scripts.map((script) => script.textContent ?? ""),
      );
    expect(schemaTexts.some((text) => text.includes('"@type":"Product"'))).toBe(
      true,
    );
    expect(schemaTexts.join("\n")).not.toContain(displayImageUrl);
  });

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

    await page.goto("/library", {
      waitUntil: "commit",
    });
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("link", { name: "Add Bottle" }),
    ).toHaveAttribute("href", "/addBottle?intent=library");
    await expect(
      page.getByRole("link", { name: savedBottleName }).first(),
    ).toBeVisible();
    if (!testInfo.project.name.includes("mobile")) {
      await expect(
        page.getByRole("columnheader", { name: "Bottle" }),
      ).toBeVisible();
      await expect(
        page.getByRole("columnheader", { name: "Tastings" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("columnheader", { name: "Rating" }),
      ).toHaveCount(0);
      await expect(page.getByRole("columnheader", { name: "Age" })).toHaveCount(
        0,
      );
    }

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
    const savedBottleRow = page.locator("tr").filter({
      hasText: savedBottleName,
    });

    await expect(
      savedBottleRow.getByRole("button", { name: "Bottle options" }),
    ).toBeVisible();
    await expect(savedBottleRow.getByText("Library entry image")).toHaveCount(
      0,
    );
    await expect(
      savedBottleRow.getByText("Only for this Library entry."),
    ).toHaveCount(0);

    const addImageButton = savedBottleRow.getByRole("button", {
      name: `Add image for ${savedBottleName}`,
    });
    await expect(addImageButton).toBeVisible();
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
    await expect(
      page.getByRole("button", { name: "Replace Photo" }),
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
      page
        .getByRole("link", { name: savedBottleName })
        .filter({ visible: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Bottle options" }),
    ).toHaveCount(0);
    await expect(page.getByText("Library entry image")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

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
    await expect(
      page.getByText("No library bottles recorded yet."),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
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
