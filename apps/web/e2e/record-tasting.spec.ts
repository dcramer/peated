import { expect, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdTastingId,
  existingBottle,
  failingTastingNotes,
  photoTastingNotes,
  tastingNotes,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("log tasting", () => {
  test("logs a tasting for a fixture bottle", async ({ context, page }) => {
    await signIn(context);

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);

    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();

    await page.getByRole("button", { name: "Savor" }).click();
    await page.getByLabel("Comments").fill(tastingNotes);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expectNoHorizontalOverflow(page);
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

    await expect(page.getByText("Match found")).toBeVisible();
    await expect(page.getByText("Lagavulin")).toBeVisible();
    await expect(page.getByText("16 years")).toBeVisible();

    await page.getByRole("button", { name: "Log Tasting" }).click();

    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await page.getByRole("button", { name: "Savor" }).click();
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

    await uploadLabel(page);

    await expect(page.getByText("Match found")).toBeVisible();
    await page.getByRole("button", { name: "Log Tasting" }).click();

    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await page.getByRole("button", { name: "Savor" }).click();
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

async function uploadLabel(page: Page) {
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
