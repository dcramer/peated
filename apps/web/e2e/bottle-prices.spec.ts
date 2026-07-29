import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  firstStorePriceName,
  priceChangeFirstBottle,
  priceChangeSecondBottle,
  priceSite,
  secondStorePriceName,
  testAccessToken,
  testUser,
  unresolvedStorePriceName,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Bottle prices", () => {
  test("links Market Prices directly to Bottles on desktop and stays hidden on mobile", async ({
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
      .filter({ hasText: priceChangeSecondBottle.fullName });
    await expect(prices).toBeVisible();

    const firstRow = prices.locator("tr").filter({
      hasText: priceChangeFirstBottle.fullName,
    });
    await expect(
      firstRow.getByRole("link", {
        name: priceChangeFirstBottle.fullName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/bottles/${priceChangeFirstBottle.id}`);
    await expect(
      firstRow.getByRole("img", { name: "In Library" }),
    ).toBeVisible();
    await expect(firstRow.getByRole("img", { name: "Tasted" })).toHaveCount(0);

    const secondRow = prices.locator("tr").filter({
      hasText: priceChangeSecondBottle.fullName,
    });
    await expect(
      secondRow.getByRole("link", {
        name: priceChangeSecondBottle.fullName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/bottles/${priceChangeSecondBottle.id}`);
    await expect(secondRow.getByRole("img", { name: "Tasted" })).toBeVisible();
    await expect(
      secondRow.getByRole("img", { name: "In Library" }),
    ).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("renders direct and unresolved admin store prices without overflow", async ({
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

    const firstRow = page
      .locator("tr")
      .filter({ hasText: firstStorePriceName });
    await expect(
      firstRow.getByRole("link", {
        name: priceChangeFirstBottle.fullName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/bottles/${priceChangeFirstBottle.id}`);

    const secondRow = page
      .locator("tr")
      .filter({ hasText: secondStorePriceName });
    await expect(
      secondRow.getByRole("link", {
        name: priceChangeSecondBottle.fullName,
        exact: true,
      }),
    ).toHaveAttribute("href", `/bottles/${priceChangeSecondBottle.id}`);

    const unresolvedRow = page
      .locator("tr")
      .filter({ hasText: unresolvedStorePriceName });
    await expect(unresolvedRow.getByText("No Bottle")).toBeVisible();
    await expect(unresolvedRow.locator('a[href^="/bottles/"]')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});
