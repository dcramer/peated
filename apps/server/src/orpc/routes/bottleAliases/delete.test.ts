import { db } from "@peated/server/db";
import { bottleAliases, reviews, storePrices } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

describe("DELETE /bottle-aliases/:name", () => {
  test("deletes alias", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: true });
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    const site = await fixtures.ExternalSiteOrExisting();
    const review = await fixtures.Review({
      bottleId: bottle.id,
      name: alias.name,
      externalSiteId: site.id,
    });
    const storePrice = await fixtures.StorePrice({
      bottleId: bottle.id,
      externalSiteId: site.id,
      name: alias.name,
    });

    const data = await routerClient.bottleAliases.delete(
      { alias: alias.name },
      {
        context: { user },
      },
    );
    expect(data).toEqual({});

    const [newAlias] = await db
      .select()
      .from(bottleAliases)
      .where(eq(bottleAliases.name, alias.name));
    expect(newAlias).toBeDefined();
    expect(newAlias.bottleId).toBeNull();

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
    const bottle = await fixtures.Bottle();
    const alias = await fixtures.BottleAlias({ bottleId: bottle.id });

    const err = await waitError(
      routerClient.bottleAliases.delete(
        { alias: alias.name },
        {
          context: { user },
        },
      ),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });
});
