import { expect, test } from "./test";

import {
  activityReview,
  createdMemberReview,
  tastingNotes,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("activity feed", () => {
  test("filters activity and keeps review and bottle links independent", async ({
    context,
    page,
    snapshot,
  }) => {
    await signIn(context);
    await page.goto(`/users/${testUser.username}`, {
      waitUntil: "commit",
    });
    const profileFeed = page.getByRole("list", { name: "Member activity" });
    await profileFeed
      .getByRole("link", { name: "View tasting" })
      .first()
      .click();
    await expect(page).toHaveURL(/\/tastings\//);
    await page.goBack({ waitUntil: "commit" });
    await page
      .locator("section")
      .filter({ has: profileFeed })
      .getByRole("link", { name: "View all", exact: true })
      .click();
    await expect(page).toHaveURL(`/users/${testUser.username}/activity`);

    await expect(page.getByText(tastingNotes)).toBeVisible();
    await expect(
      page.getByText("A second tasting from the same session."),
    ).toBeVisible();
    await expect(page.getByText("Personal Favorites")).toHaveCount(0);
    await expect(page.getByRole("img", { name: "Favorite" })).toHaveCount(0);
    await snapshot("Profile / Activity", { ready: profileFeed });
    await profileFeed
      .getByRole("link", { name: "their library", exact: true })
      .click();
    await expect(page).toHaveURL(`/users/${testUser.username}/library`);

    await page.goto("/");
    const homeFeed = page.getByRole("list", {
      name: "Recent activity",
    });
    const homeReview = homeFeed
      .getByRole("listitem")
      .filter({ hasText: activityReview.clip });
    await expect(homeReview).toBeVisible();
    const reviewTitle = await homeReview
      .locator(`a[href^="/bottles/"]`)
      .innerText();
    const bottleHref = await homeReview
      .locator('a[href^="/bottles/"]')
      .getAttribute("href");

    await page
      .locator("section")
      .filter({ has: homeFeed })
      .getByRole("link", { name: "View all" })
      .click();
    await expect(page).toHaveURL(/\/activity$/);
    const feed = page.getByRole("list", {
      name: "Latest activity",
    });

    await expect(
      feed.getByText("A tasting from someone you follow."),
    ).toBeVisible();
    await expect(feed.getByText(activityReview.clip)).toHaveCount(0);

    await page.getByRole("link", { name: "Everyone", exact: true }).click();
    await expect(feed.getByText(activityReview.clip)).toBeVisible();
    await expect(
      feed.getByRole("link", { name: activityReview.site.name, exact: true }),
    ).toHaveAttribute("href", activityReview.url);
    await expect(
      feed.getByText("A tasting from the wider community."),
    ).toBeVisible();
    await expect(feed.getByText(createdMemberReview.notes)).toBeVisible();
    await expect(
      feed.getByRole("link", { name: "Read review", exact: true }),
    ).toHaveAttribute("href", `/reviews/${createdMemberReview.id}`);
    await expect(
      feed.getByText("their library", { exact: true }),
    ).toBeVisible();
    await expect(feed.getByText("Sealed", { exact: true })).toHaveCount(0);
    await expect(
      page
        .getByRole("complementary")
        .getByRole("link", { name: "Add a tasting", exact: true }),
    ).toBeVisible();
    await expect(
      feed.getByRole("link", { name: "Add a tasting", exact: true }),
    ).toHaveCount(0);
    await snapshot("Activity / Everyone", { ready: feed });

    const review = feed
      .getByRole("listitem")
      .filter({ hasText: activityReview.clip });
    const bottleLink = review.locator('a[href^="/bottles/"]');
    await expect(bottleLink).toHaveAttribute("href", bottleHref!);
    await expect(review.locator(`a[href^="/bottles/"]`)).toHaveText(
      reviewTitle,
    );
    await bottleLink.click();
    await expect(page).toHaveURL(/\/bottles\//);

    await page.goBack();
    await page.route(activityReview.url, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>Full whisky review</h1>",
      }),
    );
    await review
      .getByRole("link", {
        name: `Read at ${activityReview.site.name} ↗`,
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(activityReview.url);
  });
});
