import { expect, test } from "@playwright/test";

import {
  bottleGroupRepresentative,
  homeBottle,
  testBottler,
  testOwnedEntity,
} from "./rpc-fixtures.mjs";

test("switches between distillery releases and other bottlings", async ({
  page,
}) => {
  await page.goto(`/distillers/${testOwnedEntity.id}/bottles`);

  await expect(
    page.getByRole("link", { name: bottleGroupRepresentative.fullName }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Other bottlings" }).click();

  await expect(page).toHaveURL(/\/bottles\?view=other$/);
  await expect(
    page.getByRole("link", { name: homeBottle.group.fullName }),
  ).toBeVisible();
  await expect(page.getByText(`Bottled by ${testBottler.name}`)).toBeVisible();
});
