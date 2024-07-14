import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { createCaller } from "../router";

test("deletes alias", async ({ fixtures }) => {
  const user = await fixtures.User({ mod: true });
  const bottle = await fixtures.Bottle();
  const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

  const review = await fixtures.Review({
    bottleId: bottle.id,
    name: alias.name,
  });
  const storePrice = await fixtures.StorePrice({
    bottleId: bottle.id,
    name: alias.name,
  });

  const caller = createCaller({ user });
  const data = await caller.bottleAliasDelete(alias.name);
  expect(data).toEqual({});

  const [newAlias] = await db
    .select()
    .from(bottleAliases)
    .where(eq(bottleAliases.name, alias.name));
  expect(newAlias).toBeUndefined();

  const [newReview] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, review.id));
  expect(newReview.bottleId).toBeNull();

  const [newStorePrice] = await db
    .select()
    .from(storePrices)
    .where(eq(storePrices.id, storePrice.id));
  expect(newStorePrice.bottleId).toBeNull();
});

test("cannot delete without mod", async ({ fixtures }) => {
  const user = await fixtures.User();
  const bottle = await fixtures.Bottle({ createdById: user.id });
  const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

  const caller = createCaller({ user });
  const err = await waitError(caller.bottleAliasDelete(alias.name));
  expect(err).toMatchInlineSnapshot(`[TRPCError: UNAUTHORIZED]`);
});
