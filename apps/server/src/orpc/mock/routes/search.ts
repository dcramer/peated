import type { MockOutputs } from "@peated/server/orpc/mock/contract";
import {
  includesQuery,
  mockBottleFor,
  mockEntity,
  mockUser,
  mockUserDetails,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

const scopeTotals = {
  bottles: 1,
  distillers: 1,
  brands: 1,
  bottlers: 0,
  blenders: 0,
  companies: 0,
  regions: 0,
} satisfies MockOutputs["search"]["scopeTotals"];

export default mockOS.search.handler(async ({ input, context }) => {
  const groups: MockOutputs["search"]["groups"] = [];
  const bottle = mockBottleFor(context.user);
  const bottleMatches = includesQuery(
    input.query,
    bottle.fullName,
    bottle.name,
  );
  const entityMatches = includesQuery(
    input.query,
    mockEntity.name,
    mockEntity.shortName,
  );
  const memberMatches = includesQuery(input.query, mockUser.username);

  if (input.scopes.includes("bottles")) {
    groups.push({
      type: "bottles",
      total: bottleMatches ? 1 : 0,
      results: bottleMatches ? [bottle] : [],
    });
  }
  if (input.scopes.includes("distillers")) {
    groups.push({
      type: "distillers",
      total: entityMatches ? 1 : 0,
      results: entityMatches ? [mockEntity] : [],
    });
  }
  if (input.scopes.includes("brands")) {
    groups.push({
      type: "brands",
      total: entityMatches ? 1 : 0,
      results: entityMatches ? [mockEntity] : [],
    });
  }
  if (input.scopes.includes("bottlers")) {
    groups.push({ type: "bottlers", total: 0, results: [] });
  }
  if (input.scopes.includes("blenders")) {
    groups.push({ type: "blenders", total: 0, results: [] });
  }
  if (input.scopes.includes("companies")) {
    groups.push({ type: "companies", total: 0, results: [] });
  }
  if (input.scopes.includes("regions")) {
    groups.push({ type: "regions", total: 0, results: [] });
  }
  if (context.user && input.scopes.includes("members")) {
    groups.push({
      type: "members",
      total: memberMatches ? 1 : 0,
      results: memberMatches
        ? [
            {
              member: mockUser,
              totalTastings: mockUserDetails.stats.tastings,
            },
          ]
        : [],
    });
  }

  const exactQuery = input.query.trim().toLowerCase();
  const exact =
    input.scopes.includes("bottles") &&
    [bottle.peatedId, bottle.fullName, bottle.name].some(
      (value) => value.toLowerCase() === exactQuery,
    )
      ? { type: "bottle" as const, ref: bottle }
      : input.scopes.some((scope) =>
            ["distillers", "brands"].includes(scope),
          ) &&
          [mockEntity.peatedId, mockEntity.name].some(
            (value) => value.toLowerCase() === exactQuery,
          )
        ? { type: "entity" as const, ref: mockEntity }
        : null;

  return {
    query: input.query,
    exact,
    groups,
    scopeTotals: context.user ? { ...scopeTotals, members: 1 } : scopeTotals,
    nearest: [],
  };
});
