import { expect, test } from "./test";

const seriesUrl = "/series/9401-lagavulin-special-releases";

test("shows a Series rating and flavor profile", async ({ page, snapshot }) => {
  await page.goto(seriesUrl);

  await expect(
    page.getByRole("heading", { name: "Special Releases", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Peated ID", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Series rating")).toContainText("91");
  await expect(page.getByLabel("Series rating")).toContainText("Outstanding");
  await expect(
    page.getByRole("group", { name: "Flavor categories" }),
  ).toBeVisible();

  await snapshot("Series / Desktop", {
    ready: page.getByRole("group", { name: "Flavor categories" }),
  });
});

test("stacks Series insights on mobile @mobile", async ({ page, snapshot }) => {
  await page.goto(seriesUrl);

  await expect(page.getByLabel("Series rating")).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Flavor categories" }),
  ).toBeVisible();

  await snapshot("Series / Mobile", {
    ready: page.getByRole("group", { name: "Flavor categories" }),
  });
});
