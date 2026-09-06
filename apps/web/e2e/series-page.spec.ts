import { expect, test } from "./test";

const seriesUrl = "/series/9401-lagavulin-special-releases";

test("shows a Series flavor profile", async ({ page, snapshot }) => {
  await page.goto(seriesUrl);

  await expect(
    page.getByRole("heading", { name: "Special Releases", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Peated ID", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Flavor categories" }),
  ).toBeVisible();

  await snapshot("Series / Desktop", {
    ready: page.getByRole("group", { name: "Flavor categories" }),
  });
});

test("stacks the Series flavor profile on mobile @mobile", async ({
  page,
  snapshot,
}) => {
  await page.goto(seriesUrl);

  await expect(
    page.getByRole("group", { name: "Flavor categories" }),
  ).toBeVisible();

  await snapshot("Series / Mobile", {
    ready: page.getByRole("group", { name: "Flavor categories" }),
  });
});
