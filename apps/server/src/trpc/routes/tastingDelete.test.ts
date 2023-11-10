import { db } from "@peated/server/db";
import { bottleTags, tastings } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import * as Fixtures from "../../lib/test/fixtures";
import { appRouter } from "../router";

test("requires authentication", async () => {
  const caller = appRouter.createCaller({ user: null });
  expect(() => caller.tastingDelete(1)).rejects.toThrowError(/UNAUTHORIZED/);
});

test("delete own tasting", async () => {
  const tasting = await Fixtures.Tasting({
    createdById: DefaultFixtures.user.id,
    tags: ["spiced", "caramel"],
  });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
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

test("cannot delete others tasting", async () => {
  const user = await Fixtures.User();
  const tasting = await Fixtures.Tasting({ createdById: user.id });

  const caller = appRouter.createCaller({ user: DefaultFixtures.user });
  expect(() => caller.tastingDelete(tasting.id)).rejects.toThrowError(
    /Cannot delete another user's tasting/,
  );
});
