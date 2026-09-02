import { expect, test } from "./test";

import {
  bottleGroupRepresentative,
  existingBottle,
  existingBottleDetails,
  priceSite,
  testBottler,
  testBrand,
  testCountry,
  testOwnedEntity,
  testOwner,
  testRegion,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const publicRoutes = [
  {
    heading: "A record of whisky, bottle by bottle.",
    name: "Home",
    path: "/",
  },
  {
    heading: "Search the database",
    name: "Search",
    path: "/search",
  },
  {
    heading: existingBottleDetails.group.fullName,
    name: "Bottle",
    path: `/bottles/${existingBottle.id}`,
  },
  {
    heading: testCountry.name,
    name: "Country",
    path: `/locations/${testCountry.slug}`,
  },
  {
    heading: testRegion.name,
    name: "Region",
    path: `/locations/${testRegion.country.slug}/regions/${testRegion.slug}`,
  },
  {
    heading: testUser.username,
    name: "Profile",
    path: `/users/${testUser.username}`,
  },
  { heading: "Sign in", name: "Sign in", path: "/login" },
  {
    heading: testBrand.name,
    name: "Brand",
    path: `/brands/${testBrand.id}`,
  },
  {
    heading: testOwnedEntity.name,
    name: "Distillery",
    path: `/distillers/${testOwnedEntity.id}`,
  },
  {
    heading: testBottler.name,
    name: "Bottler",
    path: `/bottlers/${testBottler.id}`,
  },
] as const;

const otherPublicRoutes = [
  ["Bottle releases", `/bottles/${bottleGroupRepresentative.id}/releases`],
  ["distillers", "/distillers"],
  ["company", `/companies/${testOwner.id}`],
] as const;

test("public routes load", async ({ page, snapshot }) => {
  for (const route of publicRoutes) {
    await test.step(route.name, async () => {
      const response = await page.goto(route.path, { waitUntil: "commit" });

      expect(response?.status()).toBeLessThan(400);
      if ("heading" in route) {
        const heading = page
          .getByRole("heading", { exact: true, name: route.heading })
          .first();
        await expect(heading).toBeVisible();
        await snapshot(route.name, { ready: heading });
      }
    });
  }
});

for (const [name, path] of otherPublicRoutes) {
  test(`${name} route loads`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "commit" });

    expect(response?.status()).toBeLessThan(400);
  });
}

test("Add Entity route loads for a signed-in member", async ({
  context,
  page,
}) => {
  await signIn(context);

  const response = await page.goto("/addEntity?kind=distillery", {
    waitUntil: "commit",
  });

  expect(response?.status()).toBeLessThan(400);
});

test(
  "mobile navigation opens and reaches the bottle catalog",
  { tag: "@mobile" },
  async ({ page, snapshot }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("navigation", {
      name: "Mobile navigation",
    });

    await expect(navigation).toBeVisible();
    await snapshot("Menu", { fullPage: false, ready: navigation });
    await navigation.getByRole("link", { name: "Bottles" }).click();
    await expect(page).toHaveURL(/\/bottles$/);
  },
);

test(
  "location overviews expose discovery sections on mobile",
  { tag: "@mobile" },
  async ({ page, snapshot }) => {
    await page.goto(`/locations/${testCountry.slug}`);

    const regions = page.getByRole("heading", { name: "Regions" });
    await expect(regions).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Most recorded distilleries" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Latest releases" }),
    ).toBeVisible();
    await snapshot("Country overview", { ready: regions });

    await page.goto(
      `/locations/${testRegion.country.slug}/regions/${testRegion.slug}`,
    );

    const releases = page.getByRole("heading", { name: "Latest releases" });
    await expect(
      page.getByRole("heading", { name: "Most recorded distilleries" }),
    ).toBeVisible();
    await snapshot("Region overview", { ready: releases });
  },
);

test("site administration route loads for an administrator", async ({
  context,
  page,
}) => {
  await signIn(context, { user: { ...testUser, admin: true } });

  const response = await page.goto(`/admin/sites/${priceSite.type}`, {
    waitUntil: "commit",
  });

  expect(response?.status()).toBeLessThan(400);
});
