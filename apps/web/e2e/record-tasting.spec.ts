import { Buffer } from "node:buffer";
import { tastingPathPattern } from "./assertions";
import { expect, type Page, test } from "./test";

import {
  createdMemberReview,
  createdTastingId,
  existingBottle,
  failingTastingNotes,
  tastingNotes,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const testImage = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test.describe("tastings and reviews", () => {
  test("submits a review with an explicit score", async ({ context, page }) => {
    await signIn(context);
    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
    await page.getByRole("button", { name: /^Write a review/ }).click();
    await page.getByLabel("What do you think?").fill("Coastal and waxy.");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByLabel("Score out of 100").fill("80");
    const reviewPage = page.waitForRequest(
      (request) =>
        new URL(request.url()).pathname ===
        `/reviews/${createdMemberReview.id}`,
    );
    await page.getByRole("button", { name: "Save review" }).click();
    await reviewPage;
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

  test("preserves tasting notes when saving fails", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-tasting-save-fail-${testInfo.project.name}`,
    });
    await page.goto(`/bottles/${existingBottle.id}/addTasting`);
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
