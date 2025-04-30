import type { Bottle, Entity, User } from "@peated/server/types";
import { z } from "zod";
import { publicProcedure } from "../trpc";
import { bottleList } from "./bottleList";
import { entityList } from "./entityList";
import { userList } from "./userList";

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

export default publicProcedure
  .input(
    z.object({
      query: z.string(),
      include: z.array(z.enum(INCLUDE_LIST)).default([...INCLUDE_LIST]),
      limit: z.number().lte(100),
    }),
  )
  .query(async function ({ input: { query, include, limit }, ctx }) {
    const promises = [];

    if (include.includes("bottles"))
      promises.push(
        bottleList({
          input: {
            query,
            cursor: 1,
            limit,
            sort: "rank",
          },
          ctx,
        })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "bottle", ref: b })),
          )
          .catch(() => []),
      );

    if (include.includes("users"))
      promises.push(
        userList({
          input: {
            query,
            cursor: 1,
            sort: "name",
            limit,
          },
          ctx,
        })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "user", ref: b })),
          )
          .catch(() => []),
      );

    if (include.includes("entities"))
      promises.push(
        entityList({
          input: { query, cursor: 1, limit, sort: "rank" },
          ctx,
        })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "entity", ref: b })),
          )
          .catch(() => []),
      );

    const results = await Promise.all(promises);

    const sortedResults = sortResults(
      query,
      results.reduce((prev, cur) => [...prev, ...cur], []),
    );

    return {
      query,
      results: sortedResults,
    };
  });
