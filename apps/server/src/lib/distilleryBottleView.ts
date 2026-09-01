import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import type { SQL } from "drizzle-orm";
import { and, eq, isNull, not, or, sql } from "drizzle-orm";

/**
 * A distillery release uses the distillery or one of its directly owned
 * labels as the brand, with no outside bottler. Other bottlings use an
 * outside brand or bottler.
 */
export function bottlesForDistilleryView(
  distilleryId: number,
  view: "releases" | "other",
): SQL<unknown> {
  const ownBrand = or(
    eq(bottles.brandId, distilleryId),
    sql`EXISTS(
      SELECT FROM ${entities}
      WHERE ${entities.id} = ${bottles.brandId}
        AND ${entities.ownerId} = ${distilleryId}
        AND ${entities.kind} IN ('brand', 'bottler')
    )`,
  )!;
  const ownBottler = or(
    isNull(bottles.bottlerId),
    eq(bottles.bottlerId, distilleryId),
    sql`EXISTS(
      SELECT FROM ${entities}
      WHERE ${entities.id} = ${bottles.bottlerId}
        AND ${entities.ownerId} = ${distilleryId}
        AND ${entities.kind} IN ('brand', 'bottler')
    )`,
  )!;
  const madeByDistillery = sql`EXISTS(
    SELECT FROM ${bottlesToDistillers}
    WHERE ${bottlesToDistillers.bottleId} = ${bottles.id}
      AND ${bottlesToDistillers.distillerId} = ${distilleryId}
  )`;
  const ownRelease = and(ownBrand, ownBottler)!;

  return view === "releases"
    ? ownRelease
    : and(or(ownBrand, madeByDistillery), not(ownRelease))!;
}
