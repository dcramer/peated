import { existingBottle, priceSite, testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";
import { expect, test } from "./test";

test("moderator previews and saves score rules; readers keep the original score", async ({
  context,
  page,
  snapshot,
}) => {
  await signIn(context, {
    accessToken: "review-scoring-setup",
    user: { ...testUser, admin: true, mod: true },
  });
  const settingsUrl = `/admin/sites/${priceSite.type}`;
  await page.goto(settingsUrl);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Use this site's scores").selectOption("include");
  await page
    .getByRole("button", { name: "Add another scale", exact: true })
    .click();
  await page.getByLabel("Site scores are out of").fill("5");
  await page
    .getByLabel("Site's scoring guide")
    .fill("https://example.com/scoring");
  await page
    .getByLabel("Why this comparison is fair")
    .fill(
      "Fictional guide for this browser test: 3 is very good; 4 is outstanding.",
    );
  await page.getByLabel("Site score 1", { exact: false }).fill("3");
  await page.getByLabel("Peated score 1", { exact: false }).fill("82");
  await page.getByLabel("Site score 2", { exact: false }).fill("4");
  await page.getByLabel("Peated score 2", { exact: false }).fill("90");
  await page.getByRole("button", { name: "Preview changes" }).click();
  await expect(
    page.getByRole("cell", { name: "3.5/5", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "86", exact: true }),
  ).toBeVisible();
  await snapshot("Admin/Review score setup/Preview", {
    ready: page.getByRole("button", { name: "Save score settings" }),
  });
  await page.getByRole("button", { name: "Save score settings" }).click();
  await expect(
    page.getByRole("button", { name: "Save score settings" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Site scores are out of")).toHaveValue("5");
  await page.goto(`/bottles/${existingBottle.id}`);
  await expect(
    page.getByLabel(`${priceSite.name} score 3.5 out of 5`),
  ).toBeVisible();
  await expect(
    page.getByText("Counts as an estimated 86/100 in the bottle score.", {
      exact: false,
    }),
  ).toBeVisible();
  await snapshot("Bottles/Original critic score", {
    ready: page.getByLabel(`${priceSite.name} score 3.5 out of 5`),
  });
});
