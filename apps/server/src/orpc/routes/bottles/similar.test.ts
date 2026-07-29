import { db } from "@peated/server/db";
import { bottleGroups, bottleTombstones } from "@peated/server/db/schema";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

function requireGroupId(groupId: number | null): number {
  if (groupId === null) throw new Error("Missing BottleGroup fixture");
  return groupId;
}

describe("GET /bottles/:bottle/similar", () => {
  test("lists similar bottles", async ({ fixtures }) => {
    const brand = await fixtures.Entity({ name: "Brand" });
    const distiller = await fixtures.Entity({ name: "Distiller" });

    const bottle1 = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      statedAge: 12,
      category: "bourbon",
    });

    // Should find - same brand, same name but different vintage
    const bottle2 = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      edition: "Other Vintage",
      statedAge: 10,
      category: "bourbon",
    });

    // Should find - same brand, similar age
    const bottle3 = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Different Name",
      statedAge: 14,
      category: "bourbon",
    });

    // Should NOT find - different brand
    await fixtures.Bottle({
      brandId: (await fixtures.Entity({ name: "Other Brand" })).id,
      distillerIds: [distiller.id],
      name: "Main Bottle",
      statedAge: 12,
    });

    const { results } = await routerClient.bottles.similar({
      bottle: bottle1.id,
    });

    expect(results.length).toBe(2);
    expect(results.map((r) => r.id).sort()).toEqual(
      [bottle2.id, bottle3.id].sort(),
    );
  });

  test("returns empty when no similar bottles", async ({ fixtures }) => {
    const brand = await fixtures.Entity();
    const bottle = await fixtures.Bottle({
      brandId: brand.id,
      name: "Unique Bottle",
    });

    const { results } = await routerClient.bottles.similar({
      bottle: bottle.id,
    });

    expect(results.length).toBe(0);
  });

  test("uses direct Bottle identity and excludes ungrouped legacy Bottles", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Direct Brand" });
    const distiller = await fixtures.Entity({ name: "Direct Distiller" });
    const source = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Direct Bottle",
    });
    const candidate = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: source.name,
      edition: "Direct Candidate",
    });
    await fixtures.LegacyBottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Unassigned Similar Bottle",
    });
    const { results } = await routerClient.bottles.similar({
      bottle: source.id,
    });

    expect(results.map(({ id }) => id)).toEqual([candidate.id]);
  });

  test("excludes Bottle tombstones as sources and results", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Bottle Tombstone Brand" });
    const distiller = await fixtures.Entity({
      name: "Bottle Tombstone Distiller",
    });
    const source = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: "Retired Exact Bottle",
    });
    const retiredResult = await fixtures.Bottle({
      brandId: brand.id,
      distillerIds: [distiller.id],
      name: source.name,
      edition: "Retired Result",
    });
    await db.insert(bottleTombstones).values({ bottleId: retiredResult.id });

    const { results } = await routerClient.bottles.similar({
      bottle: source.id,
    });
    await db.insert(bottleTombstones).values({ bottleId: source.id });
    const sourceError = await waitError(
      routerClient.bottles.similar({ bottle: source.id }),
    );

    expect(results).toHaveLength(0);
    expect(sourceError).toMatchObject({
      status: 404,
      message: "Bottle not found.",
    });
  });

  test("returns independently complete Bottle fields without group substitution", async ({
    fixtures,
  }) => {
    const bottleBrand = await fixtures.Entity({ name: "Exact Bottle Brand" });
    const groupBrand = await fixtures.Entity({ name: "Divergent Group Brand" });
    const distiller = await fixtures.Entity({ name: "Exact Distiller" });
    const source = await fixtures.Bottle({
      brandId: bottleBrand.id,
      distillerIds: [distiller.id],
      name: "Independent Identity",
      statedAge: 12,
      category: "bourbon",
    });
    const candidate = await fixtures.Bottle({
      brandId: bottleBrand.id,
      distillerIds: [distiller.id],
      name: source.name,
      edition: "Exact Edition",
      statedAge: 12,
      category: "bourbon",
    });
    await db
      .update(bottleGroups)
      .set({
        brandId: groupBrand.id,
        name: "Group-Owned Divergence",
        fullName: "Divergent Group Brand Group-Owned Divergence",
        category: "rye",
      })
      .where(eq(bottleGroups.id, requireGroupId(candidate.groupId)));

    const { results } = await routerClient.bottles.similar({
      bottle: source.id,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: candidate.id,
      fullName: candidate.fullName,
      name: candidate.name,
      edition: "Exact Edition",
      category: "bourbon",
      brand: { id: bottleBrand.id, name: bottleBrand.name },
    });
    expect(results[0]).not.toHaveProperty("group");
  });

  test("throws error for non-existent bottle", async () => {
    const err = await waitError(
      routerClient.bottles.similar({
        bottle: 999999,
      }),
    );
    expect(err).toMatchInlineSnapshot(`[Error: Bottle not found.]`);
  });
});
