import { db } from "@peated/server/db";
import { bottleTombstones, entities } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { findOwnerLoopEntityIds } from "./kind-backfill-status";

describe("findOwnerLoopEntityIds", () => {
  test("returns only the Entities that form a loop", () => {
    expect(
      findOwnerLoopEntityIds([
        { id: 1, ownerId: 2 },
        { id: 2, ownerId: 3 },
        { id: 3, ownerId: 2 },
        { id: 4, ownerId: 1 },
        { id: 5, ownerId: null },
      ]),
    ).toEqual([2, 3]);
  });
});

describe("GET /entities/kind-backfill/status", () => {
  test("requires moderator access", async ({ fixtures }) => {
    const user = await fixtures.User({ mod: false });

    const error = await waitError(
      routerClient.entities.kindBackfillStatus(undefined, {
        context: { user },
      }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Unauthorized.]`);
  });

  test("reports migration invariants and active Bottle links", async ({
    fixtures,
  }) => {
    const first = await fixtures.Entity({ kind: null });
    const second = await fixtures.Entity({
      kind: "company",
      ownerId: first.id,
    });
    await db
      .update(entities)
      .set({ ownerId: second.id })
      .where(eq(entities.id, first.id));
    const user = await fixtures.User({ mod: true });

    await fixtures.Bottle({
      brandId: first.id,
      bottlerId: second.id,
      distillerIds: [first.id, second.id],
      name: "Active Bottle",
    });
    const retiredBottle = await fixtures.Bottle({
      brandId: first.id,
      bottlerId: second.id,
      distillerIds: [first.id],
      name: "Retired Bottle",
    });
    await db.insert(bottleTombstones).values({ bottleId: retiredBottle.id });

    const result = await routerClient.entities.kindBackfillStatus(undefined, {
      context: { user },
    });

    expect(result).toEqual({
      ready: false,
      entities: { total: 2, missingKind: 1 },
      owners: { links: 2, invalid: 0, loopEntityIds: [first.id, second.id] },
      bottleLinks: { activeBottles: 1, brand: 1, bottler: 1, distiller: 2 },
    });
  });
});
