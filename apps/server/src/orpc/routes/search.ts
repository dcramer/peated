import { procedure } from "@peated/server/orpc";
import { routerClient } from "@peated/server/orpc/router";
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

const INCLUDE_LIST = ["bottles", "entities", "users"] as const;

function sortResults(query: string, unsortedResults: Result[]) {
  const exactMatches: number[] = [];
  const lowerQuery = query.toLowerCase();
  unsortedResults.forEach((value, index) => {
    if (value.type === "entity") {
      if (
        value.ref.name.toLowerCase() === lowerQuery ||
        value.ref.shortName?.toLowerCase() === lowerQuery
      ) {
        exactMatches.push(index);
      }
    } else if (value.type === "user") {
      if (value.ref.username.toLowerCase() === lowerQuery) {
        exactMatches.push(index);
      }
    } else {
      if (
        value.ref.fullName.toLowerCase() === lowerQuery ||
        value.ref.name.toLowerCase() === lowerQuery
      ) {
        exactMatches.push(index);
      }
    }
  });

  const results = [...unsortedResults];
  exactMatches.forEach((resultIndex, index) => {
    const item = results.splice(resultIndex, 1);
    results.unshift(...item);
  });
  return results;
}

export default procedure
  .route({
    method: "GET",
    path: "/search",
    summary: "Global search",
    description:
      "Search across bottles, entities, and users with configurable result types and limits",
  })
  .input(
    z.object({
      query: z.coerce.string(),
      include: z.array(z.enum(INCLUDE_LIST)).default([...INCLUDE_LIST]),
      limit: z.coerce.number().lte(100),
    })
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
        ])
      ),
    })
  )
  .handler(async ({ input, context, errors }) => {
    const { query, include, limit } = input;
    const promises = [];

    if (include.includes("bottles")) {
      promises.push(
        routerClient.bottles
          .list(
            {
              query,
              cursor: 1,
              limit,
              sort: "rank",
            },
            { context }
          )
          .then((data: any) =>
            data.results.map((b: any) => ({ type: "bottle", ref: b }))
          )
          .catch(() => [])
      );
    }

    if (include.includes("users")) {
      promises.push(
        routerClient.users
          .list(
            {
              query,
              cursor: 1,
              sort: "name",
              limit,
            },
            { context }
          )
          .then((data: any) =>
            data.results.map((b: any) => ({ type: "user", ref: b }))
          )
          .catch(() => [])
      );
    }

    if (include.includes("entities")) {
      promises.push(
        routerClient.entities
          .list(
            {
              query,
              cursor: 1,
              limit,
              sort: "rank",
            },
            { context }
          )
          .then((data: any) =>
            data.results.map((b: any) => ({ type: "entity", ref: b }))
          )
          .catch(() => [])
      );
    }

    const results = await Promise.all(promises);

    const sortedResults = sortResults(
      query,
      results.reduce((prev: any[], cur: any[]) => [...prev, ...cur], [])
    );

    return {
      query,
      results: sortedResults,
    };
  });
