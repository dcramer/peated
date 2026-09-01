import { expect, test } from "@playwright/test";

import {
  bottleGroupRepresentative,
  priceSite,
  testOwnedEntity,
  testOwner,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

const publicRoutes = [
  ["home", "/"],
  ["Bottle releases", `/bottles/${bottleGroupRepresentative.id}/releases`],
  ["distillers", "/distillers"],
  ["distillery", `/distillers/${testOwnedEntity.id}`],
  ["company", `/companies/${testOwner.id}`],
] as const;

for (const [name, path] of publicRoutes) {
  test(`${name} route loads`, async ({ page }) => {
    const response = await page.goto(path, { waitUntil: "commit" });

    expect(response?.status()).toBeLessThan(400);
  });
}

test("Add Entity route loads for a signed-in member", async ({
  context,
  page,
}) => {
  await signIn(context);

  const response = await page.goto("/addEntity?kind=distillery", {
    waitUntil: "commit",
  });

  expect(response?.status()).toBeLessThan(400);
});

test(
  "mobile navigation opens and reaches the bottle catalog",
  { tag: "@mobile" },
  async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("navigation", {
      name: "Mobile navigation",
    });

    await expect(navigation).toBeVisible();
    await navigation.getByRole("link", { name: "Bottles" }).click();
    await expect(page).toHaveURL(/\/bottles$/);
  },
);

test("site administration route loads for an administrator", async ({
  context,
  page,
}) => {
  await signIn(context, { user: { ...testUser, admin: true } });

  const response = await page.goto(`/admin/sites/${priceSite.type}`, {
    waitUntil: "commit",
  });

  expect(response?.status()).toBeLessThan(400);
});
