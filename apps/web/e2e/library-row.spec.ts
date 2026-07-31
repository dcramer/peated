import { expect, test } from "@playwright/test";

import { expectNoHorizontalOverflow } from "./assertions";
import {
  destinationBottleGroup,
  existingBottle,
  homeBottle,
  testAccessToken,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("library shows only useful release details on one line", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, {
    accessToken: `${testAccessToken}-visual-library-${testInfo.project.name}`,
  });

  await page.goto(`/bottles/${homeBottle.id}`, { waitUntil: "commit" });
  const homeLibraryButton = page.locator(
    'button[data-collection-action="library"]',
  );
  await homeLibraryButton.click();
  await expect(homeLibraryButton).toHaveAttribute("aria-pressed", "true");

  await page.goto(`/bottles/${existingBottle.id}`, { waitUntil: "commit" });
  const existingLibraryButton = page.locator(
    'button[data-collection-action="library"]',
  );
  await existingLibraryButton.click();
  await expect(existingLibraryButton).toHaveAttribute("aria-pressed", "true");

  await page.goto(`/users/${testUser.username}/library`, {
    waitUntil: "commit",
  });

  const row = page
    .getByTitle(homeBottle.fullName, { exact: true })
    .first()
    .locator("xpath=ancestor::tr");
  await expect(row).toBeVisible();
  await expect(
    row.getByRole("link", { name: homeBottle.group.name, exact: true }),
  ).toBeVisible();
  await expect(
    row.getByText(homeBottle.brand.name, { exact: true }),
  ).toBeVisible();

  const metadata = row.locator(".text-muted.mt-1.block.truncate");
  await expect(metadata).toBeVisible();
  await expect(metadata).toHaveCSS("white-space", "nowrap");
  await expect(metadata).toHaveText("Pedro Ximenez cask·55.8% ABV");
  await expect(row.getByText("Single Malt", { exact: true })).toHaveCount(0);

  const nameOnlyRow = page
    .getByRole("link", { name: destinationBottleGroup.name, exact: true })
    .first()
    .locator("xpath=ancestor::tr");
  await expect(nameOnlyRow).toBeVisible();
  await expect(
    nameOnlyRow.getByRole("link", {
      name: destinationBottleGroup.name,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    nameOnlyRow.locator(".text-muted.mt-1.block.truncate"),
  ).toHaveCount(0);
  await expect(
    nameOnlyRow.getByText("Single Malt", { exact: true }),
  ).toHaveCount(0);

  await expectNoHorizontalOverflow(page);
  if (process.env.PEATED_VISUAL_DIR) {
    await page.addStyleTag({
      content: "body { padding-bottom: 300px !important; }",
    });
    const table = page.locator("table");
    await table.evaluate((element) => {
      element.scrollIntoView({ block: "center" });
    });
    await table.screenshot({
      path: `${process.env.PEATED_VISUAL_DIR}/peated-library-${testInfo.project.name}.png`,
    });
  }
});
