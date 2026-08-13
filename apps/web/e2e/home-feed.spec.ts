import { expect, test } from "@playwright/test";

import { homeBottle } from "./rpc-fixtures.mjs";

test("home feed favors recognizable bottle names over exact release names", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "commit" });

  await expect(page.getByText(homeBottle.group.fullName).first()).toBeVisible();
  await expect(
    page.getByText(homeBottle.fullName, { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByTitle(homeBottle.fullName).first()).toBeVisible();
  await expect(page.getByText("Single Cask", { exact: true })).toHaveCount(0);
});
