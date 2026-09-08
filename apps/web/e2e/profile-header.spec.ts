import { expect, test } from "./test";

import { adminUser, testAccessToken, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("keeps account state current across navigation and reload", async ({
  context,
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  // A restored tab can retain signed-out client state after its cookie becomes valid.
  await signIn(context, {
    accessToken: `${testAccessToken}-profile-role-update-${testInfo.project.name}-${testInfo.retry}`,
    user: adminUser,
  });
  await page.getByRole("link", { name: "Sign in" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: "Open account menu" }),
  ).toBeVisible();

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
