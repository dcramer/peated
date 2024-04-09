import { db } from "@peated/server/db";
import { collectionBottles } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { createCaller } from "@peated/server/trpc/router";
import { eq } from "drizzle-orm";

test("requires auth", async () => {
  const caller = createCaller({
    user: null,
  });
  const err = await waitError(
    caller.collectionBottleDelete({
      user: "me",
      collection: "default",
      bottle: 1,
    }),
  );
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});

test("delete bottle in default", async ({ fixtures, defaults }) => {
  const bottle = await fixtures.Bottle();

  const caller = createCaller({
    user: defaults.user,
  });
  await caller.collectionBottleDelete({
    user: "me",
    collection: "default",
    bottle: bottle.id,
  });

  const bottleList = await db
    .select()
    .from(collectionBottles)
    .where(eq(collectionBottles.bottleId, bottle.id));

  expect(bottleList.length).toBe(1);
});
