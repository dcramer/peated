import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import { testOwnedEntity, testOwner } from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("shows Entity kind, owner, browse, and form fields", async ({
  context,
  page,
}) => {
  await signIn(context);

  await page.goto("/addEntity?kind=distillery", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { name: "Add Entity" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Distillery" })).toBeVisible();
  await expect(page.getByText("Owned by", { exact: true })).toBeVisible();
  await expect(page.getByText("Search all Entities")).toBeVisible();

  await page.goto("/distillers");
  await expect(
    page.getByRole("link", { name: testOwnedEntity.name }),
  ).toBeVisible();

  await page.goto(`/distillers/${testOwnedEntity.id}`);
  await expect(
    page.getByRole("heading", { name: testOwnedEntity.name }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "distillery" })).toBeVisible();
  await expect(page.getByText("Owned by")).toContainText(testOwner.name);

  await page.goto(`/companies/${testOwner.id}`);
  await expect(
    page.getByRole("heading", { name: "Owned Entities" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: testOwnedEntity.name }),
  ).toBeVisible();
});

test("keeps owner details usable on mobile @mobile", async ({ page }) => {
  await page.goto(`/companies/${testOwner.id}`);

  await expect(
    page.getByRole("heading", { name: testOwner.name }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: testOwnedEntity.name }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
