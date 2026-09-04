import { db } from "@peated/server/db";
import { entities } from "@peated/server/db/schema";
import { sql, type SQL } from "drizzle-orm";

type OwnershipPathRow = {
  descendantId: string;
  path: string[];
};

function companyDescendantsCte(companyId: number): SQL {
  return sql`
    WITH RECURSIVE company_descendants(descendant_id, path) AS (
      SELECT
        ${entities.id},
        ARRAY[${companyId}::bigint, ${entities.id}]::bigint[]
      FROM ${entities}
      WHERE ${entities.ownerId} = ${companyId}
        AND ${entities.id} <> ${companyId}

      UNION ALL

      SELECT
        child.id,
        parent.path || child.id
      FROM ${entities} AS child
      INNER JOIN company_descendants AS parent
        ON child.owner_id = parent.descendant_id
      WHERE NOT child.id = ANY(parent.path)
    )
  `;
}

/** Returns every recorded descendant once, even if corrupt data contains a loop. */
export function companyDescendantIds(companyId: number): SQL {
  return sql`
    ${companyDescendantsCte(companyId)}
    SELECT DISTINCT descendant_id
    FROM company_descendants
  `;
}

/** Includes the Company itself plus every descendant that a Bottle may use. */
export function companyBottleEntityIds(companyId: number): SQL {
  return sql`
    ${companyDescendantsCte(companyId)}
    SELECT ${companyId}::bigint AS entity_id
    UNION
    SELECT DISTINCT descendant_id AS entity_id
    FROM company_descendants
  `;
}

export async function getCompanyOwnershipPaths(
  companyId: number,
  descendantIds: number[],
): Promise<Map<number, number[]>> {
  if (!descendantIds.length) return new Map();

  const result = await db.execute<OwnershipPathRow>(sql`
    ${companyDescendantsCte(companyId)}
    SELECT DISTINCT ON (descendant_id)
      descendant_id AS "descendantId",
      path
    FROM company_descendants
    WHERE descendant_id IN (
      ${sql.join(
        descendantIds.map((descendantId) => sql`${descendantId}`),
        sql`, `,
      )}
    )
    ORDER BY descendant_id, cardinality(path), path
  `);

  return new Map(
    result.rows.map((row) => [Number(row.descendantId), row.path.map(Number)]),
  );
}
