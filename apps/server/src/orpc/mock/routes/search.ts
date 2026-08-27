import type { MockOutputs } from "@peated/server/orpc/mock/contract";
import {
  includesQuery,
  mockBottleFor,
  mockBottles,
  mockEntities,
  mockFriendDetails,
  mockFriends,
  mockRegions,
  mockUser,
  mockUserDetails,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.search.handler(async ({ input, context }) => {
  const groups: MockOutputs["search"]["groups"] = [];
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
    mockEntities.filter(
      (entity) =>
        predicate(entity) &&
        includesQuery(input.query, entity.name, entity.shortName),
    );
  const entitiesByScope = {
    distillers: matchingEntities((entity) => entity.type.includes("distiller")),
    brands: matchingEntities((entity) => entity.type.includes("brand")),
    bottlers: matchingEntities((entity) => entity.type.includes("bottler")),
    blenders: matchingEntities((entity) => entity.kind === "blender"),
    companies: matchingEntities((entity) => entity.kind === "company"),
  } as const;
  const regions = mockRegions.filter((region) =>
    includesQuery(input.query, region.name, region.slug, region.country.name),
  );

  if (input.scopes.includes("bottles")) {
    groups.push({
      type: "bottles",
      total: bottles.length,
      results: bottles.slice(0, input.limit),
    });
  }
  for (const scope of [
    "distillers",
    "brands",
    "bottlers",
    "blenders",
    "companies",
  ] as const) {
    if (input.scopes.includes(scope)) {
      const results = entitiesByScope[scope];
      groups.push({
        type: scope,
        total: results.length,
        results: results.slice(0, input.limit),
      });
    }
  }
  if (input.scopes.includes("regions")) {
    groups.push({
      type: "regions",
      total: regions.length,
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
      total: members.length,
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
        case "distillers":
          return entity.type.includes("distiller");
        case "brands":
          return entity.type.includes("brand");
        case "bottlers":
          return entity.type.includes("bottler");
        case "blenders":
          return entity.kind === "blender";
        case "companies":
          return entity.kind === "company";
        case "bottles":
        case "members":
        case "regions":
          return false;
      }
    });
  const exactEntity = mockEntities.find(
    (entity) =>
      entityMatchesSelectedScope(entity) &&
      [entity.peatedId, entity.name, entity.shortName].some(
        (value) => value?.toLowerCase() === exactQuery,
      ),
  );

  const scopeTotals: MockOutputs["search"]["scopeTotals"] = {
    bottles: mockBottles.length,
    distillers: mockEntities.filter((entity) =>
      entity.type.includes("distiller"),
    ).length,
    brands: mockEntities.filter((entity) => entity.type.includes("brand"))
      .length,
    bottlers: mockEntities.filter((entity) => entity.type.includes("bottler"))
      .length,
    blenders: mockEntities.filter((entity) => entity.kind === "blender").length,
    companies: mockEntities.filter((entity) => entity.kind === "company")
      .length,
    regions: mockRegions.length,
  };
  if (context.user) scopeTotals.members = 3;

  return {
    query: input.query,
    exact:
      input.scopes.includes("bottles") && exactBottle
        ? { type: "bottle", ref: exactBottle }
        : exactEntity
          ? { type: "entity", ref: exactEntity }
          : null,
    groups,
    scopeTotals,
    nearest: [],
  };
});
