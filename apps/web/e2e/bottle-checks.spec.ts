import { expect, test, type TestInfo } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  existingBottle,
  existingBottleId,
  moderatorUser,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("reviews independent catalog operations one task at a time", async ({
  context,
  page,
}, testInfo) => {
  const accessToken = uniqueAccessToken(testInfo);
  await signIn(context, {
    accessToken,
    user: { ...testUser, admin: true, mod: true },
  });

  await page.goto("/admin/moderation/inbox/operation/701");

  await expect(
    page.getByRole("heading", {
      name: "Apply these changes to the Entity?",
    }),
  ).toBeVisible();
  const readyOperation = page
    .getByRole("article")
    .filter({ hasText: "Rename the inspected Brand" });
  await expect(readyOperation).toBeVisible();
  await expect(
    page.getByText("Review the second inspected Brand independently."),
  ).toHaveCount(0);
  await expect(
    readyOperation.getByRole("button", { name: "Apply included changes" }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  const approvalRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/audits/approveSelected"),
  );
  await readyOperation
    .getByRole("button", { name: "Apply included changes" })
    .click();
  await approvalRequest;

  await expect(page).toHaveURL("/admin/moderation/inbox/operation/702");
  const blockedOperation = page
    .getByRole("article")
    .filter({ hasText: "Review the second inspected Brand" });
  await expect(
    blockedOperation.getByText("Not ready to approve"),
  ).toBeVisible();
  await expect(
    blockedOperation.getByRole("button", { name: "Apply included changes" }),
  ).toBeDisabled();

  await blockedOperation
    .getByRole("button", { name: "Remove operation" })
    .click();
  await blockedOperation.getByLabel("Reason").selectOption("wrong_change");
  const rejectionRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/audits/rejectSelected"),
  );
  await blockedOperation
    .getByRole("button", { name: "Confirm removal" })
    .click();
  await rejectionRequest;

  await expect(page).toHaveURL("/admin/moderation/inbox");
  await expect(
    page
      .getByRole("region", { name: "Moderation Inbox" })
      .getByText("Nothing needs a decision"),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("runs a clean moderator Bottle audit inline and returns to the Bottle", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(testInfo, "bottle-audit"),
    user: moderatorUser,
  });

  await page.goto(`/bottles/${existingBottleId}/audit`);

  await expect(
    page.getByRole("heading", { name: "Audit Bottle", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Back" })).toBeVisible();

  const auditFieldset = page.locator("form > fieldset");
  await expect(auditFieldset).toBeVisible();
  await expect(
    auditFieldset.getByRole("link", { name: existingBottle.fullName }),
  ).toHaveAttribute("href", `/bottles/${existingBottleId}`);
  await expect(auditFieldset.getByText("Audit history")).toHaveCount(0);
  await auditFieldset
    .getByRole("textbox", { name: "Optional context" })
    .fill("Verify the label and catalog identity.");
  const auditRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/audits/create"),
  );
  await page.getByRole("button", { name: "Run Bottle Audit" }).click();
  await auditRequest;
  await expect(page).toHaveURL(`/bottles/${existingBottleId}/audit`);
  await expect(
    page.getByRole("heading", { name: "No changes proposed" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The Bottle identity is supported by the inspected evidence.",
      { exact: true },
    ),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Return to Bottle" }).click();
  await expect(page).toHaveURL(`/bottles/${existingBottleId}`);
});

test("opens an actionable admin audit in its focused Moderation task", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(
      testInfo,
      "bottle-audit-bottle-check-review",
    ),
    user: { ...moderatorUser, admin: true },
  });

  await page.goto(`/bottles/${existingBottleId}/audit`);
  await page
    .getByRole("textbox", { name: "Optional context" })
    .fill("Review proposed catalog work.");
  await page.getByRole("button", { name: "Run Bottle Audit" }).click();

  await expect(page).toHaveURL("/admin/moderation/inbox/operation/701");
  await expect(
    page.getByRole("heading", {
      name: "Apply these changes to the Entity?",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Review the second inspected Brand independently."),
  ).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

function uniqueAccessToken(testInfo: TestInfo, suffix = "bottle-check-review") {
  return [
    testAccessToken,
    suffix,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}
