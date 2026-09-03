import { Buffer } from "node:buffer";
import { z } from "zod";
import { tastingPathPattern } from "./assertions";
import { expect, type Page, type Request, test } from "./test";

import {
  createdMemberReview,
  createdTastingId,
  existingBottle,
  failingTastingNotes,
  moderatorUser,
  photoTastingNotes,
  tastingNotes,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const testImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test.describe("tastings and reviews", () => {
  test("chooses a review and saves notes, pour details, and an explicit score", async ({
    context,
    page,
    snapshot,
  }) => {
    await signIn(context);
    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
    await snapshot("Tasting form / Choose tasting or review", {
      ready: page.getByRole("heading", { name: "What would you like to add?" }),
    });
    await page.getByRole("button", { name: /^Write a review/ }).click();
    await page.getByLabel("What do you think?").fill("Coastal and waxy.");
    await page.getByLabel("Find a tasting note").fill("smoke");
    await page.getByRole("option", { name: /smoke/ }).click();
    await expect(page.getByRole("button", { name: "Save review" })).toHaveCount(
      0,
    );
    await snapshot("Tasting form / Review / 1 Notes", {
      ready: page.getByLabel("What do you think?"),
    });
    await page.getByRole("button", { name: "Browse" }).click();
    await snapshot("Tasting form / Review / Flavor picker", {
      ready: page.getByRole("button", { name: "Close note picker" }),
    });
    await page.getByRole("button", { name: "Close note picker" }).click();

    await page.getByRole("button", { name: "Continue" }).click();
    await chooseRadio(page, "Serving", "Neat");
    await page.getByLabel("Color of the pour").fill("8");
    await page.getByRole("button", { name: "Add friends" }).click();
    await page
      .getByRole("combobox", { name: "Friends", exact: true })
      .fill("moderator");
    await page.getByRole("option", { name: /moderator-review/ }).click();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "1 friend", exact: true }),
    ).toBeVisible();
    await snapshot("Tasting form / Review / 2 The pour", {
      ready: page.getByLabel("Color of the pour"),
    });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Score out of 100")).toHaveValue("");
    await expect(
      page.getByRole("button", { name: "Save review" }),
    ).toBeDisabled();
    await page.getByLabel("Score out of 100").fill("80");
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("What do you think?")).toHaveValue(
      "Coastal and waxy.",
    );
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("button", { name: "1 friend", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Score out of 100")).toHaveValue("80");
    await snapshot("Tasting form / Review / 3 Score", {
      ready: page.getByLabel("Score out of 100"),
    });

    const request = page.waitForRequest((request) =>
      request.url().includes("/rpc/memberReviews/save"),
    );
    await page.getByRole("button", { name: "Save review" }).click();
    expect(getRpcInput(await request)).toMatchObject({
      bottle: existingBottle.id,
      score: 80,
      tags: ["smoke"],
      color: 8,
      notes: "Coastal and waxy.",
      servingStyle: "neat",
      friends: [moderatorUser.id],
    });
    await expect(page).toHaveURL(
      new RegExp(`/reviews/${createdMemberReview.id}$`),
    );
    const heading = page.getByRole("heading", {
      name: existingBottle.fullName,
    });
    await expect(heading).toBeVisible();
    await expect(page.getByText(createdMemberReview.notes)).toBeVisible();
    await snapshot("Review detail / Saved review", { ready: heading });
  });

  test("logs a tasting and follows canonical detail and edit links", async ({
    context,
    page,
    request,
    snapshot,
  }) => {
    await signIn(context);
    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${existingBottle.id}&intent=tasting$`),
    );
    await startTasting(page, tastingNotes);
    await snapshot("Tasting form / Tasting / 1 Notes", {
      ready: page.getByLabel("What stood out?"),
    });
    await page.getByRole("button", { name: "Continue" }).click();
    await uploadTastingImage(page);
    await chooseRadio(page, "Serving", "Neat");
    await snapshot("Tasting form / Tasting / 2 The pour", {
      ready: page.getByRole("button", { name: "Photo attached" }),
    });
    await finishTasting(page);
    await snapshot("Tasting form / Tasting / 3 Rating", {
      ready: page.getByRole("button", { name: "Save tasting" }),
    });
    const createRequest = page.waitForRequest((request) =>
      request.url().includes("/rpc/tastings/create"),
    );
    const imageRequest = page.waitForRequest((request) =>
      request.url().includes("/rpc/tastings/imageUpdate"),
    );
    await page.getByRole("button", { name: "Save tasting" }).click();
    const createInput = getRpcInput(await createRequest);
    await imageRequest;

    expect(createInput).toMatchObject({
      bottle: existingBottle.id,
      notes: tastingNotes,
      ratingBand: "very_good",
      servingStyle: "neat",
    });
    expect(createInput).not.toHaveProperty("target");
    expect(createInput).not.toHaveProperty("release");

    await expect(page).toHaveURL(tastingPathPattern(createdTastingId));

    const canonical = `/tastings/${createdTastingId}-lagavulin-16-year-old`;
    for (const suffix of ["", "-old-name", "-old.name"]) {
      const response = await request.get(
        `/tastings/${createdTastingId}${suffix}?source=legacy&tag=one&tag=two`,
        { headers: { "user-agent": "Twitterbot" }, maxRedirects: 0 },
      );
      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(
        `${canonical}?source=legacy&tag=one&tag=two`,
      );
    }

    await page.goto(`/tastings/${createdTastingId}#comments`);
    await expect(page).toHaveURL(`${canonical}#comments`);
    await expect(
      page.getByRole("heading", { name: "Comments", exact: true }),
    ).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new URL(canonical, page.url()).href,
    );
    const data = await page
      .locator('script[type="application/ld+json"]')
      .textContent();
    expect(JSON.parse(data!).url).toBe(new URL(canonical, page.url()).href);

    await page.goto(`/tastings/${createdTastingId}/edit?source=legacy`);
    await expect(page).toHaveURL(`${canonical}/edit?source=legacy`);
    await expect(
      page.getByRole("heading", { name: "Edit Tasting", exact: true }),
    ).toBeVisible();
  });

  test("finishes saving when tasting image upload fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-tasting-image-failure-${testInfo.project.name}`,
    });
    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
    await startTasting(page, tastingNotes);
    await page.getByRole("button", { name: "Continue" }).click();
    await uploadTastingImage(page);
    await finishTasting(page);
    await page.getByRole("button", { name: "Save tasting" }).click();
    await expect(
      page.getByText(
        "We couldn't upload the picture, but your tasting was saved.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(tastingPathPattern(createdTastingId));
  });

  test("logs a tasting from a matched bottle photo", async ({
    context,
    page,
    snapshot,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-photo-tasting-${testInfo.project.name}`,
    });
    await page.goto("/addTasting");
    await expect(page).toHaveURL(/\/addBottle\?intent=tasting$/);
    await snapshot("Start a tasting", {
      ready: page
        .getByRole("heading", { exact: true, name: "Rate this bottle" })
        .first(),
    });
    await uploadLabel(page);
    await page.getByRole("button", { name: "Rate this bottle" }).click();
    await startTasting(page, photoTastingNotes);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("button", { name: "Photo attached" }),
    ).toBeVisible();
    await finishTasting(page);
    await page.getByRole("button", { name: "Save tasting" }).click();

    await expect(page).toHaveURL(tastingPathPattern(createdTastingId));
  });

  test("preserves the photo tasting draft when saving fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-photo-tasting-fail-${testInfo.project.name}`,
    });
    await page.goto("/addTasting");
    await uploadLabel(page);
    await page.getByRole("button", { name: "Rate this bottle" }).click();
    await startTasting(page, failingTastingNotes);
    await page.getByRole("button", { name: "Continue" }).click();
    await finishTasting(page);
    await page.getByRole("button", { name: "Save tasting" }).click();
    await expect(
      page.getByText(
        "We couldn't save that tasting. Your notes are still here — try again.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Photo attached" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("What stood out?")).toHaveValue(
      failingTastingNotes,
    );
  });
});

