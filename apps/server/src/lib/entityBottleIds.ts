import { db } from "@peated/server/db";
import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { eq } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";

/** Uses each Bottle relationship index independently and removes role overlaps. */
export function bottleIdsForEntity(entityId: number) {
  return union(
    db
      .select({ id: bottles.id })
      .from(bottles)
      .where(eq(bottles.brandId, entityId)),
    db
      .select({ id: bottles.id })
      .from(bottles)
      .where(eq(bottles.bottlerId, entityId)),
    db
      .select({ id: bottlesToDistillers.bottleId })
      .from(bottlesToDistillers)
      .where(eq(bottlesToDistillers.distillerId, entityId)),
  );
}
