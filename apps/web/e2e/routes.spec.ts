import { expect, test } from "./test";

import { bottlePathPattern } from "./assertions";
import {
  bottleGroupRepresentative,
  existingBottle,
  existingBottleDetails,
  priceSite,
  testBottler,
  testBrand,
  testCountry,
  testOtherRegion,
  testOwnedEntity,
  testOwner,
  testRegion,
  testSeries,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const publicRoutes = [
  {
    heading: testSeries.name,
    name: "Series",
    path: `/series/${testSeries.id}-old.name`,
  },
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

test("public routes load", async ({ page, request, snapshot }) => {
  for (const source of [
    `/series/${testSeries.id}`,
    "/series/9402",
    `/S${testSeries.id}`,
  ]) {
    const response = await request.get(
      `${source}?source=legacy&tag=one&tag=two`,
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(
      `/series/${testSeries.id}-lagavulin-special-releases?source=legacy&tag=one&tag=two`,
    );
  }
  for (const route of publicRoutes) {
    await test.step(route.name, async () => {
      const response = await page.goto(route.path, { waitUntil: "commit" });

      expect(response?.status()).toBeLessThan(400);
      if ("heading" in route) {
        const heading = page
          .getByRole("heading", { exact: true, name: route.heading })
          .first();
        await expect(heading).toBeVisible();
        if (route.name === "Series") {
          await expect(page).toHaveURL(
            `/series/${testSeries.id}-lagavulin-special-releases`,
          );
        }
        if (route.name === "Bottle") {
          const smoke = page.getByRole("button", {
            name: /^Smoke, 75% of tastings with notes/,
          });
          await smoke.click();
          const panel = page.getByRole("dialog", {
            name: "Smoke",
            exact: true,
          });
          await expect(panel).toHaveAttribute("aria-modal", "true");
          await expect(
            panel.getByRole("heading", { name: "Bottles with these notes" }),
          ).toBeVisible();
          await expect(
            panel.getByRole("link", {
              name: existingBottle.group.fullName,
              exact: true,
            }),
          ).toHaveAttribute("href", bottlePathPattern(existingBottle.id));
          await page.keyboard.press("Escape");
          await expect(panel).toHaveCount(0);
          await expect(smoke).toBeFocused();
        }
        if (["Series", "Country", "Region"].includes(route.name)) {
          await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            "href",
            page.url(),
          );
          await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
            "content",
            page.url(),
          );
          const structured = await page
            .locator('script[type="application/ld+json"]')
            .allTextContents();
          expect(
            structured.some(
              (value) => JSON.parse(value)["@type"] === "CollectionPage",
            ),
          ).toBe(true);
        }
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

test("browse from the homepage through a country and its regions", async ({
  page,
  request,
  snapshot,
}) => {
  const source = `/locations/${testCountry.slug.toUpperCase()}/regions/${testRegion.slug.toUpperCase()}/bottles?source=legacy&tag=one&tag=two`;
  const redirect = await request.get(source, { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toBe(
    `/locations/${testCountry.slug}/regions/${testRegion.slug}/bottles?source=legacy&tag=one&tag=two`,
  );
  await page.goto(
    `/locations/${testCountry.slug}/regions/${testRegion.slug}/bottles?cursor=2`,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    page.url(),
  );
  await expect(page).toHaveTitle(
    `Whisky bottles from ${testRegion.name}, ${testCountry.name} | Peated`,
  );
  await page.goto("/");
  await page
    .getByRole("link", { name: new RegExp(`^${testCountry.name} `) })
    .click();
  await expect(page).toHaveURL(`/locations/${testCountry.slug}`);
  const countryHeading = page.getByRole("heading", {
    name: testCountry.name,
    exact: true,
  });
  await expect(countryHeading).toBeVisible();
  await snapshot("Country overview", { ready: countryHeading });

  await page
    .getByRole("link", { name: new RegExp(`^${testRegion.name} `) })
    .click();
  await expect(page).toHaveURL(
    `/locations/${testCountry.slug}/regions/${testRegion.slug}`,
  );
  await expect(
    page.getByRole("heading", { name: testRegion.name, exact: true }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: testOtherRegion.name, exact: true })
    .click();
  await expect(page).toHaveURL(
    `/locations/${testCountry.slug}/regions/${testOtherRegion.slug}`,
  );
  const regionHeading = page.getByRole("heading", {
    name: testOtherRegion.name,
    exact: true,
  });
  await expect(regionHeading).toBeVisible();
  await snapshot("Region overview", { ready: regionHeading });
});

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
