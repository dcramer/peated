import { Buffer } from "node:buffer";

import { bottlePathPattern } from "./assertions";
import {
  createdBottleName,
  exactSearchBottle,
  existingBottle,
  testAccessToken,
  testBrand,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";
import { expect, type Page, test, type TestInfo } from "./test";

test.describe("Add Bottle", () => {
  test("adds a resolved Bottle to the Library and starts a tasting", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "resolved"),
    });
    await page.goto(`/addBottle?bottle=${existingBottle.id}`);

    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    const status = page.getByRole("radiogroup", { name: "Bottle status" });
    await status.getByText("Open", { exact: true }).click();
    await expect(
      status.getByRole("radio", { name: "Open", exact: true }),
    ).toBeChecked();

    await page.getByRole("link", { name: "Rate this bottle" }).click();
    await expect(page).toHaveURL(
      `/addBottle?bottle=${existingBottle.id}&intent=tasting`,
    );
  });

  test("opens a search result in the Bottle resolver", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "search-route"),
    });
    await page.goto("/search?intent=choose&q=Lagavulin");

    await page
      .getByRole("link", {
        name: `${testBrand.name} ${exactSearchBottle.name}`,
      })
      .click();

    await expect(page).toHaveURL(
      `/addBottle?bottle=${exactSearchBottle.id}&intent=choose`,
    );
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View bottle" }),
    ).toHaveAttribute("href", bottlePathPattern(exactSearchBottle.id));
  });

  test("adds a matched label photo to the Library", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "scan-library-create"),
    });
    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(selectedBottle(page, existingBottle.group.name)).toBeVisible();
    await page.getByRole("button", { name: "Add to Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(selectedBottleImage(page)).toHaveAttribute(
      "src",
      /library\.webp$/,
    );
  });

  test("sends an expired photo session back to sign in", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-unauthorized-expired"),
    });
    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page).toHaveURL(/\/login\?redirectTo=%2FaddBottle$/);
  });

  test("creates a Bottle from an unmatched label and adds it to the Library", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-no-match-create"),
    });
    await page.goto("/addBottle");
    await uploadLabel(page);

    await page.getByRole("link", { name: "Add a new bottle" }).click();
    await expect(
      page.getByRole("textbox", { name: "Bottle name", exact: true }),
    ).toHaveValue(createdBottleName);
    await expect(
      page.getByRole("button", { name: testBrand.name }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();

    await expect(selectedBottle(page, createdBottleName)).toBeVisible();
    await expect(selectedBottleImage(page)).toHaveAttribute(
      "src",
      "http://127.0.0.1:4999/uploads/playwright-photo.webp",
    );
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
  });
});

function uniqueAccessToken(testInfo: TestInfo, suffix: string) {
  return [
    testAccessToken,
    suffix,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}

function selectedBottle(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Selected bottle" })
    .getByText(name, { exact: false });
}

function selectedBottleImage(page: Page) {
  return page.getByRole("region", { name: "Selected bottle" }).locator("img");
}

async function uploadLabel(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Photograph the label" }).click();
  await (
    await chooser
  ).setFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
}
