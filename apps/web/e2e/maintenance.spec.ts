import { expect, test, type TestInfo } from "./test";

import { adminUser, testAccessToken } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("previews and runs the old star rating repair", async ({
  context,
  page,
  snapshot,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(testInfo),
    user: adminUser,
  });

  await page.goto("/admin/maintenance");

  await expect(
    page.getByRole("heading", { name: "Maintenance", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("232", { exact: true })).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Convert 232 tastings" }),
  ).toBeVisible();
  await snapshot("admin/maintenance", {
    ready: page.getByRole("button", { name: "Convert 232 tastings" }),
  });

  await page.getByRole("button", { name: "Convert 232 tastings" }).click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Convert old star ratings?" }),
  ).toBeVisible();
  await expect(dialog).toContainText(
    "It will not replace ratings people chose, and it keeps the saved stars.",
  );

  const conversionRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/admin/convertOldStarRatings"),
  );
  await dialog.getByRole("button", { name: "Convert 232 tastings" }).click();
  await conversionRequest;

  await expect(page.getByText("Nothing to convert")).toBeVisible();
  await expect(page.getByText("Converted 232 tastings.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh totals for 175 Bottles" }),
  ).toBeVisible();
  const totalRefreshRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/admin/convertOldStarRatings"),
  );
  await page
    .getByRole("button", { name: "Refresh totals for 175 Bottles" })
    .click();
  await totalRefreshRequest;
  await expect(
    page.getByText("Started recalculating rating totals for 175 Bottles."),
  ).toBeVisible();

  const bottleCountRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/admin/repairBottleCounts"),
  );
  await page.getByRole("button", { name: "Check Bottle counts" }).click();
  await bottleCountRequest;
  await expect(page.getByText("Bottle count check started.")).toBeVisible();
});

test("@mobile shows the old star rating repair", async ({
  context,
  page,
  snapshot,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(testInfo),
    user: adminUser,
  });

  await page.goto("/admin/maintenance");

  await snapshot("admin/maintenance-mobile", {
    ready: page.getByRole("button", { name: "Convert 232 tastings" }),
  });
});

function uniqueAccessToken(testInfo: TestInfo): string {
  return `${testAccessToken}-maintenance-${testInfo.project.name}-${testInfo.workerIndex}`;
}
