import {
  expect,
  type Page,
  type Request,
  test,
  type TestInfo,
} from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  bottleGroup,
  bottleGroupId,
  bottleGroupMember,
  bottleGroupMemberTargets,
  bottleGroupRepresentative,
  destinationBottleGroup,
  destinationBottleGroupId,
  groupedBottleDetails,
  splitBottleGroupId,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("BottleGroup workflows", () => {
  test("renders generic identity, aggregates, and exact related Bottles", async ({
    page,
  }) => {
    await page.goto(`/bottle-groups/${bottleGroupId}`);

    const groupHeading = page.getByRole("heading", {
      level: 1,
      name: bottleGroup.fullName,
    });
    await expect(groupHeading).toBeVisible();
    await expect(groupHeading.locator("a")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Bottle group actions" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: bottleGroupRepresentative.fullName,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Exact release not specified", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(bottleGroup.description ?? "", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: bottleGroup.fullName }),
    ).toBeVisible();

    await expect(groupStatistic(page, "Tastings")).toHaveText("37");
    await expect(groupStatistic(page, "Related releases")).toHaveText("3");
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
    ).toHaveAttribute("href", `/bottle-groups/${bottleGroupId}`);
    await expect(
      page.getByRole("link", { name: "Add another release" }),
    ).toHaveAttribute("href", `/bottles/${groupedBottleDetails.id}/addRelease`);

    await page.goto("/search?q=Lagavulin");
    await expect(
      page.getByRole("link", { name: "3 related releases" }),
    ).toHaveAttribute("href", `/bottle-groups/${bottleGroupId}`);
    await expectNoHorizontalOverflow(page);
  });

  test("merges the source into an explicit destination and navigates there", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "bottle-group-merge"),
      user: { ...testUser, mod: true },
    });
    await page.goto(`/bottle-groups/${bottleGroupId}`);

    await page.getByRole("button", { name: "Bottle group actions" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Merge expression" }),
    ).toHaveAttribute("href", `/bottle-groups/${bottleGroupId}/merge`);
    await expect(
      page.getByRole("menuitem", { name: "Split releases" }),
    ).toHaveAttribute("href", `/bottle-groups/${bottleGroupId}/split`);
    await page.getByRole("menuitem", { name: "Merge expression" }).click();

    await expect(
      page.getByRole("heading", { name: "Merge expression groups" }),
    ).toBeVisible();
    await page.getByText("Destination expression", { exact: true }).click();
    await page
      .getByRole("button", {
        name: `${destinationBottleGroup.fullName} (group ${destinationBottleGroupId}, 2 releases)`,
      })
      .click();
    await expect(
      page.getByText(
        new RegExp(
          `Move every Bottle from “${escapeRegex(bottleGroup.fullName)}” into “${escapeRegex(destinationBottleGroup.fullName)}`,
        ),
      ),
    ).toBeVisible();

    const requestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/bottleGroups/merge"),
    );
    await page.getByRole("button", { name: "Merge groups" }).click();
    expect(getRpcInput(await requestPromise)).toEqual({
      group: bottleGroupId,
      destinationGroupId: destinationBottleGroupId,
    });
    await expect(page).toHaveURL(
      new RegExp(`/bottle-groups/${destinationBottleGroupId}$`),
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: destinationBottleGroup.fullName,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("splits a subset with explicit representatives and navigates to the new group", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "bottle-group-split"),
      user: { ...testUser, mod: true },
    });
    await page.goto(`/bottle-groups/${bottleGroupId}`);
    await page.getByRole("button", { name: "Bottle group actions" }).click();
    await page.getByRole("menuitem", { name: "Split releases" }).click();

    await expect(
      page.getByRole("heading", { name: "Split releases" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Generic activity, stable aliases, and editorial content remain on this source expression.",
      ),
    ).toBeVisible();

    const representativeChoice = page.getByRole("checkbox", {
      name: new RegExp(escapeRegex(bottleGroupRepresentative.fullName)),
    });
    await representativeChoice.check();
    await page
      .getByRole("radio", { name: "Representative for the new expression" })
      .check();
    await page
      .getByRole("group", { name: "Source expression representative" })
      .getByRole("radio", { name: bottleGroupMember.fullName })
      .check();

    const requestPromise = page.waitForRequest((request) =>
      request.url().includes("/rpc/bottleGroups/split"),
    );
    await page.getByRole("button", { name: "Create new expression" }).click();
    expect(getRpcInput(await requestPromise)).toEqual({
      group: bottleGroupId,
      movedBottleIds: [bottleGroupRepresentative.id],
      newRepresentativeBottleId: bottleGroupRepresentative.id,
      sourceRepresentativeBottleId: bottleGroupMember.id,
    });
    await expect(page).toHaveURL(
      new RegExp(`/bottle-groups/${splitBottleGroupId}$`),
    );
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Lagavulin Split Expression",
      }),
    ).toBeVisible();
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

function getRpcInput(request: Request): Record<string, unknown> {
  const postData = request.postData();
  if (!postData) {
    throw new Error("Expected the RPC request to contain JSON input.");
  }

  const envelope: unknown = JSON.parse(postData);
  if (!isRecord(envelope) || !isRecord(envelope.json)) {
    throw new Error("Expected the RPC request to use the JSON envelope.");
  }
  return envelope.json;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
