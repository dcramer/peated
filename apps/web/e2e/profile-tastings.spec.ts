import { testUser } from "./rpc-fixtures.mjs";
import { signIn } from "./session";
import { expect, test } from "./test";

test("loads the profile Tastings tab and answers its search", async ({
  context,
  page,
}) => {
  await signIn(context);
  await page.goto(`/users/${testUser.username}/tastings`);

  await expect(
    page.getByRole("heading", { name: "No tastings yet" }),
  ).toBeVisible();

  await page
    .getByRole("searchbox", { name: "Find in these tastings" })
    .filter({ visible: true })
    .fill("Lag");

  await expect(
    page.getByText("No brands, producers, or bottles in these tastings match."),
  ).toBeVisible();
});