async function startTasting(page: Page, notes: string) {
  await page.getByRole("button", { name: /^Log a tasting/ }).click();
  await page.getByLabel("What stood out?").fill(notes);
}

async function finishTasting(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await chooseRadio(page, "How was it", /^Very good/);
}

async function chooseRadio(
  page: Page,
  groupName: string,
  optionName: string | RegExp,
) {
  const radio = page
    .getByRole("radiogroup", { name: groupName })
    .getByRole("radio", { name: optionName });
  await radio.locator("..").click();
  await expect(radio).toBeChecked();
}

async function uploadTastingImage(page: Page) {
  await page.getByRole("button", { name: "Add photo", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "tasting.png",
    mimeType: "image/png",
    buffer: testImage,
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Photo", exact: true }),
  ).toBeHidden();
}

async function uploadLabel(page: Page) {
  await expect(
    page.getByRole("button", { name: "Photograph the label" }),
  ).toBeVisible();

  for (let attempt = 0; attempt < 2; attempt++) {
    const requestPromise = page
      .waitForRequest(
        (request) =>
          request.url().includes("/rpc/tastings/photoIdentification"),
        { timeout: 5000 },
      )
      .catch(() => null);

    await page.locator('input[type="file"]').setInputFiles({
      name: `label-${attempt}.png`,
      mimeType: "image/png",
      buffer: testImage,
    });

    if (await requestPromise) return;
  }

  throw new Error("Photo identification request was not sent.");
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
