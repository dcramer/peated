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
    await reachFinalCreateStep(page);
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

  test("uses an existing Bottle and preserves the initiating action and photo", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "create-candidate"),
    });
    const pendingImageUrl =
      "http://127.0.0.1:4999/uploads/playwright-photo.webp";
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=choose&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingImageUrl)}`,
    );

    await expect(page.getByText("1 bottle may match this one.")).toBeVisible();
    await page.getByRole("button", { name: "Review" }).click();
    await expect(
      page.getByRole("region", { name: "Bottles that may match" }),
    ).toContainText(exactSearchBottle.fullName);
    await page.getByRole("button", { name: "Use this bottle" }).click();

    await expect(page).toHaveURL(
      `/addBottle?bottle=${exactSearchBottle.id}&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingImageUrl)}&intent=choose`,
    );
  });

  test("allows a distinct release to be created after reviewing suggestions", async ({
    context,
    page,
    snapshot,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "distinct-release"),
    });
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=view`,
    );

    await expect(page.getByText("1 bottle may match this one.")).toBeVisible();
    await reachFinalCreateStep(page);
    const finalReview = page.getByRole("button", {
      name: "Review 1 bottle",
      exact: true,
    });
    await snapshot("Add bottle / Final duplicate gate / Desktop", {
      fullPage: false,
      ready: finalReview,
    });
    await finalReview.click();
    await expect(
      page.getByRole("button", { name: "Use this bottle" }),
    ).toBeVisible();
    const addAsNew = page.getByRole("button", {
      name: "Add as a new bottle",
      exact: true,
    });
    await snapshot("Add bottle / Final duplicate review / Desktop", {
      fullPage: false,
      ready: addAsNew,
    });
    await addAsNew.click();

    await expect(page).toHaveURL(bottlePathPattern(9302));
  });

  test("reviews only Bottle ids that appeared after the last review", async ({
    context,
    page,
    snapshot,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "new-candidates"),
    });
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=view`,
    );

    const firstNotice = page.getByText("1 bottle may match this one.");
    await expect(firstNotice).toBeVisible();
    await snapshot("Add bottle / Match notice / Light", {
      fullPage: false,
      ready: firstNotice,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await snapshot("Add bottle / Match notice / Dark", {
      fullPage: false,
      ready: firstNotice,
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.getByRole("button", { name: "Review" }).click();
    await page
      .getByRole("button", { name: "None of these", exact: true })
      .click();
    await expect(
      page.getByText("1 bottle may match this one."),
    ).not.toBeVisible();

    await page
      .getByRole("textbox", { name: "Bottle name" })
      .fill("21-year-old Kogei Collection");
    await expect(
      page.getByText("2 more bottles may match this one."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review" }).click();

    const candidates = page.getByRole("region", {
      name: "Bottles that may match",
    });
    await expect(candidates).not.toContainText(exactSearchBottle.fullName);
    await expect(
      candidates.getByRole("button", { name: "Use this bottle" }),
    ).toHaveCount(2);
    await snapshot("Add bottle / Match review / Desktop", {
      fullPage: false,
      ready: candidates,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await snapshot("Add bottle / Match review / Dark", {
      fullPage: false,
      ready: candidates,
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page
      .getByRole("button", { name: "None of these", exact: true })
      .click();

    await page
      .getByRole("combobox", { name: "Type" })
      .selectOption("single_malt");
    await expect(
      page.getByText(/bottles? may match this one\./),
    ).not.toBeVisible();
  });

  test("reviews a matching Bottle without leaving the mobile step @mobile", async ({
    context,
    page,
    snapshot,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "mobile-candidates"),
    });
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=view`,
    );

    const notice = page.getByText("1 bottle may match this one.");
    await expect(notice).toBeVisible();
    await snapshot("Add bottle / Match notice / Mobile", {
      fullPage: false,
      ready: notice,
    });
    await page.getByRole("button", { name: "Review" }).click();

    await expect(
      page.getByRole("heading", {
        level: 2,
        name: "Is it already on Peated?",
      }),
    ).toBeFocused();

    const candidates = page.getByRole("region", {
      name: "Bottles that may match",
    });
    await snapshot("Add bottle / Match review / Mobile", {
      fullPage: false,
      ready: candidates,
    });
    await page
      .getByRole("button", { name: "None of these", exact: true })
      .click();

    await expect(page.getByText("Step 1 of 7")).toBeVisible();
    await expect(notice).not.toBeVisible();
  });

  test("treats NAS as an alternative to an age statement", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "nas-toggle"),
    });
    await page.goto(
      `/bottles/new?name=Special Release&brand=${testBrand.id}&returnAction=view`,
    );

    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    const age = page.getByRole("spinbutton", { name: "Age statement" });
    await age.fill("12");
    await page.getByText("No age statement (NAS)", { exact: true }).click();

    await expect(age).toBeDisabled();
    await expect(age).toHaveValue("");
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

async function reachFinalCreateStep(page: Page) {
  for (let step = 0; step < 6; step += 1) {
    await page.getByRole("button", { name: "Continue" }).click();
  }
}
