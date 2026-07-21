import {
  expect,
  type Locator,
  type Page,
  type Request,
  test,
} from "@playwright/test";
import { Buffer } from "node:buffer";

import {
  bottleImageBottleId,
  bottleImageUrl,
  existingBottle,
  existingRelease,
  existingReleaseId,
  genericCollectionTargetLabel,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("profile library", () => {
  test("renders a Bottle-owned image on the detail page", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: [
        testAccessToken,
        "bottle-image",
        testInfo.project.name,
      ].join("-"),
    });

    await page.goto(`/bottles/${bottleImageBottleId}`, {
      waitUntil: "commit",
    });

    await expect(
      page.getByRole("heading", { name: "Lagavulin Bottle Image Reserve" }),
    ).toBeVisible();
    const bottleImage = page.locator(`img[src="${bottleImageUrl}"]`);

    if (testInfo.project.name.includes("mobile")) {
      await expect(bottleImage).toHaveCount(1);
    } else {
      await expect(bottleImage).toBeVisible();
    }

    const schemaTexts = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) =>
        scripts.map((script) => script.textContent ?? ""),
      );
    const productSchema = schemaTexts
      .map((text) => JSON.parse(text) as { "@type"?: string; image?: string })
      .find((schema) => schema["@type"] === "Product");
    expect(productSchema).toMatchObject({
      "@type": "Product",
      image: bottleImageUrl,
    });
  });

  test("saves a bottle to Library with Favorites hidden", async ({
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

    const libraryButton = page.locator(
      'button[data-collection-action="library"]',
    );

    await expect(
      page.locator('[data-collection-action="favorites"]'),
    ).toHaveCount(0);
    await expect(libraryButton).toBeVisible();
    await expect(libraryButton).toBeEnabled();
    await expect(libraryButton).toHaveAttribute("aria-pressed", "false");

    await libraryButton.click();
    await expect(libraryButton).toHaveAttribute("aria-pressed", "true");

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
    ).toHaveCount(0);
    await expect(
      savedBottleRow.getByRole("img", { name: "Favorite" }),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Favorites" })).toHaveCount(0);
    await expect(
      page.getByText("No library bottles recorded yet."),
    ).toHaveCount(0);

    await page.goto("/library", {
      waitUntil: "commit",
    });
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(
      page.getByRole("heading", { name: testUser.username }),
    ).toBeVisible();
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
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(page.getByRole("link", { name: savedBottleName })).toHaveCount(
      1,
    );
    await page.goto("/favorites", { waitUntil: "commit" });
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(
      page.getByRole("link", { name: "Library" }).last(),
    ).toHaveAttribute("href", `/users/${testUser.username}/library`);
    await expectNoHorizontalOverflow(page);
  });

  test("renders concise bottling names in Library", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: [
        testAccessToken,
        "library-release-name",
        testInfo.project.name,
        testInfo.workerIndex,
        testInfo.retry,
      ].join("-"),
    });

    await page.goto(
      `/addBottle?bottle=${existingBottle.id}&release=${existingReleaseId}&intent=library`,
    );
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });

    const conciseName = `${existingBottle.fullName} - ${existingRelease.edition} (${existingRelease.releaseYear})`;
    const bottlingLink = page.getByRole("link", { name: conciseName });

    await expect(bottlingLink).toBeVisible();
    await expect(bottlingLink).toHaveAttribute(
      "href",
      `/bottles/${existingReleaseId}`,
    );
    await expect(
      page.getByRole("link", { name: existingRelease.fullName, exact: true }),
    ).toHaveCount(0);
  });

  test("keeps generic Library targets independent from representative bottles", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: [
        testAccessToken,
        "library-generic",
        testInfo.project.name,
        testInfo.workerIndex,
        testInfo.retry,
      ].join("-"),
    });

    await page.goto(`/users/${testUser.username}/library`, {
      waitUntil: "commit",
    });

    const genericRow = page.locator("tr").filter({
      hasText: genericCollectionTargetLabel,
    });
    await expect(genericRow).toBeVisible();
    await expect(
      genericRow.getByText("Exact bottle not specified"),
    ).toBeVisible();
    await expect(
      genericRow.getByRole("link", { name: genericCollectionTargetLabel }),
    ).toHaveCount(0);
    await expect(
      genericRow.locator(`a[href="/bottles/${existingBottle.id}"]`),
    ).toHaveCount(0);
    await expect(genericRow.getByRole("img", { name: "Tasted" })).toBeVisible();

    await genericRow
      .getByRole("button", {
        name: "Change bottle status, current status Not set",
      })
      .click();
    await page.getByRole("menuitem", { name: "Open" }).click();
    await expect(
      genericRow.getByRole("button", {
        name: "Change bottle status, current status Open",
      }),
    ).toBeVisible();

    const deleteRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/collections/bottles/delete"),
    );
    await genericRow.getByRole("button", { name: "Bottle options" }).click();
    await page.getByRole("menuitem", { name: "Remove from Library" }).click();
    const deleteInput = getRpcInput(await deleteRequestPromise);

    expect(deleteInput.target).toBeGreaterThan(0);
    expect(deleteInput).not.toHaveProperty("bottle");
    expect(deleteInput).not.toHaveProperty("release");
    await expect(genericRow).toHaveCount(0);
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
    const savedBottleName = `${existingBottle.brand.name} 16-year-old ${bottleId}`;

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
    await expect(
      page.getByRole("link", { name: savedBottleName }).first(),
    ).toBeVisible();

    await page.getByRole("searchbox", { name: "Search library" }).fill("zzzz");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/library\?query=zzzz$/);
    await expect(
      page.getByText("No library bottles match these filters."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(
      page.getByRole("link", { name: savedBottleName }).first(),
    ).toBeVisible();

    await page.goto(`/users/${testUser.username}/library?cursor=2`, {
      waitUntil: "commit",
    });
    await page.getByRole("button", { name: /brand any brand/i }).click();
    await page.getByPlaceholder("Search brand").fill(existingBottle.brand.name);
    await expect(
      page.getByRole("button", { name: existingBottle.brand.name }),
    ).toBeVisible();
    await page.getByRole("button", { name: existingBottle.brand.name }).click();
    await expect(page).toHaveURL(
      `/users/${testUser.username}/library?brand=${existingBottle.brand.id}`,
    );
    await expect(
      page.getByRole("button", {
        name: new RegExp(`brand ${existingBottle.brand.name}`, "i"),
      }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search brand")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: savedBottleName }).first(),
    ).toBeVisible();
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

function getRpcInput(request: Request) {
  const postData = request.postData();
  expect(postData).toBeTruthy();

  return JSON.parse(postData!).json;
}
