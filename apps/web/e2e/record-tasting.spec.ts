import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdTastingId,
  existingBottle,
  tastingNotes,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("record tasting", () => {
  test("records a tasting for a fixture bottle", async ({ context, page }) => {
    await signIn(context);

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);

    await expect(
      page.getByRole("heading", { name: "Record Tasting" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();

    await page.getByRole("button", { name: "Savor" }).click();
    await page.getByLabel("Comments").fill(tastingNotes);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("records a tasting from a matched bottle photo", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto("/addTasting");

    await expect(
      page.getByRole("heading", { name: "Record Tasting" }),
    ).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: "label.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });

    await expect(page.getByText("Match found")).toBeVisible();
    await expect(page.getByText("Lagavulin")).toBeVisible();
    await expect(page.getByText("16 years")).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await page.getByRole("button", { name: "Savor" }).click();
    await page.getByLabel("Comments").fill(tastingNotes);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(new RegExp(`/tastings/${createdTastingId}$`));
    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
