import { db } from "@peated/server/db";
import { bottleAliases, catalogTargets } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";

async function exactTargetId(bottleId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: eq(catalogTargets.bottleId, bottleId),
  });
  if (!target) throw new Error("Missing exact CatalogTarget fixture");
  return target.id;
}

describe("GET /bottle-aliases", () => {
  test("lists canonical and alternate names by direct Bottle id", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Alias Route Brand" });
    const bottle = await fixtures.Bottle({
      name: "Alias Route Bottle",
      brandId: brand.id,
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Alternate Direct Name",
    });

    const { results } = await routerClient.bottleAliases.list({
      bottle: bottle.id,
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Alias Route Brand Alias Route Bottle",
        bottleId: bottle.id,
        isCanonical: true,
      }),
      expect.objectContaining({
        name: "Alternate Direct Name",
        bottleId: bottle.id,
        isCanonical: false,
      }),
    ]);
    expect(results[0]).not.toHaveProperty("target");
  });

  test("uses Bottle identity when retained target evidence disagrees", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const otherBottle = await fixtures.Bottle();
    const otherTargetId = await exactTargetId(otherBottle.id);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: otherTargetId,
      name: "Drifted Target Evidence",
    });

    const { results } = await routerClient.bottleAliases.list({
      bottle: bottle.id,
      query: "Drifted Target Evidence",
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Drifted Target Evidence",
        bottleId: bottle.id,
      }),
    ]);
  });

  test("defines unknown aliases by nullable Bottle id", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const targetId = await exactTargetId(bottle.id);
    await db.insert(bottleAliases).values([
      {
        name: "Unknown With Target Evidence",
        bottleId: null,
        targetId,
        assignedByActorId: bottle.createdByActorId,
      },
      {
        name: "Known Without Target Evidence",
        bottleId: bottle.id,
        targetId: null,
        assignedByActorId: bottle.createdByActorId,
      },
    ]);

    const { results } = await routerClient.bottleAliases.list({
      onlyUnknown: true,
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Unknown With Target Evidence",
        bottleId: null,
      }),
    ]);
  });

  test("supports query, ignored filtering, and pagination", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Alpha",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Beta",
    });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Ignored",
      ignored: true,
    });

    const first = await routerClient.bottleAliases.list({
      query: "Paged Alias",
      limit: 1,
    });
    const second = await routerClient.bottleAliases.list({
      query: "Paged Alias",
      limit: 1,
      cursor: 2,
    });

    expect(first.results).toHaveLength(1);
    expect(first.rel).toMatchObject({ nextCursor: 2, prevCursor: null });
    expect(second.results).toHaveLength(1);
    expect(second.rel.prevCursor).toBe(1);
    expect(
      [...first.results, ...second.results].map(({ name }) => name),
    ).toEqual(["Paged Alias Alpha", "Paged Alias Beta"]);
  });

  test("rejects an unknown Bottle filter", async () => {
    const error = await waitError(
      routerClient.bottleAliases.list({ bottle: 2_147_483_647 }),
    );

    expect(error).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });
});
