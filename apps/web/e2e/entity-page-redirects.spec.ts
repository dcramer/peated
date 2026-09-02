import { expect, test } from "./test";

import {
  distilleryBrandBottleId,
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
      [`/entities/${testOwner.id}`, `/companies/${testOwner.id}-diageo`],
      [`/E${testOwner.id}`, `/companies/${testOwner.id}-diageo`],
      [
        `/brands/${testOwnedEntity.id}`,
        `/distillers/${testOwnedEntity.id}-lagavulin-distillery`,
      ],
      [
        `/entities/${replacementSourceEntityId}/edit?source=legacy`,
        `/distillers/${testOwnedEntity.id}-lagavulin-distillery/edit?source=legacy`,
      ],
    ]) {
      const response = await request.get(source, { maxRedirects: 0 });

      expect(response.status()).toBe(308);
      expect(response.headers().location).toBe(destination);
    }
  });

  test("links a Bottle's distillery Brand and its owner to their canonical pages", async ({
    page,
    snapshot,
  }) => {
    await page.goto(`/bottles/${distilleryBrandBottleId}`);

    const brandLink = page
      .getByRole("link", { name: testOwnedEntity.name, exact: true })
      .first();
    const distilleryUrl = `/distillers/${testOwnedEntity.id}-lagavulin-distillery`;
    await expect(brandLink).toHaveAttribute("href", distilleryUrl);
    await brandLink.click();
    await expect(page).toHaveURL(distilleryUrl);

    const companyLink = page.getByRole("link", { name: "View company" });
    await expect(companyLink).toHaveAttribute(
      "href",
      `/companies/${testOwner.id}-diageo`,
    );

    await companyLink.click();

    await expect(page).toHaveURL(`/companies/${testOwner.id}-diageo`);
    await expect(
      page.getByRole("heading", { name: testOwner.name, exact: true }),
    ).toBeVisible();

    const sections = page.getByRole("navigation", {
      name: `${testOwner.name} sections`,
    });
    const bottlesLink = sections.getByRole("link", { name: "Bottles" });
    await expect(bottlesLink).toBeVisible();
    await expect(sections.getByRole("link", { name: "Tastings" })).toHaveCount(
      0,
    );
    await snapshot("Company overview", { ready: sections });

    await bottlesLink.click();
    await expect(page).toHaveURL(`/companies/${testOwner.id}-diageo/bottles`);

    await page.goto(`/companies/${testOwner.id}-diageo/tastings`);
    await expect(page).toHaveURL(`/companies/${testOwner.id}-diageo`);
  });
});
