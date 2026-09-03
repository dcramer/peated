import { expect, test } from "./test";

import { bottleHrefSelector, bottlePathPattern } from "./assertions";
import {
  bottleGroupMembers,
  bottleGroupRepresentative,
  existingBottle,
  existingBottleDetails,
  mockApiServer,
  priceSite,
  siteReviewList,
  storePriceList,
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

const otherPublicRoutes = [["company", `/companies/${testOwner.id}`]] as const;

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

test("bottle releases stream new pages without replacing the bottle header", async ({
  page,
  request,
}, testInfo) => {
  await page.goto(`/bottles/${bottleGroupRepresentative.id}/releases`);
  const releases = page.getByRole("list", { name: "Bottle releases" });
  await expect(releases).toBeVisible();
  const heading = page.getByRole("heading", { level: 1 });
  const title = await heading.textContent();
  const next = page
    .getByRole("navigation", { name: "Release pages" })
    .locator('a[rel="next"]');
  const nextHref = await next.getAttribute("href");
  expect(nextHref).toBeTruthy();
  const navigation = `**${nextHref}*`;
  let releaseNavigation!: () => void;
  const navigationReady = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  await page.route(navigation, async (route) => {
    await navigationReady;
    await route.continue();
  });
  await request.post(`${mockApiServer}/__test/release-pages/hold`);
  try {
    await next.click();
    await expect(next.getByRole("status")).toHaveText("Loading…");
    await expect(releases).toBeVisible();
    releaseNavigation();
    await expect(
      page.getByRole("status", { name: "Loading releases", exact: true }),
    ).toBeVisible();
    await expect(heading).toHaveText(title!);
    await expect(
      page.getByRole("heading", { name: "Releases", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("release-page-loading.png"),
    });
  } finally {
    releaseNavigation();
    await request.post(`${mockApiServer}/__test/release-pages/resume`);
    await page.unroute(navigation);
  }
  await expect(page).toHaveURL(nextHref!);
  await expect(
    releases.locator(bottleHrefSelector(bottleGroupMembers[1]!.id)),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading releases", exact: true }),
  ).toHaveCount(0);
});

test("distillers filters keep controls responsive while results update", async ({
  page,
}) => {
  await page.goto("/distillers?cursor=2");
  const producer = page.getByRole("link", {
    name: testOwnedEntity.name,
    exact: true,
  });
  await expect(producer).toBeVisible();
  const sort = page.getByRole("combobox", { name: "Sort distillers" });
  const navigation = "**/distillers?country=japan*";
  let releaseNavigation!: () => void;
  const navigationReady = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  await page.route(navigation, async (route) => {
    await navigationReady;
    await route.continue();
  });
  try {
    const country = page.getByRole("button", { name: "Japan", exact: true });
    await country.click();
    await expect(country).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("status").filter({ hasText: "Updating…" }),
    ).toBeVisible();
    await expect(producer).toBeVisible();
    await sort.selectOption({ label: "Name" });
    await expect(sort).toHaveValue("name");
  } finally {
    releaseNavigation();
  }
  await expect(page).toHaveURL("/distillers?country=japan&sort=name");
  await expect(
    page.getByRole("heading", { name: "No distillers found" }),
  ).toBeVisible();
  await expect(sort).toBeVisible();
  await page.unroute(navigation);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL("/distillers?sort=name");
  await expect(producer).toBeVisible();
});

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

    const sort = page.getByRole("combobox", { name: "Sort bottles" });
    await expect(sort).toHaveValue("-release");
    const sortNavigation = "**/bottles?sort=name*";
    let releaseNavigation!: () => void;
    const navigationReady = new Promise<void>((resolve) => {
      releaseNavigation = resolve;
    });
    await page.route(sortNavigation, async (route) => {
      await navigationReady;
      await route.continue();
    });
    try {
      await sort.selectOption({ label: "Bottle name" });
      await expect(sort).toHaveValue("name");
      await expect(
        page.getByRole("status").filter({ hasText: "Updating…" }),
      ).toBeVisible();
      await expect(
        page.locator(bottleHrefSelector(existingBottle.id)),
      ).toBeVisible();
    } finally {
      releaseNavigation();
    }
    await expect(page).toHaveURL("/bottles?sort=name");
    await expect(
      page.getByRole("status").filter({ hasText: "Updating…" }),
    ).toHaveCount(0);
    await page.unroute(sortNavigation);
    await expect(
      page
        .getByRole("list", { name: "Bottle records" })
        .getByRole("listitem")
        .first()
        .locator(bottleHrefSelector(existingBottle.id)),
    ).toBeVisible();

    const search = page.getByRole("searchbox", { name: "Find a bottle" });
    await search.fill("no-matching-whisky");
    await search.press("Enter");
    await expect(
      page.getByRole("heading", { name: "No bottles found" }),
    ).toBeVisible();
    await expect(sort).toBeVisible();
    await expect(search).toBeFocused();
    await page
      .getByRole("button", { name: "Clear filters", exact: true })
      .click();
    await expect(page).toHaveURL("/bottles?sort=name");
    await expect(
      page.locator(bottleHrefSelector(existingBottle.id)),
    ).toBeVisible();
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

test("scraper lists keep bottle links and navigation independently clickable", async ({
  context,
  page,
}) => {
  await signIn(context, { user: { ...testUser, admin: true } });

  const root = `/admin/sites/${priceSite.type}`;
  await page.goto(`${root}/reviews`);
  const table = page.getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(
    siteReviewList.results.length,
  );

  await page
    .getByRole("navigation", { name: "Scraper", exact: true })
    .getByRole("link", { name: "Prices", exact: true })
    .click();
  await expect(page).toHaveURL(`${root}/prices`);
  const firstPriceBottle = storePriceList.results[0]!.bottle!;
  await table.locator(bottleHrefSelector(firstPriceBottle.id)).click();
  await expect(page).toHaveURL(bottlePathPattern(firstPriceBottle.id));

  await page.goto(`${root}/reviews`);
  await table.locator(bottleHrefSelector(existingBottle.id)).click();
  await expect(page).toHaveURL(bottlePathPattern(existingBottle.id));
});
