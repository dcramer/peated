import { expect, test } from "./test";

import { tastingNotes, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("activity feed", () => {
  test("loads another page when Favorites hide the first page", async ({
    context,
    page,
  }) => {
    await signIn(context);
    await page.goto(`/users/${testUser.username}/activity`, {
      waitUntil: "commit",
    });

    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(
      page.getByText("A second tasting from the same session."),
    ).toBeVisible();
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
  });
});
