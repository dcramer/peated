import { expect, type Page, test } from "@playwright/test";
import { Buffer } from "node:buffer";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdTastingId,
  existingBottle,
  existingReleaseId,
  failingTastingNotes,
  photoTastingNotes,
  tastingNotes,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("log tasting", () => {
  test("preserves query params when redirecting legacy bottle tasting links", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/${existingBottle.id}/addTasting?bottling=${existingReleaseId}&flight=flight-qa`,
    );

    await expect(page).toHaveURL(/\/addBottle\?/);
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/addBottle");
    expect(currentUrl.searchParams.get("bottle")).toBe(
      String(existingBottle.id),
    );
    expect(currentUrl.searchParams.get("bottling")).toBe(
      String(existingReleaseId),
    );
    expect(currentUrl.searchParams.get("flight")).toBe("flight-qa");
    expect(currentUrl.searchParams.get("intent")).toBe("tasting");
  });

  test("logs a tasting for a fixture bottle", async ({ context, page }) => {
    await signIn(context);

    await page.goto(`/bottles/${existingBottle.id}/addTasting`);

    await expect(page).toHaveURL(
      new RegExp(`/addBottle\\?bottle=${existingBottle.id}&intent=tasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(
      page
        .locator("main section")
        .filter({ hasText: "Bottle found" })
        .getByRole("button")
        .first(),
    ).toHaveText("Log Tasting");
    await page.getByRole("button", { name: "Log Tasting" }).click();

    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
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

    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
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
        .filter({ hasText: existingBottle.fullName })
        .getByRole("button", { name: "Log Tasting" }),
    ).toBeVisible();

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
    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();

    await uploadLabel(page);

    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
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
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });

    if (await requestPromise) return;
  }

  throw new Error("Photo identification request was not sent.");
}
