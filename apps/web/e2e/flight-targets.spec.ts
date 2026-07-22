import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  bottleGroupTarget,
  createdFlightTargetFixtureId,
  existingBottle,
  flightTargetFixtureId,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test.describe("Flight catalog targets", () => {
  test("keeps generic Log Tasting available at desktop and mobile widths", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-flight-targets-${testInfo.project.name}`,
    });

    await page.goto(`/flights/${flightTargetFixtureId}`);

    const genericRow = page.getByRole("row").filter({
      has: page.getByRole("link", {
        name: bottleGroupTarget.group.fullName,
      }),
    });
    await expect(
      genericRow.getByText("Exact bottle not specified", { exact: true }),
    ).toBeVisible();
    const tastingLink = genericRow.getByRole("link", { name: "Log Tasting" });
    await expect(tastingLink).toHaveCount(1);
    await expect(tastingLink).toHaveAttribute(
      "href",
      `/addBottle?group=${bottleGroupTarget.group.id}&flight=${flightTargetFixtureId}&intent=tasting`,
    );
    await expectNoHorizontalOverflow(page);
  });

  test("labels exact and generic options and submits only target IDs", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: `${testAccessToken}-flight-targets-${testInfo.project.name}`,
    });

    await page.goto("/addFlight");
    await page.getByLabel("Name").fill("Target-aware Flight");
    await page.getByRole("group").getByText("Bottles", { exact: true }).click();
    await page.getByPlaceholder("Search").fill("Lagavulin");

    const exactOption = page.getByRole("button", {
      name: `${existingBottle.fullName} Exact bottle`,
    });
    const genericOption = page.getByRole("button", {
      name: `${bottleGroupTarget.group.fullName} Exact bottle not specified`,
    });
    await expect(exactOption).toBeVisible();
    await expect(genericOption).toBeVisible();
    await exactOption.click();
    await genericOption.click();
    await page.getByRole("button", { name: "Done" }).click();

    await expect(page.getByText("Exact bottle", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Exact bottle not specified", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/flights/${createdFlightTargetFixtureId}$`),
    );
  });
});
