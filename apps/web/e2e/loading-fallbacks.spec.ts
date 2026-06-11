import { expect, type Locator, type Page, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";

type LoadingRoute = {
  columns: number;
  desktopColumnWidthRatios?: number[];
  hasSearch: boolean;
  path: string;
  secondaryLineCount: number;
};

const loadingRoutes: LoadingRoute[] = [
  {
    columns: 4,
    hasSearch: false,
    path: "/bottles",
    secondaryLineCount: 12,
  },
  {
    columns: 3,
    desktopColumnWidthRatios: [0.6, 0.1, 0.3],
    hasSearch: true,
    path: "/brands",
    secondaryLineCount: 0,
  },
  {
    columns: 3,
    desktopColumnWidthRatios: [0.6, 0.1, 0.3],
    hasSearch: true,
    path: "/bottlers",
    secondaryLineCount: 0,
  },
  {
    columns: 3,
    desktopColumnWidthRatios: [0.6, 0.1, 0.3],
    hasSearch: true,
    path: "/distillers",
    secondaryLineCount: 0,
  },
];

test.describe("list route loading fallbacks", () => {
  for (const route of loadingRoutes) {
    test(`${route.path} renders a table skeleton while data is pending`, async ({
      page,
    }) => {
      await page.goto(route.path, { waitUntil: "commit" });

      const status = page.locator('[role="status"][aria-busy="true"]');
      const table = status.locator('table[aria-hidden="true"]');
      await expect(table).toBeVisible();
      await expect(page.locator(".svg-animate")).toHaveCount(0);
      await expect(page.getByText("Server Unreachable")).toHaveCount(0);

      const rows = table.locator("tbody tr");
      await expect(rows).toHaveCount(12);
      await expect(rows.first().locator("td")).toHaveCount(route.columns);
      await expect(
        table.locator("tbody tr td:first-child .mt-2.h-3.w-32"),
      ).toHaveCount(route.secondaryLineCount);
      if (route.desktopColumnWidthRatios && isDesktop(page)) {
        await expectColumnWidthRatios(
          table.locator("col"),
          route.desktopColumnWidthRatios,
          route.path,
        );
      }
      await expect(status.locator(".h-9.flex-grow.animate-pulse")).toHaveCount(
        route.hasSearch ? 1 : 0,
      );
      await expectNoHorizontalOverflow(page);
    });
  }
});

function isDesktop(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 640;
}

async function expectColumnWidthRatios(
  columns: Locator,
  expectedRatios: number[],
  path: string,
) {
  const widths = await columns.evaluateAll((columnElements) =>
    columnElements.map((column) => parseFloat(getComputedStyle(column).width)),
  );
  const totalWidth = widths.reduce((total, width) => total + width, 0);
  const ratios = widths.map((width) => width / totalWidth);

  for (const [index, expectedRatio] of expectedRatios.entries()) {
    expect(
      ratios[index],
      `${path} column ${index + 1} should reserve its desktop width`,
    ).toBeGreaterThanOrEqual(expectedRatio - 0.02);
    expect(
      ratios[index],
      `${path} column ${index + 1} should reserve its desktop width`,
    ).toBeLessThanOrEqual(expectedRatio + 0.02);
  }
}
