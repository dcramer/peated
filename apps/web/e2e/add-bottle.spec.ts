import { expect, type Page, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdBottleId,
  createdBottleName,
  testBrand,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("create bottle", () => {
  test("redirects legacy add bottle create links", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(`/addBottle?name=${encodeURIComponent(createdBottleName)}`);

    await expect(page).toHaveURL(/\/bottles\/new\?/);
    const currentUrl = new URL(page.url());
    expect(currentUrl.pathname).toBe("/bottles/new");
    expect(currentUrl.searchParams.get("name")).toBe(createdBottleName);
    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
  });

  test("creates a bottle with an existing fixture brand", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}`,
    );

    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);

    await page.getByText("e.g. Laphroaig").click();
    await page.getByPlaceholder("Search").fill(testBrand.name);
    await page.getByRole("button", { name: testBrand.name }).click();
    await expect(page.getByPlaceholder("Search")).toBeHidden();

    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/bottles/${createdBottleId}/addTasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("continues to tasting from explicit tasting intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=tasting`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(`/bottles/${createdBottleId}/addTasting$`),
    );
    await expect(
      page.getByRole("heading", { name: "Log Tasting" }),
    ).toBeVisible();
  });

  test("continues to the created bottle from view intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=view`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(new RegExp(`/bottles/${createdBottleId}$`));
    await expect(
      page.getByText(`${testBrand.name} ${createdBottleName}`),
    ).toBeVisible();
  });

  test("starts another add bottle flow from add bottle intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=addBottle`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(/\/bottles\/new$/);
    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await expect(page.getByLabel("Bottle")).toHaveValue("");
  });

  test("adds the created bottle to library from library intent", async ({
    context,
    page,
  }) => {
    await signIn(context);

    await page.goto(
      `/bottles/new?name=${encodeURIComponent(createdBottleName)}&returnAction=library`,
    );
    await submitCreateBottle(page);

    await expect(page).toHaveURL(
      new RegExp(`/users/${testUser.username}/library$`),
    );
    await expect(
      page.getByRole("link", {
        name: `${testBrand.name} ${createdBottleName}`,
      }),
    ).toBeVisible();
  });

  test("shows validation when saving without a brand", async ({
    context,
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await signIn(context);

    await page.goto(`/bottles/new?name=${encodeURIComponent("Hogback")}`);

    await expect(
      page.getByRole("heading", { name: "Create Bottle" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Create Bottle" }).click();

    await expect(page.getByText("Brand is required.")).toBeVisible();
    await page.getByText("e.g. Laphroaig").click();
    await expect(page.getByPlaceholder("Search")).toBeVisible();
    await expect(page).toHaveURL(/\/bottles\/new\?name=Hogback$/);
    expect(pageErrors).toEqual([]);
    await expectNoHorizontalOverflow(page);
  });
});

async function submitCreateBottle(page: Page) {
  await expect(
    page.getByRole("heading", { name: "Create Bottle" }),
  ).toBeVisible();
  await expect(page.getByLabel("Bottle")).toHaveValue(createdBottleName);

  await page.getByText("e.g. Laphroaig").click();
  await page.getByPlaceholder("Search").fill(testBrand.name);
  await page.getByRole("button", { name: testBrand.name }).click();
  await expect(page.getByPlaceholder("Search")).toBeHidden();

  await page.getByRole("button", { name: "Create Bottle" }).click();
}
