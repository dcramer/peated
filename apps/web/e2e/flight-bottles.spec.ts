import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import { expect, test } from "@playwright/test";

import {
  createdFlightBottleFixtureId,
  exactSearchBottle,
  existingBottle,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Flight bottles", () => {
  test("creates a Flight with selected Bottles", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-flight-bottles-${testInfo.project.name}`,
    });

    await page.goto("/addFlight");
    await page.getByLabel("Name").fill("Bottle Flight");
    const bottleSearch = page.getByPlaceholder("Search bottles");

    for (const bottle of [existingBottle, exactSearchBottle]) {
      await bottleSearch.fill("Lagavulin");
      const option = page.getByRole("option", {
        name: formatBottleDisplayName(bottle),
      });
      await option.click();
    }

    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/flights/${createdFlightBottleFixtureId}$`),
    );
  });
});
