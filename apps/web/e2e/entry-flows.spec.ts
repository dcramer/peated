import { expect, type Page, test } from "@playwright/test";

import {
  createdBottleId,
  createdBottleName,
  createdTastingId,
  existingBottle,
  tastingNotes,
  testBrand,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("entry flows", () => {
  test("adds a bottle with an existing fixture brand", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(`/addBottle?name=${encodeURIComponent(createdBottleName)}`);

    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);

    await page.getByText("e.g. Laphroaig").click();
    await page.getByPlaceholder("Search").fill(testBrand.name);
    await page.getByRole("button", { name: testBrand.name }).click();
    await expect(page.getByPlaceholder("Search")).toBeHidden();

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/bottles/${createdBottleId}/addTasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Record Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

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
});

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      { message: "page should not create horizontal overflow" },
    )
    .toBeLessThanOrEqual(1);
}
