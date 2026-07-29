import { db } from "@peated/server/db";
import { bottleGroupDistillers, bottleGroups } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { BottleGroupV1Schema } from "@peated/server/schemas/catalogIdentity";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { serialize } from ".";
import {
  BottleGroupSummarySerializer,
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
      .set({ totalBottles: 1, representativeBottleId: bottle.id })
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
      totalBottles: 1,
    });
  });

  test("rejects missing or denied caller permission context", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle();
    const item = await loadGroup(bottle.groupId as number);

    await expect(serialize(BottleGroupSummarySerializer, item)).rejects.toThrow(
      "requires caller context",
    );
    await expect(
      serialize(BottleGroupSummarySerializer, item, undefined, [], {
        actor: null,
        permissions: { canReadCatalogIdentity: false },
      }),
    ).rejects.toThrow("read permission is required");
  });
});
