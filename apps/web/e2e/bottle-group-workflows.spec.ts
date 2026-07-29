import { expect, test, type TestInfo } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  bottleGroup,
  bottleGroupMember,
  bottleGroupMembers,
  bottleGroupRepresentative,
  groupedBottleDetails,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Bottle releases", () => {
  test("renders exact release identity and ratings", async ({ page }) => {
    await page.goto(`/bottles/${bottleGroupRepresentative.id}/releases`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: bottleGroupRepresentative.fullName,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: `Releases (${bottleGroup.totalBottles})`,
      }),
    ).toBeVisible();
    const releases = page.getByRole("region", {
      name: "Releases",
    });
    await expect(releases).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Release family actions" }),
    ).toHaveCount(0);
    await expect(page.locator('a[href$="/releases/merge"]')).toHaveCount(0);
    await expect(page.locator('a[href$="/releases/split"]')).toHaveCount(0);

    for (const bottle of bottleGroupMembers) {
      await expect(
        releases.locator(`a[href="/bottles/${bottle.id}"]`),
      ).toHaveAttribute("title", bottle.fullName);
    }
    const representativeLink = releases.locator(
      `a[href="/bottles/${bottleGroupRepresentative.id}"]`,
    );
    await expect(representativeLink).toHaveAttribute("aria-current", "page");
    const representativeItem = releases.getByRole("listitem").filter({
      has: page.locator(`a[href="/bottles/${bottleGroupRepresentative.id}"]`),
    });
    await expect(representativeItem.getByText("Cask 42")).toBeVisible();
    await expect(representativeItem.getByText("55.1% ABV")).toBeVisible();
    await expect(representativeItem.getByText("2005 vintage")).toBeVisible();
    await expect(representativeItem.getByText("2022 release")).toBeVisible();
    await expect(representativeItem.getByText("Single cask")).toBeVisible();
    await expect(representativeItem.getByText("Cask strength")).toBeVisible();
    await expect(releases.getByText("0 ratings")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);

    await page.goto(`/bottles/${bottleGroupMember.id}/releases`);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: bottleGroupMember.fullName,
      }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Releases" })
        .locator(`a[href="/bottles/${bottleGroupMember.id}"]`),
    ).toHaveAttribute("aria-current", "page");
  });

  test("links exact Bottle and search views to release actions", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "bottle-group-workflows"),
    });

    await page.goto(`/bottles/${groupedBottleDetails.id}`);
    await expect(
      page.getByRole("link", {
        name: `Releases (${bottleGroup.totalBottles})`,
      }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/releases`);

    await page.getByRole("button", { name: "More bottle actions" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Add a similar bottle" }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/addRelease`);

    await page.goto("/search?q=Lagavulin");
    await expect(
      page.getByRole("link", { name: "3 related releases" }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/releases`);
    await expectNoHorizontalOverflow(page);
  });
});

function uniqueAccessToken(testInfo: TestInfo, suffix: string) {
  return [
    testAccessToken,
    suffix,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}
