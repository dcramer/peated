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
  expect(details.check).not.toHaveProperty("subjectKey");
  expect(details.check).not.toHaveProperty("backgroundEventKey");
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
    readyOperation.getByRole("button", { name: "Apply" }),
  ).toBeEnabled();
  await expect(
    nonReadyOperation.getByText("Not ready to approve"),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText(
      "The current catalog state does not support applying this proposal.",
    ),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByRole("button", { name: "Apply" }),
  ).toBeDisabled();
  await nonReadyOperation.getByRole("button", { name: "Reject" }).click();
  await expect(
    nonReadyOperation.getByRole("button", { name: "Confirm rejection" }),
  ).toBeEnabled();
  const rejectionRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/bottleChecks/rejectSelected"),
  );
  await nonReadyOperation
    .getByRole("button", { name: "Confirm rejection" })
    .click();
  await rejectionRequest;

  await expect(
    nonReadyOperation.getByText("Rejected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Operation results" }),
  ).toHaveCount(0);
  await expect(
    readyOperation.getByRole("button", { name: "Apply" }),
  ).toBeEnabled();
  await expectNoHorizontalOverflow(page);

  const approvalRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/bottleChecks/approveSelected"),
  );
  await readyOperation.getByRole("button", { name: "Apply" }).click();
  await approvalRequest;

  await expect(
    readyOperation.getByText("Applied", { exact: true }),
  ).toBeVisible();
  await expect(
    nonReadyOperation.getByText("Rejected", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select" })).toHaveCount(0);
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
    request.url().includes("/rpc/bottleChecks/audit"),
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

test("redirects an actionable moderator audit to its current check", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(
      testInfo,
      "bottle-audit-bottle-check-review",
    ),
    user: moderatorUser,
  });

  await page.goto(`/bottles/${existingBottleId}/audit`);
  await page
    .getByRole("textbox", { name: "Optional context" })
    .fill("Review proposed catalog work.");
  await page.getByRole("button", { name: "Run Bottle Audit" }).click();

  await expect(page).toHaveURL("/bottle-checks/91");
  await expect(
    page.getByRole("heading", { name: "Bottle Check #91" }),
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
