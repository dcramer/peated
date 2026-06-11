import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdBottleId,
  createdBottleName,
  testBrand,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("add bottle", () => {
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

  test("shows validation when saving without a brand", async ({
    context,
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await signIn(context);

    await page.goto(`/addBottle?name=${encodeURIComponent("Hogback")}`);

    await expect(
      page.getByRole("heading", { name: "Add Bottle" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Brand is required.")).toBeVisible();
    await page.getByText("e.g. Laphroaig").click();
    await expect(page.getByPlaceholder("Search")).toBeVisible();
    await expect(page).toHaveURL(/\/addBottle\?name=Hogback$/);
    expect(pageErrors).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });
});
