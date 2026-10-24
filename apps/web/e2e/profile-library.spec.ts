import { bottleHrefSelector } from "./assertions";
import {
  existingBottle,
  testAccessToken,
  testBrand,
  testUser,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";
import { expect, type Page, test, type TestInfo } from "./test";

test.describe("profile Library", () => {
  test("saves a Bottle, updates its status, and removes it", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "library-status"),
    });
    await addBottleToLibrary(page);

    await page.goto(`/users/${testUser.username}/library`);
    const bottle = libraryBottleRow(page);
    await bottle.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Mark as sealed" }).click();

    await expect(bottle.getByText("Sealed")).toBeVisible();
    await page.reload();
    const savedBottle = libraryBottleRow(page);
    await expect(savedBottle.getByText("Sealed")).toBeVisible();

    await savedBottle.getByRole("button", { name: /^Actions for / }).click();
    await page.getByRole("menuitem", { name: "Remove from library" }).click();

    await expect(savedBottle).toHaveCount(0);
  });

  test("sorts the Library and filters it by a suggested producer", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, {
      accessToken: uniqueAccessToken(testInfo, "library-sort"),
    });
    await addBottleToLibrary(page);
    await page.goto(`/users/${testUser.username}/library?cursor=2`);

    const sort = page.getByRole("combobox", { name: "Sort bottles" });
    await sort.selectOption({ label: "Recently added" });

    await expect(page).toHaveURL(
      `/users/${testUser.username}/library?sort=-created`,
    );
    await expect(sort).toHaveValue("-created");
    await expect(libraryBottleLink(page)).toBeVisible();

    const search = page
      .getByRole("searchbox", { name: "Find in this library" })
      .filter({ visible: true });
    await search.fill(testBrand.name.slice(0, 4));
    await expect(
      page
        .getByRole("region", { name: "Search results" })
        .getByRole("link", { name: testBrand.name, exact: true }),
    ).toBeVisible();
    await search.press("Enter");

    await expect(page).toHaveURL(
      `/users/${testUser.username}/library?sort=-created&entity=${testBrand.id}`,
    );
    await expect(libraryBottleLink(page)).toBeVisible();
  });
});

async function addBottleToLibrary(page: Page) {
  await page.goto(`/addBottle?bottle=${existingBottle.id}`);
  await page.getByRole("button", { name: "Add to Library" }).click();
  await expect(
    page.getByRole("heading", { name: "Added to Library" }),
  ).toBeVisible();
}

function uniqueAccessToken(testInfo: TestInfo, suffix: string) {
  return [
    testAccessToken,
    suffix,
    testInfo.project.name,
    `w${testInfo.workerIndex}`,
    `r${testInfo.retry}`,
  ].join("-");
}

function libraryBottleLink(page: Page) {
  return page.locator(bottleHrefSelector(existingBottle.id)).first();
}

function libraryBottleRow(page: Page) {
  return page
    .locator("li")
    .filter({ has: page.locator(bottleHrefSelector(existingBottle.id)) })
    .filter({ visible: true });
}
