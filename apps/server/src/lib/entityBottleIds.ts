import { bottles, bottlesToDistillers } from "@peated/server/db/schema";
import { sql, type SQL } from "drizzle-orm";

/** Uses each Bottle relationship index independently and removes role overlaps. */
export function bottleIdsForEntities(entityIds: SQL<unknown>): SQL<unknown> {
  return sql`
    WITH target_entities AS MATERIALIZED (
      ${entityIds}
    )
    SELECT ${bottles.id}
    FROM ${bottles}
    INNER JOIN target_entities
      ON target_entities.entity_id = ${bottles.brandId}

    UNION

    SELECT ${bottles.id}
    FROM ${bottles}
    INNER JOIN target_entities
      ON target_entities.entity_id = ${bottles.bottlerId}

    UNION

    SELECT ${bottlesToDistillers.bottleId}
    FROM ${bottlesToDistillers}
    INNER JOIN target_entities
      ON target_entities.entity_id = ${bottlesToDistillers.distillerId}
  `;
}

export function bottleIdsForEntity(entityId: number): SQL<unknown> {
  return bottleIdsForEntities(sql`SELECT ${entityId}::bigint AS entity_id`);
}
