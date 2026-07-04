import {
  expect,
  type Page,
  type Request,
  test,
  type TestInfo,
} from "@playwright/test";
import { Buffer } from "node:buffer";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdBottleId,
  createdBottleName,
  existingBottle,
  existingRelease,
  existingReleaseId,
  testAccessToken,
  testBrand,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("create bottle", () => {
  test("renders the Add Bottle resolver at the plain route", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto("/addBottle");

    await expect(page).toHaveURL(/\/addBottle$/);
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await expect(page.getByText("Take or upload a photo")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("redirects legacy add bottle create links", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(`/addBottle?name=${encodeURIComponent(createdBottleName)}`);

    await expect(page).toHaveURL(/\/bottles\/new\?/);
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/bottles/new");
    expect(currentUrl.searchParams.get("name")).toBe(createdBottleName);
    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
  });

  test("creates a bottle with an existing fixture brand", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}`,
    );

    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);

    await page.getByText("e.g. Laphroaig").click();
    await page.getByPlaceholder("Search").fill(testBrand.name);
    await page.getByRole("button", { name: testBrand.name }).click();
    await expect(page.getByPlaceholder("Search")).toBeHidden();

    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${createdBottleId}&intent=tasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("continues to tasting from explicit tasting intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=tasting`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${createdBottleId}&intent=tasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log Tasting" }).click();
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
  });

  test("continues to the created bottle from view intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=view`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
  });

  test("returns to the created bottle from add bottle intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=addBottle`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${createdBottleId}&intent=addBottle$`),
    );
    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
  });

  test("adds the created bottle to library from library intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=library`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${createdBottleId}&intent=library$`),
    );
    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "In Library" }),
    ).toBeVisible();
  });

  test("shows validation when saving without a brand", async ({
    context,
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await signIn(context);

    await page.goto(`/bottles/new?name=${encodeURIComponent("Hogback")}`);

    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(page.getByText("Brand is required.")).toBeVisible();
    await page.getByText("e.g. Laphroaig").click();
    await expect(page.getByPlaceholder("Search")).toBeVisible();
    await expect(page).toHaveURL(/\/bottles\/new\?name=Hogback$/);
    expect(pageErrors).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("add bottle flow", () => {
  test("shows outcome actions for a resolved bottle query", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "resolved"),
    });

    await page.goto(`/addBottle?bottle=${existingBottle.id}`);

    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Bottle" }),
    ).toHaveAttribute("href", `/bottles/${existingBottle.id}`);
    await expect(
      page.getByRole("link", { name: "Search Again" }),
    ).toHaveAttribute("href", "/search?intent=addBottle");

    await page.getByRole("button", { name: "Add to Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("shows release-specific actions for a resolved bottling query", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "release"),
    });

    await page.goto(
      `/addBottle?bottle=${existingBottle.id}&release=${existingReleaseId}&intent=library`,
    );

    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(page.getByText("Distillers Edition (2024)")).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Bottle" }),
    ).toHaveAttribute(
      "href",
      `/bottles/${existingBottle.id}/bottlings/${existingReleaseId}`,
    );

    await page.getByRole("button", { name: "Add to Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText(existingRelease.edition)).toBeVisible();
  });

  test("keeps bottling Library action available when the base bottle is saved", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "release-after-base"),
    });

    await page.goto(`/addBottle?bottle=${existingBottle.id}`);
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto(
      `/addBottle?bottle=${existingBottle.id}&release=${existingReleaseId}`,
    );
    await expect(page.getByText(existingRelease.edition)).toBeVisible();
    const addReleaseButton = page.getByRole("button", {
      name: "Add to Library",
    });
    await expect(addReleaseButton).toBeVisible();
    await expect(addReleaseButton).toBeEnabled();

    await addReleaseButton.click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText(existingRelease.edition)).toBeVisible();
  });

  test("routes Add Bottle search results into the resolver outcome", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "search-route"),
    });

    await page.goto("/search?intent=addBottle&q=Lagavulin");
    await page.getByRole("link", { name: existingBottle.fullName }).click();

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${existingBottle.id}&intent=addBottle$`),
    );
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
  });

  test("adds a searched bottle to Library from the Add Bottle resolver", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "search-library"),
    });

    await page.goto("/search?intent=addBottle&q=Lagavulin");
    await page.getByRole("link", { name: existingBottle.fullName }).click();
    await page.getByRole("button", { name: "Add to Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("disables Library action when the bottle is already saved", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "library-disabled"),
    });

    await page.goto(`/addBottle?bottle=${existingBottle.id}`);
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto(`/addBottle?bottle=${existingBottle.id}`);
    const inLibraryButton = page.getByRole("button", { name: "In Library" });
    await expect(inLibraryButton).toBeVisible();
    await expect(inLibraryButton).toBeDisabled();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Log Tasting" }),
    ).toBeEnabled();
    await expectNoHorizontalOverflow(page);
  });

  test("shows Library save errors in the direct Add Bottle flow", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "library-create-failure"),
    });

    await page.goto(`/addBottle?bottle=${existingBottle.id}`);
    await page.getByRole("button", { name: "Add to Library" }).click();

    await expect(page.getByText("Could not save to Library.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("adds a matched scan to Library with the scanned photo", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "scan-library-create-slow"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page.getByText("Match found")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Bottle" }),
    ).toHaveAttribute("href", `/bottles/${existingBottle.id}`);
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(page.getByText("Match found")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeHidden();

    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByAltText("Selected bottle label")).toHaveAttribute(
      "src",
      /library\.webp$/,
    );
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Another Bottle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Library" }),
    ).toHaveAttribute("href", "/library");

    await page.getByRole("link", { name: "View Library" }).click();
    await expect(page).toHaveURL(/\/library$/);
    await expect(
      page.getByRole("link", { name: existingBottle.fullName }),
    ).toBeVisible();

    await page.goto("/addBottle");
    await uploadLabel(page);
    await expect(page.getByText("Match found")).toBeVisible();
    const inLibraryButton = page.getByRole("button", { name: "In Library" });
    await expect(inLibraryButton).toBeVisible();
    await expect(inLibraryButton).toBeDisabled();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a bottle from a scan with explicit bottle image approval", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-bottle-approval"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const imageApproval = page.getByRole("checkbox", {
      name: /Set as Bottle Image/,
    });
    await expect(imageApproval).toBeVisible();
    await expect(imageApproval).not.toBeChecked();
    await expect(
      page.getByText(
        "This photo will be shown as the public image for the new bottle.",
      ),
    ).toBeVisible();

    await imageApproval.check();
    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input).toMatchObject({
      pendingImageId: "playwright-photo-upload",
      catalogImageApproval: {
        target: "bottle",
      },
    });
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a bottle from a scan without catalog image approval when unchecked", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-bottle-unchecked"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const imageApproval = page.getByRole("checkbox", {
      name: /Set as Bottle Image/,
    });
    await expect(imageApproval).toBeVisible();
    await expect(imageApproval).not.toBeChecked();

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input).toMatchObject({
      pendingImageId: "playwright-photo-upload",
    });
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a release from a scan with explicit release image approval", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-release-approval"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const imageApproval = page.getByRole("checkbox", {
      name: /Set as Release Image/,
    });
    await expect(imageApproval).toBeVisible();
    await expect(imageApproval).not.toBeChecked();
    await expect(
      page.getByText(
        "This photo will be shown as the public image for the new release.",
      ),
    ).toBeVisible();

    await imageApproval.check();
    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input).toMatchObject({
      pendingImageId: "playwright-photo-upload",
      catalogImageApproval: {
        target: "release",
      },
    });
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(page.getByText("First Fill Oloroso")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("hides catalog image approval for unsuitable scan create proposals", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-unsuitable"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(
      page.getByRole("checkbox", { name: /Set as Bottle Image/ }),
    ).toBeHidden();
    await expect(
      page.getByRole("checkbox", { name: /Set as Release Image/ }),
    ).toBeHidden();

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input).toMatchObject({
      pendingImageId: "playwright-photo-upload",
    });
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("shows catalog image warning without blocking created target resolution", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-warning"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await page.getByRole("checkbox", { name: /Set as Bottle Image/ }).check();
    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(
      page.getByText(
        "The bottle was created, but the public image was not saved.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("offers review and create when a low-confidence scan has label details", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-no-match"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page.getByText("We couldn't find this bottle")).toBeVisible();
    await expect(
      page.getByText(
        "We found label details, but not enough to choose an existing bottle automatically.",
      ),
    ).toBeVisible();
    await expect(page.getByText(testBrand.name)).toBeVisible();
    await expect(page.getByText(createdBottleName)).toBeVisible();
    const createBottleLink = page.getByRole("link", {
      name: "Create Bottle",
    });
    await expect(createBottleLink).toBeVisible();
    const href = await createBottleLink.getAttribute("href");
    expect(href).not.toBeNull();

    const createUrl = new URL(href!, page.url());
    expect(createUrl.pathname).toBe("/bottles/new");
    expect(createUrl.searchParams.get("returnAction")).toBe("addBottle");
    expect(createUrl.searchParams.get("brandName")).toBe(testBrand.name);
    expect(createUrl.searchParams.get("name")).toBe(createdBottleName);
    await expectNoHorizontalOverflow(page);
  });

  test("does not offer manual creation for an uncertain scan match", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-needs-review"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(
      page.getByText("We couldn't identify this bottle"),
    ).toBeVisible();
    await expect(
      page.getByText(
        "We found a possible match, but it was not reliable enough to use automatically.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Search Again" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create Manually" }),
    ).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Create Bottle" }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Start Over" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a catalog bottle from a no-match scan and shows the created bottle", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-no-match-create"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await page.getByRole("link", { name: "Create Bottle" }).click();
    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);
    await expect(
      page.getByRole("button", { name: testBrand.name }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${createdBottleId}&intent=addBottle$`),
    );
    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
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

async function uploadLabel(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "label.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  });
}

function waitForPhotoIdentificationCreate(page: Page) {
  return page.waitForRequest((request) =>
    request.url().includes("/rpc/tastings/photoIdentificationCreate"),
  );
}

function getRpcInput(request: Request) {
  const postData = request.postData();
  expect(postData).toBeTruthy();

  return JSON.parse(postData!).json;
}

async function submitCreateBottle(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Create Bottle" }),
  ).toBeVisible();
  await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);

  await page.getByText("e.g. Laphroaig").click();
  await page.getByPlaceholder("Search").fill(testBrand.name);
  await page.getByRole("button", { name: testBrand.name }).click();
  await expect(page.getByPlaceholder("Search")).toBeHidden();

  await page.getByRole("button", { name: "Create Bottle" }).click();
}
