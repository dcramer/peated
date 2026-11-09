import { testAccessToken } from "./rpc-fixtures.mjs";
import { signIn } from "./session";
import { expect, test } from "./test";

test("sends a member whose session the API rejects to sign in from a server-rendered page", async ({
  context,
  page,
}) => {
  await signIn(context, {
    accessToken: `${testAccessToken}-session-rejected`,
  });
  await page.goto("/drafts");

  await expect(page).toHaveURL(/\/login\?redirectTo=%2Fdrafts$/);
});
