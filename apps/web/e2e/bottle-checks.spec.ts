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

test("disposes non-ready and live-ready operations independently", async ({
  context,
  page,
  request,
}, testInfo) => {
  const accessToken = uniqueAccessToken(testInfo);
  await signIn(context, {
    accessToken,
    user: { ...testUser, admin: true, mod: true },
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  const detailsResponse = await request.post(
    `${mockApiServer}/rpc/audits/details`,
    {
      data: { json: { audit: 91 } },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  expect(detailsResponse.ok()).toBe(true);
  const details = (await detailsResponse.json()).json;

  expect(details.audit).not.toHaveProperty("inputSnapshot");
  expect(details.audit).not.toHaveProperty("artifacts");
  expect(details.audit.modelMetadata).toMatchObject({
    usage: { totalTokens: 10_800 },
    cost: { estimatedAgentLoopCostUsd: 0.044 },
  });
  expect(details.audit).not.toHaveProperty("subjectKey");
  expect(details.audit).not.toHaveProperty("backgroundEventKey");
  for (const operation of details.audit.operations) {
    expect(operation).not.toHaveProperty("stateToken");
  }
  for (const operation of details.reviewOperations) {
    expect(operation.review).not.toHaveProperty("stateToken");
  }

  await page.goto("/admin/audits/91");

  await expect(
    page.getByRole("region", { name: "Audited Bottle" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Bottle audit" }),
  ).toBeVisible();
  await page.getByText("Classifier run details", { exact: true }).click();
  await expect(page.getByText("10,800", { exact: true })).toBeVisible();
  await expect(page.getByText("$0.0440", { exact: true })).toBeVisible();
  await expect(page.getByText("2.4 sec", { exact: true })).toBeVisible();
  const readyOperation = page
    .getByRole("article")
    .filter({ hasText: "Rename the inspected Brand" });
  const nonReadyOperation = page
    .getByRole("article")
    .filter({ hasText: "Review the second inspected Brand" });

  await expect(
    readyOperation.getByRole("button", { name: "Apply included changes" }),
  ).toBeEnabled();
  await readyOperation
    .getByRole("button", { name: "Copy operation payload" })
    .click();
  const copiedOperation = JSON.parse(
    await page.evaluate(() => navigator.clipboard.readText()),
  );
  expect(copiedOperation).toMatchObject({
    schemaVersion: 1,
    source: "peated.admin.audit_operation",
    audit: { id: 91 },
    operation: { checkId: 91 },
    liveReview: { approvalReady: true },
  });
  await expect(
    page.getByText("Copied audit operation", { exact: false }),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText("Not ready to approve"),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText(
      "The current catalog state does not support applying this proposal.",
    ),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByRole("button", { name: "Apply included changes" }),
  ).toBeDisabled();
  await nonReadyOperation
    .getByRole("button", { name: "Remove operation" })
    .click();
  await expect(
    nonReadyOperation.getByRole("button", { name: "Confirm removal" }),
  ).toBeEnabled();
  await nonReadyOperation
    .getByRole("button", { name: "Confirm removal" })
    .click();
  await expect(
    page.getByText("Operation removed", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo remove" }).click();
  await expect(
    nonReadyOperation.getByRole("button", { name: "Apply included changes" }),
  ).toBeDisabled();

  await nonReadyOperation
    .getByRole("button", { name: "Remove operation" })
    .click();
  const rejectionRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/audits/rejectSelected"),
  );
  await nonReadyOperation
    .getByRole("button", { name: "Confirm removal" })
    .click();
  await rejectionRequest;

  await page.getByText("Reviewed operations (1)", { exact: true }).click();
  await expect(page.getByText("Removed", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Operation results" }),
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

  await expect(page).toHaveURL("/admin/audits");
  await expect(page.getByText("No audits need attention.")).toBeVisible();
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

test("redirects an actionable admin audit to its current check", async ({
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

  await expect(page).toHaveURL("/admin/audits/91");
  await expect(
    page.getByRole("heading", { name: "Bottle audit" }),
  ).toBeVisible();
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

const mockApiServer =
  process.env.PLAYWRIGHT_API_SERVER ??
  `http://127.0.0.1:${process.env.PLAYWRIGHT_API_PORT ?? 4999}`;
