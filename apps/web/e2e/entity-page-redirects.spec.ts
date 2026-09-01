import { expect, test } from "@playwright/test";

import {
  replacementSourceEntityId,
  testOwnedEntity,
  testOwner,
} from "./rpc-fixtures.mjs";

test.describe("Entity page routes", () => {
  test.describe.configure({ mode: "serial" });

  test("returns permanent redirects for noncanonical Entity routes", async ({
    request,
  }) => {
    for (const [source, destination] of [
      [`/entities/${testOwner.id}`, `/companies/${testOwner.id}`],
      [`/E${testOwner.id}`, `/companies/${testOwner.id}`],
      [`/brands/${testOwnedEntity.id}`, `/distillers/${testOwnedEntity.id}`],
      [
        `/entities/${replacementSourceEntityId}/edit?source=legacy`,
        `/distillers/${testOwnedEntity.id}/edit?source=legacy`,
      ],
    ]) {
      const response = await request.get(source, { maxRedirects: 0 });

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(destination);
    }
  });

  test("uses the canonical company link and completes client navigation", async ({
    page,
  }) => {
    await page.goto(`/distillers/${testOwnedEntity.id}`);

    const companyLink = page.getByRole("link", { name: "View company" });
    await expect(companyLink).toHaveAttribute(
      "href",
      `/companies/${testOwner.id}`,
    );

    await companyLink.click();

    await expect(page).toHaveURL(`/companies/${testOwner.id}`);
    await expect(
      page.getByRole("heading", { name: testOwner.name, exact: true }),
    ).toBeVisible();
  });
});
