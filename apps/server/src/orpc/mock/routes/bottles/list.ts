import {
  includesQuery,
  mockBottleFor,
  mockBottles,
  mockFlightBottleIds,
  mockPage,
} from "@peated/server/orpc/mock/fixtures";
import { mockOS } from "@peated/server/orpc/mock/implementer";

export default mockOS.bottles.list.handler(
  async ({ input, context, errors }) => {
    if (input.filter === "following" && !context.user) {
      throw errors.UNAUTHORIZED();
    }

    const flightBottleIds = input.flight
      ? mockFlightBottleIds.get(input.flight)
      : undefined;
    let bottles = mockBottles.filter(
      (bottle) =>
        includesQuery(
          input.query,
          bottle.fullName,
          bottle.name,
          bottle.brand.name,
        ) &&
        (input.brand == null || bottle.brand.id === input.brand) &&
        (input.distiller == null ||
          bottle.distillers.some((entity) => entity.id === input.distiller)) &&
        (input.bottler == null || bottle.bottler?.id === input.bottler) &&
        (input.entity == null ||
          bottle.brand.id === input.entity ||
          bottle.bottler?.id === input.entity ||
          bottle.distillers.some((entity) => entity.id === input.entity)) &&
        (input.series == null || bottle.series?.id === input.series) &&
        (input.tag == null || bottle.suggestedTags?.includes(input.tag)) &&
        (input.flavorProfile == null ||
          bottle.flavorProfile === input.flavorProfile) &&
        (input.category == null || bottle.category === input.category) &&
        (input.age == null || bottle.statedAge === input.age) &&
        (input.minRating == null ||
          (bottle.avgRating ?? -1) >= input.minRating) &&
        (input.minScore == null || (bottle.avgScore ?? 0) >= input.minScore) &&
        (flightBottleIds === undefined ||
          flightBottleIds.includes(bottle.id)) &&
        (input.filter !== "following" ||
          bottle.brand.id === 9201 ||
          bottle.brand.id === 9202),
    );

    const direction = input.sort.startsWith("-") ? -1 : 1;
    const sort = input.sort.replace(/^-/, "");
    bottles = bottles.toSorted((left, right) => {
      switch (sort) {
        case "name":
          return direction * left.fullName.localeCompare(right.fullName);
        case "brand":
          return direction * left.brand.name.localeCompare(right.brand.name);
        case "age":
          return direction * ((left.statedAge ?? 0) - (right.statedAge ?? 0));
        case "rating":
          return direction * ((left.avgRating ?? -1) - (right.avgRating ?? -1));
        case "score":
          return direction * ((left.avgScore ?? 0) - (right.avgScore ?? 0));
        case "tastings":
          return direction * (left.totalTastings - right.totalTastings);
        case "rank":
          return 0;
        case "created":
        case "release":
          return direction * left.createdAt.localeCompare(right.createdAt);
        default:
          return 0;
      }
    });

    return {
      ...mockPage(
        bottles.map((bottle) => mockBottleFor(context.user, bottle)),
        input.cursor,
        input.limit,
      ),
      followedDistillerCount: input.filter === "following" ? 2 : null,
    };
  },
);
