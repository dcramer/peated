import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  createdFlightBottleFixtureId,
  exactSearchBottle,
  existingBottle,
  flightBottleFixtureId,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Flight bottles", () => {
  test("shows each specific Bottle with its own tasting action", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-flight-bottles-${testInfo.project.name}`,
    });

    await page.goto(`/flights/${flightBottleFixtureId}`);

    for (const bottle of [existingBottle, exactSearchBottle]) {
      const bottleRow = page.getByRole("row").filter({
        has: page.getByRole("link", {
          name: bottle.fullName,
          exact: true,
        }),
      });
      await expect(bottleRow).toBeVisible();
      await expect(
        bottleRow.getByRole("link", { name: "Log Tasting" }),
      ).toHaveAttribute(
        "href",
        `/addBottle?bottle=${bottle.id}&flight=${flightBottleFixtureId}&intent=tasting`,
      );
    }
    await expect(page.getByText("Exact bottle not specified")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("creates and views a Flight containing selected Bottles", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-flight-bottles-${testInfo.project.name}`,
    });

    await page.goto("/addFlight");
    await page.getByLabel("Name").fill("Bottle Flight");
    await page.getByRole("group").getByText("Bottles", { exact: true }).click();
    await page.getByPlaceholder("Search").fill("Lagavulin");

    for (const bottle of [existingBottle, exactSearchBottle]) {
      const option = page.getByRole("button", {
        name: bottle.fullName,
        exact: true,
      });
      await expect(option).toBeVisible();
      await option.click();
    }
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByText(existingBottle.fullName)).toBeVisible();
    await expect(page.getByText(exactSearchBottle.fullName)).toBeVisible();
    await expect(page.getByText("Exact bottle not specified")).toHaveCount(0);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/flights/${createdFlightBottleFixtureId}$`),
    );
    await expect(
      page.getByRole("link", {
        name: existingBottle.fullName,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: exactSearchBottle.fullName,
        exact: true,
      }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
