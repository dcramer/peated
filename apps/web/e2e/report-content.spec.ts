import { expect, test } from "./test";

import {
  adminUser,
  createdTastingId,
  existingBottleId,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

// Reporting rule (moderation): a signed-in member can report anything another
// member made, from that page's actions menu, and never their own content.
test("reports another member's content from the actions menu, never their own", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: `${testAccessToken}-report-content-${testInfo.project.name}`,
    user: adminUser,
  });

  await page.goto(`/tastings/${createdTastingId}`);
  await page.getByRole("button", { name: "Actions for Tasting" }).click();
  await page.getByRole("menuitem", { name: "Report tasting" }).click();

  const dialog = page.getByRole("dialog", { name: "Report to moderators" });
  const send = dialog.getByRole("button", { name: "Send report" });
  await expect(send).toBeDisabled();
  await dialog.getByLabel("Reason").selectOption("other");
  await expect(send).toBeDisabled();
  await dialog.getByLabel("Details").fill("Not a real tasting.");
  await send.click();

  await expect(
    page.getByText("Thanks. Moderators will review your report."),
  ).toBeVisible();
  await expect(dialog).toBeHidden();

  await page.goto(`/bottles/${existingBottleId}`);
  await page
    .getByRole("button", { name: "Actions for Bottle actions" })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Report bottle" }),
  ).toBeVisible();

  // The tasting's own author gets Edit and Delete, never Report.
  await signIn(context, {
    accessToken: `${testAccessToken}-report-own-${testInfo.project.name}`,
    user: testUser,
  });
  await page.goto(`/tastings/${createdTastingId}`);
  await page.getByRole("button", { name: "Actions for Tasting" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Edit tasting" }),
  ).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "Report tasting" }),
  ).toHaveCount(0);
});
