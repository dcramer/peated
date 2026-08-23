import { procedure } from "@peated/server/orpc";
import type { Context } from "@peated/server/orpc/context";
import { BottleSchema, EntitySchema, UserSchema } from "@peated/server/schemas";
import type { Bottle, Entity, User } from "@peated/server/types";
import { z } from "zod";

export type BottleResult = {
  type: "bottle";
  ref: Bottle;
};

export type EntityResult = {
  type: "entity";
  ref: Entity;
};

export type UserResult = {
  type: "user";
  ref: User;
};

export type Result = BottleResult | UserResult | EntityResult;

export type SearchSourceClient = {
  searchBottles: (
    query: string,
    limit: number,
    context: Context,
  ) => Promise<Bottle[]>;
  searchEntities: (
    query: string,
    limit: number,
    context: Context,
  ) => Promise<Entity[]>;
  searchUsers: (
    query: string,
    limit: number,
    context: Context,
  ) => Promise<User[]>;
};

const defaultSources: SearchSourceClient = {
  searchBottles: async (query, limit, context) => {
    const { routerClient } = await import("@peated/server/orpc/router");
    const data = await routerClient.bottles.list(
      { query, cursor: 1, limit, sort: "rank" },
      { context },
    );
    return data.results;
  },
  searchEntities: async (query, limit, context) => {
    const { routerClient } = await import("@peated/server/orpc/router");
    const data = await routerClient.entities.list(
      { query, cursor: 1, limit, sort: "rank" },
      { context },
    );
    return data.results;
  },
  searchUsers: async (query, limit, context) => {
    const { routerClient } = await import("@peated/server/orpc/router");
    const data = await routerClient.users.list(
      { query, cursor: 1, limit, sort: "name" },
      { context },
    );
    return data.results;
  },
};

const INCLUDE_LIST = ["bottles", "entities", "users"] as const;

function normalizeExactText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function isExactResult(query: string, result: Result) {
  const normalizedQuery = normalizeExactText(query);
  if (result.type === "entity") {
    return [result.ref.name, result.ref.shortName].some(
      (value) => value && normalizeExactText(value) === normalizedQuery,
    );
  }
  if (result.type === "user") {
    return normalizeExactText(result.ref.username) === normalizedQuery;
  }
  return [result.ref.fullName, result.ref.name].some(
    (value) => normalizeExactText(value) === normalizedQuery,
  );
}

export function blendResults(
  query: string,
  sourceResults: Result[][],
  limit: number,
) {
  const exactResults: Result[] = [];
  const remainingResults = sourceResults.map((source) => {
    const remaining: Result[] = [];
    for (const result of source) {
      if (isExactResult(query, result)) exactResults.push(result);
      else remaining.push(result);
    }
    return remaining;
  });

  const results = exactResults.slice(0, limit);
  for (let index = 0; results.length < limit; index += 1) {
    let added = false;
    for (const source of remainingResults) {
      const result = source[index];
      if (!result) continue;
      results.push(result);
      added = true;
      if (results.length === limit) break;
    }
    if (!added) break;
  }

  return results;
}

export function createSearchProcedure(sources: SearchSourceClient) {
  return procedure
    .route({
      method: "GET",
      path: "/search",
      summary: "Global search",
      description:
        "Search across bottles, entities, and users with configurable result types and limits",
      spec: (spec) => ({
        ...spec,
        operationId: "search",
      }),
    })
    .input(
      z.object({
        query: z.coerce
          .string()
          .describe("Plain-text search; operator syntax is not supported."),
        include: z.array(z.enum(INCLUDE_LIST)).default([...INCLUDE_LIST]),
        limit: z.coerce.number().gte(1).lte(100).default(25),
      }),
    )
    .output(
      z.object({
        query: z.string(),
        results: z.array(
          z.union([
            z.object({
              type: z.literal("bottle"),
              ref: BottleSchema,
            }),
            z.object({
              type: z.literal("entity"),
              ref: EntitySchema,
            }),
            z.object({
              type: z.literal("user"),
              ref: UserSchema,
            }),
          ]),
        ),
      }),
    )
    .handler(async function ({ input, context }) {
      const { query, include, limit } = input;
      const promises: Promise<Result[]>[] = [];

      if (include.includes("bottles")) {
        promises.push(
          sources
            .searchBottles(query, limit, context)
            .then((results) =>
              results.map((ref) => ({ type: "bottle" as const, ref })),
            ),
        );
      }

      if (include.includes("users") && context.user) {
        promises.push(
          sources
            .searchUsers(query, limit, context)
            .then((results) =>
              results.map((ref) => ({ type: "user" as const, ref })),
            ),
        );
      }

      if (include.includes("entities")) {
        promises.push(
          sources
            .searchEntities(query, limit, context)
            .then((results) =>
              results.map((ref) => ({ type: "entity" as const, ref })),
            ),
        );
      }

      const results = await Promise.all(promises);

      return {
        query,
        results: blendResults(query, results, limit),
      };
    });
}

export default createSearchProcedure(defaultSources);
