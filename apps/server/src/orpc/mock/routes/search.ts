import { SearchOutputSchema } from "@peated/server/orpc/contracts/search";
import type { MockOutputs } from "@peated/server/orpc/mock/contract";
import {
  includesQuery,
  mockBottleFor,
  mockBottles,
  mockEntities,
  mockEntityFor,
  mockFriendDetails,
  mockFriends,
  mockRegions,
  mockUser,
  mockUserDetails,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.search.handler(async ({ input, context }) => {
  if (input.suggestions === "only") {
    return SearchOutputSchema.parse({
      query: input.query,
      exact: null,
      groups: [],
      nearest: [],
    });
  }
  const groups: MockOutputs["search"]["groups"] = [];
  const entities = mockEntities.map((entity) =>
    mockEntityFor(Boolean(context.user), entity),
  );
  const bottles = mockBottles
    .filter((bottle) =>
      includesQuery(
        input.query,
        bottle.fullName,
        bottle.name,
        bottle.brand.name,
      ),
    )
    .map((bottle) => mockBottleFor(context.user, bottle));
  const matchingEntities = (
    predicate: (entity: (typeof mockEntities)[number]) => boolean,
  ) =>
    entities.filter(
      (entity) =>
        predicate(entity) &&
        includesQuery(input.query, entity.name, entity.shortName),
    );
  const entitiesByScope = {
    distilleries: matchingEntities((entity) => entity.kind === "distillery"),
    brands: matchingEntities((entity) => entity.kind === "brand"),
    bottlers: matchingEntities((entity) => entity.kind === "bottler"),
    companies: matchingEntities((entity) => entity.kind === "company"),
  } as const;
  const regions = mockRegions.filter((region) =>
    includesQuery(input.query, region.name, region.slug, region.country.name),
  );

  if (input.scopes.includes("bottles")) {
    groups.push({
      type: "bottles",
      hasMore: bottles.length > input.limit,
      results: bottles.slice(0, input.limit),
    });
  }
  if (input.scopes.includes("series")) {
    groups.push({ type: "series", hasMore: false, results: [] });
  }
  for (const scope of [
    "distilleries",
    "brands",
    "bottlers",
    "companies",
  ] as const) {
    if (input.scopes.includes(scope)) {
      const results = entitiesByScope[scope];
      groups.push({
        type: scope,
        hasMore: results.length > input.limit,
        results: results.slice(0, input.limit),
      });
    }
  }
  if (input.scopes.includes("regions")) {
    groups.push({
      type: "regions",
      hasMore: regions.length > input.limit,
      results: regions.slice(0, input.limit),
    });
  }

  const members = [
    {
      member: mockUser,
      totalTastings: mockUserDetails.stats.tastings,
    },
    {
      member: mockFriends[0]!,
      totalTastings: mockFriendDetails[0]!.stats.tastings,
    },
    {
      member: mockFriends[1]!,
      totalTastings: mockFriendDetails[1]!.stats.tastings,
    },
  ].filter(({ member }) => includesQuery(input.query, member.username));
  if (context.user && input.scopes.includes("members")) {
    groups.push({
      type: "members",
      hasMore: members.length > input.limit,
      results: members.slice(0, input.limit),
    });
  }

  const exactQuery = input.query.trim().toLowerCase();
  const exactBottle = bottles.find((bottle) =>
    [bottle.peatedId, bottle.fullName, bottle.name].some(
      (value) => value.toLowerCase() === exactQuery,
    ),
  );
  const entityMatchesSelectedScope = (entity: (typeof mockEntities)[number]) =>
    input.scopes.some((scope) => {
      switch (scope) {
        case "distilleries":
          return entity.kind === "distillery";
        case "brands":
          return entity.kind === "brand";
        case "bottlers":
          return entity.kind === "bottler";
        case "companies":
          return entity.kind === "company";
        case "bottles":
        case "series":
        case "members":
        case "regions":
          return false;
      }
    });
  const exactEntity = entities.find(
    (entity) =>
      entityMatchesSelectedScope(entity) &&
      [entity.peatedId, entity.name, entity.shortName].some(
        (value) => value?.toLowerCase() === exactQuery,
      ),
  );

  return SearchOutputSchema.parse({
    query: input.query,
    exact:
      input.scopes.includes("bottles") && exactBottle
        ? { type: "bottle", ref: { ...exactBottle, group: undefined } }
        : exactEntity
          ? { type: "entity", ref: exactEntity }
          : null,
    groups,
    nearest: [],
  });
});
