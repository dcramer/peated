import { db } from "@peated/server/db";
import {
  bottles,
  catalogTargets,
  tastings,
  type Entity,
  type NewBottle,
  type Tasting,
} from "@peated/server/db/schema";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import { and, eq, isNull } from "drizzle-orm";
import { loadBadgeTastings } from "./identity";
import type { PersistedBadgeTasting } from "./types";

async function hydrateBadgeTasting(tasting: Tasting) {
  const [hydrated] = await loadBadgeTastings(db, [tasting], {
    caller: "badges.testHelpers",
    operation: "hydrate",
  });
  if (!hydrated) throw new Error("Missing hydrated badge Tasting fixture");
  return hydrated;
}

export async function getPersistedBadgeTasting(
  tastingId: number,
): Promise<PersistedBadgeTasting> {
  const tasting = await db.query.tastings.findFirst({
    where: eq(tastings.id, tastingId),
    columns: {
      id: true,
      createdById: true,
      targetId: true,
      bottleId: true,
      releaseId: true,
    },
  });
  if (!tasting) throw new Error(`Missing Tasting fixture ${tastingId}`);
  return tasting;
}

export async function createTastingForBadge(
  fixtures: typeof Fixtures,
  {
    brand,
    bottler,
    distillers = [],
    ...bottleData
  }: Omit<Partial<NewBottle>, "id" | "brandId"> & {
    distillers?: Entity[];
    bottler?: Entity | null;
    brand?: Entity;
  } = {},
  userId: number | null = null,
) {
  if (!brand) brand = await fixtures.Entity({ type: ["brand"] });
  const bottle = await fixtures.Bottle({
    name: "A",
    ...bottleData,
    brandId: brand.id,
    bottlerId: bottler ? bottler.id : null,
    distillerIds: distillers.map((d) => d.id),
  });
  const tasting = await fixtures.Tasting({
    bottleId: bottle.id,
    createdById: userId ?? undefined,
  });
  return await hydrateBadgeTasting(tasting);
}

export async function useGenericBadgeTarget(tastingId: number) {
  const row = await db.query.tastings.findFirst({
    where: eq(tastings.id, tastingId),
  });
  if (!row) throw new Error(`Missing Tasting fixture ${tastingId}`);
  if (row.bottleId === null) {
    throw new Error(`Tasting fixture ${tastingId} has no retained Bottle`);
  }

  const bottle = await db.query.bottles.findFirst({
    where: eq(bottles.id, row.bottleId),
  });
  if (!bottle?.groupId) {
    throw new Error(`Tasting fixture ${tastingId} has no BottleGroup`);
  }

  const genericTarget = await db.query.catalogTargets.findFirst({
    where: and(
      eq(catalogTargets.groupId, bottle.groupId),
      isNull(catalogTargets.bottleId),
    ),
  });
  if (!genericTarget) {
    throw new Error(`BottleGroup ${bottle.groupId} has no generic target`);
  }

  const [updated] = await db
    .update(tastings)
    .set({ targetId: genericTarget.id })
    .where(eq(tastings.id, tastingId))
    .returning();
  if (!updated)
    throw new Error(`Unable to update Tasting fixture ${tastingId}`);

  return await hydrateBadgeTasting(updated);
}
