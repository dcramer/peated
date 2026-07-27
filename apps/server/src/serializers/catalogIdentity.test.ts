import { db } from "@peated/server/db";
import { bottleGroupDistillers, bottleGroups } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  BottleGroupV1Schema,
  ConcreteBottleV1Schema,
} from "@peated/server/schemas/catalogIdentity";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { serialize } from ".";
import {
  BottleGroupSummarySerializer,
  ConcreteBottleSerializer,
  type BottleGroupSummarySerializerItem,
  type CatalogIdentitySerializerContext,
} from "./catalogIdentity";

function context(
  actor: CatalogIdentitySerializerContext["actor"],
): CatalogIdentitySerializerContext {
  return {
    actor,
    permissions: { canReadCatalogIdentity: true },
  };
}

async function loadGroup(
  groupId: number,
): Promise<BottleGroupSummarySerializerItem> {
  const group = await db.query.bottleGroups.findFirst({
    where: eq(bottleGroups.id, groupId),
  });
  if (!group) throw new Error("Missing test BottleGroup");

  const distillers = await db
    .select({ distillerId: bottleGroupDistillers.distillerId })
    .from(bottleGroupDistillers)
    .where(eq(bottleGroupDistillers.groupId, groupId));

  return {
    ...group,
    distillerIds: distillers.map(({ distillerId }) => distillerId),
  };
}

describe("catalog identity serializers", () => {
  test("serializes group-owned identity with explicit caller context", async ({
    fixtures,
    defaults,
  }) => {
    const distiller = await fixtures.Entity({ name: "Test Distillery" });
    const bottle = await fixtures.Bottle({
      name: "Core Expression",
      distillerIds: [distiller.id],
    });
    const actor = await getUserActor(defaults.user);

    await db
      .update(bottleGroups)
      .set({
        description: "Stable expression description",
        imageUrl: "/groups/core-expression.jpg",
        totalBottles: 1,
        representativeBottleId: bottle.id,
      })
      .where(eq(bottleGroups.id, bottle.groupId as number));

    const group = await loadGroup(bottle.groupId as number);
    const result = await serialize(
      BottleGroupSummarySerializer,
      group,
      undefined,
      [],
      context(actor),
    );

    expect(BottleGroupV1Schema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      id: bottle.groupId,
      distillerIds: [distiller.id],
      representativeBottleId: bottle.id,
      imageUrl: "http://localhost:4300/groups/core-expression.jpg",
      totalBottles: 1,
    });
  });

  test("serializes independently complete concrete Bottle identity", async ({
    fixtures,
  }) => {
    const brand = await fixtures.Entity({ name: "Bottle Brand" });
    const bottler = await fixtures.Entity({ name: "Bottle Bottler" });
    const firstDistiller = await fixtures.Entity({ name: "First Distiller" });
    const secondDistiller = await fixtures.Entity({ name: "Second Distiller" });
    const series = await fixtures.BottleSeries({ brandId: brand.id });
    const bottle = await fixtures.Bottle({
      name: "Batch Release",
      brandId: brand.id,
      bottlerId: bottler.id,
      distillerIds: [firstDistiller.id, secondDistiller.id],
      category: "single_malt",
      seriesId: series.id,
      flavorProfile: "peated",
      edition: "Batch 24",
      releaseYear: 2024,
      abv: 57.2,
      imageUrl: "/bottles/batch-24.jpg",
    });
    const distillerIds = [secondDistiller.id, firstDistiller.id];

    const result = await serialize(
      ConcreteBottleSerializer,
      { ...bottle, distillerIds },
      undefined,
      [],
      context(null),
    );

    expect(ConcreteBottleV1Schema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      id: bottle.id,
      groupId: bottle.groupId,
      brandId: brand.id,
      bottlerId: bottler.id,
      distillerIds: [...distillerIds].sort((a, b) => a - b),
      category: "single_malt",
      seriesId: series.id,
      flavorProfile: "peated",
      edition: "Batch 24",
      releaseYear: 2024,
      abv: 57.2,
      imageUrl: "http://localhost:4300/bottles/batch-24.jpg",
    });
  });

  test("rejects missing or denied caller permission context", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const item = { ...bottle, distillerIds: [] };

    await expect(serialize(ConcreteBottleSerializer, item)).rejects.toThrow(
      "requires caller context",
    );
    await expect(
      serialize(ConcreteBottleSerializer, item, undefined, [], {
        actor: null,
        permissions: { canReadCatalogIdentity: false },
      }),
    ).rejects.toThrow("read permission is required");
  });
});
