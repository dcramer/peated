import { expect, test } from "@playwright/test";

import { adminUser, testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("refreshes the profile after an administrator changes the moderator role", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: `${testAccessToken}-profile-role-update-${testInfo.project.name}`,
    user: adminUser,
  });

  await page.goto(`/users/${testUser.username}/activity`, {
    waitUntil: "commit",
  });
  await page.getByRole("button", { name: "Manage user" }).click();
  await page.getByRole("menuitem", { name: "Add Moderator Role" }).click();

  const moderatorRole = page
    .getByRole("main")
    .getByText("Moderator", { exact: true });
  await expect(moderatorRole).toBeVisible();
  await page.reload();
  await expect(moderatorRole).toBeVisible();
});
