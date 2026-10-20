import { tastingPathPattern } from "./assertions";
import {
  createdTastingId,
  tastingDraftHint,
  tastingDraftNotes,
  testAccessToken,
} from "./rpc-fixtures.mjs";
import { signIn } from "./session";
import { expect, test } from "./test";

test("finishes a draft by confirming its Bottle and posting it", async ({
  context,
  page,
  snapshot,
}, testInfo) => {
  // Posting removes the mock draft, so each attempt needs its own token.
  await signIn(context, {
    accessToken: `${testAccessToken}-tasting-draft-${testInfo.project.name}-${testInfo.retry}`,
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page.getByRole("menuitem", { name: /^Drafts/ }).click();

  await expect(page).toHaveURL("/drafts");
  const draftLink = page.getByRole("link", { name: tastingDraftHint });
  await snapshot("Drafts / 1 Inbox", { ready: draftLink });
  await draftLink.click();

  const useBottle = page.getByRole("button", { name: "Use this bottle" });
  await snapshot("Drafts / 2 Suggested bottle", { ready: useBottle });
  await useBottle.click();

  const notes = page.getByLabel("What stood out?");
  await notes.fill(tastingDraftNotes);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const rating = page
    .getByRole("radiogroup", { name: "How was it" })
    .getByRole("radio", { name: /^Very good/ });
  await rating.locator("..").click();
  await expect(rating).toBeChecked();
  await page.getByRole("button", { name: "Post" }).click();

  await expect(page).toHaveURL(tastingPathPattern(createdTastingId));
});
