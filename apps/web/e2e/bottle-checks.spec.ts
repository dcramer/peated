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
    user: { ...testUser, mod: true },
  });

  const detailsResponse = await request.post(
    `${mockApiServer}/rpc/bottleChecks/details`,
    {
      data: { json: { check: 91 } },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  expect(detailsResponse.ok()).toBe(true);
  const details = (await detailsResponse.json()).json;

  expect(details.check).not.toHaveProperty("inputSnapshot");
  expect(details.check).not.toHaveProperty("artifacts");
  expect(details.check).not.toHaveProperty("modelMetadata");
  for (const operation of details.check.operations) {
    expect(operation).not.toHaveProperty("stateToken");
  }
  for (const operation of details.reviewOperations) {
    expect(operation.review).not.toHaveProperty("stateToken");
  }

  await page.goto("/bottle-checks/91");

  await expect(
    page.getByRole("heading", { name: "Bottle Check #91" }),
  ).toBeVisible();
  const readyOperation = page
    .getByRole("article")
    .filter({ hasText: "Rename the inspected Brand" });
  const nonReadyOperation = page
    .getByRole("article")
    .filter({ hasText: "Review the second inspected Brand" });

  await expect(
    readyOperation.getByRole("checkbox", { name: "Select" }),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText("Not ready to approve"),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText(
      "This operation cannot currently be approved, but you can reject it.",
    ),
  ).toBeVisible();
  await nonReadyOperation.getByRole("checkbox", { name: "Select" }).check();
  await expect(
    page.getByRole("button", { name: "Approve selected" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Reject selected" }),
  ).toBeEnabled();
  const rejectionRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/bottleChecks/rejectSelected"),
  );
  await page.getByRole("button", { name: "Reject selected" }).click();
  await rejectionRequest;

  await expect(
    nonReadyOperation.getByText("Rejected", { exact: true }),
  ).toBeVisible();
  const actionResults = page.getByRole("region", {
    name: "Operation results",
  });
  const rejectionResult = actionResults
    .getByRole("listitem")
    .filter({ hasText: "Operation #702" });
  await expect(
    rejectionResult.getByText("Operation #702", { exact: true }),
  ).toBeVisible();
  await expect(rejectionResult.getByText(/^rejected$/i)).toBeVisible();
  await expect(
    readyOperation.getByRole("checkbox", { name: "Select" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await readyOperation.getByRole("checkbox", { name: "Select" }).check();
  const approvalRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/bottleChecks/approveSelected"),
  );
  await page.getByRole("button", { name: "Approve selected" }).click();
  await approvalRequest;

  await expect(
    readyOperation.getByText("Applied", { exact: true }),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText("Rejected", { exact: true }),
  ).toBeVisible();
  const approvalResult = actionResults
    .getByRole("listitem")
    .filter({ hasText: "Operation #701" });
  await expect(
    approvalResult.getByText("Operation #701", { exact: true }),
  ).toBeVisible();
  await expect(approvalResult.getByText(/^applied$/i)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test("runs a moderator Bottle audit and shows it in Bottle history", async ({
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
  const historyLink = auditFieldset.getByRole("link", {
    name: "Audit history",
  });
  await expect(historyLink).toHaveAttribute(
    "href",
    `/bottles/${existingBottleId}/checks`,
  );
  await auditFieldset
    .getByRole("textbox", { name: "Optional context" })
    .fill("Verify the label and catalog identity.");
  const auditRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/bottleChecks/audit"),
  );
  await page.getByRole("button", { name: "Run Bottle Audit" }).click();
  await auditRequest;
  await expect(page).toHaveURL(/\/bottle-checks\/93$/);
  await expectNoHorizontalOverflow(page);

  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Audit Bottle", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Audit history" }).click();
  await expect(page).toHaveURL(`/bottles/${existingBottleId}/checks`);

  await expect(
    page.getByRole("heading", { name: "Audit history", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The Bottle identity is supported by the inspected evidence.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "View review" })).toHaveAttribute(
    "href",
    "/bottle-checks/93",
  );
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
