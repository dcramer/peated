import {
  includesQuery,
  isMockEntityFollowing,
  mockEntities,
  mockEntityFor,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import type { EntityKind } from "@peated/server/types";

type EntityListInput = {
  query: string;
  name?: string | null;
  owner?: number | null;
  country?: string | null;
  region?: string | null;
  filter: "all" | "following";
  sort: string;
  cursor: number;
  limit: number;
  kinds?: EntityKind[];
};

export function listEntityKind(
  kind: EntityKind,
  input: EntityListInput,
  signedIn = false,
) {
  return listEntities(input, kind, signedIn);
}

export function listEntities(
  input: EntityListInput,
  kind?: EntityKind,
  signedIn = false,
) {
  const direction = input.sort.startsWith("-") ? -1 : 1;
  const sort = input.sort.replace(/^-/, "");
  const entities = mockEntities
    .filter(
      (entity) =>
        (kind === undefined || entity.kind === kind) &&
        (input.kinds === undefined || input.kinds.includes(entity.kind)) &&
        (input.filter !== "following" || isMockEntityFollowing(entity.id)) &&
        (input.owner == null || entity.ownerId === input.owner) &&
        includesQuery(input.query, entity.name, entity.shortName) &&
        (input.name == null || entity.name === input.name) &&
        (input.country == null ||
          entity.country?.slug === input.country.toLowerCase() ||
          entity.country?.id === Number(input.country)) &&
        (input.region == null ||
          entity.region?.slug === input.region.toLowerCase() ||
          entity.region?.id === Number(input.region)),
    )
    .toSorted((left, right) => {
      switch (sort) {
        case "name":
          return direction * left.name.localeCompare(right.name);
        case "created":
          return direction * left.createdAt.localeCompare(right.createdAt);
        case "tastings":
          return direction * (left.totalTastings - right.totalTastings);
        case "bottles":
          return direction * (left.totalBottles - right.totalBottles);
        default:
          return 0;
      }
    })
    .map((entity) => mockEntityFor(signedIn, entity));

  return mockPage(entities, input.cursor, input.limit);
}
