import {
  EntityResolutionSchema,
  SearchEntitiesArgsSchema,
  createEntityClassifier,
  type ClassifyEntityInput,
  type RunEntityClassifierAgentInput,
  type SearchEntitiesArgs,
} from "@peated/entity-classifier";
import config from "@peated/server/config";
import { db } from "@peated/server/db";
import { entities, entityAliases } from "@peated/server/db/schema";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import OpenAI from "openai";

let entityClassifier: ReturnType<typeof createEntityClassifier> | null = null;

function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: config.OPENAI_API_KEY,
    baseURL: config.OPENAI_HOST,
    organization: config.OPENAI_ORGANIZATION,
    project: config.OPENAI_PROJECT,
  });
}

function mergeResult(
  results: Map<number, ReturnType<typeof EntityResolutionSchema.parse>>,
  candidate: ReturnType<typeof EntityResolutionSchema.parse>,
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

async function searchEntityClassifierEntities(args: SearchEntitiesArgs) {
  const parsedArgs = SearchEntitiesArgsSchema.parse(args);
  const results = new Map<
    number,
    ReturnType<typeof EntityResolutionSchema.parse>
  >();

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
        parsedArgs.type
          ? sql`${parsedArgs.type} = ANY(${entities.type})`
          : undefined,
        or(
          eq(sql`LOWER(${entities.name})`, parsedArgs.query.toLowerCase()),
          eq(
            sql`LOWER(COALESCE(${entities.shortName}, ''))`,
            parsedArgs.query.toLowerCase(),
          ),
          eq(
            sql`LOWER(COALESCE(${entityAliases.name}, ''))`,
            parsedArgs.query.toLowerCase(),
          ),
        ),
      ),
    )
    .limit(parsedArgs.limit);

  for (const row of exactMatches) {
    mergeResult(
      results,
      EntityResolutionSchema.parse({
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
      ts_rank(${entities.searchVector}, websearch_to_tsquery('english', ${parsedArgs.query})) AS score
    FROM ${entities}
    WHERE ${entities.searchVector} IS NOT NULL
      AND ${entities.searchVector} @@ websearch_to_tsquery('english', ${parsedArgs.query})
      ${parsedArgs.type ? sql`AND ${parsedArgs.type} = ANY(${entities.type})` : sql``}
    ORDER BY score DESC, ${entities.name} ASC
    LIMIT ${parsedArgs.limit}
  `);

  for (const row of textMatches.rows) {
    mergeResult(
      results,
      EntityResolutionSchema.parse({
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
        parsedArgs.type
          ? sql`${parsedArgs.type} = ANY(${entities.type})`
          : undefined,
        or(
          ilike(entities.name, `${parsedArgs.query}%`),
          sql`COALESCE(${entities.shortName}, '') ILIKE ${`${parsedArgs.query}%`}`,
          sql`COALESCE(${entityAliases.name}, '') ILIKE ${`${parsedArgs.query}%`}`,
        ),
      ),
    )
    .limit(parsedArgs.limit);

  for (const row of prefixMatches) {
    mergeResult(
      results,
      EntityResolutionSchema.parse({
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

  return Array.from(results.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, parsedArgs.limit);
}

export function getEntityClassifier() {
  if (entityClassifier) {
    return entityClassifier;
  }

  entityClassifier = createEntityClassifier({
    client: createOpenAIClient(),
    model: config.OPENAI_MODEL,
    maxSearchQueries: config.ENTITY_CLASSIFIER_MAX_SEARCH_QUERIES,
    adapters: {
      searchEntities: searchEntityClassifierEntities,
    },
  });

  return entityClassifier;
}

export async function classifyEntity(input: ClassifyEntityInput) {
  return await getEntityClassifier().classifyEntity(input);
}

export async function runEntityClassifierAgent(
  input: RunEntityClassifierAgentInput,
) {
  return await getEntityClassifier().runEntityClassifierAgent(input);
}
