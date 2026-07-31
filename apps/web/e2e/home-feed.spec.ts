import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import { homeAwards, homeBottle, tastingNotes } from "./rpc-fixtures.mjs";

test("home feed favors recognizable bottle names over exact release names", async ({
  page,
}, testInfo) => {
  await page.goto("/", { waitUntil: "commit" });

  await expect(page.getByText(homeBottle.group.fullName).first()).toBeVisible();
  await expect(
    page.getByText(homeBottle.fullName, { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTitle(homeBottle.fullName).first()).toBeVisible();
  await expect(page.getByText(tastingNotes)).toBeVisible();
  await expect(page.getByText("Single Cask", { exact: true })).toHaveCount(0);

  const tastingCard = page
    .locator("li")
    .filter({ hasText: tastingNotes })
    .first();
  const [bottleNameBox, notesBox, ratingBox] = await Promise.all([
    tastingCard
      .getByRole("link", { name: homeBottle.group.fullName })
      .boundingBox(),
    tastingCard.getByText(tastingNotes, { exact: true }).boundingBox(),
    tastingCard.getByText("Rating", { exact: true }).boundingBox(),
  ]);
  expect(bottleNameBox).not.toBeNull();
  expect(notesBox).not.toBeNull();
  expect(ratingBox).not.toBeNull();
  expect(
    notesBox!.y - (bottleNameBox!.y + bottleNameBox!.height),
  ).toBeLessThanOrEqual(12);
  expect(ratingBox!.y - (notesBox!.y + notesBox!.height)).toBeLessThanOrEqual(
    12,
  );

  const awardRows = homeAwards.map((award) =>
    page.getByTitle(award.badge.name, { exact: true }),
  );
  await expect(awardRows[0]).toBeVisible();
  await expect(awardRows[1]).toBeVisible();
  const [firstAwardBox, secondAwardBox] = await Promise.all(
    awardRows.map((row) => row.boundingBox()),
  );
  expect(firstAwardBox).not.toBeNull();
  expect(secondAwardBox).not.toBeNull();
  expect(
    secondAwardBox!.y - (firstAwardBox!.y + firstAwardBox!.height),
  ).toBeLessThanOrEqual(1);

  await expectNoHorizontalOverflow(page);
  if (process.env.PEATED_VISUAL_DIR) {
    await page.screenshot({
      path: `${process.env.PEATED_VISUAL_DIR}/peated-home-page-${testInfo.project.name}.png`,
      fullPage: false,
    });
    await page.locator("ul.mt-1").screenshot({
      path: `${process.env.PEATED_VISUAL_DIR}/peated-home-${testInfo.project.name}.png`,
    });
  }
});
