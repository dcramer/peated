import { db } from "@peated/server/db";
import {
  bottleReleasePromotions,
  bottleTombstones,
  bottles,
  catalogTargets,
} from "@peated/server/db/schema";
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

async function genericTargetId(groupId: number): Promise<number> {
  const target = await db.query.catalogTargets.findFirst({
    where: (targets, { and, eq, isNull }) =>
      and(eq(targets.groupId, groupId), isNull(targets.bottleId)),
  });
  if (!target) throw new Error("Missing generic CatalogTarget fixture");
  return target.id;
}

describe("GET /bottle-aliases", () => {
  test("lists exact aliases through the Bottle's active target", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Brand" });
    const bottle = await fixtures.Bottle({ name: "Foo", brandId: brand.id });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Foo Bar",
    });

    const { results } = await routerClient.bottleAliases.list({
      bottle: bottle.id,
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Brand Foo",
        bottleId: bottle.id,
        target: expect.objectContaining({
          kind: "bottle",
          bottle: expect.objectContaining({ id: bottle.id }),
        }),
        isCanonical: true,
      }),
      expect.objectContaining({
        name: "Foo Bar",
        bottleId: bottle.id,
        isCanonical: false,
      }),
    ]);
  });

  test("returns generic aliases without presenting a representative Bottle", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    if (bottle.groupId === null) throw new Error("Missing BottleGroup fixture");
    await fixtures.BottleRelease({ bottleId: bottle.id });
    const targetId = await genericTargetId(bottle.groupId);
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId,
      name: "Generic Group Alias",
    });

    const { results } = await routerClient.bottleAliases.list({
      query: "Generic Group Alias",
    });
    const filtered = await routerClient.bottleAliases.list({
      bottle: bottle.id,
      query: "Generic Group Alias",
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Generic Group Alias",
        bottleId: null,
        target: expect.objectContaining({
          kind: "group",
          targetId,
          group: expect.objectContaining({ id: bottle.groupId }),
        }),
      }),
    ]);
    expect(results[0].isCanonical).toBeUndefined();
    expect(filtered.results).toEqual([]);
  });

  test("lists a promoted alias by its authoritative concrete Bottle", async ({
    fixtures,
  }) => {
    const parent = await fixtures.Bottle();
    if (parent.groupId === null) throw new Error("Missing BottleGroup fixture");
    const release = await fixtures.BottleRelease({ bottleId: parent.id });
    const [promoted] = await db
      .insert(bottles)
      .values({
        groupId: parent.groupId,
        brandId: parent.brandId,
        name: `${parent.name} promoted`,
        fullName: `${parent.fullName} promoted`,
        createdByActorId: parent.createdByActorId,
      })
      .returning();
    if (!promoted) throw new Error("Missing promoted Bottle fixture");
    const [target] = await db
      .insert(catalogTargets)
      .values({ groupId: parent.groupId, bottleId: promoted.id })
      .returning();
    if (!target) throw new Error("Missing promoted CatalogTarget fixture");
    await db.insert(bottleReleasePromotions).values({
      releaseId: release.id,
      promotedBottleId: promoted.id,
      status: "promoted",
      completedAt: new Date(),
      createdByActorId: parent.createdByActorId,
    });
    await fixtures.BottleAlias({
      bottleId: parent.id,
      releaseId: release.id,
      targetId: target.id,
      name: "Promoted Release Alias",
    });

    const { results } = await routerClient.bottleAliases.list({
      bottle: promoted.id,
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Promoted Release Alias",
        bottleId: promoted.id,
        target: expect.objectContaining({
          kind: "bottle",
          targetId: target.id,
          bottle: expect.objectContaining({ id: promoted.id }),
        }),
        isCanonical: false,
      }),
    ]);
  });

  test("uses durable target identity when retained Bottle ids drift", async ({
    fixtures,
  }) => {
    const authoritative = await fixtures.Bottle();
    const stale = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: stale.id,
      targetId: await exactTargetId(authoritative.id),
      name: "Drifted Exact Alias",
    });

    const authoritativeResults = await routerClient.bottleAliases.list({
      bottle: authoritative.id,
      query: "Drifted Exact Alias",
    });
    const staleResults = await routerClient.bottleAliases.list({
      bottle: stale.id,
      query: "Drifted Exact Alias",
    });

    expect(authoritativeResults.results).toEqual([
      expect.objectContaining({
        name: "Drifted Exact Alias",
        bottleId: authoritative.id,
        target: expect.objectContaining({
          kind: "bottle",
          bottle: expect.objectContaining({ id: authoritative.id }),
        }),
      }),
    ]);
    expect(staleResults.results).toEqual([]);
  });

  test("onlyUnknown uses target membership in both drift directions", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      targetId: null,
      name: "Unknown Drift Targetless",
    });
    await fixtures.BottleAlias({
      bottleId: null,
      targetId: await exactTargetId(bottle.id),
      name: "Unknown Drift Targeted",
    });

    const { results } = await routerClient.bottleAliases.list({
      onlyUnknown: true,
      query: "Unknown Drift",
    });
    const exactResults = await routerClient.bottleAliases.list({
      bottle: bottle.id,
      query: "Unknown Drift",
    });

    expect(results).toEqual([
      expect.objectContaining({
        name: "Unknown Drift Targetless",
        bottleId: null,
        target: null,
      }),
    ]);
    expect(results[0].isCanonical).toBeUndefined();
    expect(exactResults.results).toEqual([
      expect.objectContaining({
        name: "Unknown Drift Targeted",
        bottleId: bottle.id,
        target: expect.objectContaining({ kind: "bottle" }),
      }),
    ]);
  });

  test("returns conflict when the filtered Bottle target is retired", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
    });

    const error = await waitError(
      routerClient.bottleAliases.list({ bottle: bottle.id }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Catalog target is retired (bottleId=${bottle.id}).`,
    });
  });

  test("returns conflict when a selected alias target is invalid", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    await db.insert(bottleTombstones).values({
      bottleId: bottle.id,
      newBottleId: null,
    });

    const error = await waitError(
      routerClient.bottleAliases.list({ query: bottle.fullName }),
    );

    expect(error).toMatchObject({
      status: 409,
      message: `Catalog target is retired (bottleId=${bottle.id}).`,
    });
  });

  test("preserves query, ignored-alias, and cursor pagination behavior", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    for (const name of ["Paged Alias C", "Paged Alias A", "Paged Alias B"]) {
      await fixtures.BottleAlias({ bottleId: bottle.id, name });
    }
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Paged Alias Ignored",
      ignored: true,
    });

    const first = await routerClient.bottleAliases.list({
      query: "Paged Alias",
      limit: 2,
    });
    const second = await routerClient.bottleAliases.list({
      query: "Paged Alias",
      limit: 2,
      cursor: 2,
    });

    expect(first.results.map(({ name }) => name)).toEqual([
      "Paged Alias A",
      "Paged Alias B",
    ]);
    expect(first.rel).toEqual({ nextCursor: 2, prevCursor: null });
    expect(second.results.map(({ name }) => name)).toEqual(["Paged Alias C"]);
    expect(second.rel).toEqual({ nextCursor: null, prevCursor: 1 });
  });
});
