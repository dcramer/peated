import { expect, test } from "@playwright/test";

test("search settles after one request", async ({ page }) => {
  let searchRequestCount = 0;
  let searchRequestBody: unknown;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith("/rpc/search")) {
      searchRequestCount += 1;
      searchRequestBody = request.postDataJSON();
    }
  });

  await page.goto("/search?q=playwright+search", { waitUntil: "commit" });

  await expect(
    page.getByRole("link", { name: "Can't find a bottle?" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 });

  expect(searchRequestCount).toBe(1);
  expect(searchRequestBody).toEqual({
    json: {
      query: "playwright search",
      limit: 50,
      scopes: [
        "bottles",
        "distillers",
        "brands",
        "bottlers",
        "blenders",
        "companies",
      ],
    },
  });
});
