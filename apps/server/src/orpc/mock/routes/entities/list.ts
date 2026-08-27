import {
  includesQuery,
  mockEntities,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.entities.list.handler(async ({ input }) => {
  const type = input.type ?? input.searchContext?.type;
  const direction = input.sort.startsWith("-") ? -1 : 1;
  const sort = input.sort.replace(/^-/, "");
  const entities = mockEntities
    .filter(
      (entity) =>
        includesQuery(input.query, entity.name, entity.shortName) &&
        (input.name == null || entity.name === input.name) &&
        (input.country == null ||
          entity.country?.slug === input.country.toLowerCase() ||
          entity.country?.id === Number(input.country)) &&
        (input.region == null ||
          entity.region?.slug === input.region.toLowerCase() ||
          entity.region?.id === Number(input.region)) &&
        (type == null || entity.type.includes(type)) &&
        input.bottler == null,
    )
    .toSorted((left, right) => {
      switch (sort) {
        case "name":
          return direction * left.name.localeCompare(right.name);
        case "created":
          return direction * left.createdAt.localeCompare(right.createdAt);
        case "tastings":
          return direction * (left.totalTastings - right.totalTastings);
        case "rank":
          return 0;
        case "bottles":
          return direction * (left.totalBottles - right.totalBottles);
        default:
          return 0;
      }
    });

  return mockPage(entities, input.cursor, input.limit);
});
