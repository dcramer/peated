import { expect, test } from "./test";

import { adminUser, testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("updates the profile actions after an administrator changes the moderator role", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: `${testAccessToken}-profile-role-update-${testInfo.project.name}-${testInfo.retry}`,
    user: adminUser,
  });

  await page.goto(`/users/${testUser.username}/activity`);
  const profileActions = page.getByRole("button", {
    name: `Actions for ${testUser.username}`,
  });
  await profileActions.click();
  await page.getByRole("menuitem", { name: "Add moderator role" }).click();

  const removeModeratorRole = page.getByRole("menuitem", {
    name: "Remove moderator role",
  });
  await profileActions.click();
  await expect(removeModeratorRole).toBeVisible();
  await page.reload();
  await profileActions.click();
  await expect(removeModeratorRole).toBeVisible();
});
