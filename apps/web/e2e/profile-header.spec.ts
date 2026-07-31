import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import { adminUser, moderatorUser, testAccessToken } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const roleProfiles = [
  { label: "Admin", slug: "admin", user: adminUser },
  { label: "Moderator", slug: "moderator", user: moderatorUser },
] as const;

for (const { label, slug, user } of roleProfiles) {
  test(`keeps the ${label} role beneath the profile name`, async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-${slug}-profile-${testInfo.project.name}`,
      user,
    });

    await page.goto(`/users/${user.username}`, { waitUntil: "commit" });

    const username = page.getByRole("heading", { name: user.username });
    const role = page.getByText(label, { exact: true });
    await expect(username).toBeVisible();
    await expect(role).toBeVisible();
    await expect(page.getByText("225", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: `${user.stats.tastings.toLocaleString()} Tastings`,
      }),
    ).toBeVisible();

    const [usernameBox, roleBox] = await Promise.all([
      username.boundingBox(),
      role.boundingBox(),
    ]);
    expect(usernameBox).not.toBeNull();
    expect(roleBox).not.toBeNull();
    expect(roleBox!.y).toBeGreaterThanOrEqual(
      usernameBox!.y + usernameBox!.height,
    );
    expect(
      roleBox!.y - (usernameBox!.y + usernameBox!.height),
    ).toBeLessThanOrEqual(8);

    if (testInfo.project.name.includes("mobile")) {
      expect(
        Math.abs(
          usernameBox!.x +
            usernameBox!.width / 2 -
            (roleBox!.x + roleBox!.width / 2),
        ),
      ).toBeLessThanOrEqual(2);
    } else {
      expect(Math.abs(usernameBox!.x - roleBox!.x)).toBeLessThanOrEqual(2);
    }

    await expectNoHorizontalOverflow(page);

    if (process.env.PEATED_VISUAL_DIR) {
      await page.screenshot({
        path: `${process.env.PEATED_VISUAL_DIR}/peated-profile-${slug}-${testInfo.project.name}.png`,
        fullPage: false,
      });
    }
  });
}
