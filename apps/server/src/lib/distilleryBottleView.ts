import {
  bottles,
  bottlesToDistillers,
  entities,
} from "@peated/server/db/schema";
import { sql, type SQL } from "drizzle-orm";

/**
 * A distillery release uses the distillery or one of its directly owned
 * labels as the brand, with no outside bottler. Other bottlings use an
 * outside brand or bottler.
 */
export function bottleIdsForDistilleryView(
  distilleryId: number,
  view: "releases" | "other",
): SQL<unknown> {
  const scope = sql`
    WITH owned_entities AS MATERIALIZED (
      SELECT ${distilleryId}::bigint AS entity_id

      UNION

      SELECT ${entities.id} AS entity_id
      FROM ${entities}
      WHERE ${entities.ownerId} = ${distilleryId}
        AND ${entities.kind} IN ('brand', 'bottler')
    ),
    official_releases AS MATERIALIZED (
      SELECT ${bottles.id} AS bottle_id
      FROM ${bottles}
      INNER JOIN owned_entities AS brands
        ON brands.entity_id = ${bottles.brandId}
      WHERE ${bottles.bottlerId} IS NULL
        OR ${bottles.bottlerId} IN (
          SELECT entity_id FROM owned_entities
        )
    )
  `;

  return view === "releases"
    ? sql`
        ${scope}
        SELECT bottle_id FROM official_releases
      `
    : sql`
        ${scope},
        candidate_bottles AS MATERIALIZED (
          SELECT ${bottles.id} AS bottle_id
          FROM ${bottles}
          INNER JOIN owned_entities AS brands
            ON brands.entity_id = ${bottles.brandId}

          UNION

          SELECT ${bottlesToDistillers.bottleId} AS bottle_id
          FROM ${bottlesToDistillers}
          WHERE ${bottlesToDistillers.distillerId} = ${distilleryId}
        )
        SELECT candidate_bottles.bottle_id
        FROM candidate_bottles
        LEFT JOIN official_releases
          ON official_releases.bottle_id = candidate_bottles.bottle_id
        WHERE official_releases.bottle_id IS NULL
      `;
}
