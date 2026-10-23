import { Buffer } from "node:buffer";

import { bottlePathPattern } from "./assertions";
import {
  createdBottleName,
  exactSearchBottle,
  existingBottle,
  testAccessToken,
  testBrand,
  testOwnedEntity,
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

  test("reports a wrong photo match and saves the Bottle chosen next", async ({
    context,
    page,
    snapshot,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "scan-wrong-match"),
    });
    await page.goto("/addBottle");
    await uploadLabel(page);
    await expect(selectedBottle(page, existingBottle.group.name)).toBeVisible();
    const wrongMatchButton = page.getByRole("button", {
      name: "Not my bottle",
    });
    await snapshot("Add bottle / Photo match / Light", {
      ready: wrongMatchButton,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await snapshot("Add bottle / Photo match / Dark", {
      ready: wrongMatchButton,
    });
    await page.emulateMedia({ colorScheme: "light" });

    const reportRequest = page.waitForRequest((request) =>
      request.url().includes("/rpc/wrongPhotoMatches/create"),
    );
    await wrongMatchButton.click();
    await reportRequest;

    // The lookup had another candidate, so the screen leads with it.
    const findYourBottle = page.getByRole("heading", {
      name: "Is it one of these?",
    });
    await expect(findYourBottle).toBeVisible();
    // Move off the button the click left under the pointer so the snapshot
    // shows its resting state.
    await page.mouse.move(0, 0);
    await expect(
      page.getByText("Thanks, we've noted the wrong match."),
    ).toBeVisible();
    await snapshot("Add bottle / Wrong photo match / Light", {
      ready: findYourBottle,
    });
    await page.emulateMedia({ colorScheme: "dark" });
    await snapshot("Add bottle / Wrong photo match / Dark", {
      ready: findYourBottle,
    });
    await page.emulateMedia({ colorScheme: "light" });
    await expect(
      page.getByRole("link", { name: "Search bottles" }),
    ).toHaveAttribute("href", /wrongPhotoMatch=9001/);

    // Picking the lookup's other candidate saves it on the report.
    const pickRequest = page.waitForRequest((request) =>
      request.url().includes("/rpc/wrongPhotoMatches/update"),
    );
    await page
      .getByRole("button", {
        name: `Use this bottle: ${exactSearchBottle.fullName}`,
      })
      .click();
    expect((await pickRequest).postData()).toContain(
      `"correctBottle":${exactSearchBottle.id}`,
    );
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
    // Changing the Bottle again keeps the report, so the last pick is saved.
    await expect(
      page.getByRole("link", { name: "Change bottle" }),
    ).toHaveAttribute("href", /wrongPhotoMatch=9001/);

    const updateRequest = page.waitForRequest((request) =>
      request.url().includes("/rpc/wrongPhotoMatches/update"),
    );
    await page.goto(
      `/search?intent=choose&q=Lagavulin&pendingImageId=playwright-photo-upload&wrongPhotoMatch=9001`,
    );
    await page
      .getByRole("link", {
        name: `${testBrand.name} ${existingBottle.name}`,
      })
      .click();
    // A search result opens the resolver with the photo and report attached.
    await expect(page).toHaveURL(
      `/addBottle?bottle=${existingBottle.id}&pendingImageId=playwright-photo-upload&wrongPhotoMatch=9001&intent=choose`,
    );
    expect((await updateRequest).postData()).toContain(
      `"correctBottle":${existingBottle.id}`,
    );
    await expect(
      page.getByRole("link", { name: "View bottle" }),
    ).toHaveAttribute("href", bottlePathPattern(existingBottle.id));
  });

  test("keeps the label and likely matches when the photo lookup fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-stream-outage"),
    });
    await page.goto("/addBottle");
    await uploadLabel(page);
    await expect(
      page.getByText(
        "We can't check photos right now. Search by name or try again later.",
      ),
    ).toBeVisible();

    // A new Bottle starts from the streamed label facts and keeps the photo.
    const createHref = await page
      .getByRole("link", { name: "Add a new bottle" })
      .getAttribute("href");
    const createParams = new URL(createHref ?? "", "http://localhost")
      .searchParams;
    expect(createParams.get("name")).toBe(createdBottleName);
    expect(createParams.get("brandName")).toBe(testBrand.name);
    expect(createParams.get("pendingImageId")).toBe("playwright-photo-upload");

    // The streamed likely match continues with that Bottle.
    await page
      .getByRole("button", {
        name: `Use this bottle: ${exactSearchBottle.fullName}`,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Add to Library" }),
    ).toBeVisible();
  });

  test("can replace a photo while identification is pending", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-cancel"),
    });
    let releaseRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route("**/rpc/tastings/photoIdentification", () => pending);
    await page.goto("/addBottle");
    await uploadLabel(page);
    await page.getByRole("button", { name: "Use a different photo" }).click();
    releaseRequest();
    await page.unroute("**/rpc/tastings/photoIdentification");
    await uploadLabel(page);
    await expect(selectedBottle(page, existingBottle.group.name)).toBeVisible();
  });

  test("stops waiting for a stalled photo request", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "photo-timeout"),
    });
    let releaseRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route("**/rpc/tastings/photoIdentification", () => pending);
    await page.goto("/addBottle");
    await page.clock.install();
    await uploadLabel(page);
    await expect(
      page.getByRole("status").filter({ hasText: "Reading the label…" }),
    ).toBeVisible();
    await page.clock.fastForward(600_001);
    await expect(
      page.getByText(
        "This is taking too long. Search by name or try again later.",
      ),
    ).toBeVisible();
    releaseRequest();
    await page
      .getByRole("link", { name: "Search bottles", exact: true })
      .click();
    await expect(page).toHaveURL(/\/search/);
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

  test("offers an Entity with a different kind as the Brand", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "cross-kind-brand"),
    });
    await page.goto("/bottles/new?returnAction=view");

    await page.getByPlaceholder("Laphroaig").fill(testOwnedEntity.name);
    await page
      .getByRole("option", { name: new RegExp(testOwnedEntity.name) })
      .click();

    await expect(
      page.getByText(testOwnedEntity.name, { exact: true }),
    ).toBeVisible();
  });

  test("splits a leading Brand from a prefilled bottle name", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "leading-brand"),
    });
    await page.goto("/bottles/new?name=Lagavulin%2016&returnAction=view");

    await expect(
      page.getByRole("button", { name: testBrand.name }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "Bottle name" }),
    ).toHaveValue("16");
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
    // Titles leave the edition out, so find the exact Bottle by the button
    // label, which names its full stored name.
    const match = page
      .getByRole("region", { name: "Bottles that may match" })
      .getByRole("button", {
        name: `Use this bottle: ${exactSearchBottle.fullName}`,
        exact: true,
      });
    await expect(match).toBeVisible();
    await match.click();

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
    let releaseCandidates!: () => void;
    const candidatesReady = new Promise<void>((resolve) => {
      releaseCandidates = resolve;
    });
    await page.route("**/rpc/bottles/createCandidates*", async (route) => {
      await candidatesReady;
      await route.continue();
    });
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=view`,
    );

    // Save stays usable during the duplicate check and opens the review once
    // the check returns.
    await reachFinalCreateStep(page);
    await page
      .getByRole("button", { name: "Add a bottle", exact: true })
      .click();
    releaseCandidates();
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
    await expect(
      candidates.getByRole("button", {
        name: `Use this bottle: ${exactSearchBottle.fullName}`,
        exact: true,
      }),
    ).toHaveCount(0);
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

  test("keeps the match notice steady while checking an edited name", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "steady-candidates"),
    });
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=view`,
    );
    await expectMatchNoticeToStaySteady(
      page,
      testInfo,
      "match-notice-updating.png",
    );
  });

  test("keeps the match notice steady on mobile while checking @mobile", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "steady-candidates-mobile"),
    });
    await page.goto(
      `/bottles/new?name=21-year-old&brand=${testBrand.id}&returnAction=view`,
    );
    await expectMatchNoticeToStaySteady(
      page,
      testInfo,
      "match-notice-updating-mobile.png",
    );
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
    const nas = page.getByText("No age statement (NAS)", { exact: true });
    await expect(nas).toBeVisible();
    await age.fill("12");
    await expect(nas).toHaveCount(0);

    await age.fill("");
    await expect(nas).toBeVisible();
    await nas.click();
    await expect(age).toHaveCount(0);

    await nas.click();
    await expect(age).toBeVisible();
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

