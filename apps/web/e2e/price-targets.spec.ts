import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  exactStorePriceName,
  genericStorePriceName,
  priceChangeExactTarget,
  priceChangeGenericTarget,
  priceSite,
  targetlessStorePriceName,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("price catalog targets", () => {
  test("keeps Market Prices identity exact on desktop and hidden on mobile", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-price-changes-${testInfo.project.name}`,
    });
    await page.setViewportSize(
      testInfo.project.name.includes("mobile")
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );

    await page.goto("/", { waitUntil: "commit" });

    const marketPricesTab = page.getByRole("button", {
      name: "Market Prices",
    });
    if (testInfo.project.name.includes("mobile")) {
      await expect(marketPricesTab).toBeHidden();
      await expectNoHorizontalOverflow(page);
      return;
    }

    await expect(marketPricesTab).toBeVisible();
    const prices = page
      .locator("table")
      .filter({ hasText: priceChangeGenericTarget.group.fullName });
    await expect(prices).toBeVisible();

    const exactRow = prices.locator("tr").filter({
      hasText: priceChangeExactTarget.bottle.fullName,
    });
    await expect(
      exactRow.getByRole("link", {
        name: priceChangeExactTarget.bottle.fullName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/bottles/${priceChangeExactTarget.bottle.id}`);
    await expect(
      exactRow.getByText("Exact bottle", { exact: true }),
    ).toBeVisible();
    await expect(
      exactRow.getByRole("img", { name: "In Library" }),
    ).toBeVisible();
    await expect(exactRow.getByRole("img", { name: "Tasted" })).toHaveCount(0);

    const genericRow = prices.locator("tr").filter({
      hasText: priceChangeGenericTarget.group.fullName,
    });
    await expect(
      genericRow.getByText("Exact bottle not specified"),
    ).toBeVisible();
    await expect(
      genericRow.getByRole("link", {
        name: priceChangeGenericTarget.group.fullName,
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      `/bottles/${priceChangeGenericTarget.group.representativeBottleId}/releases`,
    );
    await expect(
      genericRow.locator(
        `a[href="/bottles/${priceChangeGenericTarget.group.representativeBottleId}"]`,
      ),
    ).toHaveCount(0);
    await expect(genericRow.getByRole("img", { name: "Tasted" })).toBeVisible();
    await expect(
      genericRow.getByRole("img", { name: "In Library" }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("renders exact, generic, and unresolved admin store prices without overflow", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-store-prices-${testInfo.project.name}`,
      user: { ...testUser, admin: true },
    });
    await page.setViewportSize(
      testInfo.project.name.includes("mobile")
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    );

    await page.goto(`/admin/sites/${priceSite.type}`, { waitUntil: "commit" });
    await expect(
      page.getByRole("heading", { name: priceSite.name }),
    ).toBeVisible();

    const exactRow = page
      .locator("tr")
      .filter({ hasText: exactStorePriceName });
    await expect(
      exactRow.getByRole("link", {
        name: priceChangeExactTarget.bottle.fullName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/bottles/${priceChangeExactTarget.bottle.id}`);
    await expect(
      exactRow.getByText("Exact bottle", { exact: true }),
    ).toBeVisible();

    const genericRow = page
      .locator("tr")
      .filter({ hasText: genericStorePriceName });
    await expect(
      genericRow.getByText("Exact bottle not specified"),
    ).toBeVisible();
    await expect(
      genericRow.getByRole("link", {
        name: priceChangeGenericTarget.group.fullName,
        exact: true,
      }),
    ).toHaveAttribute(
      "href",
      `/bottles/${priceChangeGenericTarget.group.representativeBottleId}/releases`,
    );
    await expect(
      genericRow.locator(
        `a[href="/bottles/${priceChangeGenericTarget.group.representativeBottleId}"]`,
      ),
    ).toHaveCount(0);

    const unresolvedRow = page
      .locator("tr")
      .filter({ hasText: targetlessStorePriceName });
    await expect(unresolvedRow.getByText("No Bottle")).toBeVisible();
    await expect(unresolvedRow.locator('a[href^="/bottles/"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
