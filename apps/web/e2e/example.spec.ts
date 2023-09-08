import { expect, test } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_URL || "http://localhost:3000";

// test.beforeEach(async ({ page }) => {
//   await page.goto('https://demo.playwright.dev/todomvc');
// });

test.describe("login", () => {
  test("can login with username and password", async ({ page }) => {
    await page.goto(`${baseUrl}/login`);

    await page.locator('input[name="email"]').fill("foo@example.com");
    await page.locator('input[name="password"]').fill("foobar");
    await page.locator('button[type="submit"]').press("Enter");

    await page.locator("a[href='/']").click();

    expect(page.url()).toBe(`${baseUrl}/settings`);
  });
});
