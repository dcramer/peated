import { tool } from "@openai/agents";
import { ENTITY_TYPE_LIST } from "@peated/server/constants";
import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

const SearchEntitiesArgsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .describe(
      "Producer, distillery, or bottler name to resolve. Use the cleanest entity text you have, without bottle-specific suffixes.",
    ),
  type: z
    .enum(ENTITY_TYPE_LIST)
    .nullable()
    .default(null)
    .describe(
      "Entity type hint to narrow results. Use when you know whether you need a brand, distillery, or bottler match.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Maximum number of entity candidates to return."),
});

export const EntitySearchResultSchema = z.object({
  entityId: z.number(),
  name: z.string(),
  shortName: z.string().nullable().default(null),
  type: z.array(z.enum(ENTITY_TYPE_LIST)).default([]),
  alias: z.string().nullable().default(null),
  score: z.number().nullable().default(null),
  source: z.array(z.string()).default([]),
});

const SearchEntitiesResultSchema = z.object({
  results: z.array(EntitySearchResultSchema),
});

export type EntitySearchResult = z.infer<typeof EntitySearchResultSchema>;

function mergeResult(
  results: Map<number, EntitySearchResult>,
  candidate: EntitySearchResult,
) {
  const existing = results.get(candidate.entityId);
  if (!existing) {
    results.set(candidate.entityId, candidate);
    return;
  }

  existing.source = Array.from(
    new Set([...existing.source, ...candidate.source]),
  );

  if (
    candidate.score !== null &&
    (existing.score === null || candidate.score > existing.score)
  ) {
    existing.score = candidate.score;
  }

  if (!existing.alias && candidate.alias) {
    existing.alias = candidate.alias;
  }
}

export function createSearchEntitiesTool({
  onResults,
}: {
  onResults?: (results: EntitySearchResult[]) => void;
} = {}) {
  return tool({
    name: "search_entities",
    description:
      "Search the local entity database for brands, distilleries, and bottlers using aliases and full-text search. Use this when producer, bottler, or distillery identity is blocking the decision. Prefer passing a `type` hint when you know what kind of entity you need. Do not use this to search for bottles.",
    parameters: SearchEntitiesArgsSchema,
    execute: async (args) => {
      const results = new Map<number, EntitySearchResult>();

      const exactMatches = await db
        .select({
          entityId: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          type: entities.type,
          alias: entityAliases.name,
        })
        .from(entities)
        .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
        .where(
          and(
            args.type ? sql`${args.type} = ANY(${entities.type})` : undefined,
            or(
              eq(sql`LOWER(${entities.name})`, args.query.toLowerCase()),
              eq(
                sql`LOWER(COALESCE(${entities.shortName}, ''))`,
                args.query.toLowerCase(),
              ),
              eq(
                sql`LOWER(COALESCE(${entityAliases.name}, ''))`,
                args.query.toLowerCase(),
              ),
            ),
          ),
        )
        .limit(args.limit);

      for (const row of exactMatches) {
        mergeResult(
          results,
          EntitySearchResultSchema.parse({
            entityId: row.entityId,
            name: row.name,
            shortName: row.shortName,
            type: row.type,
            alias: row.alias,
            score: 1,
            source: ["exact"],
          }),
        );
      }

      const textMatches = await db.execute<{
        entityId: number;
        name: string;
        shortName: string | null;
        type: string[];
        score: number | null;
      }>(sql`
        SELECT
          ${entities.id} AS "entityId",
          ${entities.name} AS "name",
          ${entities.shortName} AS "shortName",
          ${entities.type} AS "type",
          ts_rank(${entities.searchVector}, websearch_to_tsquery('english', ${args.query})) AS score
        FROM ${entities}
        WHERE ${entities.searchVector} IS NOT NULL
          AND ${entities.searchVector} @@ websearch_to_tsquery('english', ${args.query})
          ${args.type ? sql`AND ${args.type} = ANY(${entities.type})` : sql``}
        ORDER BY score DESC, ${entities.name} ASC
        LIMIT ${args.limit}
      `);

      for (const row of textMatches.rows) {
        mergeResult(
          results,
          EntitySearchResultSchema.parse({
            entityId: row.entityId,
            name: row.name,
            shortName: row.shortName,
            type: row.type,
            alias: null,
            score: row.score === null ? null : Number(row.score),
            source: ["text"],
          }),
        );
      }

      const prefixMatches = await db
        .select({
          entityId: entities.id,
          name: entities.name,
          shortName: entities.shortName,
          type: entities.type,
          alias: entityAliases.name,
        })
        .from(entities)
        .leftJoin(entityAliases, eq(entityAliases.entityId, entities.id))
        .where(
          and(
            args.type ? sql`${args.type} = ANY(${entities.type})` : undefined,
            or(
              ilike(entities.name, `${args.query}%`),
              sql`COALESCE(${entities.shortName}, '') ILIKE ${`${args.query}%`}`,
              sql`COALESCE(${entityAliases.name}, '') ILIKE ${`${args.query}%`}`,
            ),
          ),
        )
        .limit(args.limit);

      for (const row of prefixMatches) {
        mergeResult(
          results,
          EntitySearchResultSchema.parse({
            entityId: row.entityId,
            name: row.name,
            shortName: row.shortName,
            type: row.type,
            alias: row.alias,
            score: 0.5,
            source: ["prefix"],
          }),
        );
      }

      const parsedResults = SearchEntitiesResultSchema.parse({
        results: Array.from(results.values())
          .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
          .slice(0, args.limit),
      });

      onResults?.(parsedResults.results);
      return parsedResults;
    },
  });
}
