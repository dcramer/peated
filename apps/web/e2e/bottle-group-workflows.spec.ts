import { expect, type Page, test, type TestInfo } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  bottleGroup,
  bottleGroupMember,
  bottleGroupMemberTargets,
  bottleGroupRepresentative,
  groupedBottleDetails,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Similar bottles", () => {
  test("renders read-only presentation, aggregate stats, and related Bottles", async ({
    page,
  }) => {
    await page.goto(`/bottles/${bottleGroupRepresentative.id}/releases`);

    const groupHeading = page.getByRole("heading", {
      level: 1,
      name: bottleGroup.fullName,
    });
    await expect(groupHeading).toBeVisible();
    await expect(groupHeading.locator("a")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Release family actions" }),
    ).toHaveCount(0);
    await expect(page.locator('a[href$="/releases/merge"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/releases/split"]')).toHaveCount(0);
    await expect(
      page.getByText(bottleGroup.description ?? "", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: bottleGroup.fullName }),
    ).toBeVisible();

    await expect(groupStatistic(page, "Tastings")).toHaveText("37");
    await expect(groupStatistic(page, "Similar bottles")).toHaveText("3");
    await expect(groupStatistic(page, "Ratings")).toHaveText("9");

    for (const { bottle } of bottleGroupMemberTargets) {
      await expect(
        page.getByRole("link", { name: bottle.fullName }),
      ).toHaveAttribute("href", `/bottles/${bottle.id}`);
    }
    const representativeItem = page.getByRole("listitem").filter({
      has: page.getByRole("link", {
        name: bottleGroupRepresentative.fullName,
      }),
    });
    await expect(representativeItem.getByText("55.1% ABV")).toBeVisible();
    await expect(representativeItem.getByText("2005 vintage")).toBeVisible();
    await expect(representativeItem.getByText("2022 release")).toBeVisible();
    await expect(representativeItem.getByText("Single cask")).toBeVisible();
    await expect(representativeItem.getByText("Cask strength")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto(`/bottles/${bottleGroupMember.id}/releases`);
    await expect(groupHeading).toBeVisible();
    for (const { bottle } of bottleGroupMemberTargets) {
      await expect(
        page.getByRole("link", { name: bottle.fullName }),
      ).toHaveAttribute("href", `/bottles/${bottle.id}`);
    }
  });

  test("links exact Bottle and search views to the related release family", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "bottle-group-workflows"),
    });

    await page.goto(`/bottles/${groupedBottleDetails.id}`);
    await expect(
      page.getByRole("link", { name: "View all 3 releases" }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/releases`);
    await expect(
      page.getByRole("link", { name: "Add another release" }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/addRelease`);

    await page.goto("/search?q=Lagavulin");
    await expect(
      page.getByRole("link", { name: "3 related releases" }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/releases`);
    await expectNoHorizontalOverflow(page);
  });
});

function groupStatistic(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator("..").locator("dd");
}

function uniqueAccessToken(testInfo: TestInfo, suffix: string) {
  return [
    testAccessToken,
    suffix,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}
