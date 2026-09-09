import { expect, test } from "./test";

import { bottleHrefSelector } from "./assertions";
import {
  bottleGroupMembers,
  bottleGroupRepresentative,
  mockApiServer,
  testOwnedEntity,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";

test("bottle releases stream new pages without replacing the bottle header", async ({
  page,
  request,
}, testInfo) => {
  await page.goto(`/bottles/${bottleGroupRepresentative.id}/releases`);
  const releases = page.getByRole("list", { name: "Bottle releases" });
  await expect(releases).toBeVisible();
  const heading = page.getByRole("heading", { level: 1 });
  const title = await heading.textContent();
  const next = page
    .getByRole("navigation", { name: "Release pages" })
    .locator('a[rel="next"]');
  const nextHref = await next.getAttribute("href");
  expect(nextHref).toBeTruthy();
  const navigation = `**${nextHref}*`;
  let releaseNavigation!: () => void;
  const navigationReady = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  await page.route(navigation, async (route) => {
    await navigationReady;
    await route.continue();
  });
  await request.post(`${mockApiServer}/__test/release-pages/hold`);
  try {
    await next.click();
    await expect(next.getByRole("status")).toHaveText("Loading…");
    await expect(releases).toBeVisible();
    releaseNavigation();
    await expect(
      page.getByRole("status", { name: "Loading releases", exact: true }),
    ).toBeVisible();
    await expect(heading).toHaveText(title!);
    await expect(
      page.getByRole("heading", { name: "Releases", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("release-page-loading.png"),
    });
  } finally {
    releaseNavigation();
    await request.post(`${mockApiServer}/__test/release-pages/resume`);
    await page.unroute(navigation);
  }
  await expect(page).toHaveURL(nextHref!);
  await expect(
    releases.locator(bottleHrefSelector(bottleGroupMembers[1]!.id)),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading releases", exact: true }),
  ).toHaveCount(0);
});

test("distillers filters keep controls responsive while results update", async ({
  page,
}) => {
  await page.goto("/distillers?cursor=2");
  const producer = page.getByRole("link", {
    name: testOwnedEntity.name,
    exact: true,
  });
  await expect(producer).toBeVisible();
  const sort = page.getByRole("combobox", { name: "Sort distillers" });
  const navigation = "**/distillers?country=japan*";
  let releaseNavigation!: () => void;
  const navigationReady = new Promise<void>((resolve) => {
    releaseNavigation = resolve;
  });
  await page.route(navigation, async (route) => {
    await navigationReady;
    await route.continue();
  });
  try {
    const country = page.getByRole("button", { name: "Japan", exact: true });
    await country.click();
    await expect(country).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("status").filter({ hasText: "Updating…" }),
    ).toBeVisible();
    await expect(producer).toBeVisible();
    await sort.selectOption({ label: "Name" });
    await expect(sort).toHaveValue("name");
  } finally {
    releaseNavigation();
  }
  await expect(page).toHaveURL("/distillers?country=japan&sort=name");
  await expect(
    page.getByRole("heading", { name: "No distillers found" }),
  ).toBeVisible();
  await expect(sort).toBeVisible();
  await page.unroute(navigation);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page).toHaveURL("/distillers?sort=name");
  await expect(producer).toBeVisible();
});

test(
  "mobile navigation opens the bottle table and its controls",
  { tag: "@mobile" },
  async ({ context, page }) => {
    await signIn(context);
    await page.goto("/");

    await page.getByRole("button", { name: "Open navigation" }).click();
    const navigation = page.getByRole("navigation", {
      name: "Mobile navigation",
    });

    await expect(navigation).toBeVisible();
    const bottles = navigation.getByRole("link", { name: "Bottles" });
    await expect(bottles).toHaveAttribute("href", "/bottles");
    await bottles.click();

    const trigger = page.getByRole("button", {
      name: "Search, filters, and sort",
    });
    await expect(trigger).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Sort bottles" }),
    ).toBeHidden();

    await trigger.focus();
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Search, filters, and sort",
    });
    await expect(
      dialog.getByRole("heading", { name: "Search, filters, and sort" }),
    ).toBeVisible();
    await expect
      .poll(() =>
        dialog.evaluate((element) => element.contains(document.activeElement)),
      )
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog
      .getByRole("button", { name: "Single Malt", exact: true })
      .click();
    await expect(page).toHaveURL("/bottles?category=single_malt");
    await expect(
      dialog.getByRole("heading", { name: "Search, filters, and sort" }),
    ).toBeVisible();
    await dialog
      .getByRole("combobox", { name: "Sort bottles" })
      .selectOption({ label: "Bottle name" });
    await expect(page).toHaveURL("/bottles?category=single_malt&sort=name");
    await dialog.getByRole("button", { name: "View results" }).click();

    const activeTrigger = page.getByRole("button", {
      name: "Search, filters, and sort, 1 active filter",
    });
    await expect(activeTrigger).toBeVisible();
    await page.reload();
    await expect(activeTrigger).toBeVisible();

    await activeTrigger.click();
    await page
      .getByRole("dialog", { name: "Search, filters, and sort" })
      .getByRole("button", { name: "Clear filters" })
      .click();
    await expect(page).toHaveURL("/bottles?sort=name");

    await page.goto("/following");
    const followingTrigger = page.getByRole("button", {
      name: "Search, filters, and sort",
    });
    await expect(followingTrigger).toBeVisible();
    await followingTrigger.click();
    const followingControls = page.getByRole("dialog", {
      name: "Search, filters, and sort",
    });
    await expect(
      followingControls.getByRole("button", { name: "Distillers" }),
    ).toBeVisible();
    await expect(
      followingControls.getByRole("combobox", { name: "Sort results" }),
    ).toBeVisible();
  },
);
