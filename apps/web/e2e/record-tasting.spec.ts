import { expect, type Page, type Request, test } from "@playwright/test";
import { Buffer } from "node:buffer";
import { z } from "zod";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdTastingId,
  destinationBottleGroup,
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

    await page.goto(`/bottles/${existingBottle.id}`);
    const logTastingLink = page.getByRole("link", { name: "Log Tasting" });
    await expect(logTastingLink).toHaveAttribute(
      "href",
      `/bottles/${existingBottle.id}/addTasting`,
    );
    await logTastingLink.click();

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${existingBottle.id}&intent=tasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Bottle found" }),
    ).toBeHidden();
    await expect(page.getByTitle(existingBottle.fullName)).toBeVisible();
    await page.getByRole("button", { name: /^Very good/ }).click();
    await page.getByLabel("Comments").fill(tastingNotes);
    await uploadTastingImage(page);
    const createRequestPromise = waitForTastingCreate(page);
    const imageRequestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/tastings/imageUpdate"),
    );
    await page.getByRole("button", { name: "Save" }).click();
    const createInput = getRpcInput(await createRequestPromise);
    await imageRequestPromise;

    expect(createInput.bottle).toBe(existingBottle.id);
    expect(createInput).not.toHaveProperty("target");
    expect(createInput).not.toHaveProperty("release");

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expectNoHorizontalOverflow(page);
  });

  test("finishes saving when tasting image upload fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-tasting-image-failure-${testInfo.project.name}`,
    });

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Very good/ }).click();
    await page.getByLabel("Comments").fill(tastingNotes);
    await uploadTastingImage(page);

    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByText(
        "There was an error uploading your image, but the tasting was saved.",
      ),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
  });

  test("logs a tasting from a matched bottle photo", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-photo-tasting-${testInfo.project.name}`,
    });

    await page.goto("/addTasting");

    await expect(page).toHaveURL(/\/addBottle\?intent=tasting$/);
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();

    await uploadLabel(page);

    await expect(
      getBottleIdentityLink(page, existingBottle.group.name),
    ).toBeVisible();
    await expect(
      page.getByText("Matched to existing bottle in Peated"),
    ).toBeVisible();
    await expect(
      page.getByText("Lagavulin", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show all details" }).click();
    await expect(page.getByText("16 years")).toBeVisible();
    await expect(
      page
        .locator("main section")
        .filter({ hasText: "Matched to existing bottle in Peated" })
        .getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Log Tasting" }).click();

    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 4,
        name: existingBottle.fullName,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Very good/ }).click();
    await page.getByLabel("Comments").fill(photoTastingNotes);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expectNoHorizontalOverflow(page);
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
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();

    await uploadLabel(page);

    await expect(
      getBottleIdentityLink(page, existingBottle.group.name),
    ).toBeVisible();
    await page.getByRole("button", { name: "Log Tasting" }).click();

    await expect(
      page.getByRole("heading", {
        level: 4,
        name: existingBottle.fullName,
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^Very good/ }).click();
    await page.getByLabel("Comments").fill(failingTastingNotes);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("heading", {
        name: "There was an error with your submission",
      }),
    ).toBeVisible();
    await expect(page.getByText("Internal error")).toBeVisible();
    await expect(page.getByLabel("Comments")).toHaveValue(failingTastingNotes);
    await expect(page.getByAltText("uploaded image")).toBeVisible();
    await expect(page).toHaveURL(/\/addBottle\?intent=tasting$/);
    await expectNoHorizontalOverflow(page);
  });
});

function getBottleIdentityLink(page: Page, name: string) {
  return page.getByRole("main").getByRole("link", { name, exact: true });
}

async function uploadLabel(page: Page) {
  await expect(
    page.getByRole("button", { name: /Take or upload a photo/ }),
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
  await page.locator('input[type="file"]').setInputFiles({
    name: "tasting.png",
    mimeType: "image/png",
    buffer: testImage,
  });
  await expect(page.getByRole("heading", { name: "Crop Image" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(page.getByAltText("uploaded image")).toBeVisible();
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
