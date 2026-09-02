import { expect, test } from "./test";

import { activityReview, tastingNotes, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("activity feed", () => {
  test("filters activity and keeps review and bottle links independent", async ({
    context,
    page,
    snapshot,
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

    await page.goto("/activity");
    const feed = page.getByRole("list", {
      name: "Latest tastings and reviews",
    });

    await expect(
      feed.getByText("A tasting from someone you follow."),
    ).toBeVisible();
    await expect(feed.getByText(activityReview.clip)).toHaveCount(0);

    await page.getByRole("link", { name: "Everyone", exact: true }).click();
    await expect(feed.getByText(activityReview.clip)).toBeVisible();
    await expect(
      feed.getByText(activityReview.site.name, { exact: false }),
    ).toBeVisible();
    await expect(
      feed.getByText("A tasting from the wider community."),
    ).toBeVisible();
    await snapshot("Activity / Everyone", { ready: feed });

    const review = feed
      .getByRole("listitem")
      .filter({ hasText: activityReview.clip });
    const bottleLink = review.getByRole("link", { name: "View bottle" });
    await expect(bottleLink).toHaveAttribute("href", /^\/bottles\//);
    await bottleLink.click();
    await expect(page).toHaveURL(/\/bottles\//);

    await page.goBack();
    await page.route(activityReview.url, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Full whisky review</h1>",
      }),
    );
    await review.locator(`a[href="${activityReview.url}"]`).click();
    await expect(page).toHaveURL(activityReview.url);
  });
});
