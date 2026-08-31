import { expect, test, type Page } from "@playwright/test";

import { existingBottleId, testOwnedEntity } from "./rpc-fixtures.mjs";

const pageMetadata = [
  {
    name: "homepage",
    path: "/",
    title: "Peated: Whisky bottles, reviews, and tasting notes",
    openGraphTitle: "Peated: Whisky bottles, reviews, and tasting notes",
    description:
      "A record of whisky bottles, critic scores, and tasting notes. Log tastings and keep track of your whisky library.",
  },
  {
    name: "Bottle page",
    path: `/bottles/${existingBottleId}`,
    title: "Lagavulin Destination Expression | Peated",
    openGraphTitle: "Lagavulin Destination Expression",
    description:
      "See bottle details for Lagavulin Destination Expression in the Peated whisky database.",
  },
  {
    name: "distillery page",
    path: `/distillers/${testOwnedEntity.id}`,
    title: "Lagavulin Distillery — Whisky distillery | Peated",
    openGraphTitle: "Lagavulin Distillery — Whisky distillery",
    description:
      "See details for Lagavulin Distillery, a whisky distillery, in the Peated whisky database.",
  },
] as const;

for (const metadata of pageMetadata) {
  test(`${metadata.name} exposes its search and sharing metadata`, async ({
    page,
  }) => {
    const response = await page.goto(metadata.path);

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(metadata.title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      metadata.description,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      metadata.openGraphTitle,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", metadata.description);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "Peated",
    );
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
      "content",
      "en_US",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary",
    );
    await expectCanonicalUrl(page, metadata.path);
  });
}

async function expectCanonicalUrl(page: Page, path: string) {
  const expectedUrl = new URL(path, page.url()).href;
  const canonicalUrl = await page
    .locator('link[rel="canonical"]')
    .getAttribute("href");
  const openGraphUrl = await page
    .locator('meta[property="og:url"]')
    .getAttribute("content");

  expect(canonicalUrl).not.toBeNull();
  expect(openGraphUrl).not.toBeNull();
  expect(new URL(canonicalUrl!).href).toBe(expectedUrl);
  expect(new URL(openGraphUrl!).href).toBe(expectedUrl);
}
