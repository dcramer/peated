import { db } from "@peated/server/db";
import { tastings } from "@peated/server/db/schema";
import { getUserActorForDatabase } from "@peated/server/lib/actors";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

describe("GET /users/:user/tastings/search", () => {
  test("suggests Entities of tasted Bottles by the start of their name, then Bottles", async ({
    defaults,
    fixtures,
  }) => {
    const laphroaig = await fixtures.Entity({
      name: "Laphroaig",
      kind: "distillery",
    });
    const bottler = await fixtures.Entity({
      name: "Signatory",
      kind: "bottler",
    });
    const ownBottle = await fixtures.Bottle({
      brandId: laphroaig.id,
      distillerIds: [laphroaig.id],
      name: "10",
    });
    const independent = await fixtures.Bottle({
      bottlerId: bottler.id,
      distillerIds: [laphroaig.id],
      name: "Signatory Laphroaig 1998",
    });
    const unrelated = await fixtures.Bottle({ name: "Uigeadail" });
    for (const bottle of [ownBottle, ownBottle, independent, unrelated]) {
      await fixtures.Tasting({
        bottleId: bottle.id,
        createdById: defaults.user.id,
      });
    }

    const response = await routerClient.users.tastingSearch(
      { user: "me", query: "laph" },
      { context: { user: defaults.user } },
    );

    // Counts tasted Bottles, not tastings: two tastings of one Bottle count once.
    expect(
      response.entities.map(({ entity, count }) => [entity.id, count]),
    ).toEqual([[laphroaig.id, 2]]);
    expect(response.bottles.map((bottle) => bottle.id)).toEqual(
      expect.arrayContaining([ownBottle.id, independent.id]),
    );
    expect(response.bottles).toHaveLength(2);
  });

  test("does not suggest Bottles from removed tastings or other members", async ({
    defaults,
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Laphroaig" });
    const removedBottle = await fixtures.Bottle({ brandId: brand.id });
    const otherBottle = await fixtures.Bottle({ brandId: brand.id });
    const removed = await fixtures.Tasting({
      bottleId: removedBottle.id,
      createdById: defaults.user.id,
    });
    const actor = await getUserActorForDatabase(db, defaults.user);
    await db
      .update(tastings)
      .set({
        removalReason: "Removed by moderator",
        removedAt: new Date(),
        removedByActorId: actor.id,
      })
      .where(eq(tastings.id, removed.id));
    await fixtures.Tasting({ bottleId: otherBottle.id });

    const response = await routerClient.users.tastingSearch(
      { user: "me", query: "laph" },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({ entities: [], bottles: [] });
  });

  test("returns nothing for empty search text", async ({ defaults }) => {
    const response = await routerClient.users.tastingSearch(
      { user: "me", query: "  " },
      { context: { user: defaults.user } },
    );

    expect(response).toEqual({ entities: [], bottles: [] });
  });

  test("rejects a private profile without friendship", async ({
    defaults,
    fixtures,
  }) => {
    const user = await fixtures.User({ private: true });

    const error = await waitError(() =>
      routerClient.users.tastingSearch(
        { user: user.id, query: "laph" },
        { context: { user: defaults.user } },
      ),
    );

    expect(error).toMatchInlineSnapshot(`[Error: User's profile is private.]`);
  });
});
