import { expect, test } from "@playwright/test";

import {
  firstStorePriceName,
  priceChangeFirstBottle,
  priceSite,
  priceSiteRun,
  testAccessToken,
  testUser,
  unresolvedStorePriceName,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Bottle prices", () => {
  test("opens a bottle from Market Prices", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-price-changes-${testInfo.project.name}`,
    });

    await page.goto("/", { waitUntil: "commit" });

    const marketPricesHeading = page.getByRole("heading", {
      name: "Market Prices",
    });
    const prices = page.locator("section").filter({
      has: marketPricesHeading,
    });
    await prices
      .getByRole("link", {
        name: priceChangeFirstBottle.group.name,
        exact: true,
      })
      .click();

    await expect(page).toHaveURL(`/bottles/${priceChangeFirstBottle.id}`);
  });

  test("links resolved admin prices while leaving unresolved prices unlinked", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-store-prices-${testInfo.project.name}`,
      user: { ...testUser, admin: true },
    });

    await page.goto(`/admin/sites/${priceSite.type}`, { waitUntil: "commit" });

    const firstRow = page
      .locator("tr")
      .filter({ hasText: firstStorePriceName });
    await firstRow
      .getByRole("link", {
        name: priceChangeFirstBottle.fullName,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(`/bottles/${priceChangeFirstBottle.id}`);

    await page.goto(`/admin/sites/${priceSite.type}`, { waitUntil: "commit" });

    const unresolvedRow = page
      .locator("tr")
      .filter({ hasText: unresolvedStorePriceName });
    await expect(unresolvedRow.locator('a[href^="/bottles/"]')).toHaveCount(0);
  });

  test("shows durable run IDs in scraper history", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-site-runs-${testInfo.project.name}`,
      user: { ...testUser, admin: true },
    });

    await page.goto(`/admin/sites/${priceSite.type}/runs`, {
      waitUntil: "commit",
    });

    const runEntry = testInfo.project.name.includes("mobile")
      ? page.locator("article")
      : page.locator("tr");
    await expect(runEntry.getByText(`Run #${priceSiteRun.id}`)).toBeVisible();
    await expect(
      runEntry.getByText(priceSiteRun.error, { exact: true }),
    ).toBeVisible();
  });
});
