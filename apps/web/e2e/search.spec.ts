import { mockApiServer } from "./rpc-fixtures.mjs";
import { expect, test } from "./test";

test.describe("Search", () => {
  test("shows an empty result before loading a possible match", async ({
    page,
    request,
  }) => {
    await request.post(`${mockApiServer}/__test/search-suggestions/hold`);
    try {
      await page.goto("/search?intent=choose&q=playwright%20typo");

      await expect(
        page.getByText("Nothing matches “playwright typo”.", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Did you mean?" }),
      ).toHaveCount(0);
    } finally {
      await request.post(`${mockApiServer}/__test/search-suggestions/resume`);
    }

    await expect(
      page.getByRole("region", { name: "Did you mean?" }),
    ).toBeVisible();
  });
});
