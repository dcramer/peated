import {
  expect,
  type Locator,
  type Page,
  type Request,
  test,
  type TestInfo,
} from "@playwright/test";
import { Buffer } from "node:buffer";
import { z } from "zod";

declare global {
  interface Window {
    __copiedText?: string;
  }
}

import { bottlePath } from "./assertions";
import {
  addAnotherReleaseSourceBottle,
  createdBottleId,
  createdBottleName,
  createdTastingId,
  exactMatchedBottle,
  exactMatchedBottleId,
  exactSearchBottle,
  existingBottle,
  existingBottleId,
  photoTastingNotes,
  testAccessToken,
  testBrand,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const pendingScanImageUrl =
  "http://127.0.0.1:4999/uploads/playwright-photo.webp";
test.describe("create bottle", () => {
  test("loads the bottle resolver at the plain route", async ({
    context,
    page,
  }) => {
    await signIn(context);

    const response = await page.goto("/addBottle");

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/addBottle$/);
    await expect(
      page.getByRole("heading", { name: "Find a bottle" }).first(),
    ).toBeVisible();
  });

  test("uses the user intent as the resolver title", async ({
    context,
    page,
  }) => {
    await signIn(context);

    for (const [intent, title] of [
      ["catalog", "Add a bottle"],
      ["library", "Add to your Library"],
      ["tasting", "Log a tasting"],
    ] as const) {
      await page.goto(`/addBottle?intent=${intent}`);
      await expect(
        page.getByRole("heading", { name: title }).first(),
      ).toBeVisible();
    }
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
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&groupId=12345&sourceBottleId=67890`,
    );

    await expect(
      page.getByRole("heading", { name: "Add a bottle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Bottle name", exact: true }),
    ).toHaveValue(createdBottleName);
    const moreDetails = page
      .locator("details")
      .filter({ hasText: "More details" });
    await expect(moreDetails).not.toHaveAttribute("open");
    await moreDetails.getByText("More details", { exact: true }).click();
    await expect(moreDetails).toHaveAttribute("open");
    await expect(page.getByLabel("Edition or batch")).toBeVisible();
    await expect(page.getByLabel("Alcohol")).toBeVisible();
    await expect(page.getByLabel("Release year")).toBeVisible();
    await expect(page.getByLabel("Distillation year")).toBeVisible();
    await expect(page.getByText("Single cask", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Cask strength", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Maturation")).toBeVisible();
    await expect(page.getByLabel("Cask number")).toBeVisible();
    await expect(page.getByLabel("Outturn")).toBeVisible();
    await expect(page.getByLabel("Bottle Group")).toHaveCount(0);
    await expect(page.getByLabel("Source Bottle")).toHaveCount(0);

    const brandField = page.getByRole("combobox", { name: "Brand" });
    await brandField.fill(testBrand.name);
    await page
      .getByRole("option", { name: new RegExp(testBrand.name) })
      .click();
    await expect(
      page.getByRole("button", { name: `Clear ${testBrand.name}` }),
    ).toBeVisible();

    await page.getByLabel("Edition or batch").fill("Founder's Cask");
    await page.getByLabel("Alcohol").fill("58.7");
    await page.getByLabel("Release year").fill("2025");
    await page.getByLabel("Distillation year").fill("2009");
    await toggleBottleBoolean(page, "Single cask");
    await toggleBottleBoolean(page, "Cask strength");
    await page.getByLabel("Maturation").fill("Oloroso hogshead");
    await page.getByLabel("Cask number").fill("#5678");
    await page.getByLabel("Outturn").fill("240");

    const createRequestPromise = waitForBottleCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const createInput = getRpcInput(await createRequestPromise);

    expect(createRequests).toHaveLength(1);
    expect(createInput).toMatchObject({
      edition: "Founder's Cask",
      abv: 58.7,
      releaseYear: 2025,
      releaseDate: null,
      vintageYear: 2009,
      singleCask: true,
      caskStrength: true,
      outturn: 240,
      maturation: "Oloroso hogshead",
      caskNumber: "#5678",
    });
    for (const authorityField of [
      "group",
      "groupId",
      "sourceBottle",
      "sourceBottleId",
      "release",
      "releaseId",
    ]) {
      expect(createInput).not.toHaveProperty(authorityField);
    }

    await expect(page).toHaveURL(bottlePath(createdBottleId));
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
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=tasting$`,
      ),
    );
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

    await expect(page).toHaveURL(bottlePath(createdBottleId));
  });

  test("returns to the catalog outcome from catalog intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=catalog`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=catalog$`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Add a bottle" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View bottle" }),
    ).toHaveAttribute("href", bottlePath(createdBottleId));
  });

  test("returns to the created bottle from choose intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=choose`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=choose$`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Bottle added" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Similar" })).toBeHidden();
    await expect(getSelectedBottle(page, createdBottleName)).toBeVisible();
  });

  test("adds the created bottle to library from library intent", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "ordinary-create-library"),
    });

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=library`,
    );
    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await submitCreateBottle(page);
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.bottle).toBe(createdBottleId);
    expect(libraryInput).not.toHaveProperty("target");
    expect(libraryInput).not.toHaveProperty("release");

    await expect(page).toHaveURL(
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=library$`,
      ),
    );
    await expect(
      page.getByRole("heading", { name: "Bottle added" }),
    ).toBeVisible();
    await expect(getSelectedBottle(page, createdBottleName)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "In Library" }),
    ).toBeVisible();
  });

  test("continues after Library save fails for the created Bottle", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(
        testInfo,
        "bottle-create-library-create-failure",
      ),
    });

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=library`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=library$`,
      ),
    );
    await expect(
      page.getByText(
        "The bottle was added to Peated, but it could not be added to your Library.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
  });

  test("adds the created Bottle to the library from a proposal", async ({
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
      page.getByRole("heading", { name: "Add a bottle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Bottle name", exact: true }),
    ).toHaveValue(createdBottleName);

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.bottle).toBe(createdBottleId);
    expect(libraryInput).not.toHaveProperty("target");
    expect(libraryInput).not.toHaveProperty("release");
    await expect(page).toHaveURL(
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=library$`,
      ),
    );
    await expect(page.getByText("First Fill Oloroso").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "In Library" }),
    ).toBeVisible();
  });

  test("uploads a replacement scan to the created Bottle", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "bottle-image-replacement"),
    });

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&brandName=${encodeURIComponent(testBrand.name)}&returnAction=choose&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingScanImageUrl)}`,
    );

    await page
      .locator('input[type="file"][name="image"]')
      .setInputFiles(buildImageFile("replacement-label.png"));
    const imageUpdateRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/bottles/imageUpdate"),
    );
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    await imageUpdateRequestPromise;

    await expect(page).toHaveURL(/\/addBottle\?/);
    const createdUrl = new URL(page.url());
    expect(createdUrl.searchParams.get("bottle")).toBe(String(createdBottleId));
    expect(createdUrl.searchParams.get("intent")).toBe("choose");
    expect(createdUrl.searchParams.get("resultSource")).toBe("created");
    expect(createdUrl.searchParams.get("release")).toBeNull();
    expect(createdUrl.searchParams.get("pendingImageId")).toBeNull();
    expect(createdUrl.searchParams.get("pendingImageUrl")).toBeNull();
  });

  test("keeps image upload failure nonfatal after Bottle creation", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "bottle-image-upload-failure"),
    });

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&brandName=${encodeURIComponent(testBrand.name)}&returnAction=choose`,
    );
    await page
      .locator('input[type="file"][name="image"]')
      .setInputFiles(buildImageFile("replacement-label.png"));
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();

    await expect(page).toHaveURL(
      new RegExp(
        `/addBottle\\?bottle=${createdBottleId}&resultSource=created&intent=choose$`,
      ),
    );
    await expect(
      page.getByText(
        "There was an error uploading your image, but the bottle was saved.",
      ),
    ).toBeVisible();
  });

  test("creates an independent Bottle from Add a similar bottle", async ({
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
      page.getByRole("heading", { name: "Add a similar bottle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Bottle name", exact: true }),
    ).toHaveValue(addAnotherReleaseSourceBottle.group.name);
    await expect(page.getByLabel("Age Statement")).toHaveValue(
      String(addAnotherReleaseSourceBottle.statedAge),
    );
    await expect(page.getByLabel("Edition or batch")).toHaveValue(
      addAnotherReleaseSourceBottle.edition,
    );
    await expect(page.getByLabel("Alcohol")).toHaveValue(
      String(addAnotherReleaseSourceBottle.abv),
    );
    await expect(page.getByLabel("Release year")).toHaveValue(
      String(addAnotherReleaseSourceBottle.releaseYear),
    );
    await expect(page.getByLabel("Bottle Group")).toHaveCount(0);
    await expect(page.getByLabel("Source Bottle")).toHaveCount(0);

    const createRequestPromise = waitForBottleCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const createInput = getRpcInput(await createRequestPromise);

    expect(createRequests).toHaveLength(1);
    expect(createInput).toMatchObject({
      name: addAnotherReleaseSourceBottle.group.name,
      brand: addAnotherReleaseSourceBottle.brand.id,
      statedAge: addAnotherReleaseSourceBottle.statedAge,
      edition: addAnotherReleaseSourceBottle.edition,
      abv: addAnotherReleaseSourceBottle.abv,
      releaseYear: addAnotherReleaseSourceBottle.releaseYear,
    });
    expect(createInput).not.toHaveProperty("group");
    expect(createInput).not.toHaveProperty("groupId");
    expect(createInput).not.toHaveProperty("sourceBottle");
    expect(createInput).not.toHaveProperty("sourceBottleId");
    expect(createInput).not.toHaveProperty("release");
    expect(createInput).not.toHaveProperty("releaseId");
    await expect(page).toHaveURL(bottlePath(createdBottleId));
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
      page.getByRole("heading", { name: "Add a bottle" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();

    await expect(page.getByText("Brand is required.")).toBeVisible();
    const brandField = page.getByRole("combobox", { name: "Brand" });
    await brandField.click();
    await expect(brandField).toHaveAttribute("aria-expanded", "true");
    await expect(page).toHaveURL(/\/bottles\/new\?name=Hogback$/);
    expect(pageErrors).toEqual([]);
  });
});

test.describe("add bottle flow", () => {
  test("adds a resolved bottle to Library and starts a tasting", async ({
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
    await expect(
      page.getByRole("heading", { name: "Add to your Library" }).first(),
    ).toBeVisible();
    await page.getByRole("link", { name: "Log a tasting" }).click();
    await expect(page).toHaveURL(
      `/addBottle?bottle=${existingBottle.id}&intent=tasting`,
    );
  });

  test("routes generic bottle search results into the resolver outcome", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "search-route"),
    });

    await page.goto("/search?intent=choose&q=Lagavulin");
    const searchBottleLabel = `${testBrand.name} ${exactSearchBottle.name}`;
    const bottleLink = page.getByRole("link", {
      name: searchBottleLabel,
    });

    await expect(bottleLink).toHaveAttribute(
      "href",
      `/addBottle?bottle=${exactSearchBottle.id}&intent=choose`,
    );
    await bottleLink.click();

    await expect(page).toHaveURL(/\/addBottle\?/);
    const addBottleUrl = new URL(page.url());
    expect(addBottleUrl.pathname).toBe("/addBottle");
    expect(addBottleUrl.searchParams.get("bottle")).toBe(
      String(exactSearchBottle.id),
    );
    expect(addBottleUrl.searchParams.get("intent")).toBe("choose");
    expect(addBottleUrl.searchParams.get("release")).toBeNull();
    await expect(
      page.getByRole("link", { name: "View bottle" }),
    ).toHaveAttribute("href", `/bottles/${exactSearchBottle.id}`);
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("button", { name: "Log a tasting" }),
    ).toBeVisible();
  });

  test("preserves scanned photos through generic search fallback", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "scan-search-library"),
    });

    await page.goto(
      `/search?intent=choose&q=Lagavulin&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingScanImageUrl)}`,
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
    await expect(
      getSelectedBottleImage(page, existingBottle.fullName),
    ).toHaveAttribute("src", pendingScanImageUrl);
    await expect(
      page.getByRole("link", { name: "Search Bottles" }),
    ).toHaveAttribute(
      "href",
      `/search?intent=choose&pendingImageId=playwright-photo-upload&pendingImageUrl=${encodeURIComponent(pendingScanImageUrl)}`,
    );

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
  });

  test("adds a searched bottle to Library from the generic resolver", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "search-library"),
    });

    await page.goto("/search?intent=choose&q=Lagavulin");
    await page.getByRole("link", { name: existingBottle.fullName }).click();
    await page.getByRole("button", { name: "Add to Library" }).click();

    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(
      getSelectedBottle(page, existingBottle.fullName),
    ).toBeVisible();
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
      page.getByRole("main").getByRole("button", { name: "Log a tasting" }),
    ).toBeEnabled();
  });

  test("shows Library save errors in the direct bottle flow", async ({
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
    await expect(
      getSelectedBottle(page, existingBottle.group.name),
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
      page.getByRole("button", { name: "Log a tasting" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Similar" })).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Not the right bottle?" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Add a new bottle" }),
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
    await expect(
      getSelectedBottleImage(page, existingBottle.fullName),
    ).toHaveAttribute("src", /library\.webp$/);
    await expect(
      getSelectedBottle(page, existingBottle.fullName),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add another to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "View Library" }),
    ).toHaveAttribute("href", `/users/${testUser.username}/library`);

    await page.getByRole("link", { name: "View Library" }).click();
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);
    await expect(
      page.locator(`a[href="/bottles/${existingBottle.id}"]`).first(),
    ).toBeVisible();

    await page.goto("/addBottle");
    await uploadLabel(page);
    await expect(
      getSelectedBottle(page, existingBottle.group.name),
    ).toBeVisible();
    const inLibraryButton = page.getByRole("button", { name: "In Library" });
    await expect(inLibraryButton).toBeVisible();
    await expect(inLibraryButton).toBeDisabled();
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
    await expect(
      getSelectedBottle(page, existingBottle.group.name),
    ).toBeVisible();
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
    await expect(
      getSelectedBottleImage(page, existingBottle.fullName),
    ).toHaveAttribute("src", /library\.webp$/);
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

  test("defers scan bottle creation until Add a bottle is clicked", async ({
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
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Log a tasting" }),
    ).toBeVisible();
    expect(createRequests).toHaveLength(0);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(page).toHaveURL(bottlePath(createdBottleId));
  });

  test("creates a complete bottle from a scan when Add a bottle is clicked", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-complete-bottle"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(page).toHaveURL(bottlePath(createdBottleId));
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

    await expect(
      page.getByRole("heading", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
    await expect(page.getByText("First Fill Oloroso").first()).toBeVisible();

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(page).toHaveURL(bottlePath(createdBottleId));
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
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:unsuitable",
    );
    expect(input).not.toHaveProperty("catalogImageApproval");
    await expect(page).toHaveURL(bottlePath(createdBottleId));
  });

  test("shows catalog image warning without blocking created Bottle resolution", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-warning"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();

    await expect(
      page.getByText(
        "The bottle was added, but the public image was not saved.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(bottlePath(createdBottleId));
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
    expect(libraryInput.bottle).toBe(createdBottleId);
    expect(libraryInput).not.toHaveProperty("target");
    expect(libraryInput).not.toHaveProperty("release");
    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(getSelectedBottle(page, createdBottleName)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bottle added" }),
    ).toBeHidden();
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
    expect(libraryInput).not.toHaveProperty("target");
    expect(libraryInput).not.toHaveProperty("release");
    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
    await expect(page.getByText("First Fill Oloroso")).toBeVisible();
  });

  test("creates a scan proposal as part of Log a tasting", async ({
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
    await page.getByRole("button", { name: "Log a tasting" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(
      page.getByRole("heading", { name: "Log a tasting" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await page
      .getByRole("radio", { name: /^Very good/ })
      .check({ force: true });
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Comments").fill(photoTastingNotes);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save tasting" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expect(
      page.getByRole("heading", { name: "Bottle added" }),
    ).toBeHidden();
  });

  test("routes to an existing bottle when action-time create reuses it", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-existing-view"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(page).toHaveURL(bottlePath(existingBottle.id));
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
    await expect(
      getSelectedBottle(page, existingBottle.fullName),
    ).toBeVisible();
  });

  test("opens Log a tasting for an existing reused create proposal", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-create-existing-tasting"),
    });

    await page.goto("/addBottle?intent=tasting");
    await uploadLabel(page);

    const requestPromise = waitForPhotoIdentificationCreate(page);
    await page.getByRole("button", { name: "Log a tasting" }).click();
    const input = getRpcInput(await requestPromise);

    expect(input.createToken).toBe(
      "playwright-create-token:create_bottle:suitable",
    );
    await expect(
      page.getByRole("heading", { name: "Log a tasting" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
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
            window.__copiedText = value;
          },
        },
      });
    });
    await page
      .getByRole("button", { name: "Copy photo identification payload" })
      .click();
    const copiedPayload = await page.evaluate(() => window.__copiedText);
    expect(copiedPayload).toBeDefined();
    if (!copiedPayload) throw new Error("Clipboard payload is missing");
    const copied = JSON.parse(copiedPayload);
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
      name: "Add a new bottle",
    });
    await expect(createBottleLink).toBeVisible();
    await expectFooterBelowAction(createBottleLink, traceFooter);
    const href = await createBottleLink.getAttribute("href");
    expect(href).not.toBeNull();

    const createUrl = new URL(href!, page.url());
    expect(createUrl.pathname).toBe("/bottles/new");
    expect(createUrl.searchParams.get("returnAction")).toBe("choose");
    expect(createUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    expect(createUrl.searchParams.get("brandName")).toBe(testBrand.name);
    expect(createUrl.searchParams.get("name")).toBe(createdBottleName);
  });

  test("carries uncertain scan details into manual bottle creation", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-needs-review"),
    });

    await page.goto("/addBottle");
    await uploadLabel(page);

    await expect(page.getByText("We couldn't find this bottle")).toBeVisible();
    await expect(
      page.getByText(
        "We found label details, but not enough to choose an existing bottle automatically.",
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Search Bottles" }),
    ).toBeVisible();
    const createBottleLink = page.getByRole("link", {
      name: "Add a new bottle",
    });
    await expect(createBottleLink).toBeVisible();
    const href = await createBottleLink.getAttribute("href");
    expect(href).not.toBeNull();
    const createUrl = new URL(href!, page.url());
    expect(createUrl.pathname).toBe("/bottles/new");
    expect(createUrl.searchParams.get("returnAction")).toBe("choose");
    expect(createUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    expect(createUrl.searchParams.get("brandName")).toBe(testBrand.name);
    expect(createUrl.searchParams.get("name")).toBe(existingBottle.name);
    await expect(
      page.getByRole("button", { name: "Start Over" }),
    ).toBeVisible();
    await createBottleLink.click();
    await expect(
      page.getByRole("textbox", { name: "Bottle name", exact: true }),
    ).toHaveValue(existingBottle.name);
    await expect(
      page.getByRole("button", { name: testBrand.name }).first(),
    ).toBeVisible();
    await expect(page.getByAltText("Current bottle image")).toHaveAttribute(
      "src",
      pendingScanImageUrl,
    );
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

    await expect(
      getSelectedBottle(page, exactMatchedBottle.group.name),
    ).toBeVisible();
    await expect(page.getByText("We couldn't confirm the match")).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    const createBottleLink = page.getByRole("link", {
      name: "Add a new bottle",
    });
    await expect(createBottleLink).toBeVisible();

    const href = await createBottleLink.getAttribute("href");
    expect(href).not.toBeNull();
    const createUrl = new URL(href!, page.url());
    expect(createUrl.pathname).toBe("/bottles/new");
    expect(createUrl.searchParams.get("returnAction")).toBe("choose");
    expect(createUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    expect(createUrl.searchParams.get("brandName")).toBe(testBrand.name);
    expect(createUrl.searchParams.get("name")).toBe(existingBottle.name);
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

    await page.getByRole("link", { name: "Add a new bottle" }).click();
    await expect(
      page.getByRole("heading", { name: "Add a bottle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Bottle name", exact: true }),
    ).toHaveValue(createdBottleName);
    await expect(
      page.getByRole("button", { name: testBrand.name }).first(),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();

    await expect(page).toHaveURL(/\/addBottle\?/);
    const createdUrl = new URL(page.url());
    expect(createdUrl.pathname).toBe("/addBottle");
    expect(createdUrl.searchParams.get("bottle")).toBe(String(createdBottleId));
    expect(createdUrl.searchParams.get("intent")).toBe("choose");
    expect(createdUrl.searchParams.get("resultSource")).toBe("created");
    expect(createdUrl.searchParams.get("pendingImageId")).toBe(
      "playwright-photo-upload",
    );
    expect(createdUrl.searchParams.get("pendingImageUrl")).toBe(
      pendingScanImageUrl,
    );
    await expect(
      page.getByRole("heading", { name: "Bottle added" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Similar" })).toBeHidden();
    await expect(
      getSelectedBottleImage(page, createdBottleName),
    ).toHaveAttribute("src", pendingScanImageUrl);
    await expect(getSelectedBottle(page, createdBottleName)).toBeVisible();

    const libraryRequestPromise = waitForCollectionBottleCreate(page);
    await page.getByRole("button", { name: "Add to Library" }).click();
    const libraryInput = getRpcInput(await libraryRequestPromise);

    expect(libraryInput.pendingImageId).toBe("playwright-photo-upload");
    await expect(
      page.getByRole("heading", { name: "Added to Library" }),
    ).toBeVisible();
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
    await page.getByRole("link", { name: "Add a new bottle" }).click();

    await expect(page.getByAltText("Current bottle image")).toHaveAttribute(
      "src",
      pendingScanImageUrl,
    );
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await expect(page.getByAltText("Current bottle image")).toBeHidden();
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();

    await expect(page).toHaveURL(/\/addBottle\?/);
    const createdUrl = new URL(page.url());
    expect(createdUrl.searchParams.get("pendingImageId")).toBeNull();
    expect(createdUrl.searchParams.get("pendingImageUrl")).toBeNull();
    await expect(getSelectedBottleImage(page, createdBottleName)).toBeHidden();

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

function getSelectedBottle(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Selected bottle" })
    .getByText(name, { exact: false });
}

function getSelectedBottleImage(page: Page, name: string) {
  return page
    .getByRole("region", { name: "Selected bottle" })
    .getByRole("img", { name: `${name} bottle` })
    .locator("img");
}

async function toggleBottleBoolean(page: Page, label: string) {
  await page.getByText(label, { exact: true }).click();
}

async function uploadLabel(page: Page) {
  const uploadButton = page.getByRole("button", {
    name: "Photograph the label",
  });
  await expect(uploadButton).toBeVisible();
  const fileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(buildImageFile("label.png"));
}

function buildImageFile(name: string) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
      "base64",
    ),
  };
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

type RpcJsonValue =
  | string
  | number
  | boolean
  | null
  | RpcJsonValue[]
  | RpcJsonObject;

interface RpcJsonObject {
  [key: string]: RpcJsonValue;
}

function getRpcInput(request: Request): RpcJsonObject {
  const postData = request.postData();
  if (!postData) {
    throw new Error("Expected the RPC request to contain JSON input.");
  }

  const envelope: RpcJsonValue = JSON.parse(postData);
  if (!isRecord(envelope) || !isRecord(envelope.json)) {
    throw new Error("Expected the RPC request to use the JSON envelope.");
  }
  return envelope.json;
}

function isRecord(value: RpcJsonValue): value is RpcJsonObject {
  return z.record(z.string(), z.json()).safeParse(value).success;
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
    page.getByRole("heading", { name: "Add a bottle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Bottle name", exact: true }),
  ).toHaveValue(createdBottleName);

  const brandField = page.getByRole("combobox", { name: "Brand" });
  await brandField.fill(testBrand.name);
  await page.getByRole("option", { name: new RegExp(testBrand.name) }).click();
  await expect(
    page.getByRole("button", { name: `Clear ${testBrand.name}` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add a bottle", exact: true }).click();
}
