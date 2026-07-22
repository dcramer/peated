import {
  expect,
  type Locator,
  type Page,
  type Request,
  test,
  type TestInfo,
} from "@playwright/test";
import { Buffer } from "node:buffer";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  anotherReleaseSourceBottle,
  createdBottleId,
  createdBottleName,
  createdTastingId,
  existingBottle,
  existingBottleId,
  existingRelease,
  existingReleaseId,
  photoTastingNotes,
  testAccessToken,
  testBrand,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const pendingScanImageUrl =
  "http://127.0.0.1:4999/uploads/playwright-photo.webp";

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
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "ordinary-exact-create"),
    });
    const createRequests: Request[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rpc/bottles/create")) {
        createRequests.push(request);
      }
    });

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}`,
    );

    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);
    await expect(page.getByLabel("Edition / Label")).toBeVisible();
    await expect(page.getByLabel("ABV")).toBeVisible();
    await expect(page.getByLabel("Release Year")).toBeVisible();
    await expect(page.getByLabel("Vintage Year")).toBeVisible();
    await expect(page.getByText("Single Cask", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Cask Strength", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Cask Fill", { exact: true })).toBeVisible();
    await expect(page.getByText("Cask Type", { exact: true })).toBeVisible();
    await expect(page.getByText("Cask Size", { exact: true })).toBeVisible();

    await page.getByText("e.g. Laphroaig").click();
    await page.getByPlaceholder("Search").fill(testBrand.name);
    await page.getByRole("button", { name: testBrand.name }).click();
    await expect(page.getByPlaceholder("Search")).toBeHidden();

    await page.getByLabel("Edition / Label").fill("Founder's Cask");
    await page.getByLabel("ABV").fill("58.7");
    await page.getByLabel("Release Year").fill("2025");
    await page.getByLabel("Vintage Year").fill("2009");
    await toggleBottleBoolean(page, "Single Cask");
    await toggleBottleBoolean(page, "Cask Strength");
    await selectSimpleBottleField(page, "Cask Fill", "1st Fill");
    await selectSimpleBottleField(page, "Cask Type", "Oloroso");
    await selectSimpleBottleField(page, "Cask Size", "Hogshead");

    const createRequestPromise = waitForBottleCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const createInput = getRpcInput(await createRequestPromise);

    expect(createRequests).toHaveLength(1);
    expect(createInput).toMatchObject({
      edition: "Founder's Cask",
      abv: 58.7,
      releaseYear: 2025,
      vintageYear: 2009,
      singleCask: true,
      caskStrength: true,
      caskFill: "1st_fill",
      caskType: "oloroso",
      caskSize: "hogshead",
    });

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

  test("adds the created concrete bottle to library from a proposal", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "proposal-release-library"),
      user: {
        ...testUser,
        mod: true,
      },
    });

    await page.goto("/bottles/new?proposal=9901&returnAction=library");

    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.bottle).toBe(createdBottleId);
    expect(libraryInput.release).toBeNull();
    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${createdBottleId}&intent=library$`),
    );
    await expect(page.getByText("First Fill Oloroso").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "In Library" }),
    ).toBeVisible();
  });

  test("creates an independent Bottle from Add another release", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "add-another-release"),
    });
    const createRequests: Request[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rpc/bottles/create")) {
        createRequests.push(request);
      }
    });

    await page.goto(`/bottles/${existingBottleId}/addRelease`);

    await expect(
      page.getByRole("heading", { name: "Add another release" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(
      anotherReleaseSourceBottle.name,
    );
    await expect(page.getByLabel("Stated Age")).toHaveValue(
      String(anotherReleaseSourceBottle.statedAge),
    );
    await expect(page.getByLabel("Edition / Label")).toHaveValue(
      anotherReleaseSourceBottle.edition,
    );
    await expect(page.getByLabel("ABV")).toHaveValue(
      String(anotherReleaseSourceBottle.abv),
    );
    await expect(page.getByLabel("Release Year")).toHaveValue(
      String(anotherReleaseSourceBottle.releaseYear),
    );
    await expect(page.getByLabel("Bottle Group")).toHaveCount(0);
    await expect(page.getByLabel("Source Bottle")).toHaveCount(0);

    const createRequestPromise = waitForBottleCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const createInput = getRpcInput(await createRequestPromise);

    expect(createRequests).toHaveLength(1);
    expect(createInput).toMatchObject({
      name: anotherReleaseSourceBottle.name,
      brand: anotherReleaseSourceBottle.brand.id,
      statedAge: anotherReleaseSourceBottle.statedAge,
      edition: anotherReleaseSourceBottle.edition,
      abv: anotherReleaseSourceBottle.abv,
      releaseYear: anotherReleaseSourceBottle.releaseYear,
    });
    expect(createInput).not.toHaveProperty("group");
    expect(createInput).not.toHaveProperty("groupId");
    expect(createInput).not.toHaveProperty("sourceBottle");
    expect(createInput).not.toHaveProperty("sourceBottleId");
    expect(createInput).not.toHaveProperty("release");
    expect(createInput).not.toHaveProperty("releaseId");
    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expectNoHorizontalOverflow(page);
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
      page.getByRole("link", { name: "Add another release" }),
    ).toHaveAttribute("href", `/bottles/${existingBottle.id}/addRelease`);
    await expect(
      page.getByRole("link", { name: "Search Bottles" }),
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

  test("preserves scanned photos through Add Bottle search fallback", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "scan-search-library"),
    });

    await page.goto(
      `/search?intent=addBottle&q=Lagavulin&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingScanImageUrl)}`,
    );
    await page.getByRole("link", { name: existingBottle.fullName }).click();

    await expect(page).toHaveURL(/\/addBottle\?/);
    const addBottleUrl = new URL(page.url());
    expect(addBottleUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(addBottleUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    await expect(page.getByAltText("Selected bottle label")).toHaveAttribute(
      "src",
      pendingScanImageUrl,
    );
    await expect(
      page.getByRole("link", { name: "Search Bottles" }),
    ).toHaveAttribute(
      "href",
      `/search?intent=addBottle&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingScanImageUrl)}`,
    );

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
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

    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeHidden();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(
      page.getByText("Matched to existing bottle in Peated"),
    ).toBeVisible();
    const traceFooter = page.getByText(
      "Trace ID: 11111111111111111111111111111111",
    );
    await expect(traceFooter).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy photo identification payload" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Add another release" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Bottle" }),
    ).toHaveAttribute("href", `/bottles/${existingBottle.id}`);
    await expectFooterBelowAction(
      page.getByRole("link", { name: "View Bottle" }),
      traceFooter,
    );
    await page.getByRole("button", { name: "Add to Library" }).click();

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
    ).toHaveAttribute("href", `/users/${testUser.username}/library`);

    await page.getByRole("link", { name: "View Library" }).click();
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(
      page.getByRole("link", { name: existingBottle.fullName }),
    ).toBeVisible();

    await page.goto("/addBottle");
    await uploadLabel(page);
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(
      page.getByText("Matched to existing bottle in Peated"),
    ).toBeVisible();
    const inLibraryButton = page.getByRole("button", { name: "In Library" });
    await expect(inLibraryButton).toBeVisible();
    await expect(inLibraryButton).toBeDisabled();
    await expectNoHorizontalOverflow(page);
  });

  test("saves a scanned photo onto an existing Library entry without an image", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "scan-library-fill-image"),
    });

    await page.goto(`/addBottle?bottle=${existingBottle.id}`);
    await page.getByRole("button", { name: "Add to Library" }).click();
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();

    await page.goto("/addBottle");
    await uploadLabel(page);
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    const savePhotoButton = page.getByRole("button", { name: "Save Photo" });
    await expect(savePhotoButton).toBeVisible();
    await expect(savePhotoButton).toBeEnabled();

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await savePhotoButton.click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByAltText("Selected bottle label")).toHaveAttribute(
      "src",
      /library\.webp$/,
    );
    await expectNoHorizontalOverflow(page);
  });

  test("redirects to login when a scan hits an expired session", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-unauthorized-expired"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page).toHaveURL(/\/login\?redirectTo=%2FaddBottle$/);
    await expect(page.getByText("We couldn't read that photo")).toBeHidden();
  });

  test("keeps local scan errors when a 401 is not an expired session", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-unauthorized-valid"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page).toHaveURL(/\/addBottle$/);
    await expect(
      page.getByText("We couldn't read that photo", { exact: true }),
    ).toBeVisible();
  });

  test("defers scan bottle creation until Create Bottle is clicked", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(
        testInfo,
        "photo-create-bottle-default-image",
      ),
    });

    const createRequests: Request[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/rpc/tastings/photoIdentificationCreate")) {
        createRequests.push(request);
      }
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(createRequests).toHaveLength(0);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a complete bottle from a scan when Create Bottle is clicked", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-complete-bottle"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
    await expect(page.locator('dt:has-text("Bottle Label") + dd')).toHaveText(
      "First Fill Oloroso",
    );
    await expect(page.locator('dt:has-text("ABV") + dd')).toHaveText("46.0%");
    await expect(page.locator('dt:has-text("Release Year") + dd')).toHaveText(
      "2026",
    );
    await expectNoHorizontalOverflow(page);
  });

  test("prefills exact bottle fields from a scan before creating it", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-prefilled-bottle"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await page.getByRole("button", { name: "Show all details" }).click();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Edition:", { exact: true })).toBeVisible();
    await expect(page.getByText("First Fill Oloroso").first()).toBeVisible();

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
    await expect(page.locator('dt:has-text("Bottle Label") + dd')).toHaveText(
      "First Fill Oloroso",
    );
    await expectNoHorizontalOverflow(page);
  });

  test("creates from an unsuitable scan without requesting image approval", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-unsuitable"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:unsuitable",
    );
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
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

    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(
      page.getByText(
        "The bottle was created, but the public image was not saved.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a scan proposal as part of Add to Library", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(
        testInfo,
        "photo-create-bottle-default-image-library",
      ),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const input = getRpcInput(await requestPromise);
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bottle created" }),
    ).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a complete scan bottle as part of Add to Library", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(
        testInfo,
        "photo-create-complete-bottle-library",
      ),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const input = getRpcInput(await requestPromise);
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    expect(libraryInput.bottle).toBe(createdBottleId);
    expect(libraryInput.release).toBeNull();
    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText("First Fill Oloroso")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("creates a scan proposal as part of Log Tasting", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(
        testInfo,
        "photo-create-bottle-default-image-tasting",
      ),
    });

    await page.goto("/addBottle?intent=tasting");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Log Tasting" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Savor" }).click();
    await page.getByLabel("Comments").fill(photoTastingNotes);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expect(
      page.getByRole("heading", { name: "Bottle created" }),
    ).toBeHidden();
    await expectNoHorizontalOverflow(page);
  });

  test("routes to an existing bottle when action-time create reuses a target", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-existing-view"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Create Bottle" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(page).toHaveURL(new RegExp(`/bottles/${existingBottle.id}$`));
    await expect(
      page.getByRole("heading", { name: existingBottle.fullName }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("adds an existing reused create proposal to Library", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-existing-library"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("opens Log Tasting for an existing reused create proposal", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-existing-tasting"),
    });

    await page.goto("/addBottle?intent=tasting");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Log Tasting" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
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
    const result = page.getByRole("main");
    await expect(
      result.getByText(testBrand.name, { exact: true }).first(),
    ).toBeVisible();
    await result.getByRole("button", { name: "Show all details" }).click();
    await expect(
      result.getByText(createdBottleName, { exact: true }),
    ).toBeVisible();
    await expect(
      result.getByText(testBrand.name, { exact: true }).first(),
    ).toBeVisible();
    await expect(
      result.getByText("Single Cask", { exact: true }),
    ).toBeVisible();
    await expect(result.getByText("2007", { exact: true })).toBeVisible();
    await expect(result.getByText("2016", { exact: true })).toBeVisible();
    await expect(result.getByText("1661", { exact: true })).toBeVisible();
    const traceFooter = page.getByText(
      "Trace ID: 55555555555555555555555555555555",
    );
    await expect(traceFooter).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (value: string) => {
            (window as typeof window & { __copiedText?: string }).__copiedText =
              value;
          },
        },
      });
    });
    await page
      .getByRole("button", { name: "Copy photo identification payload" })
      .click();
    const copiedPayload = await page.evaluate(
      () => (window as typeof window & { __copiedText?: string }).__copiedText,
    );
    expect(copiedPayload).toBeDefined();
    const copied = JSON.parse(copiedPayload!);
    expect(copied.traceId).toBe("55555555555555555555555555555555");
    expect(copied.suggestedNextStep).toBe("manual_search");
    expect(copied.imageEvidence.fieldCandidates).toMatchObject({
      edition: { value: "Single Cask" },
      vintageYear: { value: 2007 },
      releaseYear: { value: 2016 },
      caskNumber: { value: "1661" },
    });
    expect(copied.classification.decision.action).toBe("no_match");
    const createBottleLink = page.getByRole("link", {
      name: "Create Bottle",
    });
    await expect(createBottleLink).toBeVisible();
    await expectFooterBelowAction(createBottleLink, traceFooter);
    const href = await createBottleLink.getAttribute("href");
    expect(href).not.toBeNull();

    const createUrl = new URL(href!, page.url());
    expect(createUrl.pathname).toBe("/bottles/new");
    expect(createUrl.searchParams.get("returnAction")).toBe("addBottle");
    expect(createUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
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
      page.getByRole("link", { name: "Search Bottles" }),
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

  test("keeps a downgraded scan match actionable and offers manual creation", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-manual-match"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page.getByText(existingRelease.fullName)).toBeVisible();
    await expect(
      page.getByText("Matched to existing bottle in Peated"),
    ).toBeVisible();
    await expect(page.getByText("We couldn't confirm the match")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    const createBottleLink = page.getByRole("link", {
      name: "Create Bottle",
    });
    await expect(createBottleLink).toBeVisible();

    const href = await createBottleLink.getAttribute("href");
    expect(href).not.toBeNull();
    const createUrl = new URL(href!, page.url());
    expect(createUrl.pathname).toBe("/bottles/new");
    expect(createUrl.searchParams.get("returnAction")).toBe("addBottle");
    expect(createUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    expect(createUrl.searchParams.get("brandName")).toBe(testBrand.name);
    expect(createUrl.searchParams.get("name")).toBe(existingBottle.name);
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

    await expect(page).toHaveURL(/\/addBottle\?/);
    const createdUrl = new URL(page.url());
    expect(createdUrl.pathname).toBe("/addBottle");
    expect(createdUrl.searchParams.get("bottle")).toBe(String(createdBottleId));
    expect(createdUrl.searchParams.get("intent")).toBe("addBottle");
    expect(createdUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createdUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeVisible();
    await expect(page.getByAltText("Selected bottle label")).toHaveAttribute(
      "src",
      pendingScanImageUrl,
    );
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("clears a pending scan when the manual create image is removed", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-no-match-remove-image"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);
    await page.getByRole("link", { name: "Create Bottle" }).click();

    await expect(page.getByAltText("uploaded image")).toHaveAttribute(
      "src",
      pendingScanImageUrl,
    );
    await page.getByRole("button", { name: "Remove Image" }).click();
    await expect(page.getByAltText("uploaded image")).toBeHidden();
    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(page).toHaveURL(/\/addBottle\?/);
    const createdUrl = new URL(page.url());
    expect(createdUrl.searchParams.get("pendingImageId")).toBeNull();
    expect(createdUrl.searchParams.get("pendingImageUrl")).toBeNull();
    await expect(page.getByAltText("Selected bottle label")).toBeHidden();

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput).not.toHaveProperty("pendingImageId");
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

async function toggleBottleBoolean(page: Page, label: string) {
  const field = page
    .getByText(label, { exact: true })
    .locator("..")
    .locator("..");
  await field.getByRole("switch").click();
}

async function selectSimpleBottleField(
  page: Page,
  label: string,
  option: string,
) {
  await page.getByText(label, { exact: true }).click();
  await page.getByRole("button", { name: option, exact: true }).last().click();
}

async function uploadLabel(page: Page) {
  await expect(
    page.getByRole("button", { name: /Take or upload a photo/ }),
  ).toBeVisible();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Take or upload a photo/ }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
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

function waitForCollectionBottleCreate(page: Page) {
  return page.waitForRequest((request) =>
    request.url().includes("/rpc/collections/bottles/create"),
  );
}

function waitForBottleCreate(page: Page) {
  return page.waitForRequest((request) =>
    request.url().includes("/rpc/bottles/create"),
  );
}

function getRpcInput(request: Request) {
  const postData = request.postData();
  expect(postData).toBeTruthy();

  return JSON.parse(postData!).json;
}

async function expectFooterBelowAction(action: Locator, footer: Locator) {
  const [actionBox, footerBox] = await Promise.all([
    action.boundingBox(),
    footer.boundingBox(),
  ]);

  expect(actionBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.y).toBeGreaterThanOrEqual(actionBox!.y + actionBox!.height);
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
