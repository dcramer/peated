import { expect, test, type TestInfo } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import { testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("disposes non-ready and live-ready operations independently", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(testInfo),
    user: { ...testUser, mod: true },
  });

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
  await expect(
    page.getByText("Operation #702 rejected", { exact: false }),
  ).toBeVisible();
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
  await expect(
    page.getByText("Operation #701 applied", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Select" })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

function uniqueAccessToken(testInfo: TestInfo) {
  return [
    testAccessToken,
    "bottle-check-review",
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}
