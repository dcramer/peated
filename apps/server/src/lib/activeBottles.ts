import { bottles, bottleTombstones } from "@peated/server/db/schema";
import { sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/**
 * Active Bottle rule (whisky-identity-model.md, "Active Bottles"): a Bottle is
 * active when it belongs to a BottleGroup and has no tombstone. Catalog reads,
 * counts, and search use this filter so they agree on which Bottles exist.
 *
 * Pass an aliased Bottle table when the query joins Bottles more than once.
 */
export function activeBottleWhere(
  bottle: { id: AnyPgColumn; groupId: AnyPgColumn } = bottles,
): SQL {
  // Keep the tombstone check as NOT IN. TIN search ranks with tin.score(),
  // which fails when the planner turns NOT EXISTS into an anti-join instead
  // of a TIN index scan (bottle-search.md). Tombstone ids are never null.
  return sql`(${bottle.groupId} IS NOT NULL AND ${bottle.id} NOT IN (SELECT ${bottleTombstones.bottleId} FROM ${bottleTombstones}))`;
}
