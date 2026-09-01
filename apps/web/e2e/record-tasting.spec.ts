import { Buffer } from "node:buffer";
import { z } from "zod";
import { expect, type Page, type Request, test } from "./test";

import {
  createdTastingId,
  existingBottle,
  failingTastingNotes,
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
  test("logs a tasting for a fixture bottle", async ({ context, page }) => {
    await signIn(context);

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${existingBottle.id}&intent=tasting$`),
    );
    await chooseVeryGood(page);
    await fillComments(page, tastingNotes);
    await uploadTastingImage(page);
    const createRequestPromise = waitForTastingCreate(page);
    const imageRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/tastings/imageUpdate"),
    );
    await page.getByRole("button", { name: "Save tasting" }).click();
    const createInput = getRpcInput(await createRequestPromise);
    await imageRequestPromise;

    expect(createInput.bottle).toBe(existingBottle.id);
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
    await expect(
      page.getByRole("heading", { exact: true, name: "Log a tasting" }).first(),
    ).toBeVisible();
    await snapshot("start");

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