async function expectMatchNoticeToStaySteady(
  page: Page,
  testInfo: TestInfo,
  screenshotName: string,
) {
  const notice = page.getByText("1 bottle may match this one.");
  const review = page.getByRole("button", { name: "Review" });
  const summary = review.locator("..");
  const name = page.getByRole("textbox", { name: "Bottle name" });
  await expect(notice).toBeVisible();
  const initialSummaryBox = await summary.boundingBox();
  const initialNameBox = await name.boundingBox();
  expect(initialSummaryBox).not.toBeNull();
  expect(initialNameBox).not.toBeNull();

  let releaseCandidates!: () => void;
  let markCandidatesHeld!: () => void;
  let markCandidatesContinued!: () => void;
  const candidatesHeld = new Promise<void>((resolve) => {
    markCandidatesHeld = resolve;
  });
  const candidatesReady = new Promise<void>((resolve) => {
    releaseCandidates = resolve;
  });
  const candidatesContinued = new Promise<void>((resolve) => {
    markCandidatesContinued = resolve;
  });
  const candidateRequests = "**/rpc/bottles/createCandidates*";
  await page.route(candidateRequests, async (route) => {
    markCandidatesHeld();
    await candidatesReady;
    await route.continue();
    markCandidatesContinued();
  });

  try {
    await name.fill("21-year-old Kogei Collection");
    await candidatesHeld;

    await expect(name).toBeFocused();
    await expect(notice).toBeVisible();
    await expect(review).toBeDisabled();
    await expect(summary).toHaveAttribute("aria-busy", "true");
    expect(await summary.boundingBox()).toEqual(initialSummaryBox);
    expect(await name.boundingBox()).toEqual(initialNameBox);
    await page.screenshot({
      animations: "disabled",
      caret: "hide",
      fullPage: false,
      path: testInfo.outputPath(screenshotName),
    });
  } finally {
    releaseCandidates();
    await candidatesContinued;
    await page.unroute(candidateRequests);
  }

  await expect(page.getByText("3 bottles may match this one.")).toBeVisible();
  await expect(review).toBeEnabled();
  await expect(name).toBeFocused();
  expect(await summary.boundingBox()).toEqual(initialSummaryBox);
  expect(await name.boundingBox()).toEqual(initialNameBox);
}
