import { db } from "@peated/server/db";
import {
  tastings,
  type Entity,
  type NewBottle,
  type Tasting,
} from "@peated/server/db/schema";
import type * as Fixtures from "@peated/server/lib/test/fixtures";
import { eq } from "drizzle-orm";
import { loadBadgeTastings } from "./identity";
import type { PersistedBadgeTasting } from "./types";

async function hydrateBadgeTasting(tasting: Tasting) {
  const [hydrated] = await loadBadgeTastings(db, [tasting]);
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
      bottleId: true,
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
  if (!brand) brand = await fixtures.Entity({ kind: "brand" });
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
