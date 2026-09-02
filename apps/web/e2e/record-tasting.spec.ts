import { Buffer } from "node:buffer";
import { z } from "zod";
import { expect, type Page, type Request, test } from "./test";

import {
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

test.describe("log tasting", () => {
  test("chooses the record type once and steps through a review", async ({
    context,
    page,
    snapshot,
  }) => {
    await signIn(context);

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);

    await expect(
      page.getByRole("heading", { name: "What do you want to log?" }),
    ).toBeVisible();
    await snapshot("Tasting form / Choose entry type", {
      ready: page.getByRole("heading", { name: "What do you want to log?" }),
    });
    await page.getByRole("button", { name: /^Write a review/ }).click();

    await expect(
      page.getByRole("heading", { name: "Write a review" }),
    ).toBeVisible();
    await expect(page.getByLabel("Score out of 100")).toHaveValue("80");
    await snapshot("Tasting form / Review / 1 Score", {
      ready: page.getByLabel("Score out of 100"),
    });
    const progress = page.getByRole("navigation", { name: "Form progress" });
    await expect(progress).toContainText("Score");
    await expect(progress).toContainText("Notes");
    await expect(progress).toContainText("Details");

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "What you tasted" }),
    ).toBeVisible();
    await page.getByLabel("Find a tasting note").fill("smoke");
    await page.getByRole("option", { name: /smoke/ }).click();
    await page.getByLabel("Color of the pour").fill("8");
    await page.getByLabel("Comments").fill("Coastal and waxy.");
    await snapshot("Tasting form / Review / 2 Notes", {
      ready: page.getByRole("heading", { name: "What you tasted" }),
    });
    await page.getByRole("button", { name: "Browse" }).click();
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await snapshot("Tasting form / Review / 2 Notes browser", {
      ready: page.getByRole("heading", { name: "Notes" }),
    });
    await page.getByRole("button", { name: "Close note picker" }).click();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(
      page.getByRole("heading", { name: "The sitting" }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Neat" }).check({ force: true });
    await page.getByLabel("Friends").fill("moderator");
    await page.getByRole("option", { name: /moderator-review/ }).click();
    await snapshot("Tasting form / Review / 3 Details", {
      ready: page.getByRole("heading", { name: "The sitting" }),
    });
    await expect(
      page.getByRole("button", { name: "Save review" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Write a review/ }),
    ).toHaveCount(0);

    const saveRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/memberReviews/save"),
    );
    await page.getByRole("button", { name: "Save review" }).click();
    expect(getRpcInput(await saveRequestPromise)).toMatchObject({
      bottle: existingBottle.id,
      score: 80,
      tags: ["smoke"],
      color: 8,
      notes: "Coastal and waxy.",
      servingStyle: "neat",
      friends: [moderatorUser.id],
    });
    await expect(page).toHaveURL(
      new RegExp(`/bottles/${existingBottle.id}(?:-|$)`),
    );
  });

  test("logs a tasting for a fixture bottle", async ({
    context,
    page,
    snapshot,
  }) => {
    await signIn(context);

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${existingBottle.id}&intent=tasting$`),
    );
    await chooseVeryGood(page);
    await snapshot("Tasting form / Tasting / 1 Rating", {
      ready: page.getByRole("heading", { name: "How was it?" }),
    });
    await fillComments(page, tastingNotes);
    await snapshot("Tasting form / Tasting / 2 Notes", {
      ready: page.getByRole("heading", { name: "What you tasted" }),
    });
    await page.getByRole("button", { name: "Browse" }).click();
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await snapshot("Tasting form / Tasting / 2 Notes browser", {
      ready: page.getByRole("heading", { name: "Notes" }),
    });
    await page.getByRole("button", { name: "Close note picker" }).click();
    await uploadTastingImage(page);
    await page.getByRole("radio", { name: "Neat" }).check({ force: true });
    await snapshot("Tasting form / Tasting / 3 Details", {
      ready: page.getByRole("heading", { name: "The sitting" }),
    });
    const createRequestPromise = waitForTastingCreate(page);
    const imageRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/tastings/imageUpdate"),
    );
    await page.getByRole("button", { name: "Save tasting" }).click();
    const createInput = getRpcInput(await createRequestPromise);
    await imageRequestPromise;

    expect(createInput.bottle).toBe(existingBottle.id);
    expect(createInput.servingStyle).toBe("neat");
    expect(createInput).not.toHaveProperty("target");
    expect(createInput).not.toHaveProperty("release");

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
  });

  test("finishes saving when tasting image upload fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-tasting-image-failure-${testInfo.project.name}`,
    });

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
    await chooseVeryGood(page);
    await fillComments(page, tastingNotes);
    await uploadTastingImage(page);

    await page.getByRole("button", { name: "Save tasting" }).click();

    await expect(
      page.getByText(
        "We couldn't upload the picture, but your tasting was saved.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
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
    const heading = page
      .getByRole("heading", { exact: true, name: "Log a tasting" })
      .first();
    await expect(heading).toBeVisible();
    await snapshot("Start a tasting", { ready: heading });

    await uploadLabel(page);

    await expect(
      page.getByRole("heading", { name: "Check the bottle" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Log a tasting" }).click();

    await chooseVeryGood(page);
    await fillComments(page, photoTastingNotes);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save tasting" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
  });

  test("returns to the filled photo tasting form when submit fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-photo-tasting-fail-${testInfo.project.name}`,
    });

    await page.goto("/addTasting");
    await expect(page).toHaveURL(/\/addBottle\?intent=tasting$/);

    await uploadLabel(page);

    await expect(
      page.getByRole("heading", { name: "Check the bottle" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log a tasting" }).click();

    await chooseVeryGood(page);
    await fillComments(page, failingTastingNotes);
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Save tasting" }).click();

    await expect(
      page.getByText(
        "We couldn't save that tasting. Your notes are still here — try again.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByLabel("Comments")).toHaveValue(failingTastingNotes);
    await expect(page).toHaveURL(/\/addBottle\?intent=tasting$/);
  });
});

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

async function uploadTastingImage(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "tasting.png",
    mimeType: "image/png",
    buffer: testImage,
  });
}

async function fillComments(page: Page, value: string) {
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Comments").fill(value);
}

async function chooseVeryGood(page: Page) {
  await page.getByRole("button", { name: /^Log a tasting/ }).click();
  await page.getByRole("radio", { name: /^Very good/ }).check({ force: true });
}

function waitForTastingCreate(page: Page) {
  return page.waitForRequest((request) =>
    request.url().includes("/rpc/tastings/create"),
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
