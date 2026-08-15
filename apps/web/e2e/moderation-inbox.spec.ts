import { expect, test, type TestInfo } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import { testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("bulk-ignores listings with no clear Bottle outcome", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: uniqueAccessToken(testInfo),
    user: { ...testUser, admin: true, mod: true },
  });

  await page.goto("/admin/moderation/inbox?inconclusive=true");

  await expect(
    page.getByRole("link", { name: "Inconclusive 2" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText(
      "No Bottle match was found. Should this listing be ignored?",
    ),
  ).toHaveCount(2);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Ignore all 2 inconclusive" }).click();
  await expect(
    page.getByRole("heading", { name: "Ignore all inconclusive listings?" }),
  ).toBeVisible();

  const ignoreRequest = page.waitForRequest((request) =>
    request.url().includes("/rpc/admin/moderation/ignoreInconclusive"),
  );
  await page.getByRole("button", { name: "Ignore 2 listings" }).click();
  await ignoreRequest;

  await expect(page).toHaveURL("/admin/moderation/inbox?inconclusive=true");
  await expect(page.getByText("Nothing needs a decision")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ignore all/ })).toHaveCount(0);
});

function uniqueAccessToken(testInfo: TestInfo): string {
  return `${testAccessToken}-queue-inconclusive-${testInfo.project.name}-${testInfo.workerIndex}`;
}
