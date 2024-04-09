import { db } from "@peated/server/db";
import { bottleTags, tastings } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { createCaller } from "../router";

test("requires authentication", async () => {
  const caller = createCaller({ user: null });
  const err = await waitError(caller.tastingDelete(1));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("delete own tasting", async ({ defaults, fixtures }) => {
  const tasting = await fixtures.Tasting({
    createdById: defaults.user.id,
    tags: ["spiced", "caramel"],
  });

  const caller = createCaller({ user: defaults.user });
  await caller.tastingDelete(tasting.id);

  const [newTasting] = await db
    .select()
    .from(tastings)
    .where(eq(tastings.id, tasting.id));
  expect(newTasting).toBeUndefined();

  const tags = await db
    .select()
    .from(bottleTags)
    .where(eq(bottleTags.bottleId, tasting.bottleId));

  expect(tags.length).toBe(2);
  for (const tag of tags) {
    expect(tag.count).toBe(0);
  }
});

test("cannot delete others tasting", async ({ defaults, fixtures }) => {
  const user = await fixtures.User();
  const tasting = await fixtures.Tasting({ createdById: user.id });

  const caller = createCaller({ user: defaults.user });
  const err = await waitError(caller.tastingDelete(tasting.id));
  expect(err).toMatchInlineSnapshot(
    `[TRPCError: Cannot delete another user's tasting.]`,
  );
});
